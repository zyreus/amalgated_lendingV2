/**
 * Run PM2 with project-local PM2_HOME and Windows pipe patch.
 * Usage: node scripts/pm2-run.cjs <pm2-command> [options]
 */
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
process.env.PM2_HOME = path.join(root, '.pm2-home')
fs.mkdirSync(process.env.PM2_HOME, { recursive: true })
fs.mkdirSync(path.join(root, 'logs'), { recursive: true })
process.env.PM2_DISABLE_MONIT = process.env.PM2_DISABLE_MONIT || 'true'

if (process.platform === 'win32') {
  require('./patch-pm2-windows.cjs')
}

const pm2Bin = require.resolve('pm2/lib/binaries/CLI.js')
const args = process.argv.slice(2)
if (args.length === 0) {
  process.stderr.write('Usage: node scripts/pm2-run.cjs <pm2-command> [options]\n')
  process.exit(1)
}

const result = spawnSync(process.execPath, [pm2Bin, ...args], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: false,
})
process.exit(result.status ?? 1)
