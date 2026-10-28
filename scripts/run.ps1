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
$pnpmScript = Join-Path $projectRoot 'runtime/tools/package-manager/node_modules/pnpm/bin/pnpm.cjs'
if (-not (Test-Path -LiteralPath $pnpmScript)) {
  & (Join-Path $nodeRoot 'npm.cmd') install --prefix (Join-Path $projectRoot 'runtime/tools/package-manager') --ignore-scripts --no-audit --no-fund pnpm@10.13.1
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
& (Join-Path $nodeRoot 'node.exe') $pnpmScript @TaskArgs
exit $LASTEXITCODE
