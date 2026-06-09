<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Loan statement {{ $statement->loan_account_no }} - {{ $periodLabel }}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 28px; background: #fff; color: #111827; font-family: DejaVu Sans, sans-serif; font-size: 12px; }
    .eyebrow { margin: 12px 0 4px; color: #991b1b; font-size: 10px; font-weight: bold; letter-spacing: 0.12em; text-transform: uppercase; }
    h1 { margin: 0; font-size: 22px; color: #111827; }
    .subtle { color: #6b7280; line-height: 1.6; }
    .summary { display: table; width: 100%; margin-top: 20px; border: 1px solid #f3e8d6; border-radius: 12px; background: #fffaf0; }
    .summary-cell { display: table-cell; width: 33.333%; padding: 14px; border-right: 1px solid #f3e8d6; vertical-align: top; }
    .summary-cell:last-child { border-right: 0; }
    .label { color: #6b7280; font-size: 9px; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; }
    .value { margin-top: 5px; font-size: 16px; font-weight: bold; color: #111827; }
    table { width: 100%; margin-top: 18px; border-collapse: collapse; }
    th, td { border: 1px solid #e5e7eb; padding: 10px 12px; text-align: left; }
    th { width: 35%; background: #f9fafb; color: #6b7280; font-size: 10px; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; }
    .amount { font-weight: bold; color: #991b1b; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 10px; line-height: 1.6; }
  </style>
</head>
<body>
  @include('partials.company-corporate-header', ['logoDataUri' => $logoDataUri ?? null, 'logoSize' => 44])

  <p class="eyebrow">Borrower loan statement</p>
  <h1>{{ $periodLabel }}</h1>
  <p class="subtle">
    This document summarizes the borrower loan account for the selected statement period.
  </p>

  <div class="summary">
    <div class="summary-cell">
      <div class="label">Loan amount</div>
      <div class="value">PHP {{ $loanAmount }}</div>
    </div>
    <div class="summary-cell">
      <div class="label">Remaining balance</div>
      <div class="value">PHP {{ $remainingBalance }}</div>
    </div>
    <div class="summary-cell">
      <div class="label">Monthly due</div>
      <div class="value">PHP {{ $monthlyDue }}</div>
    </div>
  </div>

  <table>
    <tr><th>Borrower</th><td>{{ $borrower?->name ?? 'Borrower' }}</td></tr>
    <tr><th>Email</th><td>{{ $borrower?->email ?? '—' }}</td></tr>
    <tr><th>Loan account</th><td>{{ $statement->loan_account_no }}</td></tr>
    <tr><th>Statement period</th><td>{{ $periodLabel }}</td></tr>
    <tr><th>Due date</th><td>{{ $dueDateLabel }}</td></tr>
    <tr><th>Loan amount</th><td class="amount">PHP {{ $loanAmount }}</td></tr>
    <tr><th>Remaining balance</th><td class="amount">PHP {{ $remainingBalance }}</td></tr>
    <tr><th>Monthly due</th><td class="amount">PHP {{ $monthlyDue }}</td></tr>
  </table>

  <div class="footer">
    Generated {{ $generatedAt }} — {{ $companyName }}.<br>
    This is a system-generated statement. Please contact support if any account details need review.
  </div>
</body>
</html>
