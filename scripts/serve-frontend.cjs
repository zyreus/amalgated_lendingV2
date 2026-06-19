/**
 * Runs Vite preview behind PM2 without creating a Windows restart loop.
 *
 * If a previous Vite preview is already bound to the public port, keep PM2
 * attached as a supervisor instead of starting a duplicate process that exits.
 */
const { spawn } = require('child_process')
const fs = require('fs')
const http = require('http')
const net = require('net')
const path = require('path')
const { logStartup, logExit, fatalExit, attachSignalLogging } = require('./pm2-process-diagnostics.cjs')

const SERVICE = 'amalgated-frontend'
attachSignalLogging(SERVICE)

const root = path.resolve(__dirname, '..')
const port = parseInt(process.env.VITE_PORT || process.env.PORT || '6174', 10) || 6174
const host = process.env.VITE_HOST || '0.0.0.0'
const probeHost = process.env.VITE_PROBE_HOST || '127.0.0.1'
const distIndex = path.join(root, 'dist', 'index.html')
const viteBin = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js')

logStartup(SERVICE, { port, host, distExists: fs.existsSync(distIndex) })

let child = null
let supervisingExisting = false

function isServing() {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: probeHost,
        port,
        path: '/',
        timeout: 1500,
        headers: { Accept: 'text/html,*/*' },
      },
      (res) => {
        res.resume()
        resolve(true)
      },
    )
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

function isPortAvailable() {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', (err) => {
      resolve(err && err.code === 'EADDRINUSE' ? false : true)
    })
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, '0.0.0.0')
  })
}

async function superviseExisting() {
  supervisingExisting = true
  process.stderr.write(
    `Vite preview already serving on http://${probeHost}:${port} — skipping duplicate start.\n` +
      `Supervising existing Vite preview on http://${probeHost}:${port} (stop via pm2 stop).\n` +
      `Supervisor staying attached (prevents PM2 restart loop).\n`,
  )

  setInterval(async () => {
    if (!(await isServing()) && (await isPortAvailable())) {
      logExit(SERVICE, { code: 1, reason: `Supervised Vite preview on port ${port} disappeared` })
      process.exit(1)
    }
  }, 5000)
}

async function main() {
  if (await isServing()) {
    await superviseExisting()
    return
  }

  if (!(await isPortAvailable())) {
    fatalExit(
      SERVICE,
      1,
      `Port ${port} is occupied but http://${probeHost}:${port}/ is not responding — stop the stale process and restart PM2`,
    )
  }

  if (!fs.existsSync(distIndex)) {
    fatalExit(
      SERVICE,
      1,
      `Missing build artifact: dist/index.html — run: npm run build`,
    )
  }

  process.stderr.write(`Vite preview -> http://${probeHost}:${port}\n`)
  child = spawn(
    process.execPath,
    [
      viteBin,
      'preview',
      '--config',
      'frontend/vite.config.js',
      '--host',
      host,
      '--port',
      String(port),
      '--strictPort',
    ],
    { cwd: root, stdio: 'inherit', shell: false },
  )

  child.on('exit', async (code, signal) => {
    child = null
    if ((code ?? 1) !== 0 && ((await isServing()) || !(await isPortAvailable()))) {
      await superviseExisting()
      return
    }
    if (signal) {
      logExit(SERVICE, { code, signal, reason: `Vite preview killed by ${signal}` })
      process.kill(process.pid, signal)
      return
    }
    logExit(SERVICE, { code, reason: code === 0 ? 'Vite preview exited cleanly' : 'Vite preview crashed' })
    process.exit(code ?? 1)
  })
}

function shutdown(signal) {
  if (child && !child.killed) {
    child.kill(signal)
    return
  }
  process.exit(supervisingExisting ? 0 : 1)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

main().catch((err) => {
  fatalExit(SERVICE, 1, String(err && err.message ? err.message : err))
})
