<?php

namespace App\Filament\Resources\PaymentResource\Pages;

use App\Filament\Resources\PaymentResource;
use App\Models\PaymentReceiptAudit;
use App\Models\User;
use Filament\Actions\Action;
use Filament\Actions\EditAction;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ViewRecord;
use Illuminate\Support\Facades\Request;

class ViewPayment extends ViewRecord
{
    protected static string $resource = PaymentResource::class;

    protected function getHeaderActions(): array
    {
        return [
            EditAction::make(),
            Action::make('verifyReceipts')
                ->label('Verify receipts')
                ->icon('heroicon-o-check-badge')
                ->color('success')
                ->visible(function (): bool {
                    $u = auth()->user();
                    if (! $u instanceof User || ! $u->can('verify', $this->record)) {
                        return false;
                    }

                    return $this->record->verified_at === null;
                })
                ->requiresConfirmation()
                ->action(function (): void {
                    $user = auth()->user();
                    if (! $user instanceof User) {
                        return;
                    }
                    $this->record->verified_by = $user->id;
                    $this->record->verified_at = now();
                    $this->record->save();

                    PaymentReceiptAudit::query()->create([
                        'payment_id' => $this->record->id,
                        'user_id' => $user->id,
                        'action' => PaymentReceiptAudit::ACTION_VERIFIED,
                        'official_receipt_number' => trim((string) ($this->record->official_receipt_number ?? '')) ?: null,
                        'acknowledgement_receipt_number' => trim((string) ($this->record->acknowledgement_receipt_number ?? '')) ?: null,
                        'meta' => ['context' => 'filament.view_payment'],
                        'ip_address' => Request::ip(),
                        'user_agent' => substr((string) Request::userAgent(), 0, 512),
                    ]);

                    Notification::make()
                        ->title('Payment verified')
                        ->success()
                        ->send();

                    $this->record->refresh();
                    $this->dispatch('$refresh');
                }),
        ];
    }
}
