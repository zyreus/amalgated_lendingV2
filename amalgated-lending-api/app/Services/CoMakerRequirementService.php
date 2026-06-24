<?php

namespace App\Services;

use App\Models\LoanApplication;
use App\Models\LoanProduct;

class CoMakerRequirementService
{
    public static function requiresCoMakers(LoanApplication $app): bool
    {
        $product = $app->relationLoaded('loanProduct')
            ? $app->loanProduct
            : ($app->loan_product_id ? LoanProduct::find($app->loan_product_id) : null);

        if ($product) {
            $rules = is_array($product->rules) ? $product->rules : [];
            if (array_key_exists('requires_co_makers', $rules)) {
                return (bool) $rules['requires_co_makers'];
            }
            $cfg = is_array($product->calculator_config) ? $product->calculator_config : [];
            if (array_key_exists('requires_co_makers', $cfg)) {
                return (bool) $cfg['requires_co_makers'];
            }
        }

        $loanType = $app->loan_type;

        return $loanType && in_array($loanType, config('amalgated_loans.loan_types_requiring_co_makers', []), true);
    }

    /** @return array<string, array{label: string, required: bool, multiple: bool}> */
    public static function documentCategories(): array
    {
        $fromCoMaker = config('co_maker.document_categories');
        if (is_array($fromCoMaker) && $fromCoMaker !== []) {
            return $fromCoMaker;
        }

        return config('amalgated_loans.co_maker_document_categories', []);
    }
}
