<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:24px 0;background-color:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;">
@php
  $__mailLogoUrl = null;
  if (! empty($mailLogoSrc)) {
      $__mailLogoUrl = $mailLogoSrc;
  } elseif (! empty($logoUrl)) {
      $__mailLogoUrl = $logoUrl;
  } else {
      $logoPath = \App\Support\MailLogo::path();
      if (! empty($message) && $logoPath && is_object($message) && method_exists($message, 'embed')) {
          $__mailLogoUrl = $message->embed($logoPath);
      } else {
          $__mailLogoUrl = \App\Support\MailLogo::src();
      }
  }
@endphp
  <tr>
    <td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:24px 28px;background:#111827;color:#f8fafc;">
            <img src="{{ $__mailLogoUrl }}" alt="{{ config('app.name') }}" width="168" height="42" style="display:inline-block;margin-bottom:8px;max-width:168px;max-height:42px;width:auto;height:42px;border:0;">
            <div style="font-size:17px;font-weight:700;">{{ config('app.name', 'Amalgated Lending Inc.') }}</div>
            @if(isset($tagline))
            <div style="font-size:12px;color:#94a3b8;margin-top:4px;">{{ $tagline }}</div>
            @endif
          </td>
        </tr>
        <tr>
          <td style="padding:28px;color:#111827;line-height:1.55;font-size:15px;">
            @yield('mail_body')
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px;background:#fafafa;color:#64748b;font-size:11px;text-align:center;border-top:1px solid #f1f5f9;">
            This notice is from {{ config('app.name', 'Amalgated Lending Inc.') }}. For your security, do not forward verification links or account codes.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
