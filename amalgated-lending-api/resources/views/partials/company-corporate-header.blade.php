{{--
  Official corporate letterhead: logo (ring) + legal name + slogan + right-aligned office address.
  Optional: $logoDataUri (DomPDF), $logoSize (px, default 46).
--}}
@php
    $cName = config('company.print_header_name', config('app.name'));
    $cSlogan = config('company.slogan', '');
    $cLines = config('company.address_lines', []);
    $logoUri = $logoDataUri ?? null;
    $logoPx = isset($logoSize) ? max(24, (int) $logoSize) : 46;
@endphp
<style type="text/css">
    .corpdoc-h-rule { border: 0; border-top: 1px solid #d1d5db; margin: 0 0 10px 0; height: 0; }
    .corpdoc-h-wrap { margin: 0 0 14px 0; font-family: Arial, Helvetica, "DejaVu Sans", sans-serif; }
    .corpdoc-h-main { width: 100%; border-collapse: collapse; margin: 8px 0; }
    .corpdoc-h-logo-cell { width: 84px; vertical-align: middle; padding: 0 12px 0 0; }
    .corpdoc-h-ring {
        border: 1.5px solid #deb8bc;
        border-radius: 999px;
        padding: 6px;
        text-align: center;
        display: inline-block;
        background: #fff;
    }
    .corpdoc-h-legal {
        font-size: 15px;
        font-weight: bold;
        color: #374151;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        margin: 0;
        line-height: 1.2;
    }
    .corpdoc-h-slogan {
        font-size: 10.5px;
        color: #6b7280;
        font-style: italic;
        margin: 5px 0 0 0;
        font-family: Georgia, "DejaVu Serif", "Times New Roman", serif;
        line-height: 1.35;
    }
    .corpdoc-h-addr { text-align: right; vertical-align: middle; font-size: 9.5px; line-height: 1.45; color: #374151; padding: 0; }
    .corpdoc-h-addr p { margin: 0; }
</style>
<div class="corpdoc-h-wrap">
    <hr class="corpdoc-h-rule" />
    <table class="corpdoc-h-main" role="presentation">
        <tr>
            <td class="corpdoc-h-logo-cell">
                <div class="corpdoc-h-ring">
                    @if (! empty($logoUri))
                        <img src="{{ $logoUri }}" alt="" style="width:{{ $logoPx }}px;height:{{ $logoPx }}px;display:block;object-fit:contain;" />
                    @else
                        @include('partials.print-logo', ['logoSize' => $logoPx])
                    @endif
                </div>
            </td>
            <td style="vertical-align:middle;padding:0 12px 0 0;">
                <p class="corpdoc-h-legal">{{ $cName }}</p>
                @if ($cSlogan !== '')
                    <p class="corpdoc-h-slogan">{{ $cSlogan }}</p>
                @endif
            </td>
            <td class="corpdoc-h-addr">
                @foreach ($cLines as $line)
                    <p>{{ $line }}</p>
                @endforeach
            </td>
        </tr>
    </table>
    <hr class="corpdoc-h-rule" />
</div>
