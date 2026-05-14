@extends('mail.layout')

@section('mail_body')
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;color:#15803d;">Payment confirmed — thank you</h1>
<p style="margin:0 0 16px;">Hi {{ $borrowerName }},</p>
<p style="margin:0 0 18px;font-size:15px;color:#475569;">
  We have credited your instalment toward loan <strong>{{ $loanNumber }}</strong>. Please retain this receipt for your records.
</p>
<table role="presentation" cellpadding="12" cellspacing="0" border="1" bordercolor="#e2e8f0" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:14px;">
  <tbody>
    <tr><td style="background:#f8fafc;font-weight:700;width:42%;">Official receipt No.</td><td style="font-weight:700;color:#991b1b;">{{ $officialOr }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Acknowledgement receipt (AR) No.</td><td>{{ $acknowledgementAr ?? '—' }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Invoice ref.</td><td>{{ $invoiceNumber }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Installment no.</td><td>{{ $installmentNo }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Amount paid</td><td>₱ {{ $amountPaid }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Payment method</td><td>{{ $paymentMethodLabel }}</td></tr>
    @if(!empty($referenceNumber))
    <tr><td style="background:#f8fafc;font-weight:700;">Reference / trace No.</td><td>{{ $referenceNumber }}</td></tr>
    @endif
    <tr><td style="background:#f8fafc;font-weight:700;">Date posted</td><td>{{ $paidAt }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Remaining balance*</td><td>₱ {{ $remainingBalance }}</td></tr>
  </tbody>
</table>
@if(!empty($breakdownInterest) || !empty($breakdownPrincipal))
<table role="presentation" cellpadding="10" cellspacing="0" border="1" bordercolor="#e5e7eb" style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
  <tbody>
    @if(!empty($breakdownPrincipal))
    <tr><td style="background:#fafafa;width:52%;font-weight:600;">Principal allocation</td><td align="right">₱ {{ $breakdownPrincipal }}</td></tr>
    @endif
    @if(!empty($breakdownInterest))
    <tr><td style="background:#fafafa;font-weight:600;">Interest / service fee</td><td align="right">₱ {{ $breakdownInterest }}</td></tr>
    @endif
  </tbody>
</table>
@endif
<p style="margin:12px 0 0;color:#94a3b8;font-size:11px;line-height:1.5;">
  *Outstanding balance aggregates scheduled instalments remaining on the ledger and may fluctuate daily with penalties/adjustments.
</p>
<p style="margin:20px 0 0;font-size:12px;color:#64748b;">
  {{ $attachmentNote }}
  @if(!empty($portalPaymentsUrl))
    <br><a href="{{ $portalPaymentsUrl }}" style="color:#b91c1c;font-weight:600;">Open borrower payments</a>
  @endif
</p>
@endsection
