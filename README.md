# Amalgated Lending Inc. Deployment Guide

This project has 3 deployable parts:
- Frontend (`frontend` built into `dist`) -> `https://amalgatedlending.com`
- Laravel API (`amalgated-lending-api`) -> `https://api.amalgatedlending.com`
- Node chat server (`chat-server`) -> `https://chat.amalgatedlending.com`

## Quick Start from Cursor

Run these commands in the Cursor terminal at repo root:

```bash
npm install
npm run build
```

This command builds frontend production assets in `dist/`.

## Server Prerequisites

- PHP 8.3+ with Laravel extensions
- MySQL database(s) and users
- Composer available on server
- Node.js runtime (PM2/systemd/Container) for chat server

## Recommended Deployment Layout

- Main domain docroot -> frontend files (`public_html`, from `frontend-dist/*`)
- API subdomain docroot -> `.../api-source/public`
- Chat subdomain -> Node app path for `chat-source`

## 1) Frontend Deploy

Before build, set local `/.env.production` values:

```env
VITE_LENDING_API_URL=https://api.amalgatedlending.com/api/v1
VITE_LENDING_PUBLIC_URL=https://api.amalgatedlending.com
VITE_AMALGATED_HOLDINGS_URL=https://amalgatedholdings.com
VITE_CHAT_SERVER_URL=https://chat.amalgatedlending.com
```

Upload the **contents** of `dist/` to your frontend document root.

## 2) Laravel API Deploy

Upload `amalgated-lending-api/` to server, then set API web root to `amalgated-lending-api/public`.

Inside `amalgated-lending-api` on server:

```bash
cp .env.example .env
composer install --no-dev --optimize-autoloader
php artisan key:generate --force
php artisan storage:link
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

Required API `.env` production values:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.amalgatedlending.com
FRONTEND_URL=https://amalgatedlending.com
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=<db_name>
DB_USERNAME=<db_user>
DB_PASSWORD=<db_password>
SANCTUM_STATEFUL_DOMAINS=amalgatedlending.com,www.amalgatedlending.com,api.amalgatedlending.com
```

Permissions:

```bash
chmod -R 775 storage bootstrap/cache
```

## 3) Chat Server Deploy

Upload `chat-server/` and run with PM2/systemd/container.

Recommended chat `.env`:

```env
PORT=8010
CHAT_CORS_ORIGINS=https://amalgatedlending.com,https://www.amalgatedlending.com
TRUST_PROXY=1
JWT_SECRET=<strong-random-secret>
LENDING_ADMIN_API_SECRET=<same-as-frontend-secret>
```

Optional MySQL backend:

```env
DB_PROVIDER=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=<chat_db_name>
MYSQL_USER=<chat_db_user>
MYSQL_PASSWORD=<chat_db_password>
```

## Smoke Test Checklist

- Frontend opens at `https://amalgatedlending.com`
- API responds under `https://api.amalgatedlending.com/api/v1/...`
- Chat connects from frontend to `https://chat.amalgatedlending.com`
- Login/auth flow works
- Laravel logs show no startup errors

## Common Deployment Problems

- API 500: check `storage/logs/laravel.log`, `.env`, and permissions
- API 404: API docroot is not pointed to Laravel `public`
- CORS/Sanctum issues: verify `SANCTUM_STATEFUL_DOMAINS`, `APP_URL`, `FRONTEND_URL`
- Frontend calling localhost: rebuild after fixing `/.env.production`
