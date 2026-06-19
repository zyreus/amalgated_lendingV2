/**
 * Launches the chat server in a PM2-safe way.
 *
 * If a previous chat server is already healthy on the desired port, keep this
 * supervisor attached instead of starting a duplicate process that exits or
 * falls through to another port.
 */
const { spawn } = require('child_process')
const fs = require('fs')
const http = require('http')
const net = require('net')
const path = require('path')
const { writeActivePort, clearActivePort } = require('./chat-active-port.cjs')
const { loadDotenvLite } = require('./load-dotenv-lite.cjs')
const { logStartup, logExit, fatalExit, attachSignalLogging } = require('./pm2-process-diagnostics.cjs')

const SERVICE = 'amalgated-chat'
attachSignalLogging(SERVICE)

const root = path.resolve(__dirname, '..')
const chatDir = path.join(root, 'chat-server')
const rootEnv = path.join(root, '.env')

loadDotenvLite(rootEnv)

const host = process.env.CHAT_HOST || '127.0.0.1'
const port = parseInt(process.env.CHAT_PORT || process.env.PORT || '8010', 10) || 8010
const serverJs = path.join(chatDir, 'server.js')

logStartup(SERVICE, { port, host, serverExists: fs.existsSync(serverJs) })

let child = null
let supervisingExisting = false

function isPortAvailable() {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', (err) => {
      resolve(err && err.code === 'EADDRINUSE' ? false : true)
    })
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, host)
  })
}

function healthOk() {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: host,
        port,
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
            const json = JSON.parse(body)
            resolve(Boolean(json && json.ok === true && json.service === 'amalgated-lending-chat-server'))
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

async function superviseExisting() {
  supervisingExisting = true
  writeActivePort(port)
  process.stderr.write(
    `Chat server already healthy on http://${host}:${port} — skipping duplicate start.\n` +
      `Supervisor staying attached (prevents PM2 restart loop).\n`,
  )

  setInterval(async () => {
    if (!(await healthOk())) {
      logExit(SERVICE, { code: 1, reason: `Supervised chat server on port ${port} stopped responding` })
      clearActivePort()
      process.exit(1)
    }
  }, 5000)
}

async function main() {
  if (!fs.existsSync(serverJs)) {
    fatalExit(SERVICE, 1, `chat-server/server.js not found at ${serverJs}`)
  }

  if (await healthOk()) {
    await superviseExisting()
    return
  }

  if (!(await isPortAvailable())) {
    fatalExit(
      SERVICE,
      1,
      `Port ${port} is occupied but http://${host}:${port}/health is not responding — stop the stale process and restart PM2`,
    )
  }

  process.stderr.write(`Chat server -> http://${host}:${port}\n`)
  child = spawn(process.execPath, ['server.js'], {
    cwd: chatDir,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      PORT: String(port),
    },
  })

  child.on('exit', async (code, signal) => {
    child = null
    if ((code ?? 1) !== 0 && (await healthOk())) {
      await superviseExisting()
      return
    }
    if (signal) {
      logExit(SERVICE, { code, signal, reason: `Chat server killed by ${signal}` })
      process.kill(process.pid, signal)
      return
    }
    logExit(SERVICE, { code, reason: code === 0 ? 'Chat server exited cleanly' : 'Chat server crashed' })
    clearActivePort()
    process.exit(code ?? 1)
  })
}

function shutdown(signal) {
  if (child && !child.killed) {
    child.kill(signal)
    return
  }
  if (supervisingExisting) {
    process.exit(0)
    return
  }
  process.exit(1)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

main().catch((err) => {
  fatalExit(SERVICE, 1, String(err && err.message ? err.message : err))
})
