@php
    $pngPath = base_path('../frontend/src/assets/amalgated-lending-logo.png');
    $logoSrc = null;
    if (is_readable($pngPath)) {
        $logoSrc = 'data:image/png;base64,'.base64_encode(file_get_contents($pngPath));
    } else {
        // Fallback for environments where the frontend PNG isn't available.
        $logoSrc = asset('amalgated-lending-logo.png');
    }
@endphp

<img
    src="{{ $logoSrc }}"
    alt="Amalgated Lending Inc. logo"
    class="brand-logo"
    style="width:54px;height:54px;display:block;object-fit:contain;"
/>
