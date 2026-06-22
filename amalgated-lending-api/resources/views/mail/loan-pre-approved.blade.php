@extends('mail.layout')

@section('mail_body')
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;color:#15803d;">
  Your loan application is pre-approved
</h1>
<p style="margin:0 0 16px;">Hi {{ $borrowerName }},</p>

<p style="margin:0 0 16px;">
  Good news — our team has <strong>pre-approved</strong> your loan application after an initial review.
  This is not the final release yet; we still need to complete final approval and your in-branch confirmation.
</p>

<table role="presentation" cellpadding="12" cellspacing="0" border="1" bordercolor="#e2e8f0" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:18px;">
  <tbody>
    <tr><td style="background:#f8fafc;font-weight:700;width:42%;">Reference</td><td>{{ $loanRef }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Status</td><td>Pre-approved — awaiting final approval</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Branch</td><td>{{ $branchInstruction }}</td></tr>
    @if((float) str_replace(',', '', $principal) > 0)
    <tr><td style="background:#f8fafc;font-weight:700;">Requested amount</td><td>₱ {{ $principal }}</td></tr>
    @endif
    @if($termMonths)
    <tr><td style="background:#f8fafc;font-weight:700;">Term</td><td>{{ $termMonths }} months</td></tr>
    @endif
    <tr><td style="background:#f8fafc;font-weight:700;">Pre-approved on</td><td>{{ $preApprovedAt ?: '—' }}</td></tr>
  </tbody>
</table>

@if(!empty($adminMessage))
<p style="margin:0 0 8px;"><strong>Message from our team:</strong></p>
<p style="margin:0 0 16px;color:#334155;line-height:1.6;font-size:14px;white-space:pre-wrap;">{{ $adminMessage }}</p>
@endif

<p style="margin:16px 0 8px;"><strong>What happens next</strong></p>
<ul style="margin:0 0 16px;padding-left:20px;color:#475569;line-height:1.65;font-size:14px;">
  <li>Please <strong>wait for final approval</strong> from our loan team. You will receive another notice once your loan is fully approved.</li>
  <li><strong>Schedule a visit</strong> to your servicing branch <strong>{{ $branchInstruction }}</strong> to confirm your loan application and complete any remaining requirements.</li>
  <li>Bring valid ID and any documents your loan officer may request for verification.</li>
  <li>Sign in to your <strong><a href="{{ $portalUrl }}" style="color:#d92243;">borrower portal</a></strong> to track status updates and messages from our team.</li>
</ul>

<p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">
  Quote reference <strong>{{ $loanRef }}</strong> when you visit the branch or contact support.
  This automated notice is from {{ config('app.name', 'Amalgated Lending Inc.') }} — keep this email confidential.
</p>
@endsection
