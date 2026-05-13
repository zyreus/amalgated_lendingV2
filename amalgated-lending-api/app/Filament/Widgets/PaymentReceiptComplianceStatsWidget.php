<?php

namespace App\Filament\Widgets;

use App\Models\Payment;
use App\Models\PaymentReceiptAudit;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class PaymentReceiptComplianceStatsWidget extends StatsOverviewWidget
{
    protected static ?int $sort = 5;

    protected ?string $heading = 'Receipt compliance';

    protected ?string $description = 'Rolling 30-day snapshot for fraud signals and missing receipt numbers on paid installments.';

    public static function canView(): bool
    {
        $u = auth()->user();

        return $u && ($u->hasPermission('reports.view') || $u->hasPermission('payments.manage'));
    }

    /**
     * @return array<Stat>
     */
    protected function getStats(): array
    {
        $dupes = PaymentReceiptAudit::query()
            ->where('action', PaymentReceiptAudit::ACTION_DUPLICATE_ATTEMPT)
            ->where('created_at', '>=', now()->subDays(30))
            ->count();

        $missing = Payment::query()
            ->where('status', Payment::STATUS_PAID)
            ->where('paid_at', '>=', now()->subDays(30))
            ->where(function ($q): void {
                $q->where(function ($x): void {
                    $x->whereNull('official_receipt_number')->orWhere('official_receipt_number', '');
                })->where(function ($x): void {
                    $x->whereNull('acknowledgement_receipt_number')->orWhere('acknowledgement_receipt_number', '');
                });
            })
            ->count();

        return [
            Stat::make('Duplicate receipt attempts', (string) $dupes)
                ->description('Logged duplicate OR/AR submissions')
                ->color($dupes > 0 ? 'danger' : 'success'),
            Stat::make('Paid installments missing both OR & AR', (string) $missing)
                ->description('Paid in the last 30 days with no OR and no AR')
                ->color($missing > 0 ? 'warning' : 'success'),
        ];
    }
}
