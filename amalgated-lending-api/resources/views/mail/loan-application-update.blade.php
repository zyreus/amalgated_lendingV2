@extends('mail.layout')

@section('mail_body')
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;color:#1e293b;">Loan Application Update</h1>
<p style="margin:0 0 16px;">Dear {{ $borrowerName }},</p>
<p style="margin:0 0 16px;">Your loan application has been reviewed.</p>

<table role="presentation" cellpadding="12" cellspacing="0" border="1" bordercolor="#e2e8f0" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:18px;">
  <tbody>
    <tr><td style="background:#f8fafc;font-weight:700;width:42%;">Reference</td><td>{{ $loanRef }}</td></tr>
    @if($requestedAmount !== null)
    <tr><td style="background:#f8fafc;font-weight:700;">Requested Loan Amount</td><td>₱ {{ number_format((float) $requestedAmount, 2) }}</td></tr>
    @endif
    @if($previousApprovedAmount !== null && $eventType === 'amount_updated')
    <tr><td style="background:#f8fafc;font-weight:700;">Previous Approved Amount</td><td>₱ {{ number_format((float) $previousApprovedAmount, 2) }}</td></tr>
    @endif
    @if($approvedAmount !== null)
    <tr><td style="background:#f8fafc;font-weight:700;">Approved Loan Amount</td><td>₱ {{ number_format((float) $approvedAmount, 2) }}</td></tr>
    @endif
    @if(!empty($statusLabel))
    <tr><td style="background:#f8fafc;font-weight:700;">Current Status</td><td>{{ $statusLabel }}</td></tr>
    @endif
    @if(!empty($documentLabel))
    <tr><td style="background:#f8fafc;font-weight:700;">Document</td><td>{{ $documentLabel }}</td></tr>
    @endif
  </tbody>
</table>

@if(!empty($remarks))
<p style="margin:0 0 8px;font-weight:700;">Remarks</p>
<p style="margin:0 0 16px;white-space:pre-wrap;">{{ $remarks }}</p>
@elseif($eventType === 'amount_updated')
<p style="margin:0 0 16px;">The approved amount was determined based on collateral appraisal, credit investigation, and lending policies.</p>
@endif

<p style="margin:0 0 16px;">Please log in to your Borrower Portal to view complete details.</p>
<p style="margin:0;"><a href="{{ $portalUrl }}" style="color:#dc2626;font-weight:700;">Open Borrower Portal</a></p>
<p style="margin:24px 0 0;">Thank you.</p>
@endsection
