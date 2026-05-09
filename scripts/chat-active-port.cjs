const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '.chat-active-port')

function writeActivePort(port) {
  fs.writeFileSync(FILE, String(port), 'utf8')
}

function clearActivePort() {
  try {
    fs.unlinkSync(FILE)
  } catch {
    /* ignore */
  }
}

function readActivePort() {
  try {
    const v = fs.readFileSync(FILE, 'utf8').trim()
    if (/^\d+$/.test(v)) return v
  } catch {
    /* ignore */
  }
  return null
}

module.exports = {
  FILE,
  writeActivePort,
  clearActivePort,
  readActivePort,
}
