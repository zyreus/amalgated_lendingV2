<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 28px 36px 40px 36px; }
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 11px;
            color: #111827;
            margin: 0;
        }
        .header {
            border-bottom: 3px solid #b91c1c;
            padding-bottom: 12px;
            margin-bottom: 18px;
        }
        .header-row { width: 100%; }
        .logo { max-height: 42px; max-width: 160px; }
        .title {
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            margin: 0 0 4px 0;
        }
        .subtitle { color: #64748b; margin: 0; font-size: 10px; }
        .meta {
            margin: 14px 0 16px 0;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px 12px;
        }
        .meta p { margin: 3px 0; }
        .label { color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; }
        table.summary {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
        }
        table.summary th {
            text-align: left;
            background: #0f172a;
            color: #f8fafc;
            padding: 10px 12px;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        table.summary td {
            padding: 11px 12px;
            border-bottom: 1px solid #e2e8f0;
        }
        table.summary tr:nth-child(even) td { background: #f9fafb; }
        .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
        .footer {
            margin-top: 20px;
            font-size: 8px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
        }
    </style>
</head>
<body>
    <div class="header">
        <table class="header-row" cellpadding="0" cellspacing="0">
            <tr>
                <td style="width: 38%; vertical-align: middle;">
                    @if(!empty($logoUrl))
                        <img class="logo" src="{{ $logoUrl }}" alt="Logo">
                    @else
                        <span style="font-size: 16px; font-weight: 700; color: #b91c1c;">{{ $appName }}</span>
                    @endif
                </td>
                <td style="vertical-align: middle; text-align: right;">
                    <p class="title">Financial summary report</p>
                    <p class="subtitle">{{ $appName }}</p>
                </td>
            </tr>
        </table>
    </div>

    <div class="meta">
        <p><span class="label">Period covered</span><br><strong>{{ $periodFrom }} — {{ $periodTo }}</strong></p>
        <p><span class="label">Export generated</span><br>{{ $exportedAt }}</p>
    </div>

    <table class="summary" cellspacing="0">
        <thead>
            <tr>
                <th style="width: 62%;">Metric</th>
                <th style="width: 38%; text-align: right;">Value</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Applications submitted</td>
                <td class="num">{{ number_format((int) ($summary['applications_submitted'] ?? 0)) }}</td>
            </tr>
            <tr>
                <td>Loans disbursed</td>
                <td class="num">{{ number_format((int) ($summary['loans_disbursed'] ?? 0)) }}</td>
            </tr>
            <tr>
                <td>Principal disbursed</td>
                <td class="num">₱{{ number_format((float) ($summary['principal_disbursed'] ?? 0), 2) }}</td>
            </tr>
            <tr>
                <td>Total collections</td>
                <td class="num">₱{{ number_format((float) ($summary['collections'] ?? 0), 2) }}</td>
            </tr>
        </tbody>
    </table>

    <div class="footer">
        Confidential — for internal use only. Figures reflect system data for the stated period.
    </div>
</body>
</html>
