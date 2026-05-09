/**
 * Blocks until the Node chat server has bound a port and its /health endpoint responds.
 * serve:chat writes scripts/.chat-active-port after its final port fallback settles.
 */
const http = require('http')
const path = require('path')
const { readActivePort } = require('./chat-active-port.cjs')
const { loadDotenvLite } = require('./load-dotenv-lite.cjs')

loadDotenvLite(path.resolve(__dirname, '..', '.env'))

const host = process.env.CHAT_HOST || '127.0.0.1'
const timeoutMs = Number(process.env.CHAT_WAIT_MS || 20000)
const intervalMs = 150

function healthOk(port) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: host,
        port: parseInt(port, 10) || 8010,
        path: '/health',
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
            const j = JSON.parse(body)
            resolve(Boolean(j && j.ok === true && j.service === 'amalgated-lending-chat-server'))
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
  process.stderr.write('Waiting for Node chat server (/health) on the active chat port ...\n')
  for (;;) {
    const active = readActivePort()
    if (active && (await healthOk(active))) {
      process.stderr.write(`Node chat server is up on port ${active}; starting Vite.\n`)
      process.exit(0)
    }
    if (Date.now() - start > timeoutMs) {
      process.stderr.write(
        `Timeout (${timeoutMs}ms) waiting for chat server.\n` +
          `  • Check "npm run serve:chat" output for startup errors.\n` +
          `  • Expected scripts/.chat-active-port after chat server listens.\n`,
      )
      process.exit(1)
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

main()
