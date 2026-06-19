/**
 * Shared startup / exit logging for PM2-managed supervisor scripts.
 * Writes to stderr so PM2 captures lines in error_file (merge_logs: true).
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const diagLog = path.join(root, 'logs', 'pm2-diagnostics.log')

function ts() {
  return new Date().toISOString()
}

function appendDiag(line) {
  try {
    fs.mkdirSync(path.dirname(diagLog), { recursive: true })
    fs.appendFileSync(diagLog, `${ts()} ${line}\n`, 'utf8')
  } catch {
    /* non-fatal */
  }
}

function write(service, level, message, meta) {
  const suffix = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  const line = `[pm2:${service}] [${level}] ${message}${suffix}`
  process.stderr.write(`${line}\n`)
  appendDiag(line)
}

function logStartup(service, meta = {}) {
  write(service, 'startup', 'Process starting', {
    pid: process.pid,
    ppid: process.ppid,
    node: process.version,
    cwd: process.cwd(),
    pm2: process.env.pm_id != null ? { id: process.env.pm_id, name: process.env.name } : undefined,
    ...meta,
  })
}

function logExit(service, { code = null, signal = null, reason = '' } = {}) {
  write(service, 'exit', reason || 'Process exiting', { code, signal })
}

function fatalExit(service, code, reason, meta = {}) {
  logExit(service, { code, reason, ...meta })
  process.exit(code)
}

function attachSignalLogging(service) {
  ;['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((sig) => {
    process.on(sig, () => {
      write(service, 'signal', `Received ${sig}`)
    })
  })
  process.on('uncaughtException', (err) => {
    write(service, 'fatal', 'uncaughtException', {
      message: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack.split('\n').slice(0, 5).join(' | ') : undefined,
    })
    process.exit(1)
  })
  process.on('unhandledRejection', (reason) => {
    write(service, 'fatal', 'unhandledRejection', {
      reason: String(reason && reason.message ? reason.message : reason),
    })
    process.exit(1)
  })
}

module.exports = {
  logStartup,
  logExit,
  fatalExit,
  attachSignalLogging,
  DIAG_LOG: diagLog,
}
