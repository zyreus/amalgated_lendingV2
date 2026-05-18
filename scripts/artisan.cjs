/**
 * Run `php artisan` with PHP 8.3+ (same resolver as serve-laravel.cjs).
 * Usage: node scripts/artisan.cjs migrate
 *        npm run artisan -- migrate
 */
const { spawnSync } = require('child_process')
const path = require('path')
const { loadDotenvLite } = require('./load-dotenv-lite.cjs')
const { resolvePhpBinary, MIN_PHP_MAJOR, MIN_PHP_MINOR } = require('./resolve-php-binary.cjs')

loadDotenvLite(path.resolve(__dirname, '..', '.env'))

const apiDir = path.resolve(__dirname, '..', 'amalgated-lending-api')
const args = process.argv.slice(2)

async function main() {
  const resolved = await resolvePhpBinary()
  if (!resolved.binary) {
    process.stderr.write(
      `PHP ${MIN_PHP_MAJOR}.${MIN_PHP_MINOR}+ required. Set PHP_BINARY in .env or install PHP 8.3+.\n`,
    )
    process.exit(1)
  }
  const result = spawnSync(
    resolved.binary,
    [path.join(apiDir, 'artisan'), ...args],
    { cwd: apiDir, stdio: 'inherit', shell: false },
  )
  process.exit(result.status ?? 1)
}

main().catch((err) => {
  process.stderr.write(String(err && err.stack ? err.stack : err) + '\n')
  process.exit(1)
})
