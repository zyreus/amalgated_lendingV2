<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Loan Application — {{ $productName }}</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111827; line-height: 1.5; margin: 0; padding: 24px; }
        .wrap { max-width: 720px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 28px; }
        h1 { font-size: 1.35rem; margin: 0 0 8px; }
        .muted { color: #6b7280; font-size: 0.8rem; margin: 0 0 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #e5e7eb; padding: 10px 12px; text-align: left; font-size: 0.9rem; vertical-align: top; }
        th { background: #f9fafb; width: 38%; }
        .foot { margin-top: 24px; padding-top: 16px; border-top: 1px dashed #d1d5db; font-size: 0.8rem; color: #6b7280; }
        @media print {
            body { padding: 0; }
            .wrap { border: none; max-width: none; }
        }
    </style>
</head>
<body>
<div class="wrap">
    @include('partials.company-corporate-header')

    <h1>Loan Application Form</h1>
    <p class="muted">Generated {{ $generatedAt }} · You may print before finishing uploads or signing — incomplete fields show as N/A</p>

    <table>
        <tbody>
            <tr><th>Loan product</th><td>{{ $productName }}</td></tr>
            <tr><th>Applicant name</th><td>{{ $na($borrowerName) }}</td></tr>
            <tr><th>Email</th><td>{{ $na($borrowerEmail) }}</td></tr>
            <tr><th>Phone</th><td>{{ $na($borrowerPhone) }}</td></tr>
            <tr><th>Username</th><td>{{ $na($borrowerUsername) }}</td></tr>
            <tr><th>Application reference</th><td>#{{ $applicationId }}</td></tr>
            <tr><th>Application date</th><td>{{ $na($applicationDate) }}</td></tr>
            <tr><th>Residential address</th><td>{{ $na($address ?? null) }}</td></tr>
            <tr><th>Full name (application)</th><td>{{ $na($fullName ?? null) }}</td></tr>
            <tr><th>Date of birth</th><td>{{ $na($dateOfBirth ?? null) }}</td></tr>
            <tr><th>Civil status</th><td>{{ $na($civilStatus ?? null) }}</td></tr>
            <tr><th>Loan type</th><td>{{ $na($loanType ?? null) }}</td></tr>
            <tr><th>Loan amount</th><td>{{ $na(isset($loanAmount) ? $loanAmount : null) }}</td></tr>
            <tr><th>Loan purpose</th><td>{{ $na($loanPurpose ?? null) }}</td></tr>
            <tr><th>Terms</th><td>{{ $na($loanTerms ?? null) }}</td></tr>
            <tr><th>Employment status</th><td>{{ $na($employmentStatus ?? null) }}</td></tr>
            <tr><th>Monthly income</th><td>{{ $na(isset($monthlyIncome) ? $monthlyIncome : null) }}</td></tr>
            <tr><th>Employer / other</th><td>{{ $na($employer ?? null) }}</td></tr>
            <tr><th>Other income</th><td>{{ $na(isset($otherIncome) ? $otherIncome : null) }}</td></tr>
        </tbody>
    </table>

    <p class="foot">
        Sign below after printing, then scan or photograph and upload the signed form in the borrower portal or document application page.
    </p>
    <p style="margin-top: 32px; min-height: 48px; border-bottom: 1px solid #111827; width: 60%;">Applicant signature</p>
    <p class="muted" style="margin-top: 4px;">Date: _______________</p>
</div>
</body>
</html>
