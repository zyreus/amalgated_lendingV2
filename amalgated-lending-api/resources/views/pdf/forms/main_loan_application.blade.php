@extends('pdf.layout')

@section('document_label', 'Loan Application Form')

@section('content')
@php
    $v = fn (?string $k, string $d = '') => isset($fields[$k]) && $fields[$k] !== '' ? $fields[$k] : $d;
@endphp

<div class="meta-bar">
    <strong>Branch / Office:</strong> {{ $branchLabel }}
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <strong>Reference:</strong> {{ $v('reference_no', 'N/A') }}
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <strong>Date:</strong> {{ $v('date', $generatedAt) }}
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <strong>Status:</strong> {{ $v('application_status', 'Pending') }}
</div>

<table class="two-col no-break"><tr>
    <td>
        <p class="section-title">Personal Information</p>
        <table class="kv">
            <tr><td class="label">Full Name</td><td>{{ $v('full_name', $borrower->name ?? '') }}</td></tr>
            <tr><td class="label">Birth Date</td><td>{{ $v('birth_date') }}</td></tr>
            <tr><td class="label">Civil Status</td><td>{{ $v('civil_status') }}</td></tr>
            <tr><td class="label">Phone</td><td>{{ $v('phone', $borrower->phone ?? '') }}</td></tr>
            <tr><td class="label">Email</td><td>{{ $v('email', $borrower->email ?? '') }}</td></tr>
            <tr><td class="label">TIN / SSS / GSIS</td><td>{{ $v('tin_sss') }}</td></tr>
            <tr><td class="label">Present Address</td><td>{{ $v('present_address') }}</td></tr>
        </table>

        <p class="section-title">Employment Information</p>
        <table class="kv">
            <tr><td class="label">Employer / Business</td><td>{{ $v('employer_name') }}</td></tr>
            <tr><td class="label">Address</td><td>{{ $v('employer_address') }}</td></tr>
            <tr><td class="label">Position / Nature</td><td>{{ $v('position') }}</td></tr>
            <tr><td class="label">Years in Service</td><td>{{ $v('years_employed') }}</td></tr>
            <tr><td class="label">Monthly Income</td><td>{{ $v('monthly_income') }}</td></tr>
            <tr><td class="label">Other Income</td><td>{{ $v('other_income') }}</td></tr>
        </table>
    </td>
    <td>
        <p class="section-title">Loan Details</p>
        <table class="kv">
            <tr><td class="label">Loan Product</td><td>{{ $v('loan_product') }}</td></tr>
            <tr><td class="label">Amount Applied</td><td>{{ $v('loan_amount') }}</td></tr>
            <tr><td class="label">Term (months)</td><td>{{ $v('loan_term_months') }}</td></tr>
            <tr><td class="label">Interest / Rate</td><td>{{ $v('interest_rate') }}</td></tr>
            <tr><td class="label">Purpose</td><td>{{ $v('loan_purpose') }}</td></tr>
            <tr><td class="label">Collateral</td><td>{{ $v('collateral') }}</td></tr>
            <tr><td class="label">Co-maker</td><td>{{ $v('comaker_name') }}</td></tr>
        </table>

        <p class="section-title">Requirements Checklist</p>
        <table class="grid tight">
            <tr><th style="width:10%">Item</th><th>Requirement</th><th style="width:20%">Status</th></tr>
            <tr><td>1</td><td>Valid government ID</td><td>{{ $v('req_valid_id', 'Pending') }}</td></tr>
            <tr><td>2</td><td>Proof of billing / address</td><td>{{ $v('req_billing', 'Pending') }}</td></tr>
            <tr><td>3</td><td>Proof of income</td><td>{{ $v('req_income', 'Pending') }}</td></tr>
            <tr><td>4</td><td>Bank statement / passbook</td><td>{{ $v('req_bank', 'Pending') }}</td></tr>
            <tr><td>5</td><td>Signed consent forms</td><td>{{ $v('req_consent', 'Pending') }}</td></tr>
        </table>

        <p class="section-title">Declaration</p>
        <table class="grid compact">
            <tr>
                <td>
                    <span class="cb">{{ ($fields['decl_truth'] ?? false) ? '☒' : '☐' }}</span>All information is true and complete.<br>
                    <span class="cb">{{ ($fields['decl_consent'] ?? false) ? '☒' : '☐' }}</span>I authorize verification and processing under company policy.
                </td>
            </tr>
        </table>
    </td>
</tr></table>

<table class="sig-grid no-break">
    <tr>
        <td><div class="sig-line">Applicant Signature</div></td>
        <td><div class="sig-line">Printed Name: {{ $v('applicant_printed_name', $borrower->name ?? '') }}</div></td>
        <td><div class="sig-line">Date: {{ $v('applicant_sign_date', $generatedAt) }}</div></td>
    </tr>
</table>
@endsection
