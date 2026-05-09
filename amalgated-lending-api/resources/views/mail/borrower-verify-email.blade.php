@extends('mail.layout')

@section('mail_body')
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;">Confirm your email address</h1>
<p style="margin:0 0 14px;">Hi {{ $borrowerName }},</p>
<p style="margin:0 0 18px;line-height:1.55;color:#475569;">
  You're almost finished — tap the button below to verify this email belongs to you. Links expire after <strong>{{ $expiresHours }}</strong> hours for security.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td bgcolor="#DC2626" style="border-radius:10px;">
  <a href="{{ $verificationUrl }}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">Verify email</a>
</td></tr></table>
<p style="margin:0 0 12px;color:#64748b;font-size:13px;line-height:1.5;">
  Copy &amp; paste this URL if you cannot tap the button:<br>
  <span style="word-break:break-all;">{{ $verificationUrl }}</span>
</p>
<p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">If you did not create this account you can ignore this mail.</p>
@endsection
