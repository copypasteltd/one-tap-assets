param([switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
& (Join-Path $PSScriptRoot 'bootstrap-native.ps1') -Postgres
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if (-not $SkipInstall) {
    & (Join-Path $PSScriptRoot 'run.ps1') install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
& (Join-Path $PSScriptRoot 'run.ps1') exec tsx scripts/dev-setup.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& (Join-Path $PSScriptRoot 'run.ps1') delivery:build --skip-mini
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host 'Local setup complete. Run: .\scripts\run.ps1 doctor'
Write-Host 'Start backend: .\scripts\run.ps1 local:start'
Write-Host 'Start shared-screen replay: .\scripts\run.ps1 preview:serve'
