/**
 * Quick health probe for all PM2-managed services (exit 0 = all OK).
 * Usage: npm run pm2:health
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function get(pathname, port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const req = http.get({ hostname: host, port, path: pathname, timeout: 5000 }, (res) => {
      let body = ''
      res.on('data', (c) => {
        body += c
      })
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, body }))
    })
    req.on('error', (err) => resolve({ ok: false, error: err.message }))
    req.on('timeout', () => {
      req.destroy()
      resolve({ ok: false, error: 'timeout' })
    })
  })
}

async function main() {
  const laravelPortFile = path.join(__dirname, '.laravel-active-port')
  let backendPort = '8001'
  try {
    const v = fs.readFileSync(laravelPortFile, 'utf8').trim()
    if (/^\d+$/.test(v)) backendPort = v
  } catch {
    /* default */
  }

  const chatPortFile = path.join(__dirname, '.chat-active-port')
  let chatPort = '8010'
  try {
    const v = fs.readFileSync(chatPortFile, 'utf8').trim()
    if (/^\d+$/.test(v)) chatPort = v
  } catch {
    /* default */
  }

  const checks = [
    { name: 'frontend', port: 6174, path: '/', expect: (r) => r.ok },
    {
      name: 'backend',
      port: parseInt(backendPort, 10),
      path: '/api/v1/health',
      expect: (r) => r.ok && r.body.includes('"ok":true'),
    },
    {
      name: 'chat',
      port: parseInt(chatPort, 10),
      path: '/health',
      expect: (r) => r.ok && r.body.includes('amalgated-lending-chat-server'),
    },
  ]

  let failed = false
  for (const c of checks) {
    const result = await get(c.path, c.port)
    const pass = c.expect(result)
    const status = pass ? 'OK' : 'FAIL'
    process.stdout.write(
      `${status}  ${c.name}  http://127.0.0.1:${c.port}${c.path}` +
        (result.error ? `  (${result.error})` : result.status ? `  HTTP ${result.status}` : '') +
        '\n',
    )
    if (!pass) failed = true
  }

  const distIndex = path.join(root, 'dist', 'index.html')
  if (!fs.existsSync(distIndex)) {
    process.stdout.write(`WARN  dist/index.html missing — run: npm run build\n`)
  }

  process.exit(failed ? 1 : 0)
}

main()
