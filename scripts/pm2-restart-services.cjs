/**
 * Restart backend, ensure queue worker exists, then restart queue/chat/frontend.
 */
const { spawnSync } = require('child_process')
const path = require('path')

const root = path.resolve(__dirname, '..')

function run(args, label, allowFail = false) {
  process.stderr.write(`\n▶ ${label}\n`)
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', shell: false })
  if ((result.status ?? 1) !== 0 && !allowFail) {
    process.stderr.write(`\npm2-restart-services: failed at "${label}" (exit ${result.status ?? 1})\n`)
    process.exit(result.status ?? 1)
  }
  return result.status ?? 1
}

run(['scripts/pm2-preflight.cjs', '--clear-stale-ports'], 'preflight checks + stale port cleanup')
run(['scripts/pm2-run.cjs', 'restart', 'amalgated-backend', '--update-env'], 'restart amalgated-backend')
run(['scripts/wait-backend-health.cjs'], 'wait for Laravel health')
run(
  ['scripts/pm2-run.cjs', 'start', 'ecosystem.config.cjs', '--update-env', '--only', 'amalgated-queue'],
  'ensure amalgated-queue is running',
  true,
)
run(
  ['scripts/pm2-run.cjs', 'restart', 'amalgated-queue', 'amalgated-chat', 'amalgated-frontend', '--update-env'],
  'restart amalgated-queue + amalgated-chat + amalgated-frontend',
  true,
)

process.stderr.write('\npm2-restart-services: done.\n')
