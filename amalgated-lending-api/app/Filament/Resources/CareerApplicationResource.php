<?php

namespace App\Filament\Resources;

use App\Filament\Resources\CareerApplicationResource\Pages;
use App\Models\CareerApplication;
use Filament\Forms;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables;
use Filament\Tables\Table;

class CareerApplicationResource extends Resource
{
    protected static ?string $model = CareerApplication::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-user-group';

    protected static ?string $navigationLabel = 'Careers — applicants';

    protected static string|\UnitEnum|null $navigationGroup = 'HR & Careers';

    protected static ?int $navigationSort = 6;

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->schema([
                Forms\Components\Select::make('status')
                    ->options(CareerApplication::statusLabels())
                    ->required(),
                Forms\Components\Textarea::make('internal_notes')->rows(4)->columnSpanFull(),
                Forms\Components\Textarea::make('interview_feedback')->rows(4)->columnSpanFull(),
                Forms\Components\Toggle::make('send_automated_emails')->label('Send automated applicant emails'),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('id')->sortable(),
                Tables\Columns\TextColumn::make('job.title')->label('Job')->wrap()->searchable(),
                Tables\Columns\TextColumn::make('applicant.email')->label('Applicant')->searchable(),
                Tables\Columns\TextColumn::make('status')->badge(),
                Tables\Columns\TextColumn::make('applied_at')->dateTime()->sortable(),
            ])
            ->defaultSort('id', 'desc');
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListCareerApplications::route('/'),
            'edit' => Pages\EditCareerApplication::route('/{record}/edit'),
        ];
    }

    public static function canCreate(): bool
    {
        return false;
    }
}
