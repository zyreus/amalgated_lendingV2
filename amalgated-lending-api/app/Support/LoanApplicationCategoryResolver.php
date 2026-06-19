<?php

namespace App\Support;

/**
 * Maps loan application metadata to print-form loan category checkboxes.
 */
final class LoanApplicationCategoryResolver
{
    /**
     * @return array{businessLoan: bool, chattelMortgage: bool, realEstateMortgage: bool, salaryLoan: bool, otherSpecify: string}
     */
    public static function emptyCategories(): array
    {
        return [
            'businessLoan' => false,
            'chattelMortgage' => false,
            'realEstateMortgage' => false,
            'salaryLoan' => false,
            'otherSpecify' => '',
        ];
    }

    /**
     * @param  array<string, mixed>|null  $existing
     * @return array{businessLoan: bool, chattelMortgage: bool, realEstateMortgage: bool, salaryLoan: bool, otherSpecify: string}
     */
    public static function resolve(
        ?string $loanType,
        ?string $productSlug = null,
        ?string $loanTypeLabel = null,
        ?array $existing = null,
    ): array {
        $categories = self::emptyCategories();
        if (is_array($existing)) {
            $categories = array_merge($categories, $existing);
        }

        if (self::hasSelection($categories)) {
            return $categories;
        }

        $haystack = mb_strtolower(trim(implode(' ', array_filter([
            (string) $loanType,
            (string) $productSlug,
            (string) $loanTypeLabel,
        ]))));

        if ($haystack === '') {
            return $categories;
        }

        if (self::matches($haystack, ['business'])) {
            $categories['businessLoan'] = true;

            return $categories;
        }

        if (self::matches($haystack, ['chattel'])) {
            $categories['chattelMortgage'] = true;

            return $categories;
        }

        if (self::matches($haystack, ['real_estate', 'real-estate', 'real estate', 'rem ', ' mortgage loan'])) {
            $categories['realEstateMortgage'] = true;

            return $categories;
        }

        if (self::matches($haystack, ['salary', 'in-house salary'])) {
            $categories['salaryLoan'] = true;

            return $categories;
        }

        if (self::matches($haystack, ['travel'])) {
            $categories['otherSpecify'] = 'Travel Assistance Loan';

            return $categories;
        }

        if (self::matches($haystack, ['pension', 'sss', 'gsis'])) {
            $categories['otherSpecify'] = 'SSS/GSIS Pension Loan';

            return $categories;
        }

        if (self::matches($haystack, ['appliance', 'home appliance'])) {
            $categories['otherSpecify'] = 'Appliance Loan';

            return $categories;
        }

        if ($loanTypeLabel !== null && trim($loanTypeLabel) !== '') {
            $categories['otherSpecify'] = trim($loanTypeLabel);
        }

        return $categories;
    }

    /**
     * @param  array<string, mixed>  $categories
     */
    public static function hasSelection(array $categories): bool
    {
        return ! empty($categories['businessLoan'])
            || ! empty($categories['chattelMortgage'])
            || ! empty($categories['realEstateMortgage'])
            || ! empty($categories['salaryLoan'])
            || trim((string) ($categories['otherSpecify'] ?? '')) !== '';
    }

    /**
     * @param  list<string>  $needles
     */
    private static function matches(string $haystack, array $needles): bool
    {
        foreach ($needles as $needle) {
            if ($needle !== '' && str_contains($haystack, $needle)) {
                return true;
            }
        }

        return false;
    }
}
