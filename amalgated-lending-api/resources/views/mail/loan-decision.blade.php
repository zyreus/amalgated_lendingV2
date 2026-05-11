@extends('mail.layout')

@section('mail_body')
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;color:{{ $isRejected ? '#b45309' : '#15803d' }};">
  {{ $isRejected ? 'Loan decision: not approved' : 'Loan decision: approved' }}
</h1>
<p style="margin:0 0 16px;">Hi {{ $borrowerName }},</p>

@if(!$isRejected)
<p style="margin:0 0 16px;">Congratulations — your facility was <strong>approved</strong>. Your repayment schedule has been booked in our system.</p>
<table role="presentation" cellpadding="12" cellspacing="0" border="1" bordercolor="#e2e8f0" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:18px;">
  <tbody>
    <tr><td style="background:#f8fafc;font-weight:700;width:42%;">Reference</td><td>{{ $loanRef }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Branch</td><td>{{ $branchInstruction }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Approved principal</td><td>₱ {{ $principal }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Term</td><td>{{ $termMonths }} months</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Monthly amortization</td><td>₱ {{ $monthlyPayment }}</td></tr>
    @if(!empty($nextPaymentDue) && !empty($nextPaymentAmount))
    <tr><td style="background:#f8fafc;font-weight:700;">Next scheduled payment</td><td>₱ {{ $nextPaymentAmount }} · due {{ $nextPaymentDue }}</td></tr>
    @endif
    @if(isset($estimatedTotalPayments) && $estimatedTotalPayments !== '')
    <tr><td style="background:#f8fafc;font-weight:700;">Est. installments</td><td>{{ $estimatedTotalPayments }}</td></tr>
    @endif
    <tr><td style="background:#f8fafc;font-weight:700;">Approval date</td><td>{{ $approvedAt ?: '—' }}</td></tr>
  </tbody>
</table>
@if(!empty($schedulePreview))
<h2 style="font-size:14px;color:#475569;text-transform:uppercase;letter-spacing:0.06em;margin:20px 0 8px;">First payments (preview)</h2>
<table role="presentation" cellpadding="8" cellspacing="0" border="1" bordercolor="#e2e8f0" style="width:100%;border-collapse:collapse;font-size:12px;">
  <thead>
    <tr style="background:#f1f5f9;"><th align="left">#</th><th align="left">Due date</th><th align="right">Amount</th></tr>
  </thead>
  <tbody>
  @foreach($schedulePreview as $row)
    <tr>
      <td>{{ $row['no'] }}</td>
      <td>{{ $row['due'] }}</td>
      <td align="right">₱ {{ $row['amt'] }}</td>
    </tr>
  @endforeach
  </tbody>
</table>
@endif
@if(!empty($adminMessage))
<p style="margin:16px 0 8px;"><strong>Message from our team:</strong></p>
<p style="margin:0 0 16px;color:#334155;line-height:1.6;font-size:14px;white-space:pre-wrap;">{{ $adminMessage }}</p>
@endif
<p style="margin:16px 0 8px;"><strong>Next steps</strong></p>
<ul style="margin:0 0 16px;padding-left:20px;color:#475569;line-height:1.65;font-size:14px;">
  <li>Sign in to your <strong>borrower portal</strong> to review your repayment schedule and disbursement checklist.</li>
  <li>Visit your servicing branch <strong>{{ $branchInstruction }}</strong> to complete release formalities when advised by your loan officer.</li>
  <li>Keep this email for your records — quote reference <strong>{{ $loanRef }}</strong> in any follow-up.</li>
</ul>

@else
<p style="margin:0 0 16px;">
  After careful review, we regret that we cannot approve your application at this time.
</p>
<table role="presentation" cellpadding="12" cellspacing="0" border="1" bordercolor="#e2e8f0" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:18px;">
  <tbody>
    <tr><td style="background:#f8fafc;font-weight:700;width:42%;">Reference</td><td>{{ $loanRef }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Summary</td><td>Application not approved · System loan ID #{{ $loanId }}</td></tr>
  </tbody>
</table>
@if($rejectionReason !== '')
<p style="margin:0 0 16px;"><strong>Reviewer note:</strong><br>{{ $rejectionReason }}</p>
@endif
<p style="margin:16px 0 8px;"><strong>Reapplying</strong></p>
<ul style="margin:0 0 16px;padding-left:20px;color:#475569;line-height:1.65;font-size:14px;">
  <li>You may submit a <strong>new application</strong> from the borrower portal once you have addressed the points above (documentation, capacity, or collateral, as applicable).</li>
  <li>Use a fresh application wizard so underwriting receives your latest information — reference <strong>{{ $loanRef }}</strong> is for this decision only.</li>
  <li>If you believe this decision was reached in error, reply to this message or contact your preferred branch with supporting documents.</li>
</ul>
@endif

<p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">
  This automated notice references {{ config('app.name', 'Amalgated Lending Inc.') }} internal records — keep this email confidential.
</p>
@endsection
