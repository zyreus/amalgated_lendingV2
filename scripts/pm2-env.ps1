# Project-local PM2 home (avoids broken Windows named-pipe collisions in %USERPROFILE%\.pm2)
$repoRoot = Split-Path -Parent $PSScriptRoot
$env:PM2_HOME = Join-Path $repoRoot '.pm2-home'
New-Item -ItemType Directory -Force -Path $env:PM2_HOME | Out-Null
$env:PM2_DISABLE_MONIT = 'true'
$env:PM2_NO_INTERACTION = '1'
