/**
 * Ordered PM2 startup: backend → wait for health → chat + frontend.
 * Prevents restart loops from frontend/chat starting before Laravel is ready.
 */
const { spawnSync } = require('child_process')
const path = require('path')

const root = path.resolve(__dirname, '..')

function run(args, label) {
  process.stderr.write(`\n▶ ${label}\n`)
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', shell: false })
  if ((result.status ?? 1) !== 0) {
    process.stderr.write(`\npm2-start-ordered: failed at "${label}" (exit ${result.status ?? 1})\n`)
    process.exit(result.status ?? 1)
  }
}

run(['scripts/pm2-preflight.cjs', '--clear-stale-ports'], 'preflight checks + stale port cleanup')

run(
  ['scripts/pm2-run.cjs', 'start', 'ecosystem.config.cjs', '--update-env', '--only', 'amalgated-backend'],
  'start amalgated-backend',
)

run(['scripts/wait-backend-health.cjs'], 'wait for Laravel health')

run(
  [
    'scripts/pm2-run.cjs',
    'start',
    'ecosystem.config.cjs',
    '--update-env',
    '--only',
    'amalgated-queue,amalgated-chat,amalgated-frontend',
  ],
  'start amalgated-queue + amalgated-chat + amalgated-frontend',
)

process.stderr.write('\npm2-start-ordered: all services started.\n')
