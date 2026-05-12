<?php

namespace App\Filament\Resources;

use App\Filament\Resources\PaymentResource\Pages;
use App\Models\Payment;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * Read-only mirror of API payment ledger for staff using the Filament panel (OR/AR visibility).
 */
class PaymentResource extends Resource
{
    protected static ?string $model = Payment::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-banknotes';

    protected static ?string $navigationLabel = 'Loan payments';

    protected static string|\UnitEnum|null $navigationGroup = 'Lending';

    protected static ?int $navigationSort = 70;

    public static function form(Schema $schema): Schema
    {
        return $schema->schema([]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('id')->sortable(),
                Tables\Columns\TextColumn::make('loan.id')->label('Loan id')->sortable(),
                Tables\Columns\TextColumn::make('loan.borrower.name')->label('Borrower')->searchable(),
                Tables\Columns\TextColumn::make('installment_no')->label('Inst #')->sortable(),
                Tables\Columns\TextColumn::make('due_date')->date()->sortable(),
                Tables\Columns\TextColumn::make('amount_due')->money('PHP'),
                Tables\Columns\TextColumn::make('amount_paid')->money('PHP'),
                Tables\Columns\TextColumn::make('status')->badge(),
                Tables\Columns\TextColumn::make('payment_method')->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('official_receipt_number')->label('OR')->searchable(),
                Tables\Columns\TextColumn::make('acknowledgement_receipt_number')->label('AR')->searchable(),
                Tables\Columns\TextColumn::make('recordedByUser.name')->label('Recorded by')->toggleable(),
                Tables\Columns\TextColumn::make('verifiedByUser.name')->label('Verified by')->toggleable(),
                Tables\Columns\TextColumn::make('approvedByUser.name')->label('Approved by')->toggleable(),
            ])
            ->defaultSort('due_date', 'desc');
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListPayments::route('/'),
        ];
    }
}
