<?php

namespace App\Support;

/**
 * Checklist helpers for print views and borrower API (uploaded vs missing).
 */
class LoanApplicationDocumentStatus
{
    /**
     * @param  array<string, mixed>|null  $documents  JSON from loan_applications.documents
     * @return array<string, array{label: string, ok: bool, paths: array<int, string>}>
     */
    public static function forGeneralLoanType(?string $loanType, ?array $documents): array
    {
        $loanType = $loanType ?: '';
        $documents = $documents ?? [];
        $defs = config('amalgated_loans.general_documents.'.$loanType, []);
        if ($loanType === 'travel_assistance') {
            $defs = self::travelDefinitionsForPurpose(null);
        }
        $out = [];
        foreach ($defs as $key => $meta) {
            $paths = $documents[$key] ?? null;
            $list = [];
            if (is_array($paths)) {
                $list = array_values(array_filter($paths, fn ($p) => is_string($p) && $p !== ''));
            } elseif (is_string($paths) && $paths !== '') {
                $list = [$paths];
            }
            $required = (bool) ($meta['required'] ?? false);
            $ok = ! $required || count($list) > 0;
            $out[$key] = [
                'label' => (string) ($meta['label'] ?? $key),
                'ok' => $ok,
                'paths' => $list,
            ];
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>|null  $documents
     * @return array<string, array{label: string, ok: bool, paths: array<int, string>}>
     */
    public static function forTravel(?array $documents): array
    {
        $documents = $documents ?? [];
        $defs = config('amalgated_loans.travel_documents', []);
        $out = [];
        foreach ($defs as $key => $meta) {
            $paths = $documents[$key] ?? null;
            $list = [];
            if (is_array($paths)) {
                $list = array_values(array_filter($paths, fn ($p) => is_string($p) && $p !== ''));
            } elseif (is_string($paths) && $paths !== '') {
                $list = [$paths];
            }
            $required = (bool) ($meta['required'] ?? false);
            $ok = ! $required || count($list) > 0;
            $out[$key] = [
                'label' => (string) ($meta['label'] ?? $key),
                'ok' => $ok,
                'paths' => $list,
            ];
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>|null  $documents
     * @return array<string, array{label: string, ok: bool, paths: array<int, string>}>
     */
    public static function forTravelPurpose(?string $purpose, ?array $documents): array
    {
        $documents = $documents ?? [];
        $defs = self::travelDefinitionsForPurpose($purpose);
        $out = [];
        foreach ($defs as $key => $meta) {
            $paths = $documents[$key] ?? null;
            $list = [];
            if (is_array($paths)) {
                $list = array_values(array_filter($paths, fn ($p) => is_string($p) && $p !== ''));
            } elseif (is_string($paths) && $paths !== '') {
                $list = [$paths];
            }
            $required = (bool) ($meta['required'] ?? false);
            $ok = ! $required || count($list) > 0;
            $out[$key] = [
                'label' => (string) ($meta['label'] ?? $key),
                'ok' => $ok,
                'paths' => $list,
            ];
        }

        return $out;
    }

    /**
     * @return array<string, array{label: string, required: bool, multiple: bool}>
     */
    private static function travelDefinitionsForPurpose(?string $purpose): array
    {
        $all = config('amalgated_loans.general_documents.travel_assistance', []);
        $keysByPurpose = config('amalgated_loans.travel_assistance_documents_by_purpose', []);
        $requiredKeys = $keysByPurpose[$purpose ?: 'Other'] ?? $keysByPurpose['Other'] ?? array_keys($all);
        $defs = [];
        foreach ($requiredKeys as $key) {
            if (isset($all[$key])) {
                $defs[$key] = array_merge($all[$key], ['required' => true]);
            }
        }

        return $defs;
    }
}
