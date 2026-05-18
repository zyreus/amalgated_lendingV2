@extends('mail.layout')

@section('mail_body')
<p style="margin:0 0 14px;color:#64748b;font-size:13px;">Loan reference · <strong style="color:#111827">{{ $loanRef }}</strong></p>
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;">{{ $headline }}</h1>
<p style="margin:0 0 16px;">Hi {{ $borrowerName }},</p>
@if($variant === 'overdue')
<p style="margin:0 0 16px;">Installment <strong>#{{ $installment }}</strong> is <strong>{{ abs($daysOffset) }} day(s) overdue</strong>. Please pay as soon as possible to avoid penalties and protect your credit standing.</p>
@else
<p style="margin:0 0 16px;">Installment <strong>#{{ $installment }}</strong> is due in <strong>{{ $daysOffset }} day(s)</strong> ({{ $dueDate }}). Plan your payment to stay on schedule.</p>
@endif
<table role="presentation" cellpadding="12" cellspacing="0" border="1" bordercolor="#e2e8f0" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:18px;">
  <tbody>
    <tr><td style="background:#f8fafc;font-weight:700;width:42%;">Amount due</td><td>₱ {{ $amount }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Due date</td><td>{{ $dueDate }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Installment</td><td>#{{ $installment }}</td></tr>
  </tbody>
</table>
<p style="margin:24px 0 0;">
  <a href="{{ $portalUrl }}" style="display:inline-block;padding:12px 22px;background:#ff0000;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View payments</a>
</p>
<p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">If you already paid, please allow up to one business day for posting. Contact support if you need assistance.</p>
@endsection
