@echo off
REM Use PHP 8.3+ from repo root .env (PHP_BINARY), not XAMPP's default php 8.2.
cd /d "%~dp0.."
node scripts\artisan.cjs %*
