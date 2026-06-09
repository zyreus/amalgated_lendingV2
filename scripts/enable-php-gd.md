# Enable PHP GD (Windows)

SOA PDFs need the **GD** extension in the PHP binary that runs the Laravel API.

This project uses **PHP 8.3 from WinGet** (`PHP_BINARY` in repo root `.env`), started by PM2 as `amalgated-backend` — **not** XAMPP’s default `php` on PATH.

## Steps (required for SOA PDFs)

1. Open the PHP ini reported by your API binary:
   ```powershell
   & $env:PHP_BINARY --ini
   ```
   Typical path:
   `C:\Users\<you>\AppData\Local\Microsoft\WinGet\Packages\PHP.PHP.8.3_...\php.ini`
2. Find `;extension=gd` and change it to `extension=gd`.
3. Verify:
   ```powershell
   & $env:PHP_BINARY -m | findstr /i gd
   ```
4. Restart the API:
   ```powershell
   npm run pm2:restart -- amalgated-backend amalgated-queue
   node scripts/artisan.cjs cache:clear
   ```

## XAMPP / Apache (optional)

If you also serve PHP through XAMPP or Laragon, enable `extension=gd` in that stack’s `php.ini` and restart Apache. That does **not** affect SOA PDFs unless the API itself runs under that PHP build.

The app falls back to a **text-only letterhead** when GD is missing, but enabling GD restores logo images in PDFs.
