@extends('mail.layout', ['tagline' => 'Secure sign-in'])

@section('mail_body')
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;">Your one-time sign-in code</h1>
<p style="margin:0 0 16px;">Hi {{ $borrowerName }},</p>
<p style="margin:0 0 20px;">Use this code to sign in to your borrower account. It expires in <strong>{{ $expiresMinutes }} minutes</strong>.</p>
<p style="margin:0 0 24px;text-align:center;">
  <span style="display:inline-block;padding:16px 28px;background:#111827;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:0.35em;border-radius:10px;">{{ $code }}</span>
</p>
<p style="margin:0 0 16px;color:#475569;font-size:14px;">Never share this code with anyone — including people claiming to be from {{ config('app.name') }}.</p>
<p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">If you did not request this code, ignore this email and ensure your password is secure.</p>
@endsection
