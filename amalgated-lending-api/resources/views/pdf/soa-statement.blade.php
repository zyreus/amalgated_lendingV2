<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{{ $statement->statement_number }} - Statement of Account</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 26px; color: #111827; font-family: DejaVu Sans, sans-serif; font-size: 11px; }
    .eyebrow { margin: 14px 0 4px; color: #991b1b; font-size: 9px; font-weight: bold; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 0; font-size: 22px; color: #111827; }
    h2 { margin: 18px 0 8px; font-size: 13px; color: #111827; }
    .muted { color: #6b7280; line-height: 1.55; }
    .summary { display: table; width: 100%; margin-top: 18px; border: 1px solid #f3e8d6; background: #fffaf0; }
    .summary-cell { display: table-cell; width: 25%; padding: 12px; border-right: 1px solid #f3e8d6; vertical-align: top; }
    .summary-cell:last-child { border-right: 0; }
    .label { color: #6b7280; font-size: 8px; font-weight: bold; letter-spacing: .08em; text-transform: uppercase; }
    .value { margin-top: 5px; font-size: 14px; font-weight: bold; color: #111827; }
    .amount { color: #991b1b; }
    table { width: 100%; margin-top: 8px; border-collapse: collapse; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 9px; text-align: left; vertical-align: top; }
    th { background: #f9fafb; color: #6b7280; font-size: 8px; font-weight: bold; letter-spacing: .08em; text-transform: uppercase; }
    .grid { display: table; width: 100%; margin-top: 14px; }
    .grid-col { display: table-cell; width: 50%; vertical-align: top; }
    .grid-col:first-child { padding-right: 8px; }
    .grid-col:last-child { padding-left: 8px; }
    .footer { margin-top: 26px; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 9px; line-height: 1.6; }
    .signature { margin-top: 34px; width: 220px; border-top: 1px solid #111827; padding-top: 6px; text-align: center; color: #374151; }
  </style>
</head>
<body>
  @include('partials.company-pdf-header', [
      'logoDataUri' => $logoDataUri ?? null,
      'useImageLogo' => $useImageLogo ?? true,
  ])

  <p class="eyebrow">Monthly Statement of Account</p>
  <h1>{{ $statement->statement_month?->format('F Y') }} Statement</h1>
  <p class="muted">Statement No. {{ $statement->statement_number }} · Generated {{ $generatedAt }}</p>

  <div class="summary">
    <div class="summary-cell"><div class="label">Monthly due</div><div class="value">PHP {{ number_format((float) $statement->monthly_due, 2) }}</div></div>
    <div class="summary-cell"><div class="label">Penalties</div><div class="value">PHP {{ number_format((float) $statement->penalties, 2) }}</div></div>
    <div class="summary-cell"><div class="label">Total due</div><div class="value amount">PHP {{ number_format((float) $statement->total_due, 2) }}</div></div>
    <div class="summary-cell"><div class="label">Due date</div><div class="value">{{ $statement->due_date?->format('M j, Y') ?? '—' }}</div></div>
  </div>

  <div class="grid">
    <div class="grid-col">
      <h2>Borrower Information</h2>
      <table>
        <tr><th>Name</th><td>{{ $borrower?->name ?? 'Borrower' }}</td></tr>
        <tr><th>Email</th><td>{{ $borrower?->email ?? '—' }}</td></tr>
        <tr><th>Phone</th><td>{{ $borrower?->phone ?? '—' }}</td></tr>
      </table>
    </div>
    <div class="grid-col">
      <h2>Loan Information</h2>
      <table>
        <tr><th>Loan account</th><td>{{ $loan?->loan_number ?? ('LN-'.str_pad((string) $statement->loan_id, 6, '0', STR_PAD_LEFT)) }}</td></tr>
        <tr><th>Principal</th><td>PHP {{ number_format((float) ($loan?->principal ?? 0), 2) }}</td></tr>
        <tr><th>Remaining balance</th><td class="amount">PHP {{ number_format((float) $statement->remaining_balance, 2) }}</td></tr>
      </table>
    </div>
  </div>

  <h2>Statement Breakdown</h2>
  <table>
    <tr><th>Monthly amortization</th><td>PHP {{ number_format((float) $statement->monthly_due, 2) }}</td></tr>
    <tr><th>Penalties and charges</th><td>PHP {{ number_format((float) $statement->penalties, 2) }}</td></tr>
    <tr><th>Total amount due</th><td class="amount">PHP {{ number_format((float) $statement->total_due, 2) }}</td></tr>
    <tr><th>Payment status</th><td>{{ ucfirst(str_replace('_', ' ', (string) $statement->status)) }}</td></tr>
  </table>

  <h2>Payment History Summary</h2>
  <table>
    <thead>
      <tr><th>Installment</th><th>Due date</th><th>Amount due</th><th>Paid</th><th>OR #</th><th>AR #</th><th>Penalty</th><th>Status</th></tr>
    </thead>
    <tbody>
      @forelse($payments as $payment)
        <tr>
          <td>#{{ $payment['installment_no'] ?? '—' }}</td>
          <td>{{ $payment['due_date'] ?? '—' }}</td>
          <td>PHP {{ number_format((float) ($payment['amount_due'] ?? 0), 2) }}</td>
          <td>PHP {{ number_format((float) ($payment['amount_paid'] ?? 0), 2) }}</td>
          <td>{{ $payment['official_receipt_number'] ?? $payment['or_number'] ?? '—' }}</td>
          <td>{{ $payment['acknowledgement_receipt_number'] ?? $payment['ar_number'] ?? '—' }}</td>
          <td>PHP {{ number_format((float) ($payment['penalty_amount'] ?? 0), 2) }}</td>
          <td>{{ ucfirst((string) ($payment['status'] ?? 'pending')) }}</td>
        </tr>
      @empty
        <tr><td colspan="8">No payment schedule found for this loan.</td></tr>
      @endforelse
    </tbody>
  </table>

  <div class="footer">
    This is an official system-generated Statement of Account from {{ $companyName }}. Keep this document for your records.
    <div class="signature">Authorized Finance Officer</div>
  </div>
</body>
</html>
