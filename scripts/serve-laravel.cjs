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

const MIN_PHP_MAJOR = 8
const MIN_PHP_MINOR = 2

function parsePhpVersion(text) {
  const match = String(text || '').match(/PHP\s+(\d+)\.(\d+)\.(\d+)/i)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

function isSupportedPhp(version) {
  if (!version) return false
  if (version.major > MIN_PHP_MAJOR) return true
  if (version.major < MIN_PHP_MAJOR) return false
  return version.minor >= MIN_PHP_MINOR
}

function resolvePhpVersion(phpBinary) {
  return new Promise((resolve) => {
    const probe = spawn(phpBinary, ['-v'], { shell: false })
    let out = ''
    let err = ''
    probe.stdout.on('data', (chunk) => {
      out += String(chunk || '')
    })
    probe.stderr.on('data', (chunk) => {
      err += String(chunk || '')
    })
    probe.on('error', () => resolve({ ok: false, version: null, output: '' }))
    probe.on('exit', () => {
      const output = `${out}\n${err}`.trim()
      resolve({ ok: true, version: parsePhpVersion(output), output })
    })
  })
}

async function main() {
  clearBindPort()
  clearStartStatus()
  writeStartStatus({ state: 'starting' })
  const php = process.env.PHP_BINARY || 'php'
  const phpCheck = await resolvePhpVersion(php)
  if (!phpCheck.ok || !isSupportedPhp(phpCheck.version)) {
    const detected = phpCheck.version
      ? `${phpCheck.version.major}.${phpCheck.version.minor}.${phpCheck.version.patch}`
      : 'unknown'
    process.stderr.write(
      `Laravel in amalgated-lending-api requires PHP ${MIN_PHP_MAJOR}.${MIN_PHP_MINOR}+.\n` +
        `Detected PHP version: ${detected} (binary: ${php}).\n` +
        `Set PHP_BINARY to a PHP ${MIN_PHP_MAJOR}.${MIN_PHP_MINOR}+ executable and retry.\n`,
    )
    writeStartStatus({
      state: 'failed',
      reason: `PHP ${MIN_PHP_MAJOR}.${MIN_PHP_MINOR}+ is required; detected ${detected} (${php}).`,
      code: 'UNSUPPORTED_PHP',
    })
    process.exit(1)
  }
  const memoryLimit = process.env.LARAVEL_PHP_MEMORY_LIMIT || '256M'
  const runtimePhpFlags = ['-d', `memory_limit=${memoryLimit}`]
  const preferred = Math.max(8001, parseInt(getLaravelPort(), 10) || 8001)
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
