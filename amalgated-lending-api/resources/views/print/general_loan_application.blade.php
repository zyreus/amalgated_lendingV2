<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Loan Application — {{ $loanTypeLabel }}</title>
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
        .grid-2, .grid-3, .grid-4 { display: grid; gap: 8px 12px; }
        .grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .field { min-width: 0; }
        .field-label { font-size: 9px; text-transform: uppercase; margin-bottom: 2px; color: #222; }
        .field-line {
            min-height: 18px;
            border-bottom: 1px solid #000;
            padding: 2px 4px 1px;
            font-size: 11px;
            white-space: pre-wrap;
            word-break: break-word;
        }
        .section-title {
            margin: 12px 0 6px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        .check-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 4px 18px;
            margin-bottom: 6px;
            font-size: 10px;
        }
        .check-item { display: flex; align-items: center; gap: 6px; }
        .box {
            width: 11px;
            height: 11px;
            border: 1px solid #000;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            font-weight: 700;
        }
        table.ruled {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
        }
        table.ruled th, table.ruled td {
            border: 1px solid #000;
            padding: 4px 5px;
            vertical-align: top;
            font-size: 10px;
            text-align: left;
        }
        table.ruled th {
            font-weight: 700;
            background: #fff;
        }
        .note { font-size: 10px; margin: 8px 0; text-align: justify; }
        .signature-wrap {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 18px;
            margin-top: 16px;
            align-items: end;
        }
        .signature-box { text-align: center; }
        .signature-image {
            display: block;
            margin: 0 auto 6px;
            max-height: 50px;
            max-width: 150px;
            object-fit: contain;
        }
        .signature-line {
            border-bottom: 1px solid #000;
            height: 26px;
            margin-bottom: 4px;
        }
        .signature-label { font-size: 10px; }
        .footer {
            margin-top: 14px;
            border-top: 1px solid #000;
            padding-top: 4px;
            text-align: center;
            font-size: 10px;
        }
        .page-number::after { content: "Page " counter(page); }
        @media print {
            .toolbar { display: none !important; }
        }
    </style>
</head>
<body>
@php
    $blank = ' ';
    $na = fn ($v) => ($v === null || $v === '') ? $blank : $v;
    $docUrl = fn ($path) => $path ? \App\Support\PublicStorageUrl::absoluteUrl($path) : null;
    $sigUrl = fn ($path) => $path ? \App\Support\PublicStorageUrl::absoluteUrl($path) : null;
    $docStatus = $docStatus ?? [];
    $extForm = $form['extended_application_form'] ?? null;
    $hasExtForm = is_array($extForm) && count($extForm) > 0;
    $coMakerForm = $form['co_maker_statement'] ?? null;
    $hasCoMakerForm = is_array($coMakerForm) && count($coMakerForm) > 0;
    $coreKeys = ['full_name', 'email', 'phone', 'address', 'city', 'province'];
    $metaSkipKeys = ['extended_application_form', 'co_maker_statement', 'loan_product_slug', 'loan_product_type', 'loan_type'];
    $skipRemainingKeys = array_merge($coreKeys, $metaSkipKeys);
    $printValue = function ($value, int $depth = 0) use (&$printValue, $na) {
        if ($depth > 25) {
            return '…';
        }
        if (is_null($value) || $value === '') {
            return $na($value);
        }
        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }
        if (is_scalar($value)) {
            return (string) $value;
        }
        if (is_array($value)) {
            $isAssoc = array_keys($value) !== range(0, count($value) - 1);
            if (! $isAssoc) {
                $items = array_map(function ($v) use (&$printValue, $depth) {
                    return $printValue($v, $depth + 1);
                }, $value);
                return implode(', ', array_filter($items, fn ($v) => $v !== ''));
            }
            $lines = [];
            foreach ($value as $k => $v) {
                $label = str_replace('_', ' ', (string) $k);
                $lines[] = $label.': '.$printValue($v, $depth + 1);
            }
            return implode("\n", $lines);
        }
        return (string) $value;
    };
    $applicant = is_array($extForm['applicant'] ?? null) ? $extForm['applicant'] : [];
    $spouse = is_array($extForm['spouse'] ?? null) ? $extForm['spouse'] : [];
    $employed = is_array($extForm['employed'] ?? null) ? $extForm['employed'] : [];
    $selfEmployed = is_array($extForm['self_employed'] ?? null) ? $extForm['self_employed'] : [];
    $productExtra = is_array($extForm['product_extra'] ?? null) ? $extForm['product_extra'] : [];
    $loanCategories = is_array($extForm['loan_categories'] ?? null) ? $extForm['loan_categories'] : [];
    $monthlyIncome = is_array($extForm['monthly_income_rows'] ?? null) ? $extForm['monthly_income_rows'] : [];
    $expenses = is_array($extForm['expense_rows'] ?? null) ? $extForm['expense_rows'] : [];
    $collateralOther = is_array($extForm['collateral_other'] ?? null) ? $extForm['collateral_other'] : [];
    $bankReferences = is_array($extForm['bank_references'] ?? null) ? $extForm['bank_references'] : [];
    $obligations = is_array($extForm['outstanding_obligations'] ?? null) ? $extForm['outstanding_obligations'] : [];
    $fullName = $applicant['name'] ?? ($form['full_name'] ?? ($borrower?->name ?? null));
    $email = $applicant['email'] ?? ($form['email'] ?? ($borrower?->email ?? null));
    $phone = $applicant['mobile_phone'] ?? ($form['phone'] ?? ($borrower?->phone ?? null));
    $cats = [
        !empty($loanCategories['businessLoan']) ? 'Business Loans' : null,
        !empty($loanCategories['chattelMortgage']) ? 'Chattel Mortgage' : null,
        !empty($loanCategories['realEstateMortgage']) ? 'Real Estate Mortgage' : null,
        !empty($loanCategories['salaryLoan']) ? 'Salary Loan' : null,
        !empty($loanCategories['otherSpecify']) ? 'Others' : null,
    ];
    $isChecked = fn ($condition) => $condition ? 'X' : '';
    $line = fn ($value) => e($na($printValue($value)));
