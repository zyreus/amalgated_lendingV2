<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Statement of Account — {{ $statement['loan']->loan_number ?? 'SOA' }}</title>
    <style>
        * { box-sizing: border-box; }
        @page { size: A4; margin: 12mm 12mm 14mm 12mm; }
        body { margin: 0; background: #fff; color: #111; font-family: Arial, Helvetica, sans-serif; line-height: 1.25; }
        .sheet { width: 100%; max-width: 190mm; margin: 0 auto; }
        .toolbar { margin: 0 0 12px; font-size: 12px; }
        .header { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
        .brand-name { font-size: 19px; font-weight: 800; letter-spacing: 0.02em; }
        .brand-sub { font-size: 11px; color: #b91c1c; font-weight: 700; margin-top: 2px; }
        .doc-title { margin: 10px 0 4px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
        .meta { margin: 0 0 10px; font-size: 10px; color: #444; }
        .divider { border-top: 1px solid #000; margin: 6px 0 10px; }
        .summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 16px; font-size: 10px; margin-bottom: 12px; }
        .summary dt { font-weight: 700; color: #222; }
        .summary dd { margin: 0 0 4px; }
        table.ruled {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
        }
        table.ruled th, table.ruled td {
            border: 1px solid #000;
            padding: 3px 4px;
            vertical-align: top;
            font-size: 9px;
        }
        table.ruled th { font-weight: 700; background: #f5f5f5; }
        table.ruled td.num, table.ruled th.num { text-align: right; white-space: nowrap; }
        .note { font-size: 10px; margin: 10px 0 0; color: #333; }
        .small { font-size: 9px; color: #555; }
        .footer {
            margin-top: 14px;
            border-top: 1px solid #000;
            padding-top: 6px;
            text-align: center;
            font-size: 10px;
        }
        .signature-blocks { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
        .signature { border: 1px solid #000; padding: 8px; min-height: 62px; }
        .signature .label { font-weight: 700; font-size: 10px; margin-bottom: 10px; }
        .signature .line { border-bottom: 1px solid #000; width: 100%; height: 18px; }
        @media print { .toolbar { display: none !important; } }
    </style>
</head>
<body>
@php
    $money = function ($v) {
        return '₱'.number_format((float) ($v ?? 0), 2);
    };

    $loan = $statement['loan'];
    $borrower = $statement['borrower'];
    $product = $statement['product'] ?? [];
    $breakdown = $statement['breakdown'] ?? [];
    $scheduleRows = $statement['schedule_rows'] ?? [];
    $totals = $statement['totals'] ?? [];
    $approval = $statement['approval'] ?? [];

    $monthlyRate = (float) ($product['monthly_rate_percent_effective'] ?? 0);
    $termMonths = (int) ($loan->term_months ?? 0);

    $monthlyPrincipal = (float) ($breakdown['monthly_principal'] ?? ($scheduleRows[0]['principal'] ?? 0));
    $monthlyInterest = (float) ($breakdown['monthly_interest'] ?? ($scheduleRows[0]['interest'] ?? 0));
    $monthlyAmortization = (float) ($breakdown['monthly_amortization'] ?? ($scheduleRows[0]['amortization'] ?? 0));
    $semiMonthlyPayment = (float) ($breakdown['semi_monthly_payment'] ?? ($monthlyAmortization / 2));
    $remainingPension = array_key_exists('remaining_pension', $breakdown) ? (float) $breakdown['remaining_pension'] : null;
    $pensionRetentionThreshold = array_key_exists('pension_retention_threshold', $breakdown) ? (float) $breakdown['pension_retention_threshold'] : null;

    $serviceCharge = (float) ($breakdown['service_charge'] ?? 0);
    $insurance = (float) ($breakdown['insurance'] ?? 0);
    $docStamp = (float) ($breakdown['documentary_stamp'] ?? 0);
    $notarialFee = (float) ($breakdown['notarial_fee'] ?? 0);
    $mortgageFee = (float) ($breakdown['mortgage_fee'] ?? 0);
    $openingAccountFee = (float) ($breakdown['opening_account_fee'] ?? 0);
    $totalMisc = (float) ($breakdown['total_miscellaneous_fees'] ?? 0);
    $netProceeds = (float) ($breakdown['net_proceeds'] ?? 0);
    $miscDeducted = (bool) ($breakdown['miscellaneous_deducted_from_proceeds'] ?? true);

    $productName = (string) ($product['name'] ?? 'Loan');
@endphp

<div class="sheet">
    <p class="toolbar"><a href="javascript:window.print()">Print</a> · Statement of Account</p>

    <div class="header">
        @include('partials.print-logo')
        <div>
            <div class="brand-name">AMALGATED</div>
            <div class="brand-sub">Lending</div>
        </div>
    </div>

    <div class="doc-title">Statement of Account (SOA) — {{ $productName }}</div>
    <div class="meta">
        {{ $loan->loan_number }} · Loan ID #{{ $loan->id }} · Generated {{ now()->format('Y-m-d H:i') }}
    </div>
    <div class="divider"></div>

    <dl class="summary">
        <div>
            <dt>Borrower</dt>
            <dd>
                {{ $borrower?->name ?? '—' }}<br>
                {{ $borrower?->email ?? '' }}<br>
                {{ $borrower?->phone ?? '' }}
            </dd>
        </div>
        <div>
            <dt>Loan Product Type</dt>
            <dd>{{ $productName }}</dd>
        </div>

        <div>
            <dt>Loan Amount</dt>
            <dd>{{ $money($loan->principal) }}</dd>
        </div>
        <div>
            <dt>Interest Rate</dt>
            <dd>{{ number_format($monthlyRate, 2) }}% per month</dd>
        </div>

        <div>
            <dt>Loan Term</dt>
            <dd>{{ $termMonths }} months</dd>
        </div>
        <div>
            <dt>Monthly Principal</dt>
            <dd>{{ $money($monthlyPrincipal) }}</dd>
        </div>

        <div>
            <dt>Monthly Interest</dt>
            <dd>{{ $money($monthlyInterest) }}</dd>
        </div>
        <div>
            <dt>Monthly Amortization</dt>
            <dd>{{ $money($monthlyAmortization) }}</dd>
        </div>
        <div>
            <dt>Semi-monthly Payment</dt>
            <dd>{{ $money($semiMonthlyPayment) }}</dd>
        </div>

        <div>
            <dt>Service Charge</dt>
            <dd>{{ $money($serviceCharge) }}</dd>
        </div>
        <div>
            <dt>Insurance</dt>
            <dd>{{ $money($insurance) }}</dd>
        </div>

        <div>
            <dt>Documentary Stamp</dt>
            <dd>{{ $money($docStamp) }}</dd>
        </div>
        <div>
            <dt>Notarial Fee</dt>
            <dd>{{ $money($notarialFee) }}</dd>
        </div>

        <div>
            <dt>Mortgage/Product Fee</dt>
            <dd>{{ $money($mortgageFee) }}</dd>
        </div>
        <div>
            <dt>Opening Account Fee (separate)</dt>
            <dd>{{ $openingAccountFee > 0 ? $money($openingAccountFee) : '—' }}</dd>
        </div>

        <div>
            <dt>Total Miscellaneous Fees</dt>
            <dd>{{ $money($totalMisc) }}</dd>
        </div>
        <div>
            <dt>Net Loan Proceeds</dt>
            <dd>{{ $money($netProceeds) }}</dd>
        </div>
        @if ($remainingPension !== null)
        <div>
            <dt>Remaining Pension</dt>
            <dd>{{ $money($remainingPension) }}</dd>
        </div>
        @endif
        @if ($pensionRetentionThreshold !== null)
        <div>
            <dt>Pension Retention Threshold</dt>
            <dd>{{ $money($pensionRetentionThreshold) }}</dd>
        </div>
        @endif
    </dl>

    <p class="small" style="margin: 0 0 10px;">
        Misc fees deducted from proceeds: <strong>{{ $miscDeducted ? 'Yes' : 'No' }}</strong>.
        {{ $openingAccountFee > 0 ? 'Opening account fee is billed separately per policy.' : '' }}
    </p>

    <dl class="summary" style="margin-bottom: 8px;">
        <div>
            <dt>Total Paid</dt>
            <dd>{{ $money($totals['total_paid'] ?? 0) }}</dd>
        </div>
        <div>
            <dt>Total Due (incl. penalties)</dt>
            <dd>{{ $money($totals['total_due_with_penalties'] ?? 0) }}</dd>
        </div>
        <div>
            <dt>Remaining Balance</dt>
            <dd>{{ $money($totals['remaining_balance'] ?? 0) }}</dd>
        </div>
        <div>
            <dt>Approval Information</dt>
            <dd>
                {{ $approval['approved_by'] ?? '—' }}<br>
                {{ $approval['approved_at'] ? \Carbon\Carbon::parse($approval['approved_at'])->format('Y-m-d H:i') : '—' }}
            </dd>
        </div>
    </dl>

    @if (count($scheduleRows) === 0)
        <p class="note">No amortization schedule is available for this loan yet.</p>
    @else
        <table class="ruled">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Due date</th>
                    <th class="num">Payment Due</th>
                    <th class="num">Principal</th>
                    <th class="num">Interest</th>
                    <th class="num">Amortization</th>
                    <th class="num">Penalty</th>
                    <th class="num">Amount Paid</th>
                    <th class="num">Running Balance</th>
                    <th>Pay status</th>
                </tr>
            </thead>
            <tbody>
            @foreach ($scheduleRows as $r)
                <tr>
                    <td>{{ (int) $r['installment_no'] }}</td>
                    <td>{{ $r['due_date'] ?? '—' }}</td>
                    <td class="num">{{ $money($r['payment_due'] ?? 0) }}</td>
                    <td class="num">{{ $money($r['principal'] ?? 0) }}</td>
                    <td class="num">{{ $money($r['interest'] ?? 0) }}</td>
                    <td class="num">{{ $money($r['amortization'] ?? 0) }}</td>
                    <td class="num">{{ $money($r['penalty_amount'] ?? 0) }}</td>
                    <td class="num">{{ $money($r['amount_paid'] ?? 0) }}</td>
                    <td class="num">{{ $money($r['running_balance'] ?? 0) }}</td>
                    <td>{{ $r['pay_status'] ?? '—' }}</td>
                </tr>
            @endforeach
            </tbody>
        </table>
    @endif

    @if (!empty(($statement['snapshot']['notes'] ?? [])) && is_array($statement['snapshot']['notes']))
        <p class="note">
            <strong>Product Notes:</strong>
            @foreach ($statement['snapshot']['notes'] as $n)
                <br>• {{ $n }}
            @endforeach
        </p>
    @endif

    <div class="signature-blocks">
        <div class="signature">
            <div class="label">Borrower Signature</div>
            <div class="line"></div>
            <div class="small" style="margin-top: 6px;">
                Name: {{ $borrower?->name ?? '—' }}<br>
                Date: ________________________
            </div>
        </div>
        <div class="signature">
            <div class="label">Approved By (Amalgated Lending Inc.)</div>
            <div class="line"></div>
            <div class="small" style="margin-top: 6px;">
                Officer: {{ $approval['approved_by'] ?? '—' }}<br>
                Date: ________________________
            </div>
        </div>
    </div>

    <p class="note">
        This Statement of Account is generated based on company-approved product rules and the current loan payment ledger.
        For discrepancies, please contact Amalgated Lending Inc. for verification and correction.
    </p>

    <div class="footer">Amalgated Lending Inc. — internal / borrower copy</div>
</div>
</body>
</html>

