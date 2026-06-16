/**
 * Runs Vite preview behind PM2 without creating a Windows restart loop.
 *
 * If a previous Vite preview is already bound to the public port, keep PM2
 * attached as a supervisor instead of starting a duplicate process that exits.
 */
const { spawn } = require('child_process')
const http = require('http')
const net = require('net')
const path = require('path')

const root = path.resolve(__dirname, '..')
const port = parseInt(process.env.VITE_PORT || process.env.PORT || '6174', 10) || 6174
const host = process.env.VITE_HOST || '0.0.0.0'
const probeHost = process.env.VITE_PROBE_HOST || '127.0.0.1'
const viteBin = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js')

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
      process.stderr.write(`Supervised Vite preview on port ${port} disappeared; asking PM2 to restart it.\n`)
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
    process.stderr.write(
      `Port ${port} is occupied, but http://${probeHost}:${port}/ is not responding. ` +
        `Stop the stale process using this port and restart PM2.\n`,
    )
    process.exit(1)
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
    if (signal) process.kill(process.pid, signal)
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
  process.stderr.write(String(err && err.stack ? err.stack : err) + '\n')
  process.exit(1)
})
