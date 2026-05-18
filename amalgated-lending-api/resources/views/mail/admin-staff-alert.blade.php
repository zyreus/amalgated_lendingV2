@extends('mail.layout', ['tagline' => 'Admin alert'])

@section('mail_body')
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;">{{ $alertTitle }}</h1>
@if($alertBody)
<p style="margin:0 0 16px;color:#475569;font-size:15px;">{{ $alertBody }}</p>
@endif
<p style="margin:0 0 12px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Category · {{ str_replace('_', ' ', $category) }}</p>
@if(!empty($data))
<table role="presentation" cellpadding="10" cellspacing="0" border="1" bordercolor="#e2e8f0" style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px;">
  <tbody>
    @foreach($data as $key => $value)
      @if(is_scalar($value) && $key !== 'dedupe_key')
      <tr>
        <td style="background:#f8fafc;font-weight:600;width:38%;">{{ ucwords(str_replace('_', ' ', $key)) }}</td>
        <td>{{ $value }}</td>
      </tr>
      @endif
    @endforeach
  </tbody>
</table>
@endif
@if($actionUrl)
<p style="margin:24px 0 0;">
  <a href="{{ $actionUrl }}" style="display:inline-block;padding:12px 22px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Open in admin dashboard</a>
</p>
@endif
<p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">Internal use only. Do not forward outside authorized staff.</p>
@endsection
