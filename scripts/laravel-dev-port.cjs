/**
 * Port used by `serve-laravel.cjs` and `wait-laravel.cjs`, read from env or amalgated-lending/.env.
 * Keeps Vite proxy + browser fallbacks aligned with `php artisan serve`.
 */
const fs = require('fs')
const path = require('path')

function readFromDotEnv(name) {
  try {
    const p = path.join(__dirname, '..', '.env')
    const raw = fs.readFileSync(p, 'utf8')
    const re = new RegExp(`^${name}\\s*=\\s*(.+)$`, 'm')
    const m = raw.match(re)
    if (!m) return null
    return m[1].trim().replace(/^["']|["']$/g, '')
  } catch {
    return null
  }
}

function getLaravelPort() {
  const fromProc = process.env.LARAVEL_PORT
  if (fromProc && /^\d+$/.test(String(fromProc).trim())) {
    return String(fromProc).trim()
  }
  const fromFile = readFromDotEnv('LARAVEL_PORT')
  if (fromFile && /^\d+$/.test(fromFile)) return fromFile
  return '8000'
}

module.exports = { getLaravelPort }
