param([ValidateRange(1,500)][int]$BatchSize = 500, [switch]$ResetBatchSettings)

$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskLog = Join-Path $taskRoot 'geog-state-backfill-progress.jsonl'
$taskStatusPath = Join-Path $taskRoot 'geog-state-backfill-status.json'
$taskQueue = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'geog-state-queue.json') | ConvertFrom-Json
if ($taskQueue.Count -ne 56) { throw 'Expected exactly 56 jurisdictions' }
$taskEnv = @{}
Get-Content -LiteralPath (Join-Path $taskRoot 'apps/web/.env') | ForEach-Object {
    if ($_ -match '^\s*(SUPABASE_Token_URL)\s*=\s*(.*)$') {
        $taskEnv[$Matches[1]] = $Matches[2].Trim().Trim('"', "'")
    }
}
if (-not $taskEnv['SUPABASE_Token_URL']) { throw 'SUPABASE_Token_URL is empty' }
$taskHeaders = @{ Authorization = 'Bearer ' + $taskEnv['SUPABASE_Token_URL'] }
$taskUri = 'https://api.supabase.com/v1/projects/ziisjgtvqmturpljnvfh/database/query'
$taskStatus = @{ pid = $PID; running = $true; complete = $false; current_state = $null; rows_updated = 0; completed = @(); started_at = [DateTime]::UtcNow.ToString('o') }
if (Test-Path -LiteralPath $taskStatusPath) {
    $taskSavedStatus = Get-Content -Raw -LiteralPath $taskStatusPath | ConvertFrom-Json
    if ($taskSavedStatus.complete) { Write-Output 'The state backfill is already complete'; exit 0 }
    foreach ($taskProperty in $taskSavedStatus.PSObject.Properties) {
        $taskStatus[$taskProperty.Name] = $taskProperty.Value
    }
    $taskStatus.pid = $PID
    $taskStatus.running = $true
    $taskStatus.Remove('error')
    $taskStatus.resumed_at = [DateTime]::UtcNow.ToString('o')
}

