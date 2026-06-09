<?php

namespace App\Console\Commands;

use App\Models\Payment;
use App\Models\SystemSetting;
use Illuminate\Console\Command;

class RecalculateOverduePenaltiesCommand extends Command
{
    protected $signature = 'soa:recalculate-penalties';

    protected $description = 'Recalculate overdue installment penalties for SOA reporting.';

    public function handle(): int
    {
        $settings = SystemSetting::query()->where('key', 'loan_defaults')->value('value');
        $penaltyPercent = (float) (is_array($settings) ? ($settings['penalty_percent'] ?? 2) : 2);
        $updated = 0;

        Payment::query()
            ->whereNotIn('status', [Payment::STATUS_PAID, Payment::STATUS_WAIVED])
            ->whereDate('due_date', '<', now()->toDateString())
            ->orderBy('id')
            ->chunkById(200, function ($payments) use ($penaltyPercent, &$updated): void {
                foreach ($payments as $payment) {
                    $balance = max(0, (float) $payment->amount_due - (float) $payment->amount_paid);
                    $penalty = round($balance * ($penaltyPercent / 100), 2);
                    $payment->forceFill([
                        'status' => Payment::STATUS_OVERDUE,
                        'penalty_amount' => $penalty,
                    ])->save();
                    $updated++;
                }
            });

        $this->info("Updated {$updated} overdue payment penalty record(s).");

        return self::SUCCESS;
    }
}
