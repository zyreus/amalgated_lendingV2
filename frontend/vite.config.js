import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

function inPackage(id, pkg) {
  return id.includes(`/node_modules/${pkg}/`) || id.includes(`/node_modules/.pnpm/${pkg}@`)
}

/**
 * Vite stamps prebundled deps with `Cache-Control: max-age=31536000, immutable`
 * because the `?v=<browserHash>` query is content-addressable. That's safe for a
 * single dev session but TOXIC behind a public CDN: each PM2 / `vite dev` restart
 * regenerates the browserHash, and the previous one stays pinned at Cloudflare for
 * a year. Old cached pages then import a hash the dev server no longer knows
 * about, the CJS interop wrapper resolves to `null`, and every component that
 * touches a hook crashes with `Cannot read properties of null (reading 'useContext')`.
 *
 * Forcing `no-store` on `/node_modules/.vite/deps/*` keeps Cloudflare (and any
 * other forward proxy) from ever caching prebundled deps, so a server restart
 * can never strand a previously-loaded browser tab.
 */
function devNoCacheOptimizedDeps() {
  const isViteDepUrl = (url) =>
    !!url && (url.includes('/node_modules/.vite/deps/') || url.includes('/.vite/deps/'))

  const stripCdnCache = (res) => {
    res.setHeader('Cache-Control', 'no-store, must-revalidate')
    res.removeHeader('ETag')
    res.removeHeader('etag')
  }

  return {
    name: 'amalgated-no-cache-optimized-deps',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (isViteDepUrl(req.url)) stripCdnCache(res)
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (isViteDepUrl(req.url)) stripCdnCache(res)
        next()
      })
    },
  }
}

function readLaravelActivePort() {
  try {
    const p = path.join(projectRoot, 'scripts', '.laravel-active-port')
    const v = fs.readFileSync(p, 'utf8').trim()
    if (/^\d+$/.test(v)) return v
  } catch {
    /* wait-laravel writes this after health check */
  }
  return null
}

function readChatActivePort() {
  try {
    const p = path.join(projectRoot, 'scripts', '.chat-active-port')
    const v = fs.readFileSync(p, 'utf8').trim()
    if (/^\d+$/.test(v)) return v
  } catch {
    /* wait-chat writes this after health check */
  }
  return null
}

