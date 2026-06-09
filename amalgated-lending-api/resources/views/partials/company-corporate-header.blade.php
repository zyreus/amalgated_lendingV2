@php
    $logoPx = isset($logoSize) ? max(28, (int) $logoSize) : 52;
    $ringPx = max(2, (int) round($logoPx * 0.07));
    $innerPx = max(22, $logoPx - $ringPx * 2 - 6);

    $legalName = (string) config('company.print_legal_name', config('app.name', 'Amalgated Lending Inc.'));
    $tagline = (string) config('company.print_tagline', 'Lending Hope, Building Futures.');

    $logoSrc = null;
    if (! empty($logoDataUri ?? null)) {
        $logoSrc = (string) $logoDataUri;
    } else {
        $pngPath = base_path('../frontend/src/assets/amalgated-lending-logo.png');
        if (is_readable($pngPath)) {
            $logoSrc = 'data:image/png;base64,'.base64_encode((string) file_get_contents($pngPath));
        } else {
            $logoSrc = asset('amalgated-lending-logo.png');
        }
    }

@endphp
<style type="text/css">
    .corp-hdr-wrap { width: 100%; margin: 0 0 10px; }
    .corp-hdr-table { width: 100%; border-collapse: collapse; margin: 0; padding: 0; }
    .corp-hdr-table td { border: 0; vertical-align: middle; padding: 0; }
    .corp-hdr-left { width: 100%; }
    .corp-hdr-inner { border-collapse: collapse; margin: 0; padding: 0; }
    .corp-hdr-inner td { border: 0; padding: 0; vertical-align: middle; }
    .corp-hdr-mark { width: {{ $logoPx + 16 }}px; padding-right: 12px; }
    .corp-hdr-ring {
        width: {{ $logoPx }}px; height: {{ $logoPx }}px;
        border: {{ $ringPx }}px solid #b91c1c;
        border-radius: 999px;
        text-align: center;
        background: #ffffff;
        box-sizing: border-box;
        padding: 3px;
    }
    .corp-hdr-ring img {
        width: {{ $innerPx }}px; height: {{ $innerPx }}px;
        display: block;
        margin: 0 auto;
        object-fit: contain;
    }
    .corp-hdr-name {
        font-family: DejaVu Sans, Arial, Helvetica, sans-serif;
        font-size: 13.5px;
        font-weight: bold;
        color: #000000;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin: 0;
        line-height: 1.15;
    }
    .corp-hdr-tag {
        font-family: DejaVu Serif, 'Times New Roman', Times, serif;
        font-size: 10.5px;
        font-style: italic;
        color: #000000;
        margin: 4px 0 0;
        line-height: 1.25;
    }
    .corp-hdr-rule {
        height: 1px;
        background: #000000;
        margin: 10px 0 12px;
        clear: both;
    }
</style>
<div class="corp-hdr-wrap">
    <table class="corp-hdr-table" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
            <td class="corp-hdr-left">
                <table class="corp-hdr-inner" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                        <td class="corp-hdr-mark">
                            <div class="corp-hdr-ring">
                                <img src="{{ $logoSrc }}" alt="{{ config('company.print_header_name', config('app.name')) }}"/>
                            </div>
                        </td>
                        <td>
                            <p class="corp-hdr-name">{{ $legalName }}</p>
                            <p class="corp-hdr-tag">&ldquo;{{ $tagline }}&rdquo;</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
    <div class="corp-hdr-rule"></div>
</div>
