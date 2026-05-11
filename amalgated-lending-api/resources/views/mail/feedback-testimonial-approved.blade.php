@extends('mail.layout')

@section('mail_body')
  <p style="margin:0 0 12px;font-size:16px;line-height:1.5">Hi {{ $recipientName }},</p>
  <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#374151">{{ $bodyLine }}</p>
  <p style="margin:16px 0 0;font-size:14px;line-height:1.5;color:#6b7280">Thank you for choosing {{ config('app.name', 'Amalgated Lending') }}.</p>
@endsection
