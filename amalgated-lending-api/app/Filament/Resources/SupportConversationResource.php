<?php

namespace App\Filament\Resources;

use App\Filament\Resources\SupportConversationResource\Pages;
use App\Models\SupportConversation;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Read-only CRM warehouse view of visitor / support threads (Laravel analytics).
 */
class SupportConversationResource extends Resource
{
    protected static ?string $model = SupportConversation::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-chat-bubble-left-right';

    protected static ?string $navigationLabel = 'Support conversations';

    protected static ?string $modelLabel = 'Support conversation';

    protected static ?string $pluralModelLabel = 'Support conversations';

    protected static string|\UnitEnum|null $navigationGroup = 'CRM';

    protected static ?int $navigationSort = 15;

    public static function form(Schema $schema): Schema
    {
        return $schema->schema([]);
    }

    public static function canViewAny(): bool
    {
        $u = auth()->user();

        return $u && $u->can('viewAny', SupportConversation::class);
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit(Model $record): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $q) => $q->orderByDesc('last_message_at')->orderByDesc('id'))
            ->columns([
                Tables\Columns\TextColumn::make('session_id')
                    ->label('Session')
                    ->searchable()
                    ->copyable()
                    ->limit(28)
                    ->tooltip(fn (SupportConversation $record): string => (string) $record->session_id),
                Tables\Columns\TextColumn::make('guest_name')
                    ->label('Visitor')
                    ->searchable()
                    ->placeholder('—'),
                Tables\Columns\TextColumn::make('guest_email')
                    ->label('Email')
                    ->searchable()
                    ->placeholder('—'),
                Tables\Columns\TextColumn::make('visitor_type')
                    ->label('Lane')
                    ->badge()
                    ->sortable()
                    ->searchable(),
                Tables\Columns\TextColumn::make('lifecycle_status')
                    ->label('Lifecycle')
                    ->badge()
                    ->sortable(query: function (Builder $query, string $direction): Builder {
                        return $query->orderBy('status', $direction);
                    }),
                Tables\Columns\TextColumn::make('status')
                    ->label('Warehouse status')
                    ->sortable()
                    ->searchable(),
                Tables\Columns\TextColumn::make('mode')
                    ->label('Mode')
                    ->sortable(),
                Tables\Columns\TextColumn::make('last_message_at')
                    ->label('Last message')
                    ->dateTime('M j, Y g:i A')
                    ->sortable()
                    ->placeholder('—'),
                Tables\Columns\TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime('M j, Y g:i A')
                    ->sortable(),
                Tables\Columns\TextColumn::make('updated_at')
                    ->label('Updated')
                    ->dateTime('M j, Y g:i A')
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('visitor_type')
                    ->label('Visitor lane')
                    ->options([
                        SupportConversation::VISITOR_TYPE_AI => 'AI',
                        SupportConversation::VISITOR_TYPE_HUMAN => 'Human',
                    ]),
            ])
            ->poll('30s');
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListSupportConversations::route('/'),
        ];
    }
}
