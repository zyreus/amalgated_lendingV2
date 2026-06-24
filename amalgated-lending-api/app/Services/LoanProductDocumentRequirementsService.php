<?php

namespace App\Services;

use App\Models\LoanApplication;
use App\Models\LoanProduct;

/**
 * Resolves borrower document checklist definitions per loan type / product.
 * Pension loans can override defaults via loan_products.rules.document_requirements.
 */
class LoanProductDocumentRequirementsService
{
    public function definitionsForApplication(LoanApplication $app): array
    {
        $app->loadMissing('loanProduct');

        return $this->definitions($app->loan_type, $app->loanProduct);
    }

    /**
     * @return array<string, array{label: string, description?: ?string, required: bool, multiple: bool, accepted?: ?array<int, string>}>
     */
    public function definitions(?string $loanType, ?LoanProduct $product = null): array
    {
        $loanType = $loanType ?: '';

        if ($loanType === LoanApplication::TYPE_SSS_PENSION && $product) {
            $custom = $product->rules['document_requirements'] ?? null;
            if (is_array($custom) && $custom !== []) {
                return $this->normalizeDefinitions($custom);
            }
        }

        if ($loanType === LoanApplication::TYPE_TRAVEL_ASSISTANCE && $product) {
            $custom = $product->rules['document_requirements'] ?? null;
            if (is_array($custom) && $custom !== []) {
                return $this->normalizeDefinitions($custom);
            }
        }

        $config = config('amalgated_loans.general_documents.'.$loanType, []);

        if ($loanType === LoanApplication::TYPE_TRAVEL_ASSISTANCE) {
            $config = $this->filterBorrowerVisibleDefinitions(is_array($config) ? $config : []);
        }

        return is_array($config) ? $this->normalizeDefinitions($config) : [];
    }

    /**
     * @param  array<string, array<string, mixed>>  $defs
     * @return array<string, array<string, mixed>>
     */
    private function filterBorrowerVisibleDefinitions(array $defs): array
    {
        return array_filter(
            $defs,
            fn (array $meta) => ($meta['borrower_visible'] ?? true) !== false,
        );
    }

    /**
     * @param  array<int|string, mixed>  $raw
     * @return array<string, array{label: string, description?: ?string, required: bool, multiple: bool, accepted?: ?array<int, string>}>
     */
    public function normalizeDefinitions(array $raw): array
    {
        $out = [];

        foreach ($raw as $key => $meta) {
            if (is_int($key) && is_array($meta) && isset($meta['key'])) {
                $key = (string) $meta['key'];
            }

            if (! is_string($key) || ! is_array($meta)) {
                continue;
            }

            $accepted = $meta['accepted'] ?? null;
            if (is_string($accepted)) {
                $accepted = array_values(array_filter(array_map('trim', explode(',', $accepted))));
            }

            $out[$key] = [
                'label' => (string) ($meta['label'] ?? $key),
                'description' => isset($meta['description']) && $meta['description'] !== ''
                    ? (string) $meta['description']
                    : null,
                'required' => array_key_exists('required', $meta) ? (bool) $meta['required'] : true,
                'multiple' => array_key_exists('multiple', $meta) ? (bool) $meta['multiple'] : true,
                'accepted' => is_array($accepted) && $accepted !== [] ? array_values($accepted) : null,
            ];
        }

        return $out;
    }
}
