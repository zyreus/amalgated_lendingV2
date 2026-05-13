<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Statement of Account — {{ $loan->loan_number }}</title>
    <style>
        * { box-sizing: border-box; }
        @page { size: A4; margin: 12mm 12mm 14mm 12mm; }
        body { margin: 0; background: #fff; color: #111; font-family: Arial, Helvetica, sans-serif; line-height: 1.25; }
        .sheet { width: 100%; max-width: 190mm; margin: 0 auto; }
        .toolbar { margin: 0 0 12px; font-size: 12px; }
        .toolbar a { color: #b91c1c; text-decoration: none; font-weight: 700; }
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
            text-align: left;
        }
        table.ruled th {
            font-weight: 700;
            background: #f5f5f5;
        }
        table.ruled td.num, table.ruled th.num { text-align: right; white-space: nowrap; }
        .note { font-size: 10px; margin: 10px 0 0; color: #333; }
        .footer {
            margin-top: 14px;
            border-top: 1px solid #000;
            padding-top: 4px;
            text-align: center;
            font-size: 10px;
        }
        @media print {
            .toolbar { display: none !important; }
        }
    </style>
</head>
<body>
@php
    $money = function ($v) {
        return '₱'.number_format((float) $v, 2);
    };
@endphp
<div class="sheet">
    <p class="toolbar"><a href="javascript:window.print()">Print</a> · Statement of Account</p>

    @include('partials.company-corporate-header')

    <div class="doc-title">Statement of Account (Amortization)</div>
    <div class="meta">
        {{ $loan->loan_number }} · Loan ID #{{ $loan->id }} · Generated {{ now()->format('Y-m-d H:i') }}
    </div>
    <div class="divider"></div>

    <dl class="summary">
        <div>
            <dt>Borrower</dt>
            <dd>{{ $borrower?->name ?? '—' }}<br><span style="color:#555;">{{ $borrower?->email ?? '' }}</span></dd>
        </div>
        <div>
            <dt>Loan status</dt>
            <dd class="capitalize">{{ $loan->status }}</dd>
        </div>
        <div>
            <dt>Principal</dt>
            <dd>{{ $money($loan->principal) }}</dd>
        </div>
        <div>
            <dt>Term / rate</dt>
            <dd>{{ (int) $loan->term_months }} months · {{ rtrim(rtrim(number_format((float) $loan->annual_interest_rate, 4, '.', ''), '0'), '.') }}% p.a.</dd>
        </div>
        <div>
            <dt>Contractual monthly payment</dt>
            <dd>{{ $loan->monthly_payment !== null ? $money($loan->monthly_payment) : '—' }}</dd>
        </div>
        <div>
            <dt>Semi-monthly payment</dt>
            <dd>{{ $loan->monthly_payment !== null ? $money(((float) $loan->monthly_payment) / 2) : '—' }}</dd>
        </div>
        <div>
            <dt>Outstanding balance (system)</dt>
            <dd>{{ $loan->outstanding_balance !== null ? $money($loan->outstanding_balance) : '—' }}</dd>
        </div>
    </dl>

    @if (count($schedule) === 0)
        <p class="note">No amortization schedule is stored for this loan yet (for example, it may still be pending approval).</p>
    @else
        <table class="ruled">
            <thead>
            <tr>
                <th>#</th>
                <th>Due date</th>
                <th class="num">Payment</th>
                <th class="num">Principal</th>
                <th class="num">Interest</th>
                <th class="num">Balance</th>
                <th class="num">Amount paid</th>
                <th>Pay status</th>
            </tr>
            </thead>
            <tbody>
            @foreach ($schedule as $row)
                @php
                    $row = is_array($row) ? $row : [];
                    $no = (int) ($row['installment_no'] ?? 0);
                    $p = $paymentsByInstallment->get($no) ?? $paymentsByInstallment->get((string) $no);
                    $paid = $p && $p->amount_paid !== null ? (float) $p->amount_paid : null;
                    $payStatus = $p ? $p->status : '—';
                @endphp
                <tr>
                    <td>{{ $no }}</td>
                    <td>{{ $row['due_date'] ?? '—' }}</td>
                    <td class="num">{{ isset($row['payment']) ? $money($row['payment']) : '—' }}</td>
                    <td class="num">{{ isset($row['principal']) ? $money($row['principal']) : '—' }}</td>
                    <td class="num">{{ isset($row['interest']) ? $money($row['interest']) : '—' }}</td>
                    <td class="num">{{ isset($row['balance']) ? $money($row['balance']) : '—' }}</td>
                    <td class="num">{{ $paid !== null ? $money($paid) : '—' }}</td>
                    <td>{{ $payStatus }}</td>
                </tr>
            @endforeach
            </tbody>
        </table>
        <p class="note">
            Scheduled amounts come from the loan amortization table stored when the loan was approved.
            Amount paid and pay status reflect payment records in the system as of this printout.
        </p>
    @endif

    <div class="footer">Amalgated Lending Inc. — internal / borrower copy</div>
</div>
</body>
</html>
