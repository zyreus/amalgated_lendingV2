@php
    $legalName = (string) config('company.print_legal_name', config('app.name', 'Amalgated Lending Inc.'));
    $tagline = (string) config('company.print_tagline', 'Lending Hope, Building Futures.');
    $useImage = $useImageLogo ?? true;
@endphp
<style type="text/css">
    .pdf-corp { font-family: DejaVu Sans, sans-serif; margin-bottom: 12px; }
    .pdf-corp-name { font-size: 14px; font-weight: bold; color: #991b1c; text-transform: uppercase; letter-spacing: 0.06em; }
    .pdf-corp-tag { font-size: 9px; color: #6b7280; margin-top: 4px; }
    .pdf-corp-img { width: 48px; height: 48px; }
</style>
<div class="pdf-corp">
    @if($useImage && !empty($logoDataUri))
        <img src="{{ $logoDataUri }}" alt="" class="pdf-corp-img" />
    @endif
    <div class="pdf-corp-name">{{ $legalName }}</div>
    <div class="pdf-corp-tag">{{ $tagline }}</div>
</div>
