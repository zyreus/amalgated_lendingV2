/**
 * Pre-flight checks before PM2 start/restart. Exits non-zero on blocking issues.
 * Usage: node scripts/pm2-preflight.cjs [--clear-stale-ports]
 */
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { loadDotenvLite } = require('./load-dotenv-lite.cjs')
const { getLaravelPort } = require('./laravel-dev-port.cjs')
const { resolvePhpBinary, MIN_PHP_MAJOR, MIN_PHP_MINOR } = require('./resolve-php-binary.cjs')

const root = path.resolve(__dirname, '..')
const clearStale = process.argv.includes('--clear-stale-ports')

loadDotenvLite(path.join(root, '.env'))

let failed = false

function ok(msg) {
  process.stdout.write(`OK   ${msg}\n`)
}
function warn(msg) {
  process.stdout.write(`WARN ${msg}\n`)
}
function fail(msg) {
  process.stderr.write(`FAIL ${msg}\n`)
  failed = true
}

function runNode(script, args = []) {
  return spawnSync(process.execPath, [path.join(__dirname, script), ...args], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  })
}

async function main() {
  const distIndex = path.join(root, 'dist', 'index.html')
  if (fs.existsSync(distIndex)) {
    ok('dist/index.html present')
  } else {
    fail('dist/index.html missing — run: npm run build')
  }

  const apiDir = path.join(root, 'amalgated-lending-api')
  const rr = path.join(apiDir, process.platform === 'win32' ? 'rr.exe' : 'rr')
  if (fs.existsSync(path.join(apiDir, 'artisan'))) ok('Laravel artisan found')
  else fail(`Laravel artisan missing at ${path.join(apiDir, 'artisan')}`)
  if (fs.existsSync(rr)) ok('RoadRunner binary found')
  else fail(`RoadRunner binary missing — run: php vendor/bin/rr get-binary in amalgated-lending-api`)

  const chatServer = path.join(root, 'chat-server', 'server.js')
  if (fs.existsSync(chatServer)) ok('chat-server/server.js found')
  else fail('chat-server/server.js missing')

  if (!fs.existsSync(path.join(root, 'node_modules', 'pm2'))) {
    fail('node_modules/pm2 missing — run: npm install')
  } else {
    ok('node_modules/pm2 present')
  }

  if (!fs.existsSync(path.join(root, 'chat-server', 'node_modules'))) {
    warn('chat-server/node_modules missing — run: cd chat-server && npm install')
  } else {
    ok('chat-server/node_modules present')
  }

  const php = await resolvePhpBinary()
  if (php.binary) {
    ok(`PHP ${php.version.major}.${php.version.minor}.${php.version.patch} (${php.binary})`)
  } else {
    fail(`PHP ${MIN_PHP_MAJOR}.${MIN_PHP_MINOR}+ required — set PHP_BINARY in .env`)
  }

  const laravelPort = getLaravelPort()
  const chatPort = process.env.CHAT_PORT || process.env.PORT || '8010'
  const frontendPort = process.env.VITE_PORT || '6174'

  if (clearStale) {
    process.stdout.write('Clearing stale port holders …\n')
    runNode('kill-stale-port.cjs', [laravelPort, `--probe-url=http://127.0.0.1:${laravelPort}/api/v1/health`])
    runNode('kill-stale-port.cjs', [frontendPort, `--probe-url=http://127.0.0.1:${frontendPort}/`])
    runNode('kill-stale-port.cjs', [chatPort, `--probe-url=http://127.0.0.1:${chatPort}/health`])
  }

  const apiEnv = path.join(apiDir, '.env')
  const chatEnv = path.join(root, 'chat-server', '.env')
  if (fs.existsSync(apiEnv) && fs.existsSync(chatEnv)) {
    ok('amalgated-lending-api/.env and chat-server/.env present')
  } else {
    warn('Missing .env in api or chat-server — copy from .env.example')
  }

  if (failed) {
    process.stderr.write('\npm2-preflight: blocking issues found. Fix above before starting PM2.\n')
    process.exit(1)
  }
  process.stdout.write('pm2-preflight: all checks passed.\n')
}

main().catch((err) => {
  process.stderr.write(String(err && err.message ? err.message : err) + '\n')
  process.exit(1)
})
