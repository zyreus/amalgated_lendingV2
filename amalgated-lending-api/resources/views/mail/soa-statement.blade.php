@extends('mail.layout')

@section('mail_body')
<p style="margin:0 0 14px;color:#64748b;font-size:13px;">Statement · <strong style="color:#111827">{{ $statementNumber }}</strong></p>
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;">Your {{ $statementMonth }} Statement of Account is ready</h1>
<p style="margin:0 0 16px;">Hi {{ $borrowerName }},</p>
<p style="margin:0 0 16px;">Your monthly Statement of Account for loan <strong>{{ $loanNumber }}</strong> is attached as a PDF and is also available in the borrower portal.</p>
<table role="presentation" cellpadding="12" cellspacing="0" border="1" bordercolor="#e2e8f0" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:18px;">
  <tbody>
    <tr><td style="background:#f8fafc;font-weight:700;width:42%;">Monthly due</td><td>PHP {{ $monthlyDue }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Penalties / charges</td><td>PHP {{ $penalties }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Total amount due</td><td><strong>PHP {{ $totalDue }}</strong></td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Due date</td><td>{{ $dueDate }}</td></tr>
    <tr><td style="background:#f8fafc;font-weight:700;">Remaining balance</td><td>PHP {{ $remainingBalance }}</td></tr>
  </tbody>
</table>
<p style="margin:24px 0 0;">
  <a href="{{ $portalUrl }}" style="display:inline-block;padding:12px 22px;background:#ff0000;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View statement</a>
</p>
<p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">If you recently paid, please allow posting time for the next statement refresh. Contact support for account corrections.</p>
@endsection
