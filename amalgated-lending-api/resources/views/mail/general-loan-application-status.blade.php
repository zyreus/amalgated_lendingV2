<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;">
  {{ $headline ?? 'Loan application portal update' }}
</h1>
<p style="margin:0 0 16px;">Hi {{ $borrowerName }},</p>
@if($status === \App\Models\LoanApplication::STATUS_PENDING)
<p style="margin:0 0 16px;">Thank you — <strong>application #{{ $applicationId }}</strong> ({{ str_replace('_',' ', $loanType) }}) has been lodged for review{{ $submittedAt ? ', submitted '.$submittedAt : '' }}.</p>
@elseif($status === \App\Models\LoanApplication::STATUS_REJECTED)
<p style="margin:0 0 16px;color:#b45309;">Your application #{{ $applicationId }} requires attention — it could not proceed at this time.</p>
@if(!empty($rejectionReason))
<p style="margin:0 0 16px;line-height:1.55;background:#fef3c7;padding:14px;border-radius:8px;border:1px solid #fcd34d;font-size:14px;">{{ $rejectionReason }}</p>
@endif
<p style="margin:0 0 16px;color:#475569;font-size:14px;">You may revise documents and initiate a fresh submission from the borrower portal wizard.</p>
@else
<p style="margin:0 0 16px;color:#15803d;">Great news — application #{{ $applicationId }} is <strong>{{ $status }}</strong>. Please log in for next steps regarding release / agreement signing.</p>
@endif

<table role="presentation" cellpadding="12" cellspacing="0" border="1" bordercolor="#e2e8f0" style="width:100%;border-collapse:collapse;font-size:14px;">
  <tbody>
    <tr><td style="background:#f8fafc;width:42%;font-weight:700;">Reference</td><td>APP-{{ str_pad((string) $applicationId, 8, '0', STR_PAD_LEFT) }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Product type</td><td>{{ str_replace('_',' ', ucwords(str_replace('_', ' ', $loanType))) }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Status flag</td><td>{{ strtoupper($status) }}</td></tr>
  </tbody>
</table>

<p style="margin:22px 0 0;color:#94a3b8;font-size:12px;">
  Confidential · {{ config('app.name', 'Amalgated Lending Inc.') }}
</p>
@endsection
