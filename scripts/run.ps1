param([Parameter(ValueFromRemainingArguments=$true)][string[]]$TaskArgs)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
$nodeRoot = Join-Path $projectRoot 'runtime/tools/node'
if (-not (Test-Path (Join-Path $nodeRoot 'node.exe'))) { throw 'Run scripts/bootstrap-native.ps1 first.' }
$env:PATH = "$nodeRoot;$env:PATH"
$env:TEMP = Join-Path $projectRoot 'runtime/tmp'
$env:TMP = $env:TEMP
$env:npm_config_cache = Join-Path $projectRoot 'runtime/npm-cache'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $projectRoot 'runtime/playwright-browsers'
New-Item -ItemType Directory -Force -Path $env:TEMP | Out-Null
$directTasks = @{
  'doctor' = 'scripts/delivery/doctor.ts'
  'local:start' = 'scripts/delivery/start.ts'
  'preview:serve' = 'scripts/delivery/start.ts'
  'delivery:build' = 'scripts/delivery/build.ts'
  'delivery:package' = 'scripts/delivery/package.ts'
}
if ($TaskArgs.Count -gt 0 -and $directTasks.ContainsKey($TaskArgs[0])) {
  $directArgs = @()
  if ($TaskArgs[0] -eq 'preview:serve') { $directArgs += '--preview-only' }
  if ($TaskArgs.Count -gt 1) { $directArgs += $TaskArgs[1..($TaskArgs.Count - 1)] }
  & (Join-Path $nodeRoot 'node.exe') --env-file-if-exists=.env.local --import tsx $directTasks[$TaskArgs[0]] @directArgs
  exit $LASTEXITCODE
}
$pnpmScript = Join-Path $projectRoot 'runtime/tools/package-manager/node_modules/pnpm/bin/pnpm.cjs'
if (-not (Test-Path -LiteralPath $pnpmScript)) {
  & (Join-Path $nodeRoot 'npm.cmd') install --prefix (Join-Path $projectRoot 'runtime/tools/package-manager') --ignore-scripts --no-audit --no-fund pnpm@10.13.1
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
& (Join-Path $nodeRoot 'node.exe') --env-file-if-exists=.env.local $pnpmScript @TaskArgs
exit $LASTEXITCODE
