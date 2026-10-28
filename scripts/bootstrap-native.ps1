param([switch]$Postgres)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
$downloadRoot = Join-Path $projectRoot 'runtime/downloads'
$toolRoot = Join-Path $projectRoot 'runtime/tools'
New-Item -ItemType Directory -Force -Path $downloadRoot,$toolRoot | Out-Null
if (-not (Test-Path (Join-Path $toolRoot 'node/node.exe'))) {
  $releases = Invoke-RestMethod 'https://nodejs.org/dist/index.json'
  $release = $releases | Where-Object { $_.version -like 'v24.*' -and $_.lts } | Select-Object -First 1
  $archiveName = "node-$($release.version)-win-x64.zip"
  $archive = Join-Path $downloadRoot $archiveName
  Invoke-WebRequest "https://nodejs.org/dist/$($release.version)/$archiveName" -OutFile $archive
  $sums = (Invoke-WebRequest "https://nodejs.org/dist/$($release.version)/SHASUMS256.txt").Content
  $expected = ($sums -split "`n" | Where-Object { $_ -match "  $([regex]::Escape($archiveName))$" }).Split(' ')[0]
  if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'Node download checksum mismatch' }
  Expand-Archive -LiteralPath $archive -DestinationPath $toolRoot
  Rename-Item -LiteralPath (Join-Path $toolRoot "node-$($release.version)-win-x64") -NewName 'node'
  @{version=$release.version;source="https://nodejs.org/dist/$($release.version)/$archiveName";sha256=$expected} | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $toolRoot 'node-source.json')
}
& (Join-Path $toolRoot 'node/node.exe') --version
if ($Postgres -and -not (Test-Path (Join-Path $toolRoot 'pgsql/bin/postgres.exe'))) {
  # EDB's official native PostgreSQL distribution. No service/VM/container installation.
  $pgVersion = '17.6-1'
  $pgUrl = "https://get.enterprisedb.com/postgresql/postgresql-$pgVersion-windows-x64-binaries.zip"
  $pgArchive = Join-Path $downloadRoot "postgresql-$pgVersion.zip"
  Invoke-WebRequest $pgUrl -OutFile $pgArchive
  Expand-Archive -LiteralPath $pgArchive -DestinationPath $toolRoot
  @{version=$pgVersion;source=$pgUrl;sha256=(Get-FileHash -LiteralPath $pgArchive -Algorithm SHA256).Hash.ToLowerInvariant();note='Download hash recorded, publisher checksum not independently provided'} | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $toolRoot 'postgres-source.json')
}
