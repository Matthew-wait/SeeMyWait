param([int]$BatchSize = 500)

$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskLog = Join-Path $taskRoot 'geog-backfill-progress.jsonl'
$taskEnv = @{}
Get-Content -LiteralPath (Join-Path $taskRoot 'apps/web/.env') | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        $taskEnv[$Matches[1]] = $Matches[2].Trim().Trim('"', "'")
    }
}
if (-not $taskEnv['SUPABASE_Token_URL']) { throw 'SUPABASE_Token_URL is empty' }
$taskHeaders = @{ Authorization = 'Bearer ' + $taskEnv['SUPABASE_Token_URL'] }
$taskUri = 'https://api.supabase.com/v1/projects/ziisjgtvqmturpljnvfh/database/query'
$taskMutex = New-Object System.Threading.Mutex($false, 'SeeMyWaitGeogBackfill')
if (-not $taskMutex.WaitOne(0)) { throw 'A geo backfill runner is already active' }
try {
    do {
        $taskTimer = [System.Diagnostics.Stopwatch]::StartNew()
        # Each request commits one batch. Stop on any uncertain outcome; do not blindly retry.
        $taskQuery = "set local statement_timeout='30s'; select public.backfill_clinics_geog_batch($BatchSize) as rows_updated;"
        $taskBody = @{ query = $taskQuery } | ConvertTo-Json
        $taskResult = Invoke-RestMethod -Uri $taskUri -Method Post -Headers $taskHeaders -ContentType 'application/json' -Body $taskBody -TimeoutSec 60
        $taskRows = @($taskResult)[0].rows_updated
        if ($null -eq $taskRows) { throw 'Missing rows_updated in backfill response' }
        $taskRows = [int]$taskRows
        @{ time = [DateTime]::UtcNow.ToString('o'); pid = $PID; rows_updated = $taskRows; elapsed_ms = $taskTimer.ElapsedMilliseconds; complete = ($taskRows -lt $BatchSize) } |
            ConvertTo-Json -Compress | Add-Content -LiteralPath $taskLog
    } while ($taskRows -eq $BatchSize)
} catch {
    # Record only a sanitized message; never log request headers or credentials.
    @{ time = [DateTime]::UtcNow.ToString('o'); pid = $PID; error = $_.Exception.Message; stopped = $true } |
        ConvertTo-Json -Compress | Add-Content -LiteralPath $taskLog
    throw
} finally {
    $taskMutex.ReleaseMutex()
    $taskMutex.Dispose()
}
