/**
 * Blocks until Laravel GET /api/v1/health returns {"ok":true}.
 * Used by ordered PM2 startup (backend before frontend/chat).
 */
const http = require('http')
const path = require('path')
const { loadDotenvLite } = require('./load-dotenv-lite.cjs')
const { getLaravelPort } = require('./laravel-dev-port.cjs')

loadDotenvLite(path.resolve(__dirname, '..', '.env'))

const host = process.env.LARAVEL_HOST || '127.0.0.1'
const port = parseInt(getLaravelPort(), 10) || 8001
const timeoutMs = Number(process.env.LARAVEL_WAIT_MS || 90000)
const intervalMs = 500

function healthOk() {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: host,
        port,
        path: '/api/v1/health',
        timeout: 3000,
        headers: { Accept: 'application/json' },
      },
      (res) => {
        let body = ''
        res.on('data', (c) => {
          body += c
        })
        res.on('end', () => {
          if (res.statusCode !== 200) return resolve(false)
          try {
            resolve(JSON.parse(body).ok === true)
          } catch {
            resolve(false)
          }
        })
      },
    )
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function main() {
  const start = Date.now()
  process.stderr.write(`Waiting for Laravel http://${host}:${port}/api/v1/health …\n`)
  while (Date.now() - start < timeoutMs) {
    if (await healthOk()) {
      process.stderr.write(`Laravel API ready on port ${port}.\n`)
      process.exit(0)
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  process.stderr.write(`Timeout (${timeoutMs}ms) waiting for Laravel on port ${port}.\n`)
  process.exit(1)
}

main()
