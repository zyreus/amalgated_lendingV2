<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Official receipt {{ $officialOr }}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #0f172a; margin: 0; padding: 28px; }
    .meta-row { display: table; width: 100%; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
    .meta-left { display: table-cell; vertical-align: top; width: 58%; }
    .meta-right { display: table-cell; vertical-align: top; text-align: right; font-size: 11px; color: #475569; }
    .meta-right div { margin-bottom: 8px; }
    .badge { display: inline-block; margin-top: 6px; padding: 4px 10px; background: #ecfdf5; color: #047857; font-weight: bold; border-radius: 4px; font-size: 11px; }
    table.data { width: 100%; border-collapse: collapse; margin-top: 12px; }
    table.data th, table.data td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
    table.data th { background: #f8fafc; width: 38%; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; line-height: 1.5; }
  </style>
</head>
<body>
  @include('partials.company-corporate-header', ['logoDataUri' => $logoDataUri ?? null, 'logoSize' => 40])

  <p style="margin:10px 0 0;font-size:11px;font-weight:bold;color:#991b1b;text-transform:uppercase;letter-spacing:0.06em;">Official payment receipt / invoice</p>

  <div class="meta-row">
    <div class="meta-left">
      &nbsp;
    </div>
    <div class="meta-right">
      <div><strong>Receipt No.</strong><br>{{ $officialOr !== '' ? $officialOr : '—' }}</div>
      <div><strong>AR No.</strong><br>{{ ($acknowledgementAr ?? '') !== '' ? $acknowledgementAr : '—' }}</div>
      <div><strong>Invoice ref.</strong><br>{{ $invoiceNumber }}</div>
      <span class="badge">PAID</span>
      @if(!empty($receiptQrDataUri))
        <div style="margin-top:10px;"><img src="{{ $receiptQrDataUri }}" alt="Verification QR" style="width:92px;height:92px;"></div>
      @endif
    </div>
  </div>

  <table class="data">
    <tr><th>Official receipt (OR)</th><td>{{ $officialOr !== '' ? $officialOr : '—' }}</td></tr>
    <tr><th>Acknowledgement receipt (AR)</th><td>{{ ($acknowledgementAr ?? '') !== '' ? $acknowledgementAr : '—' }}</td></tr>
    <tr><th>Borrower</th><td>{{ $borrowerName }}</td></tr>
    <tr><th>Loan reference</th><td>{{ $loanNumber }}</td></tr>
    <tr><th>Installment</th><td>#{{ $installmentNo }}</td></tr>
    <tr><th>Amount paid</th><td>₱ {{ $amountPaid }}</td></tr>
    <tr><th>Scheduled amount</th><td>₱ {{ $amountDue }}</td></tr>
    <tr><th>Payment date (posted)</th><td>{{ $paidAt }}</td></tr>
    <tr><th>Confirmed</th><td>{{ $confirmationDate }}</td></tr>
    <tr><th>Payment method</th><td>{{ $paymentMethod }}</td></tr>
    @if($referenceNumber !== '')
    <tr><th>Reference / trace No.</th><td>{{ $referenceNumber }}</td></tr>
    @endif
    <tr><th>Principal allocation</th><td>₱ {{ $principalPortion }}</td></tr>
    <tr><th>Interest / charges</th><td>₱ {{ $interestPortion }}</td></tr>
    <tr><th>Remaining scheduled balance*</th><td>₱ {{ $remainingBalance }}</td></tr>
  </table>

  <div class="footer">
    *Remaining balance is the sum of unpaid scheduled installments on the ledger and may change with penalties or adjustments.<br>
    Generated {{ $generatedAt }} — {{ $companyName }} — keep this document for your records.
  </div>
</body>
</html>
