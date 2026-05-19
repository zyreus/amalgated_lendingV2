@extends('mail.layout')

@section('mail_body')
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#18181b;">Reset your password</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46;">
        Hello {{ $userName }},
    </p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3f3f46;">
        We received a request to reset the password for your {{ config('app.name', 'Amalgated Lending Inc.') }} account.
        Click the button below to choose a new password. This link expires in {{ $expireMinutes }} minutes.
    </p>
    <p style="margin:0 0 24px;text-align:center;">
        <a href="{{ $resetUrl }}"
            style="display:inline-block;padding:14px 28px;background:#DC2626;color:#ffffff;text-decoration:none;font-weight:600;border-radius:10px;font-size:15px;">
            Reset password
        </a>
    </p>
    <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#71717a;word-break:break-all;">
        Or copy this link: <a href="{{ $resetUrl }}" style="color:#DC2626;">{{ $resetUrl }}</a>
    </p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#71717a;">
        If you did not request a password reset, you can safely ignore this email. Your password will not change.
    </p>
@endsection
