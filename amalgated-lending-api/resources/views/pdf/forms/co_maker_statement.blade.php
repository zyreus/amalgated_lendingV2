@extends('pdf.layout')

@section('document_label', 'Payment Receipt / Invoice')

@section('content')
@php
    $v = fn (?string $k, string $d = '') => isset($fields[$k]) && $fields[$k] !== '' ? $fields[$k] : $d;
@endphp

<div class="meta-bar">
    <strong>Branch:</strong> {{ $branchLabel }}
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <strong>Receipt Date:</strong> {{ $v('payment_date', $v('date', $generatedAt)) }}
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <strong>Receipt No:</strong> {{ $v('receipt_number', $v('official_receipt_number', 'N/A')) }}
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <strong>Invoice No:</strong> {{ $v('invoice_number', 'N/A') }}
</div>

<table class="two-col no-break"><tr>
    <td>
        <p class="section-title">Borrower</p>
        <table class="kv">
            <tr><td class="label">Name</td><td>{{ $v('borrower_name', $borrower->name ?? '') }}</td></tr>
            <tr><td class="label">Loan ID</td><td>{{ $v('loan_id', $v('loan_reference', 'N/A')) }}</td></tr>
            <tr><td class="label">Email</td><td>{{ $v('email', $borrower->email ?? '') }}</td></tr>
            <tr><td class="label">Contact</td><td>{{ $v('phone', $borrower->phone ?? '') }}</td></tr>
        </table>
    </td>
    <td>
        <p class="section-title">Payment Info</p>
        <table class="kv">
            <tr><td class="label">Payment Method</td><td>{{ $v('payment_method') }}</td></tr>
            <tr><td class="label">Reference / Txn</td><td>{{ $v('payment_reference') }}</td></tr>
            <tr><td class="label">Collector / Cashier</td><td>{{ $v('processed_by') }}</td></tr>
            <tr><td class="label">Posting Date</td><td>{{ $v('posted_at', $v('date', $generatedAt)) }}</td></tr>
        </table>
    </td>
</tr></table>

<p class="section-title">Receipt Breakdown</p>
<table class="grid tight no-break">
    <tr>
        <th style="width:30%">Description</th>
        <th style="width:22%">Due Amount</th>
        <th style="width:22%">Amount Paid</th>
        <th style="width:26%">Remaining Balance</th>
    </tr>
    <tr>
        <td>Loan Installment</td>
        <td>{{ $v('amount_due') }}</td>
        <td>{{ $v('amount_paid') }}</td>
        <td>{{ $v('remaining_balance') }}</td>
    </tr>
    <tr>
        <td>Penalty / Charges</td>
        <td>{{ $v('penalty_due', '0.00') }}</td>
        <td>{{ $v('penalty_paid', '0.00') }}</td>
        <td>{{ $v('penalty_balance', '0.00') }}</td>
    </tr>
    <tr>
        <th>Total</th>
        <th>{{ $v('total_due') }}</th>
        <th>{{ $v('total_paid', $v('amount_paid')) }}</th>
        <th>{{ $v('outstanding_balance', $v('remaining_balance')) }}</th>
    </tr>
</table>

<p class="section-title">Acknowledgment</p>
<table class="grid compact">
    <tr>
        <td>
            This certifies that payment has been received and posted to the above loan account.
            For online/bank transfer payments, keep this invoice as proof of remittance.
        </td>
    </tr>
</table>

<table class="sig-grid no-break">
    <tr>
        <td><div class="sig-line">Received By</div></td>
        <td><div class="sig-line">Borrower Signature</div></td>
        <td><div class="sig-line">Reference / QR: {{ $v('qr_reference', $v('payment_reference', 'N/A')) }}</div></td>
    </tr>
</table>

@endsection
