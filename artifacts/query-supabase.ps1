param([Parameter(Mandatory=$true)][string]$SqlFile)
$ErrorActionPreference='Stop'
$credentialLine=Get-Content apps/web/.env | Where-Object {$_ -match '^\s*SUPABASE_Token_URL\s*='} | Select-Object -First 1
$taskCredential=($credentialLine -split '=',2)[1].Trim().Trim('"',"'")
if(-not $taskCredential){throw 'Supabase management credential unavailable'}
$taskQuery=[string](Get-Content -Raw -LiteralPath $SqlFile)
$taskBody=@{query=$taskQuery}|ConvertTo-Json -Compress
Invoke-RestMethod -Uri 'https://api.supabase.com/v1/projects/ziisjgtvqmturpljnvfh/database/query' -Method Post -Headers @{Authorization="Bearer $taskCredential"} -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($taskBody)) -TimeoutSec 90 | ConvertTo-Json -Depth 12
