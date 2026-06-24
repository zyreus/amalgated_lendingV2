<?php

namespace App\Services;

use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\RealEstateDetail;
use App\Models\User;
use Illuminate\Support\Arr;

class PropertyAppraisalService
{
    private const STAFF_KEYS = [
        'property_type',
        'title_number',
        'tax_declaration_number',
        'property_address',
        'lot_area',
        'floor_area',
        'market_value',
        'assessed_value',
        'appraised_value',
        'loanable_percentage',
        'loanable_value',
        'evaluation_remarks',
    ];

    /**
     * @param  array<string, mixed>  $payload
     * @return array{detail: RealEstateDetail, application: LoanApplication}
     */
    public function updateFromStaff(Loan $loan, User $actor, array $payload): array
    {
        $app = $loan->loanApplication;
        if (! $app || $app->loan_type !== LoanApplication::TYPE_REAL_ESTATE) {
            throw new \InvalidArgumentException('Property appraisal applies only to real estate mortgage loans.');
        }

        $data = Arr::only($payload, self::STAFF_KEYS);

        foreach (['lot_area', 'floor_area', 'market_value', 'assessed_value', 'appraised_value', 'loanable_percentage', 'loanable_value'] as $numKey) {
            if (array_key_exists($numKey, $data) && $data[$numKey] !== '' && $data[$numKey] !== null) {
                $data[$numKey] = round((float) $data[$numKey], 2);
            } elseif (array_key_exists($numKey, $data) && ($data[$numKey] === '' || $data[$numKey] === null)) {
                $data[$numKey] = null;
            }
        }

        $data['loanable_value'] = $this->resolveLoanableValue($data);
        $data['evaluated_by'] = $actor->id;
        $data['evaluated_at'] = now();

        $detail = RealEstateDetail::query()->updateOrCreate(
            ['loan_application_id' => $app->id],
            $data
        );

        if (! empty($data['property_address'])) {
            $app->property_location = trim((string) $data['property_address']);
        }

        $collateralValue = $detail->collateralValueForLtv();
        if ($collateralValue !== null) {
            $app->property_value = $collateralValue;
        }

        $app->save();

        return ['detail' => $detail->fresh(['evaluator']), 'application' => $app->fresh()];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function resolveLoanableValue(array $data): ?float
    {
        if (isset($data['loanable_value']) && $data['loanable_value'] !== null && (float) $data['loanable_value'] > 0) {
            return round((float) $data['loanable_value'], 2);
        }

        $base = null;
        foreach (['appraised_value', 'market_value'] as $key) {
            if (isset($data[$key]) && $data[$key] !== null && (float) $data[$key] > 0) {
                $base = (float) $data[$key];
                break;
            }
        }

        if ($base === null) {
            return isset($data['loanable_value']) && $data['loanable_value'] !== null
                ? round((float) $data['loanable_value'], 2)
                : null;
        }

        $pct = isset($data['loanable_percentage']) && $data['loanable_percentage'] !== null && $data['loanable_percentage'] !== ''
            ? (float) $data['loanable_percentage']
            : null;

        if ($pct === null || $pct <= 0) {
            return null;
        }

        return round($base * ($pct / 100), 2);
    }
}
