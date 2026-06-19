/**
 * Monitor PM2 processes for restart loops. Exit 0 if stable for --minutes.
 * Usage: node scripts/pm2-stability-watch.cjs [--minutes=5] [--interval=30]
 */
const { spawnSync } = require('child_process')
const path = require('path')

const root = path.resolve(__dirname, '..')
const minutes = Number((process.argv.find((a) => a.startsWith('--minutes=')) || '--minutes=5').split('=')[1]) || 5
const intervalSec = Number((process.argv.find((a) => a.startsWith('--interval=')) || '--interval=30').split('=')[1]) || 30
const checks = Math.ceil((minutes * 60) / intervalSec)

function jlist() {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'pm2-run.cjs'), 'jlist'], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || 'pm2 jlist failed')
  }
  return JSON.parse(result.stdout)
}

function snapshot(list) {
  return list
    .filter((p) => p.name && p.name.startsWith('amalgated-'))
    .map((p) => ({
      name: p.name,
      status: p.pm2_env?.status,
      restarts: p.pm2_env?.restart_time ?? 0,
      uptimeMs: p.pm2_env?.pm_uptime ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function print(snap) {
  return snap
    .map((p) => `${p.name}=${p.status} uptime=${Math.floor(p.uptimeMs / 1000)}s restarts=${p.restarts}`)
    .join(' | ')
}

async function main() {
  const baseline = snapshot(jlist())
  process.stdout.write(`Baseline: ${print(baseline)}\n`)
  const baseRestarts = Object.fromEntries(baseline.map((p) => [p.name, p.restarts]))

  for (let i = 1; i <= checks; i++) {
    await new Promise((r) => setTimeout(r, intervalSec * 1000))
    const now = snapshot(jlist())
    const ts = new Date().toISOString().slice(11, 19)
    process.stdout.write(`${ts} check ${i}/${checks}: ${print(now)}\n`)

    for (const p of now) {
      if (p.status !== 'online') {
        process.stderr.write(`FAIL ${p.name} status=${p.status}\n`)
        process.exit(1)
      }
      if (p.restarts > baseRestarts[p.name]) {
        process.stderr.write(`FAIL ${p.name} restarted (${baseRestarts[p.name]} → ${p.restarts})\n`)
        process.exit(1)
      }
    }
  }

  process.stdout.write(`STABILITY OK — ${minutes} minute(s) with no restarts.\n`)
}

main().catch((err) => {
  process.stderr.write(String(err && err.message ? err.message : err) + '\n')
  process.exit(1)
})
