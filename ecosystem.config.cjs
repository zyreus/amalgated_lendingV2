const path = require('path')
const { loadDotenvLite } = require('./scripts/load-dotenv-lite.cjs')
const { getLaravelPort } = require('./scripts/laravel-dev-port.cjs')

const ROOT = path.resolve(__dirname)
loadDotenvLite(path.join(ROOT, '.env'))

const LARAVEL_PORT = getLaravelPort()
const CHAT_PORT = process.env.CHAT_PORT || '8010'
const FRONTEND_PORT = process.env.VITE_PORT || '6174'
const API_PROXY = process.env.VITE_API_PROXY_TARGET || `http://127.0.0.1:${LARAVEL_PORT}`
const CHAT_SYNC_SECRET =
  process.env.LARAVEL_CHAT_SYNC_SECRET || 'amalgated-local-chat-warehouse-sync-v1'

/** Shared PM2 options for all production-facing services. */
const PM2_DEFAULTS = {
  cwd: ROOT,
  windowsHide: true,
  watch: false,
  autorestart: true,
  max_restarts: 10,
  min_uptime: '30s',
  restart_delay: 5000,
  exp_backoff_restart_delay: 100,
  kill_timeout: 8000,
  merge_logs: true,
  time: true,
  ignore_watch: [
    'node_modules',
    'logs',
    '.git',
    'vendor',
    'storage',
    'dist',
    '.pm2-home',
    'amalgated-lending-api/storage',
    'chat-server/node_modules',
  ],
}

module.exports = {
  apps: [
    {
      /**
       * Public-facing SPA service. Serves the prebuilt `dist/` via `vite preview`,
       * which gives every asset a permanent content hash and never restarts with a
       * new browserHash the way `vite dev` does.
       *
       * Run `npm run build` (or `npm run build:laravel`) before `pm2 restart amalgated-frontend`.
       */
      ...PM2_DEFAULTS,
      name: 'amalgated-frontend',
      script: 'scripts/serve-frontend.cjs',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        VITE_PORT: FRONTEND_PORT,
        VITE_HOST: '0.0.0.0',
        VITE_PROBE_HOST: '127.0.0.1',
        VITE_API_PROXY_TARGET: API_PROXY,
      },
      max_memory_restart: '1G',
      out_file: './logs/frontend-out.log',
      error_file: './logs/frontend-error.log',
    },
    {
      /**
       * Optional dev server (HMR) — NOT auto-started by `npm run pm2:start`.
       *   pm2 start ecosystem.config.cjs --only amalgated-frontend-dev
       */
      ...PM2_DEFAULTS,
      name: 'amalgated-frontend-dev',
      script: 'C:/Windows/System32/cmd.exe',
      args: '/d /s /c "npm run dev:vite -- --host 0.0.0.0 --port 5175 --strictPort"',
      interpreter: 'none',
      autorestart: false,
      max_restarts: 3,
      env: {
        NODE_ENV: 'development',
        VITE_PORT: '5175',
      },
      max_memory_restart: '1G',
      out_file: './logs/frontend-dev-out.log',
      error_file: './logs/frontend-dev-error.log',
    },
    {
      name: 'amalgated-backend',
      ...PM2_DEFAULTS,
      script: 'scripts/serve-laravel.cjs',
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
        // PHP 8.3+ — set PHP_BINARY in repo root `.env` (do not use XAMPP 8.2 `php` on PATH).
        LARAVEL_PORT,
        PHP_BINARY: process.env.PHP_BINARY || '',
        VITE_API_PROXY_TARGET: API_PROXY,
      },
      max_memory_restart: '1G',
      out_file: './logs/backend-out.log',
      error_file: './logs/backend-error.log',
    },
    {
      /**
       * Laravel queue worker for transactional emails (notifications queue).
       * Required when QUEUE_CONNECTION=database or redis. With sync, this process is idle but harmless.
       */
      ...PM2_DEFAULTS,
      name: 'amalgated-queue',
      script: 'C:/Windows/System32/cmd.exe',
      args: '/d /s /c "node scripts/artisan.cjs queue:work --queue=notifications,default --sleep=3 --tries=5 --max-time=3600"',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
      out_file: './logs/queue-out.log',
      error_file: './logs/queue-error.log',
    },
    {
      name: 'amalgated-chat',
      ...PM2_DEFAULTS,
      script: 'scripts/serve-chat.cjs',
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
        PORT: CHAT_PORT,
        CHAT_PORT,
        LARAVEL_CHAT_SYNC_URL: `http://127.0.0.1:${LARAVEL_PORT}/api/v1`,
        /** Must equal amalgated-lending-api `.env` `SUPPORT_CHAT_SYNC_SECRET`, or CRM warehouse stays empty. */
        LARAVEL_CHAT_SYNC_SECRET: CHAT_SYNC_SECRET,
      },
      max_memory_restart: '768M',
      out_file: './logs/chat-out.log',
      error_file: './logs/chat-error.log',
    },
  ],
}
