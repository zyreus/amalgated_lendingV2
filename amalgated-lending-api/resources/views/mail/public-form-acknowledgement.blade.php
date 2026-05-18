@extends('mail.layout')

@section('mail_body')
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;">{{ $headline }}</h1>
<p style="margin:0 0 16px;">Hi {{ $recipientName }},</p>
<p style="margin:0 0 16px;">Thank you for reaching out to {{ config('app.name', 'Amalgated Lending Inc.') }}. This email confirms we received your submission.</p>
<p style="margin:0 0 20px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;color:#334155;">{{ $summaryLine }}</p>
@if($formType === 'loan_inquiry')
<p style="margin:0 0 16px;">A lending specialist will review your inquiry and contact you using the details you provided. Typical response time is one business day.</p>
@elseif($formType === 'newsletter')
<p style="margin:0 0 16px;">You'll receive updates about products, rates, and company news. You can unsubscribe anytime by replying to this email.</p>
@else
<p style="margin:0 0 16px;">Our team will respond as soon as possible during business hours.</p>
@endif
<p style="margin:24px 0 0;">
  <a href="{{ $portalUrl }}" style="display:inline-block;padding:12px 22px;background:#ff0000;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Visit borrower portal</a>
</p>
<p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">This is an automated confirmation. Please do not reply with sensitive information such as passwords or ID numbers.</p>
@endsection
