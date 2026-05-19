# Use PHP 8.3+ from repo root .env (PHP_BINARY), not XAMPP's default php 8.2.
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot
& node (Join-Path $repoRoot 'scripts\artisan.cjs') @args
exit $LASTEXITCODE
