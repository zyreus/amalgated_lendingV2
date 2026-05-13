<?php

namespace App\Filament\Resources\PaymentResource\RelationManagers;

use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables;
use Filament\Tables\Table;

class ReceiptAuditsRelationManager extends RelationManager
{
    protected static string $relationship = 'receiptAudits';

    protected static ?string $title = 'Receipt audit trail';

    protected static bool $shouldSkipAuthorization = true;

    public function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('id')->sortable(),
                Tables\Columns\TextColumn::make('created_at')->dateTime()->label('When'),
                Tables\Columns\TextColumn::make('user.name')->label('User')->placeholder('—'),
                Tables\Columns\TextColumn::make('action')->badge()->searchable(),
                Tables\Columns\TextColumn::make('official_receipt_number')->label('OR')->toggleable(),
                Tables\Columns\TextColumn::make('acknowledgement_receipt_number')->label('AR')->toggleable(),
                Tables\Columns\TextColumn::make('ip_address')->label('IP')->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('meta')
                    ->label('Meta')
                    ->limit(40)
                    ->tooltip(function ($state): ?string {
                        if (is_array($state)) {
                            return json_encode($state, JSON_UNESCAPED_UNICODE);
                        }

                        return is_string($state) ? $state : null;
                    })
                    ->formatStateUsing(function ($state): string {
                        if (is_array($state)) {
                            return json_encode($state, JSON_UNESCAPED_UNICODE) ?: '';
                        }

                        return (string) ($state ?? '');
                    }),
            ])
            ->paginated([10, 25, 50]);
    }
}
