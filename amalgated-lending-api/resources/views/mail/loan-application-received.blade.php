@extends('mail.layout')

@section('mail_body')
<p style="margin:0 0 14px;color:#64748b;font-size:13px;">Application reference · <strong style="color:#111827">{{ $loanRef ?? '' }}</strong></p>
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;">We received your loan application.</h1>
<p style="margin:0 0 16px;">
  Hi {{ $borrowerName }},
</p>
<p style="margin:0 0 16px;">
  Thank you for applying with {{ config('app.name', 'Amalgated Lending Inc.') }}. Your submission is queued for credit review by our underwriting team.
</p>
<table role="presentation" cellpadding="12" cellspacing="0" border="1" bordercolor="#e2e8f0" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:18px;">
  <tbody>
    <tr><td style="background:#f8fafc;font-weight:700;width:42%;">Reference</td><td>{{ $loanRef ?? '' }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Product</td><td>{{ $productLabel }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Branch note</td><td>{{ $branchNote }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Amount requested</td><td>₱ {{ $principal }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Term</td><td>{{ $termMonths }} months</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">System loan ID</td><td>#{{ $loanId }}</td></tr>
  </tbody>
</table>
<p style="margin:0 0 16px;color:#475569;font-size:14px;">
  We will email you once a decision has been recorded. You can also monitor status in your borrower portal.
</p>
<p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">
  If you did not submit this application, contact us immediately — this inbox is not monitored for replies for loan instructions.
</p>
@endsection
