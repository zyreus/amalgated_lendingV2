<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Travel Assistance Loan Application</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111827; line-height: 1.45; margin: 0; padding: 24px; background: #fff; }
        .sheet { max-width: 210mm; margin: 0 auto; }
        h1 { font-size: 1.25rem; margin: 0 0 4px; }
        .sub { color: #6b7280; font-size: 0.75rem; margin: 0 0 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #d1d5db; padding: 7px 9px; text-align: left; font-size: 0.82rem; vertical-align: top; }
        th { background: #f3f4f6; width: 30%; font-weight: 600; }
        .section { margin-top: 16px; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #374151; }
        .sig { margin-top: 24px; padding-top: 12px; border-top: 1px dashed #9ca3af; }
        .sig-line { margin-top: 32px; min-height: 36px; border-bottom: 1px solid #111827; width: 62%; }
        .sig-img { max-height: 72px; max-width: 280px; margin-top: 8px; display: block; }
        .no-print { margin-bottom: 14px; }
        ul { margin: 4px 0 0 18px; padding: 0; font-size: 0.82rem; }
        .ok { color: #047857; font-weight: 600; }
        .miss { color: #b91c1c; font-weight: 600; }
        @media print {
            button, input, select, textarea { display: none !important; }
            body { background: white !important; padding: 12mm !important; }
            .no-print { display: none !important; }
        }
    </style>
</head>
<body>
@php
    $na = fn ($v) => ($v === null || $v === '') ? '—' : $v;
    $p = $t['personal'] ?? [];
    $sp = $t['spouse'] ?? [];
    $w = $t['work'] ?? [];
    $docUrl = fn ($path) => $path ? \App\Support\PublicStorageUrl::absoluteUrl($path) : null;
    $sigUrl = fn ($path) => $path ? \App\Support\PublicStorageUrl::absoluteUrl($path) : null;
    $docStatus = $docStatus ?? [];
@endphp
<div class="sheet">
    <p class="no-print"><a href="javascript:window.print()">Print</a> · Travel assistance loan</p>
    <h1>Travel Assistance Loan Application</h1>
    <p class="sub">Reference #{{ $app->id }} · Generated {{ now()->format('Y-m-d H:i') }}</p>

    <p class="section">Borrower</p>
    <table>
        <tbody>
            <tr><th>Name</th><td>{{ $na($borrower?->name ?? null) }}</td></tr>
            <tr><th>Email</th><td>{{ $na($borrower?->email ?? null) }}</td></tr>
            <tr><th>Phone</th><td>{{ $na($borrower?->phone ?? null) }}</td></tr>
        </tbody>
    </table>

    <p class="section">Travel loan</p>
    <table>
        <tbody>
            <tr><th>Amount of loan</th><td>{{ $na($t['amount_of_loan'] ?? null) }}</td></tr>
            <tr><th>Purpose</th><td>{{ $na($t['purpose_of_loan'] ?? null) }}</td></tr>
            <tr><th>Desired term</th><td>{{ $na($t['desired_term'] ?? null) }}</td></tr>
            <tr><th>Country of destination</th><td>{{ $na($t['country_of_destination'] ?? null) }}</td></tr>
            <tr><th>Referred by</th><td>{{ $na($t['referred_by'] ?? null) }}</td></tr>
        </tbody>
    </table>

    <p class="section">Personal data</p>
    <table>
        <tbody>
            <tr><th>Name</th><td>{{ $na(trim(implode(', ', array_filter([$p['last_name'] ?? '', $p['first_name'] ?? '', $p['middle_name'] ?? ''])))) }}</td></tr>
            <tr><th>Birthdate</th><td>{{ $na($p['birthdate'] ?? null) }}</td></tr>
            <tr><th>Place of birth</th><td>{{ $na($p['place_of_birth'] ?? null) }}</td></tr>
            <tr><th>Civil status</th><td>{{ $na($p['civil_status'] ?? null) }}</td></tr>
            <tr><th>Citizenship</th><td>{{ $na($p['citizenship'] ?? null) }}</td></tr>
            <tr><th>Gender</th><td>{{ $na($p['gender'] ?? null) }}</td></tr>
            <tr><th>Address</th><td>{{ $na($p['address_line'] ?? null) }}</td></tr>
            <tr><th>City / Province / ZIP</th><td>{{ $na(trim(implode(' · ', array_filter([$p['city'] ?? '', $p['province'] ?? '', $p['zip'] ?? ''])))) }}</td></tr>
            <tr><th>Residence type</th><td>{{ $na($p['residence_type'] ?? null) }}</td></tr>
            <tr><th>Mobile</th><td>{{ $na($p['mobile_number'] ?? null) }}</td></tr>
        </tbody>
    </table>

    <p class="section">Spouse</p>
    <table>
        <tbody>
            <tr><th>Name</th><td>{{ $na($sp['name'] ?? null) }}</td></tr>
            <tr><th>Employment status</th><td>{{ $na($sp['employment_status'] ?? null) }}</td></tr>
            <tr><th>Employer info</th><td>{{ $na($sp['employer_info'] ?? null) }}</td></tr>
        </tbody>
    </table>

    <p class="section">Employment</p>
    <table>
        <tbody>
            <tr><th>Type</th><td>{{ $na($w['employment_type'] ?? null) }}</td></tr>
            <tr><th>TIN / SSS</th><td>{{ $na($w['tin_sss'] ?? null) }}</td></tr>
            <tr><th>Employer</th><td>{{ $na($w['employer_name'] ?? null) }}</td></tr>
            <tr><th>Address</th><td>{{ $na($w['employer_address'] ?? null) }}</td></tr>
            <tr><th>Position</th><td>{{ $na($w['position'] ?? null) }}</td></tr>
            <tr><th>Start date</th><td>{{ $na($w['start_date'] ?? null) }}</td></tr>
        </tbody>
    </table>

    <p class="section">Dependents</p>
    @if (! empty($t['dependents']) && is_array($t['dependents']))
        <table>
            <thead><tr><th>Name</th><th>Birthdate</th><th>School / work</th></tr></thead>
            <tbody>
                @foreach ($t['dependents'] as $d)
                    <tr>
                        <td>{{ $na($d['name'] ?? null) }}</td>
                        <td>{{ $na($d['birthdate'] ?? null) }}</td>
                        <td>{{ $na($d['school_or_work'] ?? null) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @else
        <p style="font-size:0.85rem;">—</p>
    @endif

    <p class="section">Contact persons</p>
    @if (! empty($t['contact_persons']) && is_array($t['contact_persons']))
        <table>
            <thead><tr><th>Name</th><th>Relationship</th><th>Phone</th><th>Address</th></tr></thead>
            <tbody>
                @foreach ($t['contact_persons'] as $c)
                    <tr>
                        <td>{{ $na($c['name'] ?? null) }}</td>
                        <td>{{ $na($c['relationship'] ?? null) }}</td>
                        <td>{{ $na($c['phone'] ?? null) }}</td>
                        <td>{{ $na($c['address'] ?? null) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @else
        <p style="font-size:0.85rem;">—</p>
    @endif

    <p class="section">Sketch / notes</p>
    <p style="font-size:0.85rem;">{{ $na($t['sketch_notes'] ?? null) }}</p>

    <p class="section">Documents (checklist)</p>
    <table>
        <tbody>
            @forelse ($docStatus as $key => $row)
                <tr>
                    <th>{{ $row['label'] }}</th>
                    <td>
                        <span class="{{ $row['ok'] ? 'ok' : 'miss' }}">{{ $row['ok'] ? '✔ Uploaded' : '✖ Missing' }}</span>
                        @if (! empty($row['paths']))
                            <div style="margin-top:6px;font-size:0.78rem;">
                                @foreach ($row['paths'] as $pth)
                                    @if ($pth)<div>{{ basename($pth) }} — {{ $docUrl($pth) }}</div>@endif
                                @endforeach
                            </div>
                        @endif
                    </td>
                </tr>
            @empty
                <tr><td colspan="2">—</td></tr>
            @endforelse
        </tbody>
    </table>

    <p class="section">Terms</p>
    <p style="font-size:0.82rem;">Terms accepted: {{ $app->terms_accepted ? 'Yes' : 'No' }} @if($app->terms_accepted_at) · {{ $app->terms_accepted_at->format('Y-m-d H:i') }} @endif</p>

    <p class="section">Signatures on file</p>
    <table>
        <tbody>
            <tr>
                <th>Applicant</th>
                <td>
                    @if ($app->applicant_signature)
                        <img class="sig-img" src="{{ $sigUrl($app->applicant_signature) }}" alt="Applicant signature">
                    @else
                        <span class="miss">✖ Missing</span>
                    @endif
                    <p style="font-size:0.8rem;margin-top:8px;">Printed name: {{ $na(data_get($app->signatures, 'applicant_printed_name')) }}</p>
                </td>
            </tr>
            <tr>
                <th>Spouse</th>
                <td>
                    @if ($app->spouse_signature)
                        <img class="sig-img" src="{{ $sigUrl($app->spouse_signature) }}" alt="Spouse signature">
                    @else
                        —
                    @endif
                </td>
            </tr>
        </tbody>
    </table>

    <div class="sig">
        <p style="font-size:0.8rem;">Date (declaration): {{ $na(data_get($app->signatures, 'date')) }}</p>
        <div class="sig-line"></div>
        <p style="font-size:0.75rem;margin-top:6px;">Wet signature (if required on original)</p>
    </div>
</div>
</body>
</html>
