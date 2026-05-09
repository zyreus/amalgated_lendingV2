@extends('pdf.layout')

@section('document_label', 'Statement Of Account')

@section('content')
@php
    $v = fn (?string $k, string $d = '') => isset($fields[$k]) && $fields[$k] !== '' ? $fields[$k] : $d;
    $rows = $fields['payment_schedule'] ?? $fields['schedule'] ?? [];
    if (is_string($rows)) {
        $decoded = json_decode($rows, true);
        $rows = is_array($decoded) ? $decoded : [];
    }
    if (!is_array($rows)) { $rows = []; }
    $rows = array_slice($rows, 0, 8);
@endphp

<div class="meta-bar">
    <strong>Branch / Unit:</strong> {{ $branchLabel }}
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <strong>SOA No:</strong> {{ $v('soa_no', $v('reference_no', 'N/A')) }}
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <strong>As Of:</strong> {{ $v('date', $generatedAt) }}
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <strong>Loan ID:</strong> {{ $v('loan_id', $v('loan_reference', 'N/A')) }}
</div>

<table class="two-col no-break"><tr>
    <td>
        <p class="section-title">Borrower Information</p>
        <table class="kv">
            <tr><td class="label">Borrower</td><td>{{ $v('borrower_name', $borrower->name ?? '') }}</td></tr>
            <tr><td class="label">Account No.</td><td>{{ $v('account_no', $v('loan_reference')) }}</td></tr>
            <tr><td class="label">Email</td><td>{{ $v('email', $borrower->email ?? '') }}</td></tr>
            <tr><td class="label">Phone</td><td>{{ $v('phone', $borrower->phone ?? '') }}</td></tr>
            <tr><td class="label">Address</td><td>{{ $v('address') }}</td></tr>
        </table>
    </td>
    <td>
        <p class="section-title">Loan Summary</p>
        <table class="kv">
            <tr><td class="label">Principal</td><td>{{ $v('principal_amount', $v('loan_amount')) }}</td></tr>
            <tr><td class="label">Interest Rate</td><td>{{ $v('interest_rate') }}</td></tr>
            <tr><td class="label">Term</td><td>{{ $v('loan_term_months') }} months</td></tr>
            <tr><td class="label">Monthly Amort.</td><td>{{ $v('monthly_amortization') }}</td></tr>
            <tr><td class="label">Maturity Date</td><td>{{ $v('maturity_date') }}</td></tr>
            <tr><td class="label">Loan Status</td><td>{{ $v('loan_status', 'Ongoing') }}</td></tr>
        </table>
    </td>
</tr></table>

<p class="section-title">Payment Schedule</p>
<table class="grid tight fit-rows-8 compact no-break">
    <thead>
    <tr>
        <th style="width:10%">#</th>
        <th style="width:19%">Due Date</th>
        <th style="width:23%">Amount Due</th>
        <th style="width:16%">Paid</th>
        <th style="width:16%">Balance</th>
        <th style="width:16%">Status</th>
    </tr>
    </thead>
    <tbody>
    @forelse($rows as $i => $row)
        @php
            $r = is_array($row) ? $row : [];
        @endphp
        <tr>
            <td>{{ $r['installment_no'] ?? ($i + 1) }}</td>
            <td>{{ $r['due_date'] ?? '' }}</td>
            <td>{{ $r['amount_due'] ?? '' }}</td>
            <td>{{ $r['amount_paid'] ?? '' }}</td>
            <td>{{ $r['balance'] ?? '' }}</td>
            <td>{{ $r['status'] ?? '' }}</td>
        </tr>
    @empty
        @for($i = 1; $i <= 6; $i++)
            <tr>
                <td>{{ $i }}</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
            </tr>
        @endfor
    @endforelse
    </tbody>
</table>

<p class="section-title">Outstanding Balance</p>
<table class="grid tight">
    <tr>
        <th style="width:25%">Total Payable</th>
        <td>{{ $v('total_payable') }}</td>
        <th style="width:25%">Outstanding</th>
        <td>{{ $v('outstanding_balance') }}</td>
    </tr>
</table>

<table class="sig-grid no-break">
    <tr>
        <td><div class="sig-line">Prepared By</div></td>
        <td><div class="sig-line">Verified By</div></td>
        <td><div class="sig-line">Borrower Acknowledgment</div></td>
    </tr>
</table>
@endsection
