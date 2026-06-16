/**
 * PM2 on Windows ignores PM2_HOME for rpc/pub pipes (uses global \\.\pipe\rpc.sock).
 * Patch paths.js once per PM2_HOME so each project gets its own named pipe.
 */
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pm2Home = process.env.PM2_HOME || path.join(root, '.pm2-home')
const id = crypto.createHash('md5').update(pm2Home).digest('hex').slice(0, 12)
const marker = path.join(pm2Home, '.pm2-windows-patched')
const pathsFile = path.join(root, 'node_modules', 'pm2', 'paths.js')

if (!fs.existsSync(pathsFile)) {
  process.stderr.write('Run npm install first (pm2 missing).\n')
  process.exit(1)
}

let src = fs.readFileSync(pathsFile, 'utf8')
const patchedNeedle = `pm2-rpc-${id}`

if (fs.existsSync(marker) && src.includes(patchedNeedle)) {
  return
}

if (fs.existsSync(marker) && !src.includes(patchedNeedle)) {
  fs.unlinkSync(marker)
}
const needle = `  if (process.platform === 'win32' ||
      process.platform === 'win64') {
    //@todo instead of static unique rpc/pub file custom with PM2_HOME or UID
    pm2_file_stucture.DAEMON_RPC_PORT = '\\\\\\\\.\\\\pipe\\\\rpc.sock';
    pm2_file_stucture.DAEMON_PUB_PORT = '\\\\\\\\.\\\\pipe\\\\pub.sock';
    pm2_file_stucture.INTERACTOR_RPC_PORT = '\\\\\\\\.\\\\pipe\\\\interactor.sock';
  }`

if (!src.includes(needle)) {
  if (src.includes('pm2-rpc-')) {
    fs.mkdirSync(pm2Home, { recursive: true })
    fs.writeFileSync(marker, id)
    return
  }
  process.stderr.write('pm2/paths.js layout changed; patch not applied.\n')
  process.exit(1)
}

const replacement = `  if (process.platform === 'win32' ||
      process.platform === 'win64') {
    var _pm2PipeId = '${id}';
    pm2_file_stucture.DAEMON_RPC_PORT = '\\\\\\\\.\\\\pipe\\\\pm2-rpc-' + _pm2PipeId + '.sock';
    pm2_file_stucture.DAEMON_PUB_PORT = '\\\\\\\\.\\\\pipe\\\\pm2-pub-' + _pm2PipeId + '.sock';
    pm2_file_stucture.INTERACTOR_RPC_PORT = '\\\\\\\\.\\\\pipe\\\\pm2-interactor-' + _pm2PipeId + '.sock';
  }`

fs.writeFileSync(pathsFile, src.replace(needle, replacement))
fs.mkdirSync(pm2Home, { recursive: true })
fs.writeFileSync(marker, id)
process.stderr.write(`PM2 Windows pipes patched (id=${id}).\n`)
