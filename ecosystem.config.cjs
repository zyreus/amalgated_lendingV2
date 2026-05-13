module.exports = {
  apps: [
    {
      /**
       * Public-facing SPA service. Serves the prebuilt `dist/` via `vite preview`,
       * which gives every asset a permanent content hash and never restarts with a
       * new browserHash the way `vite dev` does. That removes the "Cannot read
       * properties of null (reading 'useContext')" crash users were seeing on
       * /admin and /borrower/login behind Cloudflare (stale `?v=<hash>` requests).
       *
       * Run `npm run build` (or `npm run build:laravel`) before `pm2 restart amalgated-frontend`.
       */
      name: 'amalgated-frontend',
      cwd: 'C:/xampp/htdocs/amalgated_lendingV2',
      script: 'C:/Windows/System32/cmd.exe',
      args: '/d /s /c "npx vite preview --config frontend/vite.config.js --host 0.0.0.0 --port 5174 --strictPort"',
      windowsHide: true,
      env: {
        NODE_ENV: 'production',
        VITE_PORT: '5174',
      },
      watch: false,
      autorestart: true,
      max_memory_restart: '1G',
      out_file: './logs/frontend-out.log',
      error_file: './logs/frontend-error.log',
      merge_logs: true,
      time: true,
    },
    {
      /**
       * Optional dev server (HMR) — NOT auto-started by `pm2 start ecosystem.config.cjs`
       * because the public-facing service above already occupies port 5174. Use for
       * local development:
       *   pm2 start ecosystem.config.cjs --only amalgated-frontend-dev
       * (Pick a different port via `--port` if you also want the preview server up.)
       */
      name: 'amalgated-frontend-dev',
      cwd: 'C:/xampp/htdocs/amalgated_lendingV2',
      script: 'C:/Windows/System32/cmd.exe',
      args: '/d /s /c "npm run dev:vite -- --host 0.0.0.0 --port 5175 --strictPort"',
      windowsHide: true,
      env: {
        NODE_ENV: 'development',
        VITE_PORT: '5175',
      },
      watch: false,
      autorestart: false,
      max_memory_restart: '1G',
      out_file: './logs/frontend-dev-out.log',
      error_file: './logs/frontend-dev-error.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'amalgated-backend',
      cwd: 'C:/xampp/htdocs/amalgated_lendingV2',
      script: 'C:/Windows/System32/cmd.exe',
      args: '/d /s /c "npm run serve:laravel"',
      windowsHide: true,
      env: {
        NODE_ENV: 'development',
        PHP_BINARY: 'C:/xampp/php/php.exe',
        LARAVEL_PORT: '8001',
      },
      watch: false,
      autorestart: true,
      out_file: './logs/backend-out.log',
      error_file: './logs/backend-error.log',
      merge_logs: true,
      time: true,
    },

    {
      name: 'amalgated-chat',
      cwd: 'C:/xampp/htdocs/amalgated_lendingV2',
      script: 'C:/Windows/System32/cmd.exe',
      args: '/d /s /c "npm run serve:chat"',
      windowsHide: true,
      env: {
        NODE_ENV: 'development',
        PORT: '8010',
        LARAVEL_CHAT_SYNC_URL: 'http://127.0.0.1:8001/api/v1',
        /** Must equal amalgated-lending-api `.env` `SUPPORT_CHAT_SYNC_SECRET`, or CRM warehouse stays empty. */
        LARAVEL_CHAT_SYNC_SECRET: 'amalgated-local-chat-warehouse-sync-v1',
      },
      watch: false,
      autorestart: true,
      max_memory_restart: '768M',
      out_file: './logs/chat-out.log',
      error_file: './logs/chat-error.log',
      merge_logs: true,
      time: true,
    },
  ],
}