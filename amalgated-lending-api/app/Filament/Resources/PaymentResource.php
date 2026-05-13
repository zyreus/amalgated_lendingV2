<?php

namespace App\Filament\Resources;

use App\Filament\Resources\PaymentResource\Pages;
use App\Filament\Resources\PaymentResource\RelationManagers;
use App\Models\Payment;
use App\Services\PaymentReceiptStatusManager;
use Filament\Forms;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class PaymentResource extends Resource
{
    protected static ?string $model = Payment::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-banknotes';

    protected static ?string $navigationLabel = 'Payments & receipts';

    protected static ?string $modelLabel = 'Payment';

    protected static ?string $pluralModelLabel = 'Payments';

    protected static string|\UnitEnum|null $navigationGroup = 'Lending';

    protected static ?int $navigationSort = 70;

    public static function canViewAny(): bool
    {
        $u = auth()->user();

        return $u && $u->can('viewAny', Payment::class);
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit(Model $record): bool
    {
        $u = auth()->user();

        return $u && $u->can('update', $record);
    }

    public static function canView(Model $record): bool
    {
        $u = auth()->user();

        return $u && $u->can('view', $record);
    }

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->columns(2)
            ->schema([
                Section::make('Installment')
                    ->description('Identifiers are read-only; update receipts from the sections below.')
                    ->schema([
                        Forms\Components\TextInput::make('loan_id')->disabled()->dehydrated(false),
                        Forms\Components\TextInput::make('installment_no')->label('Installment #')->disabled()->dehydrated(false),
                        Forms\Components\TextInput::make('borrower_display')
                            ->label('Borrower')
                            ->disabled()
                            ->dehydrated(false)
                            ->afterStateHydrated(function (Forms\Components\TextInput $c, ?Payment $record): void {
                                $c->state($record?->loan?->borrower?->name ?? '—');
                            }),
                        Forms\Components\TextInput::make('loan_ref_display')
                            ->label('Loan reference')
                            ->disabled()
                            ->dehydrated(false)
                            ->afterStateHydrated(function (Forms\Components\TextInput $c, ?Payment $record): void {
                                $c->state($record?->loan?->loan_number ?? '—');
                            }),
                    ])
                    ->columns(2),
                Section::make('Official & acknowledgement receipts')
                    ->description('Enter OR only, AR only, or both. Values are normalized to uppercase. Duplicates are blocked system-wide.')
                    ->schema([
                        Forms\Components\TextInput::make('official_receipt_number')
                            ->label('Official Receipt (OR) No.')
                            ->maxLength(64)
                            ->extraInputAttributes(['style' => 'text-transform:uppercase'])
                            ->helperText('Optional on pending installments; required when marking paid (unless AR is used).'),
                        Forms\Components\TextInput::make('acknowledgement_receipt_number')
                            ->label('Acknowledgement Receipt (AR) No.')
                            ->maxLength(64)
                            ->extraInputAttributes(['style' => 'text-transform:uppercase']),
                        Forms\Components\DateTimePicker::make('receipt_issued_at')->disabled()->dehydrated(false),
                        Forms\Components\TextInput::make('receipt_issued_by_name')
                            ->label('First issued by')
                            ->disabled()
                            ->dehydrated(false)
                            ->afterStateHydrated(function (Forms\Components\TextInput $c, ?Payment $record): void {
                                $c->state($record?->receiptIssuedByUser?->name ?? '—');
                            }),
                    ])
                    ->columns(2),
                Section::make('Internal notes')
                    ->schema([
                        Forms\Components\Textarea::make('notes')->rows(3)->columnSpanFull(),
                    ]),
            ]);
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema
            ->columns(2)
            ->schema([
                Section::make('Ledger')
                    ->schema([
                        TextEntry::make('id')->label('Payment ID'),
                        TextEntry::make('loan.loan_number')->label('Loan reference'),
                        TextEntry::make('loan.borrower.name')->label('Borrower'),
                        TextEntry::make('installment_no')->label('Installment #'),
                        TextEntry::make('due_date')->date()->label('Due date'),
                        TextEntry::make('amount_due')->money('PHP')->label('Amount due'),
                        TextEntry::make('amount_paid')->money('PHP')->label('Amount paid'),
                        TextEntry::make('status')->badge(),
                        TextEntry::make('payment_method')->label('Payment method'),
                        TextEntry::make('paid_at')->dateTime()->label('Paid at'),
                    ])
                    ->columns(2),
                Section::make('Receipt compliance')
                    ->schema([
                        TextEntry::make('official_receipt_number')->label('OR No.')->copyable(),
                        TextEntry::make('acknowledgement_receipt_number')->label('AR No.')->copyable(),
                        TextEntry::make('receipt_status')
                            ->label('Receipt status')
                            ->badge()
                            ->formatStateUsing(fn (?string $state): string => $state ? str_replace('_', ' ', $state) : '—')
                            ->color(fn (?string $state): string => match ($state) {
                                Payment::RECEIPT_STATUS_APPROVED => 'success',
                                Payment::RECEIPT_STATUS_VERIFIED => 'info',
                                Payment::RECEIPT_STATUS_FULLY_RECEIPTED => 'success',
                                Payment::RECEIPT_STATUS_PARTIAL_RECEIPT => 'warning',
                                default => 'gray',
                            }),
                        TextEntry::make('receipt_document_coverage')
                            ->label('OR / AR coverage')
                            ->getStateUsing(fn (Payment $record): string => app(PaymentReceiptStatusManager::class)->documentCoverageLabel($record))
                            ->badge()
                            ->formatStateUsing(fn (string $state): string => match ($state) {
                                'or_only' => 'OR only',
                                'ar_only' => 'AR only',
                                'both' => 'OR + AR',
                                default => 'Pending',
                            })
                            ->color(fn (string $state): string => match ($state) {
                                'both' => 'success',
                                'or_only', 'ar_only' => 'warning',
                                default => 'gray',
                            }),
                        TextEntry::make('receipt_issued_at')->dateTime()->label('Receipt issued at'),
                        TextEntry::make('receiptIssuedByUser.name')->label('Issued by'),
                        TextEntry::make('receipt_issued_role')->label('Issuer role'),
                        TextEntry::make('verifiedByUser.name')->label('Verified by'),
                        TextEntry::make('verified_at')->dateTime(),
                        TextEntry::make('approvedByUser.name')->label('Approved by'),
                        TextEntry::make('approved_at')->dateTime(),
                        TextEntry::make('recordedByUser.name')->label('Last updated by'),
                    ])
                    ->columns(2),
            ]);
    }

    public static function table(Table $table): Table
    {
        $statuses = [
            Payment::RECEIPT_STATUS_PENDING => 'Pending',
            Payment::RECEIPT_STATUS_PARTIAL_RECEIPT => 'Partial receipt',
            Payment::RECEIPT_STATUS_FULLY_RECEIPTED => 'Fully receipted',
            Payment::RECEIPT_STATUS_VERIFIED => 'Verified',
            Payment::RECEIPT_STATUS_APPROVED => 'Approved',
        ];

        return $table
            ->columns([
                Tables\Columns\TextColumn::make('id')->sortable()->toggleable(),
                Tables\Columns\TextColumn::make('loan.loan_number')->label('Loan ref')->searchable()->sortable(),
                Tables\Columns\TextColumn::make('loan.borrower.name')->label('Borrower')->searchable(),
                Tables\Columns\TextColumn::make('installment_no')->label('Inst #')->sortable(),
                Tables\Columns\TextColumn::make('due_date')->date()->sortable(),
                Tables\Columns\TextColumn::make('amount_paid')->money('PHP')->sortable(),
                Tables\Columns\TextColumn::make('status')->badge()->sortable(),
                Tables\Columns\TextColumn::make('receipt_status')
                    ->label('Receipt status')
                    ->badge()
                    ->toggleable()
                    ->formatStateUsing(fn (?string $state): string => $state ? ($statuses[$state] ?? $state) : '—')
                    ->color(fn (?string $state): string => match ($state) {
                        Payment::RECEIPT_STATUS_APPROVED => 'success',
                        Payment::RECEIPT_STATUS_VERIFIED => 'info',
                        Payment::RECEIPT_STATUS_FULLY_RECEIPTED => 'success',
                        Payment::RECEIPT_STATUS_PARTIAL_RECEIPT => 'warning',
                        default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('receipt_document_coverage')
                    ->label('Coverage')
                    ->badge()
                    ->getStateUsing(fn (Payment $record): string => app(PaymentReceiptStatusManager::class)->documentCoverageLabel($record))
                    ->formatStateUsing(fn (string $state): string => match ($state) {
                        'or_only' => 'OR only',
                        'ar_only' => 'AR only',
                        'both' => 'OR+AR',
                        default => '—',
                    })
                    ->color(fn (string $state): string => match ($state) {
                        'both' => 'success',
                        'or_only', 'ar_only' => 'warning',
                        default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('official_receipt_number')->label('OR')->searchable(),
                Tables\Columns\TextColumn::make('acknowledgement_receipt_number')->label('AR')->searchable(),
                Tables\Columns\TextColumn::make('recordedByUser.name')->label('Collector')->searchable()->toggleable(),
                Tables\Columns\TextColumn::make('loan.assignedOfficer.name')->label('Loan officer')->searchable()->toggleable(),
                Tables\Columns\TextColumn::make('payment_method')->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('paid_at')->dateTime()->sortable()->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        Payment::STATUS_PENDING => 'Pending',
                        Payment::STATUS_PARTIAL => 'Partial',
                        Payment::STATUS_PAID => 'Paid',
                        Payment::STATUS_OVERDUE => 'Overdue',
                        Payment::STATUS_WAIVED => 'Waived',
                    ]),
                Tables\Filters\SelectFilter::make('receipt_status')->options($statuses),
                Tables\Filters\SelectFilter::make('receipt_document_coverage')
                    ->label('OR/AR coverage')
                    ->options([
                        'none' => 'Missing both',
                        'or_only' => 'OR only',
                        'ar_only' => 'AR only',
                        'both' => 'OR + AR',
                    ])
                    ->query(function (Builder $query, array $data): void {
                        $v = $data['value'] ?? null;
                        if (! is_string($v) || $v === '') {
                            return;
                        }
                        if ($v === 'or_only') {
                            $query->where(function ($w): void {
                                $w->whereNotNull('official_receipt_number')->where('official_receipt_number', '!=', '')
                                    ->where(function ($x): void {
                                        $x->whereNull('acknowledgement_receipt_number')->orWhere('acknowledgement_receipt_number', '');
                                    });
                            });
                        } elseif ($v === 'ar_only') {
                            $query->where(function ($w): void {
                                $w->whereNotNull('acknowledgement_receipt_number')->where('acknowledgement_receipt_number', '!=', '')
                                    ->where(function ($x): void {
                                        $x->whereNull('official_receipt_number')->orWhere('official_receipt_number', '');
                                    });
                            });
                        } elseif ($v === 'both') {
                            $query->where(function ($w): void {
                                $w->whereNotNull('official_receipt_number')->where('official_receipt_number', '!=', '')
                                    ->whereNotNull('acknowledgement_receipt_number')->where('acknowledgement_receipt_number', '!=', '');
                            });
                        } elseif ($v === 'none') {
                            $query->where(function ($w): void {
                                $w->where(function ($x): void {
                                    $x->whereNull('official_receipt_number')->orWhere('official_receipt_number', '');
                                })->where(function ($x): void {
                                    $x->whereNull('acknowledgement_receipt_number')->orWhere('acknowledgement_receipt_number', '');
                                });
                            });
                        }
                    }),
                Tables\Filters\SelectFilter::make('payment_method')
                    ->options([
                        'cash' => 'Cash',
                        'gcash' => 'GCash',
                        'bank' => 'Bank',
                    ]),
            ])
            ->defaultSort('due_date', 'desc')
            ->striped()
            ->paginated([25, 50, 100])
            ->recordUrl(fn (Payment $record): string => static::getUrl('view', ['record' => $record]));
    }

    public static function getRelations(): array
    {
        return [
            RelationManagers\ReceiptAuditsRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListPayments::route('/'),
            'view' => Pages\ViewPayment::route('/{record}'),
            'edit' => Pages\EditPayment::route('/{record}/edit'),
        ];
    }
}
