<?php

namespace App\Filament\Resources\PaymentResource\Pages;

use App\Filament\Resources\PaymentResource;
use Filament\Resources\Pages\ListRecords;
use Illuminate\Database\Eloquent\Builder;

class ListPayments extends ListRecords
{
    protected static string $resource = PaymentResource::class;

    protected function getTableQuery(): Builder
    {
        return parent::getTableQuery()
            ->with(['loan.borrower', 'loan.assignedOfficer', 'recordedByUser', 'verifiedByUser', 'approvedByUser']);
    }
}
