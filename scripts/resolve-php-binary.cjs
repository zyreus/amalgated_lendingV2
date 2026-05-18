/**
 * Resolve a PHP 8.3+ binary for Laravel (matches amalgated-lending-api composer.json).
 * Prefers PHP_BINARY from env, then `php` on PATH, then common Windows installs (WinGet, etc.).
 */
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const MIN_PHP_MAJOR = 8
const MIN_PHP_MINOR = 3

function parsePhpVersion(text) {
  const match = String(text || '').match(/PHP\s+(\d+)\.(\d+)\.(\d+)/i)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

function isSupportedPhp(version) {
  if (!version) return false
  if (version.major > MIN_PHP_MAJOR) return true
  if (version.major < MIN_PHP_MAJOR) return false
  return version.minor >= MIN_PHP_MINOR
}

function resolvePhpVersion(phpBinary) {
  return new Promise((resolve) => {
    const probe = spawn(phpBinary, ['-v'], { shell: false })
    let out = ''
    let err = ''
    probe.stdout.on('data', (chunk) => {
      out += String(chunk || '')
    })
    probe.stderr.on('data', (chunk) => {
      err += String(chunk || '')
    })
    probe.on('error', () => resolve({ ok: false, version: null, output: '' }))
    probe.on('exit', () => {
      const output = `${out}\n${err}`.trim()
      resolve({ ok: true, version: parsePhpVersion(output), output })
    })
  })
}

function wingetPhp83Candidates() {
  const base = path.join(
    os.homedir(),
    'AppData',
    'Local',
    'Microsoft',
    'WinGet',
    'Packages',
  )
  if (!fs.existsSync(base)) return []
  const out = []
  for (const name of fs.readdirSync(base)) {
    if (!/^PHP\.PHP\.8\.3/i.test(name)) continue
    const exe = path.join(base, name, 'php.exe')
    if (fs.existsSync(exe)) out.push(exe)
  }
  return out
}

function extraPhpCandidates() {
  const candidates = []
  if (process.platform === 'win32') {
    candidates.push(...wingetPhp83Candidates())
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
    for (const sub of ['php-8.3', 'PHP\\8.3', 'php83']) {
      candidates.push(path.join(programFiles, sub, 'php.exe'))
    }
  }
  return candidates
}

function wherePhpOnPath() {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const probe = spawn(cmd, ['php'], { shell: false })
    let out = ''
    probe.stdout.on('data', (chunk) => {
      out += String(chunk || '')
    })
    probe.on('error', () => resolve([]))
    probe.on('exit', (code) => {
      if (code !== 0) return resolve([])
      resolve(
        out
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
      )
    })
  })
}

async function resolvePhpBinary() {
  const seen = new Set()
  const queue = []

  function enqueue(binary) {
    const b = String(binary || '').trim()
    if (!b || seen.has(b.toLowerCase())) return
    seen.add(b.toLowerCase())
    queue.push(b)
  }

  if (process.env.PHP_BINARY) enqueue(process.env.PHP_BINARY)
  enqueue('php')
  for (const p of await wherePhpOnPath()) enqueue(p)
  for (const p of extraPhpCandidates()) enqueue(p)

  let bestUnsupported = null

  for (const binary of queue) {
    const check = await resolvePhpVersion(binary)
    if (!check.ok || !check.version) continue
    if (isSupportedPhp(check.version)) {
      return { binary, version: check.version }
    }
    if (!bestUnsupported) {
      bestUnsupported = { binary, version: check.version }
    }
  }

  return { binary: null, version: bestUnsupported?.version ?? null, tried: queue }
}

module.exports = {
  MIN_PHP_MAJOR,
  MIN_PHP_MINOR,
  parsePhpVersion,
  isSupportedPhp,
  resolvePhpVersion,
  resolvePhpBinary,
}
