/**
 * Launches Laravel Octane with a cwd that does not depend on shell `cd` (Windows-safe).
 * API lives at: amalgated-lending/amalgated-lending-api (relative to this repo root).
 *
 * Skips ports where something else answers (GET /api/v1/health is not this app) and
 * binds the next free port in range so duplicate local runs can move to +1 ports.
 */
const { spawn } = require('child_process')
const fs = require('fs')
const net = require('net')
const path = require('path')
const { getLaravelPort } = require('./laravel-dev-port.cjs')
const { checkAmalgatedHealth } = require('./laravel-health.cjs')
const {
  writeActivePort,
  clearActivePort,
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
const { logStartup, logExit, fatalExit, attachSignalLogging } = require('./pm2-process-diagnostics.cjs')

const SERVICE = 'amalgated-backend'
attachSignalLogging(SERVICE)

const apiDir = path.resolve(__dirname, '..', 'amalgated-lending-api')
const artisan = path.join(apiDir, 'artisan')
const roadRunnerBinary = path.join(apiDir, process.platform === 'win32' ? 'rr.exe' : 'rr')
const roadRunnerConfig = path.join(apiDir, '.rr.yaml')
const rootEnv = path.resolve(__dirname, '..', '.env')
const RANGE = 40

loadDotenvLite(rootEnv)

logStartup(SERVICE, {
  laravelPort: getLaravelPort(),
  apiDir,
  roadRunner: fs.existsSync(roadRunnerBinary),
})

let child = null

if (!fs.existsSync(artisan)) {
  fatalExit(SERVICE, 1, `Laravel not found. Expected artisan at: ${artisan}`)
}
if (!fs.existsSync(roadRunnerBinary)) {
  fatalExit(
    SERVICE,
    1,
    `RoadRunner binary not found at ${roadRunnerBinary}. Run: php vendor/bin/rr get-binary in amalgated-lending-api`,
  )
}
if (!fs.existsSync(roadRunnerConfig)) {
  fatalExit(
    SERVICE,
    1,
    `RoadRunner config not found at ${roadRunnerConfig}. Run: php artisan octane:install --server=roadrunner`,
  )
}

function superviseExistingLaravel(port) {
  writeActivePort(port)
  process.stderr.write(
    `Laravel amalgated-lending-api already healthy on http://127.0.0.1:${port} — skipping duplicate Octane start.\n` +
      `Supervisor staying attached (prevents PM2 restart loop).\n`,
  )

  setInterval(async () => {
    if ((await checkAmalgatedHealth(port)) !== 'ok') {
      writeStartStatus({
        state: 'failed',
        reason: `Supervised Laravel server on port ${port} stopped responding.`,
        code: 'LARAVEL_SUPERVISED_DOWN',
      })
      logExit(SERVICE, { code: 1, reason: `Supervised Laravel server on port ${port} stopped responding` })
      process.exit(1)
    }
  }, 5000)
}

function isTcpPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, '127.0.0.1')
  })
}

async function findFreeTcpPort(start, range = RANGE) {
  for (let p = start; p <= start + range; p++) {
    if (await isTcpPortAvailable(p)) return p
  }
  return null
}

async function main() {
  clearBindPort()
  clearActivePort()
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
    fatalExit(SERVICE, 1, `PHP ${MIN_PHP_MAJOR}.${MIN_PHP_MINOR}+ required; detected ${detected}`)
  }
  if (!process.env.PHP_BINARY) {
    process.stderr.write(`Using PHP ${resolved.version.major}.${resolved.version.minor}.${resolved.version.patch} (${php})\n`)
  }
  const preferred = Math.max(8000, parseInt(getLaravelPort(), 10) || 8000)
  const end = preferred + RANGE

  for (let p = preferred; p <= end; p++) {
    const st = await checkAmalgatedHealth(p)
    if (st === 'ok') {
      writeBindPort(p)
      writeStartStatus({ state: 'ready', port: p, reused: true })
      superviseExistingLaravel(p)
      return
    }
    if (st === 'bad') {
      process.stderr.write(
        `Port ${p} is in use by another app (health check failed); trying next port…\n`,
      )
      continue
    }
    writeBindPort(p)
    const rpcPort = 6005 + (p - preferred)
    const metricsPort = await findFreeTcpPort(2112 + (p - preferred))
    if (!metricsPort) {
      writeStartStatus({
        state: 'failed',
        reason: `No free RoadRunner metrics port found from ${2112 + (p - preferred)}.`,
        code: 'NO_FREE_METRICS_PORT',
      })
      process.stderr.write(`No free RoadRunner metrics port found near ${2112 + (p - preferred)}.\n`)
      fatalExit(SERVICE, 1, `No free RoadRunner metrics port near ${2112 + (p - preferred)}`)
    }
    process.stderr.write(
      `Laravel Octane (RoadRunner) → http://127.0.0.1:${p} (metrics: 127.0.0.1:${metricsPort}; auto-fallback enabled; set LARAVEL_PORT in .env to change the start port)\n`,
    )
    child = spawn(
      roadRunnerBinary,
      [
        'serve',
        '-c',
        roadRunnerConfig,
        '-o',
        `http.address=127.0.0.1:${p}`,
        '-o',
        `rpc.listen=tcp://127.0.0.1:${rpcPort}`,
        '-o',
        `metrics.address=127.0.0.1:${metricsPort}`,
      ],
      {
        cwd: apiDir,
        stdio: 'inherit',
        shell: false,
        env: {
          ...process.env,
          APP_ENV: process.env.APP_ENV || 'local',
          APP_BASE_PATH: apiDir,
          LARAVEL_OCTANE: '1',
          PHP_BINARY: php,
          LARAVEL_OCTANE_ROADRUNNER_RELAY: 'pipes',
        },
      },
    )
    writeActivePort(p)
    writeStartStatus({ state: 'ready', port: p, metricsPort })
    child.on('exit', (code) => {
      child = null
      clearActivePort()
      const exitCode = code ?? 1
      if (exitCode !== 0) {
        writeStartStatus({
          state: 'failed',
          reason: `Laravel Octane exited with code ${exitCode}.`,
          code: 'LARAVEL_EXITED',
        })
        logExit(SERVICE, {
          code: exitCode,
          reason: `RoadRunner exited (metrics port conflict on 2112 is a common cause — now auto-assigned)`,
        })
      } else {
        logExit(SERVICE, { code: 0, reason: 'RoadRunner exited cleanly' })
      }
      process.exit(exitCode)
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
  fatalExit(SERVICE, 1, `No free Laravel port from ${preferred} to ${end}`)
}

function shutdown(signal) {
  if (child && !child.killed) {
    child.kill(signal)
    return
  }
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

main().catch((err) => {
  writeStartStatus({
    state: 'failed',
    reason: String(err && err.message ? err.message : err),
    code: 'STARTUP_EXCEPTION',
  })
  fatalExit(SERVICE, 1, String(err && err.message ? err.message : err))
})
