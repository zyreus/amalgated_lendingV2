<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>SMTP Test</title>
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; color: #1f2937;">
    <h2 style="margin: 0 0 12px; color: #2F6FA3;">{{ $appName }} — SMTP test</h2>
    <p style="margin: 0 0 12px; line-height: 1.6;">
        Your Google Workspace SMTP configuration is working. Transactional emails (loan updates, receipts, password resets, CRM) will be sent through this mailer.
    </p>
    <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">
        Host: {{ $mailHost ?: 'smtp.gmail.com' }} · From: {{ $fromAddress }}
    </p>
    <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">Sent at {{ $sentAt }}</p>
</body>
</html>
