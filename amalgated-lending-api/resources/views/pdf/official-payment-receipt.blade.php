@php
  $legalName = (string) config('company.print_legal_name', $companyName ?? config('app.name', 'Amalgated Lending Inc.'));
  $tagline = (string) config('company.print_tagline', 'Lending Hope, Building Futures.');
  $addressLines = config('company.print_address_lines', []);
  if ($addressLines === [] || $addressLines === null) {
      $addressLines = [
          'ACI IT and Corporate Centre',
          'Doña Carolina Uykimpang Building',
          'JP Laurel Ave, Bajada, Davao City 8000',
      ];
  }
  $receiptDate = $paidAt ?? $confirmationDate ?? $generatedAt ?? now()->format('F j, Y');
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Official receipt {{ $officialOr }}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { width: 100%; margin: 0; padding: 0; }
    @page { margin: 28px 32px 32px 32px; size: A4 portrait; }
    body {
      font-family: DejaVu Sans, Arial, sans-serif;
      font-size: 10.5px;
      color: #000000;
      background: #ffffff;
      line-height: 1.45;
    }
    .page-wrap { width: 100%; border-collapse: collapse; }
    .page-wrap td { border: 0; padding: 0; vertical-align: top; }
    .sheet {
      width: 100%;
      max-width: 700px;
      margin: 0 auto;
      padding: 0;
      text-align: left;
    }
    .brand { color: #991b1b; }
    .muted { color: #333333; }
    .light { color: #555555; font-size: 9.5px; }

    /* Header */
    .header-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 22px; }
    .header-table td { border: 0; padding: 0; vertical-align: top; }
    .company-block { width: 54%; padding-right: 16px; }
    .receipt-block { width: 46%; text-align: right; vertical-align: top; }
    .logo-row { width: 100%; border-collapse: collapse; }
    .logo-row td { border: 0; padding: 0; vertical-align: middle; }
    .logo-cell { width: 50px; padding-right: 10px; }
    .logo-wrap img { width: 44px; height: 44px; object-fit: contain; display: block; }
    .logo-fallback {
      width: 44px; height: 44px; line-height: 44px; text-align: center;
      font-size: 11px; font-weight: 800; color: #991b1b;
    }
    .company-name {
      margin: 0 0 3px;
      font-size: 13px;
      font-weight: 800;
      color: #991b1b;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      line-height: 1.2;
    }
    .company-tagline {
      margin: 0 0 8px;
      font-size: 9.5px;
      color: #333333;
      font-style: italic;
    }
    .company-address {
      margin: 8px 0 0;
      padding: 0;
      list-style: none;
      font-size: 9.5px;
      color: #333333;
      line-height: 1.5;
    }
    .receipt-title {
      margin: 0;
      padding: 10px 0 0;
      font-size: 28px;
      font-weight: 800;
      color: #991b1b;
      letter-spacing: 0.06em;
      line-height: 1;
      text-align: right;
    }
    .receipt-title-row td { padding-bottom: 10px; }
    .header-details-row .company-address { margin-top: 0; }
    .header-details-row .meta-block { padding-top: 2px; }
    .meta-block { text-align: right; }
    .meta-table { width: 100%; border-collapse: collapse; margin-left: auto; }
    .meta-table td {
      border: 0;
      padding: 3px 0;
      font-size: 9.5px;
      vertical-align: top;
    }
    .meta-label {
      width: 42%;
      text-align: left;
      color: #991b1b;
      font-weight: 700;
      padding-right: 8px;
    }
    .meta-value {
      width: 58%;
      text-align: right;
      color: #000000;
      font-weight: 600;
    }
    .status-paid {
      margin-top: 6px;
      font-size: 10px;
      font-weight: 800;
      color: #991b1b;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      text-align: right;
    }
    .qr-inline {
      margin-top: 10px;
      text-align: right;
    }
    .qr-inline img { width: 64px; height: 64px; display: inline-block; }
    .qr-caption { font-size: 7.5px; color: #555555; margin-top: 2px; text-align: right; }

    /* Billed To */
    .section-heading {
      margin: 0 0 6px;
      font-size: 11px;
      font-weight: 800;
      color: #991b1b;
      letter-spacing: 0.02em;
    }
    .billed-block { margin-bottom: 20px; text-align: left; }
    .billed-name {
      margin: 0 0 6px;
      font-size: 12px;
      font-weight: 700;
      color: #000000;
    }
    .billed-meta {
      margin: 0;
      padding: 0;
      font-size: 9.5px;
      color: #333333;
      line-height: 1.55;
    }

    /* Line items */
    table.items {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
      table-layout: fixed;
    }
    table.items thead th {
      background: #991b1b;
      color: #ffffff;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 8px 10px;
      text-align: left;
      border: 0;
    }
    table.items thead th.col-amount { text-align: right; }
    table.items tbody td {
      padding: 9px 10px;
      font-size: 10px;
      color: #000000;
      border: 0;
      border-bottom: 1px solid #d4d4d4;
      vertical-align: top;
    }
    table.items tbody td.col-installment { width: 14%; color: #333333; font-weight: 600; }
    table.items tbody td.col-desc { width: 56%; }
    table.items tbody td.col-amount {
      width: 30%;
      text-align: right;
      font-weight: 700;
      white-space: nowrap;
    }

    /* Totals */
    .totals-wrap { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
    .totals-wrap td { border: 0; padding: 0; vertical-align: top; }
    .totals-spacer { width: 60%; }
    .totals-panel { width: 40%; }
    table.totals {
      width: 100%;
      border-collapse: collapse;
    }
    table.totals td {
      border: 0;
      padding: 5px 0;
      font-size: 10px;
      vertical-align: top;
    }
    table.totals .t-label { color: #333333; text-align: left; padding-right: 12px; }
    table.totals .t-value { text-align: right; font-weight: 600; color: #000000; white-space: nowrap; }
    table.totals tr.row-paid td {
      padding-top: 8px;
      padding-bottom: 8px;
      border-top: 2px solid #991b1b;
      border-bottom: 2px solid #991b1b;
    }
    table.totals tr.row-paid .t-label,
    table.totals tr.row-paid .t-value {
      font-size: 11px;
      font-weight: 800;
      color: #991b1b;
    }
    table.totals tr.row-balance .t-value {
      color: #991b1b;
      font-weight: 800;
      font-size: 11px;
    }
    table.totals tr.row-balance .t-label { color: #000000; font-weight: 700; }

    /* Notes footer */
    .notes-block {
      margin-top: 8px;
      padding-top: 14px;
      border-top: 1px solid #d4d4d4;
    }
    .notes-block .section-heading { margin-bottom: 8px; }
    .notes-body {
      margin: 0;
      font-size: 9px;
      color: #333333;
      line-height: 1.55;
    }
    .notes-body strong { color: #000000; font-weight: 700; }
  </style>
</head>
<body>
  <table class="page-wrap" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center">
        <div class="sheet">

          {{-- Header --}}
          <table class="header-table" cellpadding="0" cellspacing="0">
            <tr class="receipt-title-row">
              <td class="company-block" valign="top">
                <table class="logo-row" cellpadding="0" cellspacing="0">
                  <tr>
                    <td class="logo-cell" valign="top">
                      @if(!empty($logoDataUri))
                        <div class="logo-wrap"><img src="{{ $logoDataUri }}" alt="{{ $legalName }}"></div>
                      @else
                        <div class="logo-fallback">ALI</div>
                      @endif
                    </td>
                    <td valign="top">
                      <p class="company-name">{{ $legalName }}</p>
                      <p class="company-tagline">{{ $tagline }}</p>
                    </td>
                  </tr>
                </table>
              </td>
              <td class="receipt-block" valign="top" align="right">
                <p class="receipt-title">RECEIPT</p>
              </td>
            </tr>
            <tr class="header-details-row">
              <td class="company-block" valign="top">
                <div class="company-address">
                  {!! implode('<br>', array_map('e', $addressLines)) !!}
                </div>
              </td>
              <td class="receipt-block meta-block" valign="top" align="right">
                <table class="meta-table" cellpadding="0" cellspacing="0" align="right">
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
                    <td class="meta-label">Receipt date</td>
                    <td class="meta-value">{{ $receiptDate }}</td>
                  </tr>
                </table>
                <div class="status-paid">Paid</div>
                @if(!empty($receiptQrDataUri))
                  <div class="qr-inline">
                    <img src="{{ $receiptQrDataUri }}" alt="Verification QR">
                    <div class="qr-caption">Scan to verify · OR / AR reference</div>
                  </div>
                @endif
              </td>
            </tr>
          </table>

          {{-- Billed To --}}
          <div class="billed-block">
            <p class="section-heading">Billed To</p>
            <p class="billed-name">{{ $borrowerName }}</p>
            <p class="billed-meta">
              Loan Reference: {{ $loanNumber }},
              {{ $paymentMethod }}@if($referenceNumber !== ''),
              Trace No. {{ $referenceNumber }}@endif
            </p>
            <p class="billed-meta light" style="margin-top:4px;">
              Installment #{{ $installmentNo }} · Posted {{ $paidAt }} · Confirmed {{ $confirmationDate }}
            </p>
          </div>

          {{-- Line items --}}
          <table class="items" cellpadding="0" cellspacing="0">
            <thead>
              <tr>
                <th style="width:14%;">Installment</th>
                <th style="width:56%;">Description</th>
                <th class="col-amount" style="width:30%;">Allocation Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="col-installment">#{{ $installmentNo }}</td>
                <td class="col-desc">Principal allocation</td>
                <td class="col-amount">₱ {{ $principalPortion }}</td>
              </tr>
              <tr>
                <td class="col-installment">#{{ $installmentNo }}</td>
                <td class="col-desc">Interest / charges</td>
                <td class="col-amount">₱ {{ $interestPortion }}</td>
              </tr>
            </tbody>
          </table>

          {{-- Totals (right-aligned panel) --}}
          <table class="totals-wrap" cellpadding="0" cellspacing="0">
            <tr>
              <td class="totals-spacer">&nbsp;</td>
              <td class="totals-panel">
                <table class="totals" cellpadding="0" cellspacing="0">
                  <tr>
                    <td class="t-label">Scheduled Amount (PHP)</td>
                    <td class="t-value">₱ {{ $amountDue }}</td>
                  </tr>
                  <tr class="row-paid">
                    <td class="t-label">Amount Paid (PHP)</td>
                    <td class="t-value">₱ {{ $amountPaid }}</td>
                  </tr>
                  <tr class="row-balance">
                    <td class="t-label">Remaining Balance (PHP)*</td>
                    <td class="t-value">₱ {{ $remainingBalance }}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          {{-- Notes --}}
          <div class="notes-block">
            <p class="section-heading">Notes</p>
            <p class="notes-body">
              This official payment receipt confirms that installment #{{ $installmentNo }} for loan
              <strong>{{ $loanNumber }}</strong> has been posted to the borrower ledger.
              Processed by <strong>{{ $processedByName ?? 'Authorized representative' }}</strong>@if(!empty($processedByRole))
              ({{ $processedByRole }})@endif.
              Generated {{ $generatedAt }} by {{ $companyName }}.
              *Remaining balance reflects unpaid scheduled installments and may change with penalties or approved adjustments.
              For verification, quote receipt <strong>{{ $officialOr !== '' ? $officialOr : '—' }}</strong>
              or acknowledgement <strong>{{ ($acknowledgementAr ?? '') !== '' ? $acknowledgementAr : '—' }}</strong>
              when contacting the company.
            </p>
          </div>

        </div>
      </td>
    </tr>
  </table>
</body>
</html>
