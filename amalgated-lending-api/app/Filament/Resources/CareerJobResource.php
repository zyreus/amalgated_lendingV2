<?php

namespace App\Filament\Resources;

use App\Filament\Resources\CareerJobResource\Pages;
use App\Models\CareerBranch;
use App\Models\CareerDepartment;
use App\Models\CareerJob;
use Filament\Forms;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables;
use Filament\Tables\Table;

class CareerJobResource extends Resource
{
    protected static ?string $model = CareerJob::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-briefcase';

    protected static ?string $navigationLabel = 'Careers — job posts';

    protected static string|\UnitEnum|null $navigationGroup = 'HR & Careers';

    protected static ?int $navigationSort = 5;

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->schema([
                Forms\Components\Grid::make(2)->schema([
                    Forms\Components\TextInput::make('title')->required()->maxLength(255),
                    Forms\Components\TextInput::make('slug')->maxLength(255)->helperText('Leave blank to auto-generate from title.'),
                    Forms\Components\Select::make('department_id')
                        ->label('Department')
                        ->options(fn () => CareerDepartment::query()->where('is_active', true)->orderBy('name')->pluck('name', 'id'))
                        ->searchable()
                        ->nullable(),
                    Forms\Components\Select::make('branch_id')
                        ->label('Branch / location')
                        ->options(fn () => CareerBranch::query()->where('is_active', true)->orderBy('name')->pluck('name', 'id'))
                        ->searchable()
                        ->nullable(),
                    Forms\Components\TextInput::make('employment_type')->default('full_time')->required(),
                    Forms\Components\Select::make('status')
                        ->options([
                            CareerJob::STATUS_DRAFT => 'Draft',
                            CareerJob::STATUS_PUBLISHED => 'Published',
                            CareerJob::STATUS_CLOSED => 'Closed',
                            CareerJob::STATUS_ARCHIVED => 'Archived',
                        ])
                        ->required(),
                    Forms\Components\DatePicker::make('application_deadline')->nullable(),
                    Forms\Components\DateTimePicker::make('published_at')->nullable(),
                    Forms\Components\TextInput::make('salary_currency')->default('PHP')->maxLength(8),
                    Forms\Components\TextInput::make('salary_min')->numeric()->nullable(),
                    Forms\Components\TextInput::make('salary_max')->numeric()->nullable(),
                ]),
                Forms\Components\Textarea::make('qualifications')->rows(4)->columnSpanFull(),
                Forms\Components\Textarea::make('responsibilities')->rows(4)->columnSpanFull(),
                Forms\Components\Textarea::make('requirements')->rows(4)->columnSpanFull(),
                Forms\Components\Textarea::make('benefits')->rows(3)->columnSpanFull(),
                Forms\Components\Textarea::make('application_instructions')->rows(3)->columnSpanFull(),
                Forms\Components\TextInput::make('seo_title')->maxLength(255)->nullable(),
                Forms\Components\Textarea::make('seo_description')->rows(2)->maxLength(512)->nullable(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('id')->sortable(),
                Tables\Columns\TextColumn::make('title')->searchable()->wrap(),
                Tables\Columns\TextColumn::make('status')->badge(),
                Tables\Columns\TextColumn::make('department.name')->label('Dept'),
                Tables\Columns\TextColumn::make('published_at')->dateTime()->sortable(),
                Tables\Columns\TextColumn::make('applications_count')->counts('applications')->label('Apps'),
            ])
            ->defaultSort('id', 'desc');
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListCareerJobs::route('/'),
            'create' => Pages\CreateCareerJob::route('/create'),
            'edit' => Pages\EditCareerJob::route('/{record}/edit'),
        ];
    }
}
