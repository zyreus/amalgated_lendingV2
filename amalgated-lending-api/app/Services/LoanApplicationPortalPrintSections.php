<?php

namespace App\Services;

use App\Models\LoanApplication;
use App\Models\LoanProduct;

/**
 * Builds labeled print sections from product wizard form_data (borrower portal).
 */
class LoanApplicationPortalPrintSections
{
    /** @var list<string> */
    private const SKIP_KEYS = [
        'loan_product_id',
        'loan_product_slug',
        'loan_product_type',
        'loan_type',
        'privacy_consent',
        'requested_loan_amount',
        'prospected_loan_amount',
        'extended_application_form',
        'co_maker_statement',
    ];

    /**
     * @param  array<string, mixed>  $form
     * @return list<array{title: string, fields: list<array{label: string, value: string}>}>
     */
    public function build(LoanApplication $application, array $form): array
    {
        $loanType = (string) ($application->loan_type ?? '');
        $schema = config("amalgated_loans.product_application_fields.{$loanType}", []);
        if ($schema === []) {
            return [];
        }

        $sectionTitles = [];
        foreach (config("amalgated_loans.product_application_steps.{$loanType}", []) as $step) {
            if (isset($step['section'], $step['title'])) {
                $sectionTitles[(string) $step['section']] = (string) $step['title'];
            }
        }

        $productName = $application->loanProduct?->name;
        if (! $productName && ! empty($form['loan_product_id'])) {
            $productName = LoanProduct::query()->find($form['loan_product_id'])?->name;
        }

        $sections = [];

        foreach ($schema as $sectionKey => $fieldDefs) {
            if (! is_array($fieldDefs)) {
                continue;
            }

            $items = [];
            foreach ($fieldDefs as $fieldDef) {
                if (! is_array($fieldDef) || empty($fieldDef['key'])) {
                    continue;
                }

                $key = (string) $fieldDef['key'];
                if (in_array($key, self::SKIP_KEYS, true)) {
                    continue;
                }

                if (! $this->shouldShowField($fieldDef, $form)) {
                    continue;
                }

                $raw = $form[$key] ?? null;
                if ($key === 'loan_product_id' && $productName) {
                    $raw = $productName;
                }

                $formatted = $this->formatValue($raw);
                if ($formatted === '') {
                    continue;
                }

                $items[] = [
                    'label' => (string) ($fieldDef['label'] ?? $key),
                    'value' => $formatted,
                ];
            }

            if ($items !== []) {
                $sections[] = [
                    'title' => $sectionTitles[$sectionKey]
                        ?? ucwords(str_replace('_', ' ', (string) $sectionKey)),
                    'fields' => $items,
                ];
            }
        }

        return $sections;
    }

    /**
     * @param  array<string, mixed>  $fieldDef
     * @param  array<string, mixed>  $form
     */
    private function shouldShowField(array $fieldDef, array $form): bool
    {
        $requiredIf = $fieldDef['required_if'] ?? null;
        if (! is_array($requiredIf) || $requiredIf === []) {
            return true;
        }

        foreach ($requiredIf as $depKey => $expected) {
            if (($form[$depKey] ?? null) !== $expected) {
                return false;
            }
        }

        return true;
    }

    private function formatValue(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }

        if (is_scalar($value)) {
            return trim((string) $value);
        }

        if (is_array($value)) {
            $parts = [];
            foreach ($value as $item) {
                $part = $this->formatValue($item);
                if ($part !== '') {
                    $parts[] = $part;
                }
            }

            return implode(', ', $parts);
        }

        return '';
    }
}
