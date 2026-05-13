@php
    $pngPath = base_path('../frontend/src/assets/amalgated-lending-logo.png');
    $logoSrc = null;
    if (is_readable($pngPath)) {
        $logoSrc = 'data:image/png;base64,'.base64_encode(file_get_contents($pngPath));
    } else {
        // Fallback for environments where the frontend PNG isn't available.
        $logoSrc = asset('amalgated-lending-logo.png');
    }
    $logoPx = isset($logoSize) ? max(24, (int) $logoSize) : 54;
@endphp

<img
    src="{{ $logoSrc }}"
    alt="{{ config('company.print_header_name', config('app.name')) }} logo"
    class="brand-logo"
    style="width:{{ $logoPx }}px;height:{{ $logoPx }}px;display:block;object-fit:contain;"
/>
