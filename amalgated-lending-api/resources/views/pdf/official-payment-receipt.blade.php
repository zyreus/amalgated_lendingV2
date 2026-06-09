@php
  $legalName = (string) config('company.print_legal_name', $companyName ?? config('app.name', 'Amalgated Lending Inc.'));
  $tagline = (string) config('company.print_tagline', 'Lending Hope, Building Futures.');
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Official receipt {{ $officialOr }}</title>
  <style>
    * { box-sizing: border-box; }
    @page { margin: 24px; }
    body {
      font-family: DejaVu Sans, Arial, sans-serif;
      font-size: 11px;
      color: #111827;
      margin: 0;
      padding: 0;
      background: #ffffff;
      line-height: 1.35;
    }
    .receipt-shell {
      width: 100%;
      border: 1px solid #d8dee8;
      border-radius: 10px;
      padding: 18px 20px 14px;
      background: #ffffff;
    }
    .header-table,
    .brand-table,
    .meta-table,
    .summary-table,
    .data {
      width: 100%;
      border-collapse: collapse;
    }
    .header-table td,
    .brand-table td,
    .meta-table td,
    .summary-table td {
      border: 0;
      padding: 0;
      vertical-align: top;
    }
    .brand-cell { width: 62%; padding-right: 16px; }
    .meta-cell { width: 38%; }
    .logo-wrap {
      width: 62px;
      height: 62px;
      border: 2px solid #b91c1c;
      border-radius: 999px;
      text-align: center;
      padding: 5px;
      background: #ffffff;
    }
    .logo-wrap img {
      width: 48px;
      height: 48px;
      object-fit: contain;
    }
    .logo-fallback {
      font-size: 17px;
      font-weight: 800;
      color: #b91c1c;
      line-height: 48px;
      letter-spacing: 0.04em;
    }
    .brand-copy { padding-left: 12px; vertical-align: middle !important; }
    .company-name {
      margin: 2px 0 4px;
      font-size: 18px;
      font-weight: 800;
      color: #111827;
      text-transform: uppercase;
      letter-spacing: 0.045em;
      line-height: 1.12;
    }
    .tagline {
      margin: 0;
      font-size: 10.5px;
      color: #64748b;
      font-style: italic;
    }
    .document-title {
      margin: 12px 0 0;
      font-size: 12px;
      font-weight: 800;
      color: #991b1b;
      text-transform: uppercase;
      letter-spacing: 0.09em;
    }
    .receipt-card {
      border: 1px solid #dbe3ee;
      border-radius: 8px;
      background: #f8fafc;
      padding: 10px 11px;
    }
    .meta-table td {
      padding: 2px 0 5px;
      font-size: 10px;
      color: #64748b;
    }
    .meta-table .meta-label {
      width: 40%;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.045em;
    }
    .meta-table .meta-value {
      width: 60%;
      text-align: right;
      color: #0f172a;
      font-weight: 700;
    }
    .badge {
      display: inline-block;
      margin-top: 3px;
      padding: 5px 14px;
      background: #16a34a;
      color: #ffffff;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .divider {
      height: 1px;
      background: #cbd5e1;
      margin: 14px 0 12px;
    }
    .summary-table { margin-bottom: 12px; }
    .summary-copy {
      width: 65%;
      padding-right: 18px !important;
      color: #475569;
    }
    .summary-copy .label {
      margin: 0 0 5px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
    }
    .summary-copy .headline {
      margin: 0 0 4px;
      font-size: 15px;
      font-weight: 800;
      color: #111827;
    }
    .summary-copy .subtext {
      margin: 0;
      font-size: 10.5px;
      color: #64748b;
      line-height: 1.45;
    }
    .qr-cell {
      width: 35%;
      text-align: right;
    }
    .qr-box {
      display: inline-block;
      width: 128px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 7px;
      text-align: center;
      background: #ffffff;
    }
    .qr-box img {
      width: 88px;
      height: 88px;
      display: block;
      margin: 0 auto 4px;
    }
    .qr-label {
      font-size: 9px;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.07em;
    }
    .qr-note {
      margin-top: 2px;
      font-size: 8px;
      color: #94a3b8;
    }
    table.data {
      border: 1px solid #dbe3ee;
      border-radius: 8px;
      overflow: hidden;
      margin: 0;
      table-layout: fixed;
    }
    table.data th,
    table.data td {
      border: 1px solid #e3e8ef;
      padding: 7px 9px;
      text-align: left;
      vertical-align: middle;
    }
    table.data th {
      width: 25%;
      background: #f1f5f9;
      color: #475569;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.045em;
    }
    table.data td {
      width: 25%;
      color: #111827;
      font-size: 10.5px;
      font-weight: 600;
    }
    table.data tr.alt th,
    table.data tr.alt td {
      background: #fbfdff;
    }
    table.data .section-row td {
      padding: 6px 9px;
      background: #991b1b;
      color: #ffffff;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    table.data .amount-label {
      background: #f8fafc;
      font-size: 10px;
      color: #334155;
    }
    table.data .money {
      text-align: right;
      font-weight: 800;
      font-size: 11px;
      white-space: nowrap;
    }
    table.data .highlight th,
    table.data .highlight td {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }
    table.data .highlight .money {
      color: #047857;
      font-size: 12px;
    }
    table.data .balance th,
    table.data .balance td {
      background: #fff7ed;
      border-color: #fed7aa;
    }
    table.data .balance .money {
      color: #9a3412;
      font-size: 12px;
    }
    .footer {
      margin-top: 13px;
      padding-top: 9px;
      border-top: 1px solid #cbd5e1;
      font-size: 8.8px;
      color: #64748b;
      line-height: 1.45;
    }
    .footer-table {
      width: 100%;
      border-collapse: collapse;
    }
    .footer-table td {
      border: 0;
      padding: 0;
      vertical-align: top;
    }
    .footer-left { width: 55%; }
    .footer-right {
      width: 45%;
      text-align: right;
      color: #94a3b8;
    }
    .signature {
      margin-top: 14px;
      text-align: right;
      color: #0f172a;
    }
    .signature .line {
      display: inline-block;
      min-width: 210px;
      border-top: 1px solid #334155;
      padding-top: 5px;
      font-weight: 800;
    }
    .signature .role {
      color: #64748b;
      font-size: 9.5px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="receipt-shell">
    <table class="header-table" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td class="brand-cell">
          <table class="brand-table" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="width:66px;">
                <div class="logo-wrap">
                  @if(!empty($logoDataUri))
                    <img src="{{ $logoDataUri }}" alt="{{ $legalName }}">
                  @else
                    <div class="logo-fallback">ALI</div>
                  @endif
                </div>
              </td>
              <td class="brand-copy">
                <p class="company-name">{{ $legalName }}</p>
                <p class="tagline">{{ $tagline }}</p>
                <p class="document-title">Official Payment Receipt / Invoice</p>
              </td>
            </tr>
          </table>
        </td>
        <td class="meta-cell">
          <div class="receipt-card">
            <table class="meta-table" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td class="meta-label">Receipt No.</td>
                <td class="meta-value">{{ $officialOr !== '' ? $officialOr : '—' }}</td>
              </tr>
              <tr>
                <td class="meta-label">AR No.</td>
                <td class="meta-value">{{ ($acknowledgementAr ?? '') !== '' ? $acknowledgementAr : '—' }}</td>
              </tr>
              <tr>
                <td class="meta-label">Invoice Ref.</td>
                <td class="meta-value">{{ $invoiceNumber }}</td>
              </tr>
              <tr>
                <td class="meta-label">Status</td>
                <td class="meta-value"><span class="badge">Paid</span></td>
              </tr>
            </table>
          </div>
        </td>
      </tr>
    </table>

    <div class="divider"></div>

    <table class="summary-table" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td class="summary-copy">
          <p class="label">Payment Confirmation</p>
          <p class="headline">Payment received for loan {{ $loanNumber }}</p>
          <p class="subtext">
            This receipt confirms that the posted installment payment below has been credited to the borrower ledger.
            Please retain this document for account verification and audit reference.
          </p>
        </td>
        <td class="qr-cell">
          @if(!empty($receiptQrDataUri))
            <div class="qr-box">
              <img src="{{ $receiptQrDataUri }}" alt="Verification QR">
              <div class="qr-label">Scan to Verify</div>
              <div class="qr-note">OR / AR reference</div>
            </div>
          @endif
        </td>
      </tr>
    </table>

    <table class="data" cellpadding="0" cellspacing="0">
      <tr class="section-row">
        <td colspan="4">Receipt Details</td>
      </tr>
      <tr>
        <th>Official receipt (OR)</th>
        <td>{{ $officialOr !== '' ? $officialOr : '—' }}</td>
        <th>Acknowledgement receipt (AR)</th>
        <td>{{ ($acknowledgementAr ?? '') !== '' ? $acknowledgementAr : '—' }}</td>
      </tr>
      <tr class="alt">
        <th>Borrower</th>
        <td>{{ $borrowerName }}</td>
        <th>Loan reference</th>
        <td>{{ $loanNumber }}</td>
      </tr>
      <tr>
        <th>Installment</th>
        <td>#{{ $installmentNo }}</td>
        <th>Payment method</th>
        <td>{{ $paymentMethod }}</td>
      </tr>
      <tr class="alt">
        <th>Payment date (posted)</th>
        <td>{{ $paidAt }}</td>
        <th>Confirmed</th>
        <td>{{ $confirmationDate }}</td>
      </tr>
      @if($referenceNumber !== '')
      <tr>
        <th>Reference / trace No.</th>
        <td colspan="3">{{ $referenceNumber }}</td>
      </tr>
      @endif
      <tr class="section-row">
        <td colspan="4">Financial Summary</td>
      </tr>
      <tr class="highlight">
        <th colspan="3" class="amount-label">Amount Paid</th>
        <td class="money">₱ {{ $amountPaid }}</td>
      </tr>
      <tr class="alt">
        <th colspan="3" class="amount-label">Scheduled Amount</th>
        <td class="money">₱ {{ $amountDue }}</td>
      </tr>
      <tr>
        <th colspan="3" class="amount-label">Principal Allocation</th>
        <td class="money">₱ {{ $principalPortion }}</td>
      </tr>
      <tr class="alt">
        <th colspan="3" class="amount-label">Interest / Charges</th>
        <td class="money">₱ {{ $interestPortion }}</td>
      </tr>
      <tr class="balance">
        <th colspan="3" class="amount-label">Remaining Scheduled Balance*</th>
        <td class="money">₱ {{ $remainingBalance }}</td>
      </tr>
    </table>

    <div class="signature">
      <div style="margin-bottom:18px; color:#64748b; font-size:9.5px;">Processed By</div>
      <div class="line">{{ $processedByName ?? 'Authorized representative' }}</div>
      @if(!empty($processedByRole))
        <div class="role">{{ $processedByRole }}</div>
      @endif
    </div>

    <div class="footer">
      <table class="footer-table" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td class="footer-left">
            Generated {{ $generatedAt }} by {{ $companyName }}.<br>
            *Remaining balance is based on unpaid scheduled installments and may change with penalties or approved adjustments.
          </td>
          <td class="footer-right">
            Verification note: scan the QR code or quote the OR / AR number when contacting the company.
          </td>
        </tr>
      </table>
    </div>
  </div>
</body>
</html>
