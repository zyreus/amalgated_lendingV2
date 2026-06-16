/**
 * Launches Laravel API with a cwd that does not depend on shell `cd` (Windows-safe).
 * API lives at: amalgated-lending/amalgated-lending-api (relative to this repo root).
 *
 * Skips ports where something else answers (GET /api/v1/health is not this app) and
 * binds the next free port in range so duplicate local runs can move to +1 ports.
 */
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const { getLaravelPort } = require('./laravel-dev-port.cjs')
const { checkAmalgatedHealth } = require('./laravel-health.cjs')
const {
  writeBindPort,
  clearBindPort,
  clearStartStatus,
  writeStartStatus,
} = require('./laravel-active-port.cjs')
const { loadDotenvLite } = require('./load-dotenv-lite.cjs')
const {
  MIN_PHP_MAJOR,
  MIN_PHP_MINOR,
  resolvePhpBinary,
} = require('./resolve-php-binary.cjs')

const apiDir = path.resolve(__dirname, '..', 'amalgated-lending-api')
const artisan = path.join(apiDir, 'artisan')
const routerScript = path.join(apiDir, 'server-router.php')
const rootEnv = path.resolve(__dirname, '..', '.env')
const RANGE = 40

loadDotenvLite(rootEnv)

if (!fs.existsSync(artisan)) {
  process.stderr.write(
    `Laravel not found. Expected artisan at:\n  ${artisan}\n`,
  )
  process.exit(1)
}
if (!fs.existsSync(routerScript)) {
  process.stderr.write(
    `Laravel router not found. Expected router at:\n  ${routerScript}\n`,
  )
  process.exit(1)
}

async function main() {
  clearBindPort()
  clearStartStatus()
  writeStartStatus({ state: 'starting' })
  const resolved = await resolvePhpBinary()
  const php = resolved.binary
  if (!php) {
    const detected = resolved.version
      ? `${resolved.version.major}.${resolved.version.minor}.${resolved.version.patch}`
      : 'unknown'
    process.stderr.write(
      `Laravel in amalgated-lending-api requires PHP ${MIN_PHP_MAJOR}.${MIN_PHP_MINOR}+.\n` +
        `Detected PHP version: ${detected} (default \`php\` on PATH is too old).\n` +
        `Install PHP ${MIN_PHP_MAJOR}.${MIN_PHP_MINOR}+ (e.g. winget install PHP.PHP.8.3) or set PHP_BINARY in .env to your php.exe path.\n`,
    )
    writeStartStatus({
      state: 'failed',
      reason: `PHP ${MIN_PHP_MAJOR}.${MIN_PHP_MINOR}+ is required; detected ${detected}.`,
      code: 'UNSUPPORTED_PHP',
    })
    process.exit(1)
  }
  if (!process.env.PHP_BINARY) {
    process.stderr.write(`Using PHP ${resolved.version.major}.${resolved.version.minor}.${resolved.version.patch} (${php})\n`)
  }
  const memoryLimit = process.env.LARAVEL_PHP_MEMORY_LIMIT || '256M'
  const runtimePhpFlags = ['-d', `memory_limit=${memoryLimit}`]
  const preferred = Math.max(8000, parseInt(getLaravelPort(), 10) || 8000)
  const end = preferred + RANGE

  for (let p = preferred; p <= end; p++) {
    const st = await checkAmalgatedHealth(p)
    if (st === 'ok') {
      writeBindPort(p)
      writeStartStatus({ state: 'ready', port: p, reused: true })
      process.stderr.write(
        `Laravel amalgated-lending-api already healthy on http://127.0.0.1:${p} — skipping duplicate php artisan serve.\n`,
      )
      process.exit(0)
    }
    if (st === 'bad') {
      process.stderr.write(
        `Port ${p} is in use by another app (health check failed); trying next port…\n`,
      )
      continue
    }
    writeBindPort(p)
    process.stderr.write(
      `Laravel dev server → http://127.0.0.1:${p} (auto-fallback enabled; set LARAVEL_PORT in .env to change the start port)\n`,
    )
    const child = spawn(
      php,
      [
        ...runtimePhpFlags,
        '-S',
        `127.0.0.1:${p}`,
        '-t',
        'public',
        'server-router.php',
      ],
      { cwd: apiDir, stdio: 'inherit', shell: false },
    )
    child.on('exit', (code) => {
      if ((code ?? 1) !== 0) {
        writeStartStatus({
          state: 'failed',
          reason: `php artisan serve exited with code ${code ?? 1}.`,
          code: 'LARAVEL_EXITED',
        })
      }
      process.exit(code ?? 1)
    })
    return
  }

  writeStartStatus({
    state: 'failed',
    reason: `No free port found from ${preferred} to ${end}.`,
    code: 'NO_FREE_PORT',
  })
  process.stderr.write(
    `No free port found from ${preferred} to ${end} (all in use or wrong app). Stop other servers or change LARAVEL_PORT.\n`,
  )
  process.exit(1)
}

main().catch((err) => {
  writeStartStatus({
    state: 'failed',
    reason: String(err && err.message ? err.message : err),
    code: 'STARTUP_EXCEPTION',
  })
  process.stderr.write(String(err && err.stack ? err.stack : err) + '\n')
  process.exit(1)
})
