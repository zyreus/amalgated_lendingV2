/**
 * Free a TCP port when something is LISTENING but fails a health probe.
 * Usage: node scripts/kill-stale-port.cjs <port> [--probe-url=http://127.0.0.1:PORT/path]
 *
 * Safe: only kills the PID bound to the port when the probe fails (stale/zombie holder).
 */
const http = require('http')
const { execSync } = require('child_process')

const port = parseInt(process.argv[2], 10)
if (!port || port < 1 || port > 65535) {
  process.stderr.write('Usage: node scripts/kill-stale-port.cjs <port> [--probe-url=...]\n')
  process.exit(1)
}

const probeArg = process.argv.find((a) => a.startsWith('--probe-url='))
const probeUrl = probeArg ? probeArg.slice('--probe-url='.length) : `http://127.0.0.1:${port}/`

function probeOk(url) {
  return new Promise((resolve) => {
    let parsed
    try {
      parsed = new URL(url)
    } catch {
      resolve(false)
      return
    }
    const req = http.get(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        timeout: 2500,
      },
      (res) => {
        res.resume()
        resolve(res.statusCode >= 200 && res.statusCode < 500)
      },
    )
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

function findListeningPid(targetPort) {
  if (process.platform === 'win32') {
    const out = execSync(`netstat -ano | findstr :${targetPort}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes('LISTENING')) continue
      const parts = line.trim().split(/\s+/)
      const local = parts[1] || ''
      if (!local.endsWith(`:${targetPort}`) && !local.includes(`:${targetPort}`)) continue
      const pid = parseInt(parts[parts.length - 1], 10)
      if (pid > 0) return pid
    }
    return null
  }
  try {
    const out = execSync(`lsof -ti tcp:${targetPort} -sTCP:LISTEN`, { encoding: 'utf8' }).trim()
    const pid = parseInt(out.split(/\s+/)[0], 10)
    return pid > 0 ? pid : null
  } catch {
    return null
  }
}

function killPid(pid) {
  if (process.platform === 'win32') {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
  } else {
    process.kill(pid, 'SIGTERM')
  }
}

async function main() {
  const pid = findListeningPid(port)
  if (!pid) {
    process.stdout.write(`port ${port}: free\n`)
    return
  }
  if (await probeOk(probeUrl)) {
    process.stdout.write(`port ${port}: healthy (PID ${pid}) — keeping\n`)
    return
  }
  process.stderr.write(`port ${port}: stale holder PID ${pid} (probe ${probeUrl} failed) — killing\n`)
  try {
    killPid(pid)
    await new Promise((r) => setTimeout(r, 1500))
    process.stdout.write(`port ${port}: cleared\n`)
  } catch (err) {
    process.stderr.write(`port ${port}: could not kill PID ${pid}: ${err && err.message ? err.message : err}\n`)
    process.exit(1)
  }
}

main().catch((err) => {
  process.stderr.write(String(err && err.message ? err.message : err) + '\n')
  process.exit(1)
})