@endphp
<div class="sheet">
    <p class="toolbar"><a href="javascript:window.print()">Print</a> · General loan application</p>

    @include('partials.company-corporate-header')

    <div class="doc-title">Application Form</div>
    <div class="meta">Reference #{{ $app->id }} · {{ $loanTypeLabel }} · Generated {{ now()->format('Y-m-d H:i') }}</div>
    <div class="divider"></div>

    <div class="field" style="max-width: 180px;">
        <div class="field-label">Branch</div>
        <div class="field-line">{{ $line($extForm['branch_name'] ?? null) }}</div>
    </div>

    <div class="section-title">Loan Type / Nature</div>
    <div class="check-grid">
        <div class="check-item"><span class="box">{{ $isChecked(($extForm['application_nature'] ?? null) === 'new') }}</span> New Loan</div>
        <div class="check-item"><span class="box">{{ $isChecked(!empty($loanCategories['businessLoan'])) }}</span> Business Loans</div>
        <div class="check-item"><span class="box">{{ $isChecked(($extForm['application_nature'] ?? null) === 'reloan') }}</span> Re-Loan / Renewal</div>
        <div class="check-item"><span class="box">{{ $isChecked(!empty($loanCategories['chattelMortgage'])) }}</span> Chattel Mortgage</div>
        <div class="check-item"><span class="box">{{ $isChecked(($extForm['application_nature'] ?? null) === 'restructured') }}</span> Restructured</div>
        <div class="check-item"><span class="box">{{ $isChecked(!empty($loanCategories['realEstateMortgage'])) }}</span> Real Estate Mortgage</div>
        <div class="check-item"><span class="box">{{ $isChecked(!empty($loanCategories['otherSpecify'])) }}</span> Others</div>
        <div class="check-item"><span class="box">{{ $isChecked(!empty($loanCategories['salaryLoan'])) }}</span> Salary Loan</div>
    </div>

    <div class="grid-3">
        <div class="field">
            <div class="field-label">Name of Applicant</div>
            <div class="field-line">{{ $line($fullName) }}</div>
        </div>
        <div class="field">
            <div class="field-label">Age</div>
            <div class="field-line">{{ $line($applicant['age'] ?? null) }}</div>
        </div>
        <div class="field">
            <div class="field-label">Civil Status</div>
            <div class="field-line">{{ $line($applicant['civil_status'] ?? null) }}</div>
        </div>
    </div>

    <div class="grid-4">
        <div class="field">
            <div class="field-label">Residence Address</div>
            <div class="field-line">{{ $line($applicant['residence_address'] ?? ($form['address'] ?? null)) }}</div>
        </div>
        <div class="field">
            <div class="field-label">City</div>
            <div class="field-line">{{ $line($applicant['city'] ?? ($form['city'] ?? null)) }}</div>
        </div>
        <div class="field">
            <div class="field-label">Province</div>
            <div class="field-line">{{ $line($applicant['province'] ?? ($form['province'] ?? null)) }}</div>
        </div>
        <div class="field">
            <div class="field-label">Email</div>
            <div class="field-line">{{ $line($email) }}</div>
        </div>
    </div>

    <div class="grid-4">
        <div class="field">
            <div class="field-label">Business Address</div>
            <div class="field-line">{{ $line($applicant['business_address'] ?? null) }}</div>
        </div>
        <div class="field">
            <div class="field-label">Tel. No.</div>
            <div class="field-line">{{ $line($applicant['business_tel'] ?? null) }}</div>
        </div>
        <div class="field">
            <div class="field-label">Mobile No.</div>
            <div class="field-line">{{ $line($phone) }}</div>
        </div>
        <div class="field">
            <div class="field-label">TIN</div>
            <div class="field-line">{{ $line($applicant['tin'] ?? ($form['tin_number'] ?? null)) }}</div>
        </div>
    </div>

    <div class="grid-4">
        <div class="field">
            <div class="field-label">SSS / GSIS No.</div>
            <div class="field-line">{{ $line($applicant['sss_gsis'] ?? null) }}</div>
        </div>
        <div class="field">
            <div class="field-label">PhilHealth</div>
            <div class="field-line">{{ $line($applicant['philhealth'] ?? null) }}</div>
        </div>
        <div class="field">
            <div class="field-label">CTC No.</div>
            <div class="field-line">{{ $line($applicant['ctc_number'] ?? null) }}</div>
        </div>
        <div class="field">
            <div class="field-label">CTC Date / Place</div>
            <div class="field-line">{{ $line(trim(($applicant['ctc_date'] ?? '').' '.($applicant['ctc_place'] ?? ''))) }}</div>
        </div>
    </div>

    <div class="grid-3">
        <div class="field">
            <div class="field-label">Requested Loan Amount</div>
            <div class="field-line">{{ $line($extForm['loan_principal_php'] ?? ($form['loan_amount'] ?? $app->loan?->principal ?? null)) }}</div>
        </div>
        <div class="field">
            <div class="field-label">Term</div>
            <div class="field-line">{{ $line($extForm['loan_term_months'] ?? ($form['loan_term_months'] ?? $app->loan?->term_months ?? null)) }}</div>
        </div>
        <div class="field">
            <div class="field-label">Loan Product</div>
            <div class="field-line">{{ $line($loanTypeLabel) }}</div>
        </div>
    </div>

    <div class="section-title">Employment / Business Information</div>
    <div class="grid-2">
        <div>
            <div class="field-label" style="font-weight:700;">Employed</div>
            <div class="grid-2">
                <div class="field"><div class="field-label">Employer</div><div class="field-line">{{ $line($employed['employer_name'] ?? ($productExtra['employer_name'] ?? ($form['employer_name'] ?? null))) }}</div></div>
                <div class="field"><div class="field-label">Position</div><div class="field-line">{{ $line($employed['position'] ?? null) }}</div></div>
                <div class="field"><div class="field-label">Address</div><div class="field-line">{{ $line($employed['address'] ?? null) }}</div></div>
                <div class="field"><div class="field-label">Length of Service</div><div class="field-line">{{ $line($employed['length_of_service'] ?? null) }}</div></div>
                <div class="field"><div class="field-label">Salary / Pension</div><div class="field-line">{{ $line($productExtra['monthly_salary'] ?? ($productExtra['monthly_pension'] ?? ($form['monthly_income'] ?? null))) }}</div></div>
            </div>
        </div>
        <div>
            <div class="field-label" style="font-weight:700;">Self-Employed</div>
            <div class="grid-2">
                <div class="field"><div class="field-label">Firm / Trade Name</div><div class="field-line">{{ $line($selfEmployed['firm_name'] ?? null) }}</div></div>
                <div class="field"><div class="field-label">Nature of Business</div><div class="field-line">{{ $line($selfEmployed['nature_of_business'] ?? null) }}</div></div>
                <div class="field"><div class="field-label">Address</div><div class="field-line">{{ $line($selfEmployed['address'] ?? null) }}</div></div>
                <div class="field"><div class="field-label">Sole Owner / Partner</div><div class="field-line">{{ $line($selfEmployed['ownership'] ?? null) }}</div></div>
                <div class="field"><div class="field-label">Capital Invested</div><div class="field-line">{{ $line($selfEmployed['capital_invested'] ?? null) }}</div></div>
            </div>
        </div>
    </div>

    <div class="section-title">Monthly Salary / Income and Expenses</div>
    <table class="ruled">
        <thead>
            <tr>
                <th>Monthly Salary / Income and Source of Income</th>
                <th>Amount</th>
                <th>Expenses / Monthly</th>
                <th>Amount</th>
            </tr>
        </thead>
        <tbody>
            @for ($i = 0; $i < max(count($monthlyIncome), count($expenses), 4); $i++)
                <tr>
                    <td>{{ $na($monthlyIncome[$i]['description'] ?? null) }}</td>
                    <td>{{ $na($monthlyIncome[$i]['amount'] ?? null) }}</td>
                    <td>{{ $na($expenses[$i]['description'] ?? null) }}</td>
                    <td>{{ $na($expenses[$i]['amount'] ?? null) }}</td>
                </tr>
            @endfor
        </tbody>
    </table>

    <div class="section-title">Residence / Dependents</div>
    <div class="grid-4">
        <div class="field"><div class="field-label">Do you own your residence?</div><div class="field-line">{{ $line($extForm['home_ownership'] ?? null) }}</div></div>
        <div class="field"><div class="field-label">No. of Dependents</div><div class="field-line">{{ $line($extForm['dependents'] ?? null) }}</div></div>
        <div class="field"><div class="field-label">No. of Length of Stay / Present Residence</div><div class="field-line">{{ $line(trim(($extForm['stay_years'] ?? '').' year(s) '.($extForm['stay_months'] ?? '').' month(s)')) }}</div></div>
        <div class="field"><div class="field-label">If yes, Name</div><div class="field-line">{{ $blank }}</div></div>
    </div>

    <div class="section-title">Description of other properties owned and offered as collateral</div>
    <table class="ruled">
        <thead>
            <tr>
                <th>Name of Bank</th>
                <th>Description of Properties</th>
                <th>Accommodation / Date Availed</th>
                <th>Amount</th>
            </tr>
        </thead>
        <tbody>
            @for ($i = 0; $i < max(count($collateralOther), 3); $i++)
                <tr>
                    <td>{{ $na($collateralOther[$i]['bank'] ?? null) }}</td>
                    <td>{{ $na($collateralOther[$i]['description'] ?? null) }}</td>
                    <td>{{ $na($collateralOther[$i]['dateAvailed'] ?? null) }}</td>
                    <td>{{ $na($collateralOther[$i]['amount'] ?? null) }}</td>
                </tr>
            @endfor
        </tbody>
    </table>

    <div class="section-title">Credit Information / Bank Account / Bank Reference</div>
    <table class="ruled">
        <thead>
            <tr>
                <th>Name of Bank</th>
                <th>Type of Deposit</th>
                <th>Accommodation</th>
            </tr>
        </thead>
        <tbody>
            @for ($i = 0; $i < max(count($bankReferences), 3); $i++)
                <tr>
                    <td>{{ $na($bankReferences[$i]['bank'] ?? null) }}</td>
                    <td>{{ $na($bankReferences[$i]['depositType'] ?? null) }}</td>
                    <td>{{ $na($bankReferences[$i]['accommodation'] ?? null) }}</td>
                </tr>
            @endfor
        </tbody>
    </table>

    <div class="section-title">Outstanding Obligation, if any</div>
    <table class="ruled">
        <thead>
            <tr>
                <th>Creditors</th>
                <th>As Principal / As Guarantor</th>
                <th>Original Amount</th>
                <th>Present Balance</th>
                <th>Maturity</th>
            </tr>
        </thead>
        <tbody>
            @for ($i = 0; $i < max(count($obligations), 3); $i++)
                <tr>
                    <td>{{ $na($obligations[$i]['creditor'] ?? null) }}</td>
                    <td>{{ $na($obligations[$i]['role'] ?? null) }}</td>
                    <td>{{ $na($obligations[$i]['originalAmount'] ?? null) }}</td>
                    <td>{{ $na($obligations[$i]['presentBalance'] ?? null) }}</td>
                    <td>{{ $na($obligations[$i]['maturity'] ?? null) }}</td>
                </tr>
            @endfor
        </tbody>
    </table>

    @if ($hasCoMakerForm)
        @php
            $cm = $coMakerForm;
            $cmSpouse = is_array($cm['spouse'] ?? null) ? $cm['spouse'] : [];
            $cmEmployed = is_array($cm['employed'] ?? null) ? $cm['employed'] : [];
            $cmSelfEmployed = is_array($cm['self_employed'] ?? null) ? $cm['self_employed'] : [];
            $cmCollateral = is_array($cm['collateral_other'] ?? null) ? $cm['collateral_other'] : [];
            $cmBank = is_array($cm['bank_references'] ?? null) ? $cm['bank_references'] : [];
            $cmObligations = is_array($cm['outstanding_obligations'] ?? null) ? $cm['outstanding_obligations'] : [];
        @endphp
        <div style="page-break-before: always;"></div>
        @include('partials.company-corporate-header')
        <div class="doc-title">Co-Maker Statement</div>
        <div class="divider"></div>
        <p class="note">
            I agreed to be the co-maker of the applicant. I am signing the note as co-maker and understand that I may be jointly and solidarily liable with the applicant.
        </p>

        <div class="grid-4">
            <div class="field"><div class="field-label">Name</div><div class="field-line">{{ $line($cm['name'] ?? null) }}</div></div>
            <div class="field"><div class="field-label">Age</div><div class="field-line">{{ $line($cm['age'] ?? null) }}</div></div>
            <div class="field"><div class="field-label">TIN</div><div class="field-line">{{ $line($cm['tin'] ?? null) }}</div></div>
            <div class="field"><div class="field-label">SSS / GSIS No.</div><div class="field-line">{{ $line($cm['sss_gsis'] ?? null) }}</div></div>
        </div>
        <div class="grid-4">
            <div class="field"><div class="field-label">Business Address</div><div class="field-line">{{ $line($cm['business_address'] ?? null) }}</div></div>
            <div class="field"><div class="field-label">Tel. No.</div><div class="field-line">{{ $line($cm['business_tel'] ?? null) }}</div></div>
            <div class="field"><div class="field-label">Residence Address</div><div class="field-line">{{ $line($cm['residence_address'] ?? null) }}</div></div>
            <div class="field"><div class="field-label">PhilHealth</div><div class="field-line">{{ $line($cm['philhealth'] ?? null) }}</div></div>
        </div>
        <div class="grid-4">
            <div class="field"><div class="field-label">Name of Spouse</div><div class="field-line">{{ $line($cmSpouse['name'] ?? null) }}</div></div>
            <div class="field"><div class="field-label">Age</div><div class="field-line">{{ $line($cmSpouse['age'] ?? null) }}</div></div>
            <div class="field"><div class="field-label">TIN</div><div class="field-line">{{ $line($cmSpouse['tin'] ?? null) }}</div></div>
            <div class="field"><div class="field-label">SSS / GSIS No.</div><div class="field-line">{{ $line($cmSpouse['sss_gsis'] ?? null) }}</div></div>
        </div>

        <div class="section-title">Co-Maker Employment / Business</div>
        <div class="grid-2">
            <div>
                <div class="field-label" style="font-weight:700;">Employed</div>
                <div class="grid-2">
                    <div class="field"><div class="field-label">Employer</div><div class="field-line">{{ $line($cmEmployed['employer_name'] ?? null) }}</div></div>
                    <div class="field"><div class="field-label">Position</div><div class="field-line">{{ $line($cmEmployed['position'] ?? null) }}</div></div>
                    <div class="field"><div class="field-label">Address</div><div class="field-line">{{ $line($cmEmployed['address'] ?? null) }}</div></div>
                    <div class="field"><div class="field-label">Length of Service</div><div class="field-line">{{ $line($cmEmployed['length_of_service'] ?? null) }}</div></div>
                    <div class="field"><div class="field-label">Annual Salary</div><div class="field-line">{{ $line($cmEmployed['annual_salary'] ?? null) }}</div></div>
                </div>
            </div>
            <div>
                <div class="field-label" style="font-weight:700;">Self-Employed</div>
                <div class="grid-2">
                    <div class="field"><div class="field-label">Firm / Trade Name</div><div class="field-line">{{ $line($cmSelfEmployed['firm_name'] ?? null) }}</div></div>
                    <div class="field"><div class="field-label">Nature of Business</div><div class="field-line">{{ $line($cmSelfEmployed['nature_of_business'] ?? null) }}</div></div>
                    <div class="field"><div class="field-label">Address</div><div class="field-line">{{ $line($cmSelfEmployed['address'] ?? null) }}</div></div>
                    <div class="field"><div class="field-label">Sole Owner / Partner</div><div class="field-line">{{ $line($cmSelfEmployed['ownership'] ?? null) }}</div></div>
                    <div class="field"><div class="field-label">Capital Invested</div><div class="field-line">{{ $line($cmSelfEmployed['capital_invested'] ?? null) }}</div></div>
                </div>
            </div>
        </div>

        <div class="section-title">Co-Maker Collateral / References / Obligations</div>
        <table class="ruled">
            <thead>
                <tr>
                    <th>Name of Bank</th>
                    <th>Description of Properties</th>
                    <th>Accommodation / Date Availed</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
                @for ($i = 0; $i < max(count($cmCollateral), 3); $i++)
                    <tr>
                        <td>{{ $na($cmCollateral[$i]['bank'] ?? null) }}</td>
                        <td>{{ $na($cmCollateral[$i]['description'] ?? null) }}</td>
                        <td>{{ $na($cmCollateral[$i]['dateAvailed'] ?? null) }}</td>
                        <td>{{ $na($cmCollateral[$i]['amount'] ?? null) }}</td>
                    </tr>
                @endfor
            </tbody>
        </table>
        <table class="ruled" style="margin-top:8px;">
            <thead>
                <tr>
                    <th>Name of Bank</th>
                    <th>Type of Deposit</th>
                    <th>Accommodation</th>
                </tr>
            </thead>
            <tbody>
                @for ($i = 0; $i < max(count($cmBank), 3); $i++)
                    <tr>
                        <td>{{ $na($cmBank[$i]['bank'] ?? null) }}</td>
                        <td>{{ $na($cmBank[$i]['depositType'] ?? null) }}</td>
                        <td>{{ $na($cmBank[$i]['accommodation'] ?? null) }}</td>
                    </tr>
                @endfor
            </tbody>
        </table>
        <table class="ruled" style="margin-top:8px;">
            <thead>
                <tr>
                    <th>Creditors</th>
                    <th>As Principal / As Guarantor</th>
                    <th>Original Amount</th>
                    <th>Present Balance</th>
                    <th>Maturity</th>
                </tr>
            </thead>
            <tbody>
                @for ($i = 0; $i < max(count($cmObligations), 3); $i++)
                    <tr>
                        <td>{{ $na($cmObligations[$i]['creditor'] ?? null) }}</td>
                        <td>{{ $na($cmObligations[$i]['role'] ?? null) }}</td>
                        <td>{{ $na($cmObligations[$i]['originalAmount'] ?? null) }}</td>
                        <td>{{ $na($cmObligations[$i]['presentBalance'] ?? null) }}</td>
                        <td>{{ $na($cmObligations[$i]['maturity'] ?? null) }}</td>
                    </tr>
                @endfor
            </tbody>
        </table>
    @endif

    <div class="section-title">Document Checklist</div>
    <table class="ruled">
        <thead>
            <tr>
                <th style="width:40%;">Requirement</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($docStatus as $row)
                <tr>
                    <td>{{ $row['label'] }}</td>
                    <td>{{ $row['ok'] ? 'Uploaded' : 'Missing' }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="2">{{ $blank }}</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <p class="note">
        I / We hereby certify that the information furnished on this application is correct. It is agreed that any information submitted herein may be verified and documents shall remain the property of Amalgated Lending Inc. whenever or not the loan is granted.
    </p>

    <div class="signature-wrap">
        <div class="signature-box">
            <div class="signature-line">{{ $na($extForm['certification_date'] ?? null) }}</div>
            <div class="signature-label">Date</div>
        </div>
        <div class="signature-box">
            @if ($app->applicant_signature)
                <img class="signature-image" src="{{ $sigUrl($app->applicant_signature) }}" alt="Applicant signature">
            @endif
            <div class="signature-line"></div>
            <div class="signature-label">Signature of Applicant</div>
        </div>
        <div class="signature-box">
            @if ($app->spouse_signature)
                <img class="signature-image" src="{{ $sigUrl($app->spouse_signature) }}" alt="Spouse signature">
            @endif
            <div class="signature-line"></div>
            <div class="signature-label">Signature of Spouse</div>
        </div>
    </div>

    <div class="footer">
        Amalgated Lending Inc. Loan Application · <span class="page-number"></span>
    </div>
</div>
</body>
</html>
