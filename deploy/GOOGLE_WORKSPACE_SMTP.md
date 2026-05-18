# Google Workspace SMTP — Amalgated Lending

Transactional email (loan applications, payment receipts, password resets, CRM, chat escalations) is delivered through **Google Workspace SMTP** using `support@amalgatedlending.com`.

## 1. Google Workspace setup

1. Sign in to [Google Admin](https://admin.google.com) for `amalgatedlending.com`.
2. Ensure the mailbox `support@amalgatedlending.com` exists (or create an alias/group that delivers to your support team).
3. Enable **2-Step Verification** for that account (or a dedicated sending user).
4. Create an **App Password**: Google Account → Security → App passwords → Mail → Other (e.g. “Amalgated Lending API”).
5. Copy the 16-character password (no spaces) — this is `MAIL_PASSWORD` / `SMTP_PASS`. Never commit it to git.

## 2. Laravel API (`amalgated-lending-api/.env`)

```env
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=support@amalgatedlending.com
MAIL_PASSWORD=your-google-app-password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=support@amalgatedlending.com
MAIL_FROM_NAME="Amalgated Lending"

# Optional tuning
MAIL_RETRY_ATTEMPTS=3
MAIL_RETRY_DELAY_MS=750
MAIL_RATE_LIMIT_PER_MINUTE=40
MAIL_QUEUE_TRANSACTIONAL=false
MAIL_FALLBACK_MAILER=log
```

**Local development:** use MailHog (`MAIL_HOST=127.0.0.1`, `MAIL_PORT=1025`) or `MAIL_MAILER=log`.

Run queue workers when `MAIL_QUEUE_TRANSACTIONAL=true`:

```bash
php artisan queue:work
```

## 3. Node chat server (`chat-server/.env`)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=support@amalgatedlending.com
SMTP_PASS=your-google-app-password
MAIL_FROM="Amalgated Lending <support@amalgatedlending.com>"
```

## 4. DNS (deliverability)

Configure in your DNS host for `amalgatedlending.com`:

| Record | Purpose |
|--------|---------|
| **SPF** | `v=spf1 include:_spf.google.com ~all` |
| **DKIM** | Enable in Google Admin → Apps → Google Workspace → Gmail → Authenticate email |
| **DMARC** | `v=DMARC1; p=quarantine; rua=mailto:dmarc@amalgatedlending.com` |

Verify with [Google Admin Toolbox](https://toolbox.googleapps.com/apps/checkmx/) and send a test from **Admin → Settings → Email** (or `POST /api/v1/admin/email/test`).

## 5. Admin verification

- **Status:** `GET /api/v1/admin/email/status` (requires `settings.manage`)
- **Health:** `GET /api/v1/admin/email/health` (SMTP handshake)
- **Test send:** `POST /api/v1/admin/email/test` with `{ "to": "you@example.com" }`
- **Failed logs:** `GET /api/v1/admin/email/logs`

Chat server: `GET /api/admin/email/status` and `POST /api/admin/email/test` on the chat host.

## 6. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `535 Authentication failed` | Use an App Password, not the account login password. |
| `Connection timed out` | Allow outbound TCP 587 from the server; check firewall. |
| Mail goes to spam | Complete SPF/DKIM/DMARC; warm up sending volume. |
| `rate_limited` | Lower burst sends; increase `MAIL_RATE_LIMIT_PER_MINUTE` only if Google limits allow. |
| Receipts not sending | Ensure `php artisan queue:work` is running for queued jobs. |

## 7. Security

- Store credentials only in `.env` on the server (never in the frontend or git).
- Rotate App Passwords if exposed.
- Restrict admin test-email endpoint to authenticated staff with `settings.manage`.
- Use TLS (`MAIL_ENCRYPTION=tls`) on port 587.

## 8. Maintenance

- Review `email_logs` and `failed_notifications` weekly.
- Run `php artisan notifications:retry-failed` if you use the failed-notification retry command.
- After domain or mailbox changes, re-send a test email and check Gmail “Sent” on the support mailbox.
