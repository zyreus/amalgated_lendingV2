<?php

namespace App\Filament\Resources\PaymentResource\Pages;

use App\Filament\Resources\PaymentResource;
use App\Models\Payment;
use App\Models\User;
use App\Services\PaymentReceiptMutationService;
use Filament\Actions\ViewAction;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Database\Eloquent\Model;

class EditPayment extends EditRecord
{
    protected static string $resource = PaymentResource::class;

    protected function getHeaderActions(): array
    {
        return [
            ViewAction::make(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function handleRecordUpdate(Model $record, array $data): Model
    {
        if (! $record instanceof Payment) {
            return parent::handleRecordUpdate($record, $data);
        }

        $user = auth()->user();
        if (! $user instanceof User) {
            abort(403);
        }

        $allowClear = ! $record->isPaid()
            || $user->hasPermission('payments.override_locked')
            || $user->hasPermission('roles.manage');

        return app(PaymentReceiptMutationService::class)->updateReceiptsFromStaff(
            $record,
            $user,
            $data,
            'filament.edit_payment',
            false,
            $allowClear
        );
    }
}
