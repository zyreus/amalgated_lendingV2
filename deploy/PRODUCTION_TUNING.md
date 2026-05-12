# Amalgated Lending Inc. — Production Performance Tuning

A senior-level checklist for getting the SPA + Laravel API production stack running fast,
cool, and stable. Pair this with `deploy/apache/performance.conf`,
`deploy/php-fpm/opcache-recommended.ini`, and the `.htaccess` files already shipped
in the repo.

The audit pass that produced this document also landed:

- Lazy-loaded below-the-fold homepage sections via `LazySection` (`frontend/src/components/LazySection.jsx`).
- Switched the 180 KB PNG logo to the 569 B SVG variant in `Header`, `SubPageHeader`, `Footer`, and `index.html`
  (also adds `width`/`height`/`decoding="async"` to remove CLS and unblock decode).
- `vite.config.js` hardened (`assetsInlineLimit: 4096`, `cssCodeSplit`, `modulePreload.polyfill`, esbuild `pure`).
- Backend cooldown on `BorrowerNotificationController::syncPaymentRemindersForUser`
  (poll/unread-count no longer thrash the DB every 30–60 s).
- `BorrowerPortalController::chatMessages` is now bounded (default 100, max 200) with
  cursor-style `before_id` pagination.
- `LoanController::index` no longer materializes the heavy `application_payload` JSON
  column; only the three quote-snippet keys are extracted server-side via `JSON_EXTRACT`.
- `Cache-Control` headers on `dashboard/summary`, `dashboard/charts`, and `loan-products`
  public catalog so the SPA / CDN can short-circuit repeated polls.
- `2026_05_11_130000_add_more_performance_indexes.php` covering the borrower portal,
  loan-application listing, payment reference lookups, and admin role filtering.
- `.htaccess` (frontend + Laravel public) now ships Brotli + JSON/font in mod_deflate,
  with explicit `no-gzip` for already-compressed assets.

## 1. Build

```sh
npm run composer:install:prod        # composer install --no-dev --optimize-autoloader
npm run build:laravel                # vite build → dist/ → copies to amalgated-lending-api/public
npm run api:cache                    # config:cache + route:cache + view:cache
```

After a deploy:

```sh
cd amalgated-lending-api
php artisan optimize                 # config + route + event cache
php artisan view:cache
php artisan event:cache
php artisan filament:optimize        # only if you use the Filament admin
php artisan storage:link             # idempotent
```

## 2. PHP / OPcache

`deploy/php-fpm/opcache-recommended.ini` covers the basics. For production, also confirm:

```ini
opcache.enable=1
opcache.memory_consumption=192
opcache.interned_strings_buffer=16
opcache.max_accelerated_files=20000
opcache.validate_timestamps=0     ; bump deploys with `cachetool opcache:reset`
opcache.jit=tracing
opcache.jit_buffer_size=64M
realpath_cache_size=4M
realpath_cache_ttl=600
```

Add the `cachetool` binary so `opcache:reset` can run without restarting PHP-FPM.

## 3. Apache (XAMPP / cPanel) tuning

`deploy/apache/performance.conf` already contains the MPM-event sizing. Confirm:

```sh
a2enmod headers expires deflate brotli http2 rewrite
sudo systemctl restart apache2
```

`mod_http2` halves connection setup for the >40 small `/assets/*-<hash>.js` chunks the
Vite build produces.

## 4. MySQL

The repo ships two perf-index migrations:

- `2026_04_28_220000_add_performance_indexes.php`
- `2026_05_11_120000_add_performance_indexes_loans_payments.php`
- `2026_05_11_130000_add_more_performance_indexes.php`  ← new

After deploy:

```sh
php artisan migrate --force
```

Recommended `my.cnf` baseline for an 8-core / 16 GB box on production:

```ini
innodb_buffer_pool_size = 8G
innodb_log_file_size    = 512M
innodb_flush_method     = O_DIRECT
innodb_flush_neighbors  = 0
innodb_io_capacity      = 2000
max_connections         = 200
slow_query_log          = 1
long_query_time         = 0.5
log_queries_not_using_indexes = 1
```

## 5. Redis (cache + queue) — strongly recommended

Switch `.env` from `file`/`database` drivers to `redis` for cache, sessions, and queue:

```env
CACHE_STORE=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis
BROADCAST_CONNECTION=redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

Then start the queue + horizon:

```sh
php artisan horizon          # Laravel Horizon already requires it (composer.json)
```

Heavy work that should always queue (verify these are dispatched, not awaited):

- `SendLoanApplicationReceivedJob`, `SendLoanDecisionJob`
- Email + SMS notifications via `NotificationCenter`
- PDF generation (`PrintableForm*Controller`)

## 6. Vite / SPA

- Run `npm run build` and verify `dist/assets/*.js` are <250 KB each (chunked).
- Serve `dist/` from a CDN if available (CloudFront / Cloudflare). The `.htaccess`
  already sets `Cache-Control: max-age=31536000, immutable` for hashed assets.
- The service worker (`frontend/public/service-worker.js`) is registered lazily after
  `requestIdleCallback`; do **not** add long offline caches for borrower data — they'll
  desync from the API.

## 7. Database connection / N+1 watchdog

In `app/Providers/AppServiceProvider.php`, gate the following on local + staging:

```php
use Illuminate\Database\Eloquent\Model;

public function boot(): void
{
    Model::shouldBeStrict(! $this->app->isProduction());
}
```

This will throw on lazy loading, missing attributes, and silent SQL errors during development —
blocking new N+1 issues from reaching production.

## 8. Health endpoints

Wire the existing `/api/v1/health` endpoint into your uptime monitor, alerting on
p95 > 250 ms over 5 minutes.

## 9. .env hygiene (production)

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://amalgatedlending.com
LOG_CHANNEL=daily
LOG_LEVEL=warning
SESSION_SECURE_COOKIE=true
SANCTUM_STATEFUL_DOMAINS=amalgatedlending.com
```

`APP_DEBUG=false` is critical — debug mode disables many of the optimizations (route cache,
config cache, exception renderer caching) and leaks stack traces.

## 10. Smoke test

After every deploy, hit:

```sh
curl -sI https://amalgatedlending.com/                 # 200 + immutable assets cache
curl -sI https://amalgatedlending.com/assets/index-*.js
curl -s https://amalgatedlending.com/api/v1/health
```

Confirm `content-encoding: br` (or `gzip`) on text responses, and
`cache-control: public, max-age=31536000, immutable` on hashed assets.
