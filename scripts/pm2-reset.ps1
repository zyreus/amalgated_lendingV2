# Free Windows pipe \\.\pipe\rpc.sock (fixes EPERM). Do NOT run `pm2 kill` first — it spawns another daemon.
$ErrorActionPreference = 'SilentlyContinue'
$repoRoot = Split-Path $PSScriptRoot -Parent
$pm2Home = Join-Path $repoRoot '.pm2-home'
$globalHome = Join-Path $env:USERPROFILE '.pm2'

function Stop-Pm2Processes {
  Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -and (
      $_.CommandLine -like '*\pm2\lib\Daemon.js*' -or
      $_.CommandLine -like '*\pm2\lib\binaries\CLI.js*' -or
      $_.CommandLine -like '*\pm2\lib\ProcessContainer*' -or
      $_.CommandLine -like '*PM2*God*'
    )
  } | ForEach-Object {
    Write-Host "Stopping PM2 process PID $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Clear-Pm2Home($home) {
  if (-not $home -or -not (Test-Path $home)) { return }
  foreach ($name in @('pm2.pid', 'rpc.sock', 'pub.sock', 'touch', '.pm2-windows-patched')) {
    Remove-Item (Join-Path $home $name) -Force -ErrorAction SilentlyContinue
  }
}

Stop-Pm2Processes
Start-Sleep -Seconds 2
Stop-Pm2Processes

Clear-Pm2Home $pm2Home
Clear-Pm2Home $globalHome

$env:PM2_HOME = $pm2Home
New-Item -ItemType Directory -Path $pm2Home -Force | Out-Null

Write-Host "PM2 reset complete. Run: npm run pm2:start"
