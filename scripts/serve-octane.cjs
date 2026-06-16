/**
 * Laravel Octane via RoadRunner (Windows-safe).
 * `php artisan octane:start` needs pcntl signals; native Windows uses rr.exe directly.
 */
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const { getOctanePort } = require('./laravel-dev-port.cjs')
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
const rrConfig = path.join(apiDir, '.rr.yaml')
const rrBinary = path.join(apiDir, 'vendor', 'bin', 'rr.exe')
const workerScript = path.join(apiDir, 'vendor', 'bin', 'roadrunner-worker')
const rootEnv = path.resolve(__dirname, '..', '.env')
const RANGE = 40

loadDotenvLite(rootEnv)

async function isOctaneReady(port) {
  const health = await checkAmalgatedHealth(port)
  if (health !== 'ok') return false
  try {
    const res = await fetch(`http://127.0.0.1:${port}/test`, {
      signal: AbortSignal.timeout(2500),
    })
    return res.status === 200
  } catch {
    return false
  }
}

if (!fs.existsSync(rrBinary)) {
  process.stderr.write(
    `RoadRunner binary not found. Run from amalgated-lending-api:\n` +
      `  php vendor/bin/rr get-binary --location=vendor/bin --no-config -n\n`,
  )
  process.exit(1)
}
if (!fs.existsSync(rrConfig)) {
  process.stderr.write(`Missing RoadRunner config: ${rrConfig}\n`)
  process.exit(1)
}
if (!fs.existsSync(workerScript)) {
  process.stderr.write(`Missing Octane worker: ${workerScript}\n`)
  process.exit(1)
}

async function main() {
  clearBindPort()
  clearStartStatus()
  writeStartStatus({ state: 'starting', server: 'octane-roadrunner' })

  const resolved = await resolvePhpBinary()
  const php = resolved.binary
  if (!php) {
    const detected = resolved.version
      ? `${resolved.version.major}.${resolved.version.minor}.${resolved.version.patch}`
      : 'unknown'
    process.stderr.write(
      `Laravel Octane requires PHP ${MIN_PHP_MAJOR}.${MIN_PHP_MINOR}+.\n` +
        `Detected PHP version: ${detected}.\n` +
        `Set PHP_BINARY in .env to your php.exe path.\n`,
    )
    writeStartStatus({
      state: 'failed',
      reason: `PHP ${MIN_PHP_MAJOR}.${MIN_PHP_MINOR}+ is required; detected ${detected}.`,
      code: 'UNSUPPORTED_PHP',
    })
    process.exit(1)
  }
  if (!process.env.PHP_BINARY) {
    process.stderr.write(
      `Using PHP ${resolved.version.major}.${resolved.version.minor}.${resolved.version.patch} (${php})\n`,
    )
  }

  const preferred = Math.max(8000, parseInt(getOctanePort(), 10) || 8000)
  const end = preferred + RANGE

  for (let p = preferred; p <= end; p++) {
    if (await isOctaneReady(p)) {
      writeBindPort(p)
      writeStartStatus({ state: 'ready', port: p, reused: true, server: 'octane-roadrunner' })
      process.stderr.write(
        `Laravel Octane already running on http://127.0.0.1:${p}.\n`,
      )
      process.exit(0)
    }

    const st = await checkAmalgatedHealth(p)
    if (st === 'ok') {
      process.stderr.write(
        `Port ${p} already serves amalgated-lending-api (php -S); trying next port for Octane…\n`,
      )
      continue
    }
    if (st === 'bad') {
      process.stderr.write(
        `Port ${p} is in use by another app (health check failed); trying next port…\n`,
      )
      continue
    }

    writeBindPort(p)
    process.stderr.write(
      `Laravel Octane (RoadRunner) → http://127.0.0.1:${p}\n` +
        `Stop with Ctrl+C. On Windows use this script instead of php artisan octane:start.\n`,
    )

    const workerPath = path.join(apiDir, 'vendor', 'bin', 'roadrunner-worker')
    const rpcPort = p - 1999
    const child = spawn(
      rrBinary,
      [
        'serve',
        '-c',
        rrConfig,
        '-o',
        `http.address=127.0.0.1:${p}`,
        '-o',
        `rpc.listen=tcp://127.0.0.1:${rpcPort}`,
        '-o',
        `server.command=${php},${workerPath}`,
      ],
      {
        cwd: apiDir,
        stdio: 'inherit',
        shell: false,
        env: {
          ...process.env,
          APP_BASE_PATH: apiDir,
          LARAVEL_OCTANE: '1',
        },
      },
    )

    child.on('exit', (code) => {
      if ((code ?? 1) !== 0) {
        writeStartStatus({
          state: 'failed',
          reason: `RoadRunner exited with code ${code ?? 1}.`,
          code: 'OCTANE_EXITED',
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
    `No free port found from ${preferred} to ${end}. Stop other servers or change LARAVEL_PORT.\n`,
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
