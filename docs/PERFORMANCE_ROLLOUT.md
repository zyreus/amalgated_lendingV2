# Enterprise Performance Rollout

## Baseline First

Run these before and after each phase:

- `node scripts/perf-baseline.cjs > baseline.json`
- `php artisan optimize:clear`
- `php artisan route:list --path=api/v1 > routes.txt`
- MySQL slow query snapshot (`SHOW GLOBAL STATUS LIKE 'Slow_queries';`)

Track:

- API latency (`p50`, `p95`) for top endpoints
- Chat health latency and error rate
- Queue depth (`jobs`, `failed_jobs`)
- DB slow query count and top offenders

## Deployment Cache Commands

Run on deploy (Laravel API):

- `php artisan config:cache`
- `php artisan route:cache`
- `php artisan view:cache`
- `php artisan event:cache`

Queue/Horizon:

- `php artisan migrate --force`
- `php artisan horizon`

## Rollback Safety

- Disable queue workers first, then roll back code.
- Keep migration rollback plan per release.
- For Redis issues: temporary fallback to `QUEUE_CONNECTION=database` and restart workers.

---

## 2026-05 Safe Optimization Pass

The following changes are already applied. They are all behavior-preserving;
no API contract, route, or data-shape was changed.

### Frontend (Vite + React)

| Area | Change | Why it helps |
| --- | --- | --- |
| `src/main.jsx` | Removed eager `import './amplifyLivenessConfig.js'`. | `aws-amplify` (~200–400 KB) no longer ships in the initial bundle; tree-shaken when liveness flow is unused, dynamically loaded when it is. |
| `src/amplifyLivenessConfig.js` | Now exports `ensureAmplifyConfigured()` that does `import('aws-amplify')` on demand. | Same as above. Idempotent — safe to call from many places. |
| `src/components/LivenessQuickStartReact.jsx` | Awaits `ensureAmplifyConfigured()` before requesting a session. | Keeps Cognito Identity Pool credentials available when needed. |
| `vite.config.js` | esbuild drops `console.*` + `debugger` in prod, finer-grained `manualChunks` (`router-vendor`, `http-vendor`, AWS SDK + Smithy bundled into `amplify-vendor`). | Smaller, better-cacheable chunks. Repeat visits hit fewer fresh bytes. |
| `frontend/index.html` | Async Google Fonts via `media="print" onload`. Preload + `fetchpriority="high"` for the brand logo. | Removes render-blocking CSS request; logo shows up in the splash without TTFB delay. |
| `src/components/SplashScreen.jsx` | Logo `<img>` now has `loading="eager"`, `decoding="async"`, intrinsic `width`/`height`. | No layout shift, browser can decode in parallel. |
| `src/components/Header.jsx` | Wrapped `goHome` / `goToSection` in `useCallback`. | Stable references for child handlers; fewer churn renders during nav. |
| `src/components/BackToTopButton.jsx` | rAF-coalesced scroll listener; only re-renders when threshold crosses. | Eliminates ~60 unnecessary React renders per second on scroll. |
| `src/borrower/BorrowerLayout.jsx` | `BorrowerNotificationsPage` is now `lazy()`, mounted only when the bell modal opens. | Removes ~3.5 KB chunk from the initial borrower bundle. |
| `src/admin/AdminLayout.jsx` | `NotificationsPage` is now `lazy()`, mounted only when the bell modal opens. | Removes ~5.5 KB chunk from the initial admin bundle. |

### Chat server (Node + Express + Socket.IO)

| Area | Change | Why it helps |
| --- | --- | --- |
| `chat-server/server.js` | **Bug fix**: `emitConversationsRefresh` and `emitAnalyticsRefresh` previously recursed into themselves and never emitted. They now correctly emit to the `admin` room (debounced). | Admin chat dashboard now live-updates conversation list / analytics without a manual refresh — same contract the frontend was already listening for. |
| `chat-server/server.js` | Added `compression` middleware (1 KB threshold). | Chat history JSON, CMS uploads list responses, and the SPA when served from `../dist` are now gzipped. Easily 60–80% smaller. |
| `chat-server/server.js` | `/uploads` static now sends `Cache-Control: public, max-age=2592000, immutable`. | Browsers + Cloudflare stop re-downloading uploaded photos. |
| `chat-server/server.js` | SPA `/assets/*` cached for 1 year immutable; `index.html` no-cache. | Long-term browser caching of hashed assets, instant updates on deploy. |
| `chat-server/server.js` | Socket.IO `pingInterval=25s`, `pingTimeout=60s`, `maxHttpBufferSize=1 MB`, `perMessageDeflate.threshold=1 KB`. | Fewer reconnect storms on flaky mobile networks; smaller frames over the wire. |
| `chat-server/package.json` | Added `compression` ^1.7.4. | Required by the middleware above. |

### Database (recommended, not auto-applied)

See [`docs/perf-recommended-indexes.sql`](perf-recommended-indexes.sql) for a
list of composite indexes targeting the hottest queries (borrower → loans
lookups, payments by loan + due date, admin status filters, notification
unread counts, etc.). Apply when convenient — they are additive only.

## Next Steps (not yet applied — require a moderate-risk pass)

1. **MUI on public pages** — `mui-vendor` (77 KB) is currently eager-loaded on
   the home page because `Root.jsx` wraps everything in `AdminMuiProvider`.
   Splitting it so MUI only loads under `/admin/*` would shave another large
   chunk off the public bundle.
2. **API response cache headers** — `loan-products` and the public CMS reads
   are excellent candidates for `Cache-Control: public, max-age=300, s-maxage=900`,
   but this would mean admins editing products may see stale data for up to
   5 min. Worth doing once a CDN is in place.
3. **PHP OPcache + JIT** — confirm in `php.ini` that `opcache.enable=1`,
   `opcache.memory_consumption=256`, `opcache.max_accelerated_files=20000`, and
   `opcache.validate_timestamps=0` (in production only — invalidate via deploy).
4. **PM2 cluster mode** — `chat-server` and the Laravel artisan serve are
   currently single-process. On Linux production hosts, switch to
   `instances: "max"` + `exec_mode: "cluster"` for the chat server (the SQLite
   path won't survive cluster, but the MySQL provider will).

