@extends('mail.layout')

@section('mail_body')
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;">News &amp; announcements</h1>
<p style="margin:0 0 16px;">Hi {{ $recipientName }},</p>
<p style="margin:0 0 20px;">Here is the latest from {{ config('app.name', 'Amalgated Lending Inc.') }}.</p>

@if(count($announcements) > 0)
<h2 style="margin:24px 0 12px;font-size:16px;color:#991b1b;">Announcements</h2>
@foreach($announcements as $item)
<div style="margin:0 0 16px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
  <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#111827;">{{ $item['title'] }}</p>
  @if(!empty($item['date']))
  <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">{{ $item['date'] }}</p>
  @endif
  @if(!empty($item['summary']))
  <p style="margin:0;font-size:14px;color:#334155;">{{ $item['summary'] }}</p>
  @endif
</div>
@endforeach
@endif

@if(count($news) > 0)
<h2 style="margin:24px 0 12px;font-size:16px;color:#991b1b;">News</h2>
@foreach($news as $item)
<div style="margin:0 0 16px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
  <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#111827;">{{ $item['title'] }}</p>
  @if(!empty($item['date']))
  <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">{{ $item['date'] }}</p>
  @endif
  @if(!empty($item['summary']))
  <p style="margin:0;font-size:14px;color:#334155;">{{ $item['summary'] }}</p>
  @endif
</div>
@endforeach
@endif

<p style="margin:24px 0 0;">
  <a href="{{ $siteUrl }}" style="display:inline-block;padding:12px 22px;background:#991b1b;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Visit our website</a>
</p>
<p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">You are receiving this because you subscribed to updates from our website. To unsubscribe, reply to this email.</p>
@endsection