function Save-Status {
    $taskStatus.updated_at = [DateTime]::UtcNow.ToString('o')
    $taskStatus | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath ($taskStatusPath + '.tmp')
    Move-Item -LiteralPath ($taskStatusPath + '.tmp') -Destination $taskStatusPath -Force
}
function Write-Event($entry) {
    $entry.time = [DateTime]::UtcNow.ToString('o')
    $entry.pid = $PID
    $entry | ConvertTo-Json -Compress -Depth 8 | Add-Content -LiteralPath $taskLog
}
function Invoke-Database([string]$query) {
    $taskBody = @{ query = $query } | ConvertTo-Json
    $taskResult = Invoke-RestMethod -Uri $taskUri -Method Post -Headers $taskHeaders -ContentType 'application/json' -Body $taskBody -TimeoutSec 150
    return @($taskResult)[0]
}
function Process-State($code) {
    $taskLabel = if ($null -eq $code) { '(no state)' } else { $code }
    $taskStateFilter = if ($null -eq $code) { 'state is null' } else { "state = '$code'" }
    $taskEligible = "$taskStateFilter and geog is null and latitude between -90 and 90 and longitude between -180 and 180"
    $taskCity = $null
    $taskId = $null
    $taskStateRows = 0
    $taskCurrentBatch = $BatchSize
    $taskInitialTimeout = 30
    if ($taskStatus.current_state -eq $taskLabel -and $taskStatus.last_id -and $taskStatus.completed -notcontains $taskLabel) {
        $taskCity = $taskStatus.last_city
        $taskId = $taskStatus.last_id
        $taskStateRows = [int]$taskStatus.state_rows_updated
        # Older checkpoints did not store adaptive settings. Use the conservative
        # settings already reached by the paused NY runner rather than repeating timeouts.
        $taskCurrentBatch = if ($taskStatus.batch_size) { [int]$taskStatus.batch_size } else { 50 }
        $taskInitialTimeout = if ($taskStatus.timeout_seconds) { [int]$taskStatus.timeout_seconds } else { 120 }
        if ($ResetBatchSettings) { $taskCurrentBatch = $BatchSize; $taskInitialTimeout = 30 }
    }
    $taskStatus.current_state = $taskLabel
    $taskStatus.last_city = $taskCity
    $taskStatus.last_id = $taskId
    $taskStatus.state_rows_updated = $taskStateRows
    Save-Status
    Write-Event @{ event = 'state_started'; state = $taskLabel }
    while ($true) {
        $taskNonNullCursor = ''
        $taskNullCursor = ''
        if ($taskId) {
            if ($null -eq $taskCity) {
                $taskNonNullCursor = 'and false'
                $taskNullCursor = "and id > '$taskId'::uuid"
            } else {
                $taskCitySql = $taskCity.Replace("'", "''")
                # Keep NULL cities in a separate index scan. Combining them with OR
                # prevents the (state, city) index from seeking to the saved city.
                $taskNonNullCursor = "and city >= '$taskCitySql' and (city > '$taskCitySql' or id > '$taskId'::uuid)"
            }
        }
        for ($taskAttempt = 0; ; $taskAttempt++) {
            $taskTimeout = [Math]::Min(120, $taskInitialTimeout * [Math]::Pow(2,$taskAttempt))
            $taskQuery = @"
set local statement_timeout='${taskTimeout}s';
with candidates as materialized (
  (select id,city from public.clinics
   where $taskEligible and city is not null $taskNonNullCursor
   order by city,id limit $taskCurrentBatch)
  union all
  (select id,city from public.clinics
   where $taskEligible and city is null $taskNullCursor
   order by id limit $taskCurrentBatch)
), batch as materialized (
  select id,city from candidates order by city nulls last,id limit $taskCurrentBatch
), updated as (
  update public.clinics c
  set geog=ST_SetSRID(ST_MakePoint(c.longitude,c.latitude),4326)::geography
  from batch b where c.id=b.id and c.geog is null
  returning c.id
)
select (select count(*) from updated) as rows_updated,
       (select id from batch order by city desc nulls first,id desc limit 1) as last_id,
       (select city from batch order by city desc nulls first,id desc limit 1) as last_city;
"@
            $taskTimer = [System.Diagnostics.Stopwatch]::StartNew()
            try {
                $taskResponse = Invoke-Database $taskQuery
                if ($null -eq $taskResponse.rows_updated) { throw 'Missing rows_updated in state batch response' }
                break
            } catch {
                $taskDetail = $_.ErrorDetails.Message
                # A confirmed SQL statement timeout rolls back this request, so a smaller retry is safe.
                # Connection errors or unknown commit outcomes stop the runner instead.
                if ($taskDetail -match '57014' -and $taskAttempt -lt 2) {
                    $taskCurrentBatch = [Math]::Max(50,[int][Math]::Floor($taskCurrentBatch / 2))
                    Write-Event @{ event = 'timeout_retry'; state = $taskLabel; batch_size = $taskCurrentBatch; next_timeout_seconds = [Math]::Min(120,$taskTimeout * 2) }
                    continue
                }
                throw
            }
        }
        $taskRows = [int]$taskResponse.rows_updated
        $taskStateRows += $taskRows
        $taskStatus.rows_updated += $taskRows
        $taskStatus.state_rows_updated = $taskStateRows
        $taskId = $taskResponse.last_id
        $taskCity = $taskResponse.last_city
        $taskStatus.last_id = $taskId
        $taskStatus.last_city = $taskCity
        $taskStatus.batch_size = $taskCurrentBatch
        $taskStatus.timeout_seconds = $taskTimeout
        $taskInitialTimeout = $taskTimeout
        Save-Status
        Write-Event @{ event = 'batch_committed'; state = $taskLabel; rows_updated = $taskRows; state_rows_updated = $taskStateRows; elapsed_ms = $taskTimer.ElapsedMilliseconds; last_id = $taskId }
        if ($taskRows -lt $taskCurrentBatch) {
            $taskRemaining = Invoke-Database "set local statement_timeout='120s'; select exists(select 1 from public.clinics where $taskEligible) as pending;"
            if ($null -eq $taskRemaining.pending) { throw 'Missing verification response' }
            if (-not $taskRemaining.pending) { break }
            # Sweep again for rows inserted behind the cursor while this state was running.
            $taskCity = $null
            $taskId = $null
        }
    }
    $taskStatus.completed += $taskLabel
    Save-Status
    Write-Event @{ event = 'state_completed'; state = $taskLabel; rows_updated = $taskStateRows; verified_no_pending = $true }
}

$taskMutex = New-Object System.Threading.Mutex($false, 'SeeMyWaitGeogBackfill')
try { $taskAcquired = $taskMutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $taskAcquired = $true }
if (-not $taskAcquired) { throw 'Another geo backfill runner is active' }
try {
    Save-Status
    foreach ($taskEntry in $taskQueue) {
        if ($taskStatus.completed -notcontains $taskEntry.state) { Process-State $taskEntry.state }
    }
    if ($taskStatus.completed -notcontains '(no state)') { Process-State $null }
    # A final pass also covers concurrent imports into previously completed states.
    foreach ($taskEntry in $taskQueue) {
        $taskCheck = Invoke-Database "set local statement_timeout='120s'; select exists(select 1 from public.clinics where state='$($taskEntry.state)' and geog is null and latitude between -90 and 90 and longitude between -180 and 180) as pending;"
        if ($null -eq $taskCheck.pending) { throw 'Missing final verification response' }
        if ($taskCheck.pending) {
            $taskStatus.completed = @($taskStatus.completed | Where-Object { $_ -ne $taskEntry.state })
            Process-State $taskEntry.state
        }
    }
    $taskStatus.complete = $true
    $taskStatus.running = $false
    $taskStatus.current_state = $null
    Save-Status
    Write-Event @{ event = 'queue_completed'; jurisdictions = 56; no_state_processed = $true; rows_updated = $taskStatus.rows_updated }
} catch {
    $taskStatus.running = $false
    $taskStatus.error = $_.Exception.Message
    Save-Status
    Write-Event @{ event = 'stopped'; state = $taskStatus.current_state; error = $_.Exception.Message }
    throw
} finally {
    $taskMutex.ReleaseMutex()
    $taskMutex.Dispose()
}
