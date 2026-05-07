<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Amalgated Lending Payment Invoice</title>
</head>
<body style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; line-height: 1.6; color: #111827; max-width: 640px; margin: 0; padding: 24px;">
    <div style="margin: 0 0 20px; display: flex; align-items: center; gap: 12px;">
        <img src="{{ $logoCid ?: $logoUrl }}" alt="Amalgated Lending" style="height: 52px; width: auto;">
        <div>
            <div style="font-size: 18px; font-weight: 800; letter-spacing: 0.04em;">Amalgated Lending</div>
            <div style="font-size: 14px; font-weight: 600; color: #4b5563;">Payment Invoice</div>
        </div>
    </div>
    <p style="margin: 0 0 16px;">Hello {{ $borrowerName }},</p>
    <p style="margin: 0 0 16px;">Your payment has been <strong>confirmed</strong> by Amalgated Lending. Below is your official receipt summary.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px; font-size: 14px;">
        <tr>
            <td style="padding: 8px 0; color: #6b7280;">Receipt #</td>
            <td style="padding: 8px 0; font-weight: 600;">{{ $invoiceNumber }}</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; color: #6b7280;">Loan</td>
            <td style="padding: 8px 0;">#{{ $loanId }}</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; color: #6b7280;">Installment</td>
            <td style="padding: 8px 0;">{{ $installmentNo }}</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; color: #6b7280;">Amount paid</td>
            <td style="padding: 8px 0; font-weight: 600;">₱{{ $amountPaid }}</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; color: #6b7280;">Payment date</td>
            <td style="padding: 8px 0;">{{ $paidAt }}</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; color: #6b7280;">Reference</td>
            <td style="padding: 8px 0;">{{ $referenceNumber }}</td>
        </tr>
    </table>
    @if($payment->receipt_path)
        <p style="margin: 0 0 16px; font-size: 13px; color: #374151;">If you uploaded proof of payment, it is also attached to this email.</p>
    @endif
    <p style="margin: 0 0 16px;">Thank you for your payment.</p>
    <p style="margin: 0; color: #374151; font-size: 13px;">
        — Amalgated Lending<br>
        <span style="color: #6b7280;">This is an automated message; please do not reply directly to this email.</span>
    </p>
</body>
</html>
