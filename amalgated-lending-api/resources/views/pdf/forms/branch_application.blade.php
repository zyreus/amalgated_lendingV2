@extends('pdf.layout')

@section('document_label', 'Borrower Information Summary')

@section('content')
@php
    $v = fn (?string $k, string $d = '') => isset($fields[$k]) && $fields[$k] !== '' ? $fields[$k] : $d;
@endphp

<div class="meta-bar">
    <strong>Branch:</strong> {{ $branchLabel }}
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <strong>Borrower ID:</strong> {{ $v('borrower_id', $v('application_no', 'N/A')) }}
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <strong>Date:</strong> {{ $v('date', $generatedAt) }}
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <strong>Profile Status:</strong> {{ $v('profile_status', 'Active') }}
</div>

<table class="two-col no-break"><tr>
    <td>
        <p class="section-title">Personal Profile</p>
        <table class="kv">
            <tr><td class="label">Full Name</td><td>{{ $v('full_name', $borrower->name ?? '') }}</td></tr>
            <tr><td class="label">Date of Birth</td><td>{{ $v('birth_date') }}</td></tr>
            <tr><td class="label">Civil Status</td><td>{{ $v('civil_status') }}</td></tr>
            <tr><td class="label">Nationality</td><td>{{ $v('nationality') }}</td></tr>
            <tr><td class="label">Primary ID</td><td>{{ $v('primary_id') }}</td></tr>
            <tr><td class="label">Address</td><td>{{ $v('present_address') }}</td></tr>
        </table>

        <p class="section-title">Contact Details</p>
        <table class="kv">
            <tr><td class="label">Email</td><td>{{ $v('email', $borrower->email ?? '') }}</td></tr>
            <tr><td class="label">Mobile</td><td>{{ $v('phone', $borrower->phone ?? '') }}</td></tr>
            <tr><td class="label">Alternate Contact</td><td>{{ $v('alternate_phone') }}</td></tr>
            <tr><td class="label">Emergency Contact</td><td>{{ $v('emergency_contact') }}</td></tr>
            <tr><td class="label">Relationship</td><td>{{ $v('emergency_relationship') }}</td></tr>
        </table>
    </td>
    <td>
        <p class="section-title">Employment &amp; Financial</p>
        <table class="kv">
            <tr><td class="label">Employer / Business</td><td>{{ $v('employer_name') }}</td></tr>
            <tr><td class="label">Position</td><td>{{ $v('position') }}</td></tr>
            <tr><td class="label">Years in Service</td><td>{{ $v('years_employed') }}</td></tr>
            <tr><td class="label">Gross Monthly Income</td><td>{{ $v('monthly_income') }}</td></tr>
            <tr><td class="label">Other Income</td><td>{{ $v('other_income') }}</td></tr>
            <tr><td class="label">Bank / Wallet</td><td>{{ $v('bank_account') }}</td></tr>
        </table>

        <p class="section-title">Loan Snapshot</p>
        <table class="kv">
            <tr><td class="label">Loan Product</td><td>{{ $v('loan_product') }}</td></tr>
            <tr><td class="label">Principal</td><td>{{ $v('loan_amount') }}</td></tr>
            <tr><td class="label">Term</td><td>{{ $v('loan_term_months') }} months</td></tr>
            <tr><td class="label">Current Status</td><td>{{ $v('loan_status', 'Pending') }}</td></tr>
            <tr><td class="label">Assigned Officer</td><td>{{ $v('assigned_officer') }}</td></tr>
            <tr><td class="label">Last Updated</td><td>{{ $v('last_updated', $generatedAt) }}</td></tr>
        </table>
    </td>
</tr></table>

<p class="section-title">Compliance Checklist</p>
<table class="grid tight compact no-break">
    <tr>
        <th style="width:48%">Validation Item</th>
        <th style="width:17%">Result</th>
        <th>Remarks</th>
    </tr>
    <tr><td>KYC complete</td><td>{{ $v('kyc_status', 'Pending') }}</td><td>{{ $v('kyc_remarks') }}</td></tr>
    <tr><td>Email verified</td><td>{{ $v('email_verified', 'No') }}</td><td>{{ $v('email_remarks') }}</td></tr>
    <tr><td>Identity checked</td><td>{{ $v('identity_checked', 'Pending') }}</td><td>{{ $v('identity_remarks') }}</td></tr>
    <tr><td>Document review</td><td>{{ $v('document_review_status', 'Pending') }}</td><td>{{ $v('document_review_remarks') }}</td></tr>
</table>

<table class="sig-grid no-break">
    <tr>
        <td><div class="sig-line">Prepared By</div></td>
        <td><div class="sig-line">Reviewed By</div></td>
        <td><div class="sig-line">Date: {{ $v('prepared_date', $generatedAt) }}</div></td>
    </tr>
</table>
@endsection
