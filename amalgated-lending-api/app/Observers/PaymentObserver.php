<?php

namespace App\Observers;

use App\Models\Payment;
use App\Services\PaymentReceiptStatusManager;

class PaymentObserver
{
    public function saving(Payment $payment): void
    {
        $payment->receipt_status = app(PaymentReceiptStatusManager::class)->compute($payment);
    }
}
