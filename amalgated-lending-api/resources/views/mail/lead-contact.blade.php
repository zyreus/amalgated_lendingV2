<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $subjectLine }}</title>
</head>
<body style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; line-height: 1.6; color: #111827; max-width: 640px; margin: 0; padding: 24px;">
    <p style="margin: 0 0 16px;">Hello {{ $leadName }},</p>
    <div style="margin: 0 0 24px; white-space: pre-wrap;">{!! nl2br(e($bodyText)) !!}</div>
    <p style="margin: 0; color: #374151;">
        — {{ $senderName }}<br>
        <span style="font-size: 13px; color: #6b7280;">Amalgated Lending Inc.</span>
    </p>
</body>
</html>
