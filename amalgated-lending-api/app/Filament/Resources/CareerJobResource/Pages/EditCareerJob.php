<?php

namespace App\Filament\Resources\CareerJobResource\Pages;

use App\Filament\Resources\CareerJobResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Support\Str;

class EditCareerJob extends EditRecord
{
    protected static string $resource = CareerJobResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }

    protected function mutateFormDataBeforeSave(array $data): array
    {
        if (isset($data['slug']) && $data['slug'] !== '') {
            $data['slug'] = Str::slug($data['slug']);
        }

        return $data;
    }
}
