<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $form->title }}</title>
    <style>
        @page { size: A4 portrait; margin: 10mm 11mm 12mm 11mm; }
        * { box-sizing: border-box; }
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 8.4pt;
            color: #111827;
            line-height: 1.25;
            margin: 0;
        }
        .wm {
            position: fixed;
            top: 38%;
            left: 10%;
            font-size: 44px;
            font-weight: bold;
            color: rgba(0, 0, 0, 0.07);
            transform: rotate(-32deg);
            z-index: 0;
            letter-spacing: 0.1em;
        }
        .sheet {
            position: relative;
            z-index: 1;
            min-height: 270mm;
        }
        .doc-shell {
            border: 1px solid #e4e4e7;
            border-radius: 6px;
            padding: 5mm 5mm 11mm;
            min-height: 266mm;
            background: #ffffff;
        }
        .brand-header {
            width: 100%;
            border-bottom: 1px solid #fca5a5;
            padding-bottom: 3mm;
            margin-bottom: 3mm;
        }
        .brand-row {
            width: 100%;
            border-collapse: collapse;
        }
        .brand-row td {
            vertical-align: middle;
        }
        .logo-wrap {
            width: 48px;
        }
        .logo-wrap img {
            max-height: 34px;
            max-width: 120px;
        }
        .company-name {
            font-size: 9.8pt;
            font-weight: bold;
            text-transform: uppercase;
            color: #991b1b;
        }
        .company-sub {
            color: #52525b;
            font-size: 7.2pt;
        }
        .doc-title {
            text-align: right;
            font-size: 9.2pt;
            font-weight: bold;
            color: #7f1d1d;
            text-transform: uppercase;
            letter-spacing: .08em;
        }
        .meta-bar {
            width: 100%;
            border: 1px solid #e4e4e7;
            border-radius: 4px;
            padding: 2.2mm 2.8mm;
            margin-bottom: 3mm;
            font-size: 7.6pt;
            background: #fafafa;
        }
        .section-title {
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 4px;
            color: #7f1d1d;
            padding: 1.6mm 2.4mm;
            font-weight: bold;
            font-size: 7.4pt;
            margin: 2.4mm 0 0;
            text-transform: uppercase;
            letter-spacing: .06em;
        }
        table.grid {
            width: 100%;
            border-collapse: collapse;
            margin: 0;
            font-size: 7.35pt;
            table-layout: fixed;
        }
        table.grid td, table.grid th {
            border: 1px solid #e4e4e7;
            padding: 1.3mm 1.8mm;
            vertical-align: top;
            overflow-wrap: anywhere;
        }
        table.grid th {
            background: #f9fafb;
            font-weight: bold;
            color: #374151;
            width: 22%;
            text-align: left;
        }
        .compact {
            font-size: 6.9pt !important;
            line-height: 1.18 !important;
        }
        .tight td, .tight th {
            padding-top: 1mm !important;
            padding-bottom: 1mm !important;
        }
        .two-col {
            width: 100%;
            border-collapse: collapse;
            margin: 0;
        }
        .two-col > tbody > tr > td {
            vertical-align: top;
            width: 50%;
        }
        .two-col > tbody > tr > td:first-child {
            padding-right: 1.5mm;
        }
        .two-col > tbody > tr > td:last-child {
            padding-left: 1.5mm;
        }
        .kv {
            width: 100%;
            border-collapse: collapse;
            margin: 0 0 1.8mm;
        }
        .kv td {
            border: 1px solid #e4e4e7;
            padding: 1.2mm 1.7mm;
            font-size: 7.2pt;
        }
        .kv td.label {
            width: 33%;
            font-weight: bold;
            color: #374151;
            background: #fafafa;
        }
        .list-clean {
            margin: 1.4mm 0 0;
            padding: 0 0 0 3.2mm;
        }
        .list-clean li {
            margin: 0 0 .5mm;
        }
        .sig-grid {
            width: 100%;
            border-collapse: collapse;
            margin-top: 3mm;
        }
        .sig-grid td {
            width: 33.333%;
            padding: 0 1.5mm;
        }
        .sig-line {
            border-top: 1px solid #374151;
            margin-top: 9mm;
            padding-top: 1mm;
            font-size: 7pt;
            text-align: center;
        }
        .footer-fixed {
            position: absolute;
            left: 5mm;
            right: 5mm;
            bottom: 3mm;
            border-top: 1px solid #fecaca;
            padding-top: 1.4mm;
            font-size: 6.7pt;
            color: #6b7280;
        }
        .footer-fixed .left { float: left; }
        .footer-fixed .right { float: right; text-align: right; }
        .clear { clear: both; }
        .no-break {
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .fit-rows-8 tbody tr:nth-child(n+9) { display: none; }
        .cb {
            font-family: DejaVu Sans, sans-serif;
            font-size: 9pt;
            margin-right: 2px;
        }
        .small { font-size: 6.7pt; color: #4b5563; }
        .tiny { font-size: 6.3pt; color: #6b7280; }
        @media print {
            .doc-shell { border-color: #ddd; }
            .section-title { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
    </style>
</head>
<body>
@if(!empty($watermark))
    <div class="wm">CONFIDENTIAL</div>
@endif
<div class="sheet">
    <div class="doc-shell">
        <div class="brand-header">
            <table class="brand-row">
                <tr>
                    <td class="logo-wrap">
                        @if(!empty($logoDataUri))
                            <img src="{{ $logoDataUri }}" alt="">
                        @endif
                    </td>
                    <td>
                        <div class="company-name">{{ $company['name'] }}</div>
                        <div class="company-sub">Loan Management &amp; Financial Services</div>
                    </td>
                    <td style="text-align:right;">
                        <div class="doc-title">@yield('document_label', $form->title)</div>
                    </td>
                </tr>
            </table>
        </div>
        @yield('content')
        <div class="footer-fixed">
            <div class="left">Generated {{ $generatedAt }} | Version {{ $form->pdf_version }}</div>
            <div class="right">{{ $company['name'] }} | Confidential Corporate Document</div>
            <div class="clear"></div>
        </div>
    </div>
</div>
</body>
</html>
