<?php

namespace App\Filament\Resources\CareerJobResource\Pages;

use App\Filament\Resources\CareerJobResource;
use App\Models\CareerJob;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Support\Str;

class CreateCareerJob extends CreateRecord
{
    protected static string $resource = CareerJobResource::class;

    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $data['slug'] = $data['slug'] ?? Str::slug($data['title'] ?? 'job');
        $base = $data['slug'];
        $i = 0;
        while (CareerJob::withTrashed()->where('slug', $data['slug'])->exists()) {
            $data['slug'] = $base.'-'.(++$i);
        }
        $data['created_by'] = auth()->id();

        return $data;
    }
}
