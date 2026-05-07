# Rollback Checkpoints

## Before Release

- Export MySQL schema and data snapshot.
- Save current `.env` for API and chat server.
- Capture baseline metrics (`npm run perf:baseline`).

## If Release Degrades

1. Stop queue workers (`php artisan horizon:terminate`).
2. Roll back application release.
3. Revert latest migration batch if required (`php artisan migrate:rollback --step=1`).
4. Restore previous cache/queue env settings.
5. Clear and rebuild cache:
   - `php artisan optimize:clear`
   - `php artisan config:cache`
6. Re-enable workers and verify health endpoints.

## Post-Rollback Validation

- `GET /api/v1/health` returns `{"ok":true}`
- Chat server `/health` returns `ok=true`
- Admin login + chat send + feedback submit + payment listing all succeed