// https://vite.dev/config/ — aligned with Amalgated Holdings (proxy + VITE_BACKEND_PORT for adminApi fallbacks)
export default defineConfig(({ mode }) => {
  /** Env files live at repo root (same folder as `package.json`), not `frontend/`. */
  const env = loadEnv(mode, projectRoot, '')
  const fromWaitLocal = env.VITE_API_PROXY_TARGET || (env.VITE_BACKEND_PORT && `http://127.0.0.1:${env.VITE_BACKEND_PORT}`)
  const laravelPort =
    env.VITE_BACKEND_PORT ||
    readLaravelActivePort() ||
    env.LARAVEL_PORT ||
    '8001'
  const proxyTarget = (fromWaitLocal || `http://127.0.0.1:${laravelPort}`).replace(/\/$/, '')
  const portMatch = proxyTarget.match(/:(\d+)/)
  const apiPort = portMatch ? portMatch[1] : '8001'

  /** Node chat server (REST fallbacks + optional same-origin Socket.IO proxy). */
  const chatPortFromFile = readChatActivePort()
  const chatPort =
    chatPortFromFile || env.CHAT_PORT || env.PORT || '8010'
  const chatTarget = (env.VITE_CHAT_PROXY_TARGET || `http://127.0.0.1:${chatPort}`).replace(/\/$/, '')
  /**
   * Only proxy `/api/admin`, `/socket.io`, and `/uploads` to Node when chat is actually running (port file
   * from `serve:chat`) or when `VITE_CHAT_PROXY_TARGET` is set. Otherwise Vite spams `ECONNREFUSED` for
   * same-origin `/api/admin/*` and Socket.IO while Laravel-only dev (`npm run dev:vite`) is used; those
   * paths then fall through to the Laravel `/api` proxy (Laravel serves `GET /api/admin/analytics`).
   */
  const enableChatProxy = Boolean(
    chatPortFromFile || String(env.VITE_CHAT_PROXY_TARGET || '').trim(),
  )

  let proxy = {
    '/api': {
      target: proxyTarget,
      changeOrigin: true,
      timeout: 120_000,
      proxyTimeout: 120_000,
    },
    /** Laravel `storage` symlink — Vite (5173) does not serve these; forward to PHP app. */
    '/storage': {
      target: proxyTarget,
      changeOrigin: true,
    },
    /** Laravel signed print views (/print/general-loan, /print/loan-soa, …) — same host as API. */
    '/print': {
      target: proxyTarget,
      changeOrigin: true,
    },
    '/health': { target: proxyTarget, changeOrigin: true },
  }

  if (enableChatProxy) {
    /**
     * Node chat-server CRM (`chat-server/server.js`) — `/api/admin/*` visitor DB, feedback, bulk routes.
     * Must be registered **before** the generic `/api` proxy (insert at front of the map).
     */
    const chatAdminProxy = {
      target: chatTarget,
      changeOrigin: true,
      timeout: 120_000,
      proxyTimeout: 120_000,
    }
    proxy = { '/api/admin': chatAdminProxy, ...proxy }
    /** Chat server CMS uploads (`/uploads/cms/...`) for LAN dev host. */
    proxy['/uploads'] = {
      target: chatTarget,
      changeOrigin: true,
    }
    /** Same-origin Socket.IO fallback when the SPA probes `window.location.origin`. */
    proxy['/socket.io'] = { target: chatTarget, changeOrigin: true, ws: true }
  }

  return {
    /** Production site is served from domain root; asset URLs must stay `/assets/...`. */
    base: '/',
    root: __dirname,
    envDir: projectRoot,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        react: path.resolve(projectRoot, 'node_modules/react'),
        'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
        /** `main.jsx` imports `react-dom/client` — must resolve to same package graph as `react` (dev duplicates otherwise). */
        'react-dom/client': path.resolve(projectRoot, 'node_modules/react-dom/client.js'),
        /** Force jsx transform + every consumer onto the same `react` copy (avoids duplicate React in prod). */
        'react/jsx-runtime': path.resolve(projectRoot, 'node_modules/react/jsx-runtime.js'),
        'react/jsx-dev-runtime': path.resolve(projectRoot, 'node_modules/react/jsx-dev-runtime.js'),
        '@emotion/react': path.resolve(projectRoot, 'node_modules/@emotion/react'),
        '@emotion/styled': path.resolve(projectRoot, 'node_modules/@emotion/styled'),
      },
      /** One React instance — without this, MUI/Amplify prebundles can cause "Invalid hook call" / null useContext. */
      dedupe: [
        'react',
        'react-dom',
        'react-dom/client',
        'scheduler',
        'use-sync-external-store',
        'react-router',
        'react-router-dom',
        '@emotion/react',
        '@emotion/styled',
        '@mui/material',
        '@mui/system',
      ],
    },
    optimizeDeps: {
      /**
       * Pre-bundle entries that must share one React instance — prevents `react-dom/client` /
       * prebundle `react` split that triggers "Invalid hook call" + null `useContext` in admin/borrower dev.
       * After changing this block, restart dev server and delete `node_modules/.vite` if issues persist.
       */
      include: [
        'react',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-dom',
        'react-dom/client',
        'scheduler',
        'react-router',
        'react-router-dom',
        '@remix-run/router',
        '@emotion/react',
        '@emotion/styled',
        '@mui/material',
        '@mui/material/styles',
        '@mui/system',
        'use-sync-external-store',
        'axios',
      ],
      dedupe: [
        'react',
        'react-dom',
        'react-dom/client',
        'scheduler',
        '@emotion/react',
        '@emotion/styled',
        'use-sync-external-store',
      ],
    },
    define: {
      'import.meta.env.VITE_BACKEND_PORT': JSON.stringify(String(apiPort)),
      'import.meta.env.VITE_CHAT_DEV_ORIGIN': JSON.stringify(chatTarget),
      'import.meta.env.VITE_CHAT_PROXY_TARGET': JSON.stringify(chatTarget),
    },
    plugins: [react({ jsxRuntime: 'automatic' }), tailwindcss(), devNoCacheOptimizedDeps()],
    server: {
      port: 5174,
      host: '0.0.0.0',
      proxy,
      allowedHosts: true
    },
    preview: { proxy },
    build: {
      /** One SPA output at repo root `dist/` (matches chat-server `../dist`, not `frontend/dist`). */
      outDir: path.resolve(projectRoot, 'dist'),
      emptyOutDir: true,
      /** esbuild minifier is fast + good; drop console.* and debugger from prod for slimmer JS. */
      minify: 'esbuild',
      cssMinify: 'esbuild',
      target: 'es2020',
      sourcemap: false,
      reportCompressedSize: false,
      /** Inline anything ≤ 4 KB as base64 to skip the request round-trip. */
      assetsInlineLimit: 4096,
      /** Per-route CSS is split into its own file alongside its JS chunk (default true, pinned). */
      cssCodeSplit: true,
      /**
       * `modulePreload.polyfill` ships ~1 KB of polyfill so older Safari/iOS browsers still
       * preload route chunks. Keeping it on (default) avoids a slow first-route navigation
       * for a small minority of users.
       */
      modulePreload: { polyfill: true },
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replaceAll('\\', '/')

            /**
             * Auth context modules MUST share the same chunk as `react` + `react-router-dom`.
             * A separate `portal-context-core` chunk created an extra module graph edge that still
             * produced null React dispatchers on `/admin` and `/borrower` in production.
             */
            if (
              normalizedId.includes('/src/borrower/context/') ||
              normalizedId.includes('/src/admin/context/')
            ) {
              return 'vendor'
            }

            if (!normalizedId.includes('/node_modules/')) return

            /**
             * Keep `react` / `react-dom` / `scheduler` inside the SAME `vendor` chunk as other
             * shared libs — not isolated in `react-vendor`. Separate async bundles caused
             * production-only hook failures: "Cannot read properties of null (reading 'useContext')".
             */
            if (
              /[/\\]node_modules[/\\]react[/\\]/.test(normalizedId) ||
              /[/\\]node_modules[/\\]react-dom[/\\]/.test(normalizedId) ||
              /[/\\]node_modules[/\\]scheduler[/\\]/.test(normalizedId)
            ) {
              return 'vendor'
            }

            if (
              inPackage(normalizedId, 'react-router') ||
              inPackage(normalizedId, 'react-router-dom') ||
              inPackage(normalizedId, '@remix-run/router')
            ) {
              return 'vendor'
            }

            /**
             * Keep MUI + Emotion in the same chunk as React (`vendor`).
             * A standalone `mui-vendor` slice has been linked to intermittent null-dispatcher /
             * `useContext` crashes when combined with lazy routes + modulepreload ordering.
             */
            if (
              normalizedId.includes('/node_modules/@mui/') ||
              normalizedId.includes('/node_modules/.pnpm/@mui+') ||
              normalizedId.includes('/node_modules/@emotion/') ||
              normalizedId.includes('/node_modules/.pnpm/@emotion+')
            ) {
              return 'vendor'
            }

            /**
             * Amplify is now imported dynamically (see `amplifyLivenessConfig.js`).
             * Tagging it as a separate chunk keeps it OUT of the eager preload list and
             * means it only downloads when the FaceLiveness flow actually mounts.
             */
            if (
              inPackage(normalizedId, 'aws-amplify') ||
              normalizedId.includes('/node_modules/@aws-amplify/') ||
              normalizedId.includes('/node_modules/.pnpm/@aws-amplify+') ||
              normalizedId.includes('/node_modules/@aws-sdk/') ||
              normalizedId.includes('/node_modules/.pnpm/@aws-sdk+') ||
              normalizedId.includes('/node_modules/@smithy/') ||
              normalizedId.includes('/node_modules/.pnpm/@smithy+')
            ) {
              return 'amplify-vendor'
            }

            /**
             * Recharts + d3 were split as `charts-vendor` → Rollup: circular chunk with `vendor`,
             * which breaks deterministic init order. Fold them into `vendor`.
             */
            if (inPackage(normalizedId, 'recharts') || inPackage(normalizedId, 'd3-shape') || inPackage(normalizedId, 'd3-scale')) {
              return 'vendor'
            }

            /** Framer Motion hooks share React internals — co-locate with `vendor` to avoid dispatcher races. */
            if (
              inPackage(normalizedId, 'framer-motion') ||
              inPackage(normalizedId, 'gsap')
            ) {
              return 'vendor'
            }

            if (inPackage(normalizedId, 'socket.io-client') || inPackage(normalizedId, 'engine.io-client')) {
              return 'vendor'
            }

            if (inPackage(normalizedId, 'axios')) {
              return 'vendor'
            }

            return 'vendor'
          },
        },
      },
      chunkSizeWarningLimit: 1500,
    },
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
      legalComments: 'none',
      /** Strip pure annotations from React.memo / forwardRef so Rollup can tree-shake unused wrappers. */
      pure: mode === 'production' ? ['console.log', 'console.info', 'console.debug'] : [],
    },
  }
})
