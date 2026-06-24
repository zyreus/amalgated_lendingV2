<?php

namespace App\Support;

use App\Models\LoanApplication;
use App\Services\LoanProductDocumentRequirementsService;

/**
 * Checklist helpers for print views and borrower API (uploaded vs missing).
 */
class LoanApplicationDocumentStatus
{
    /**
     * Product-aware checklist (pension loans honor loan_products.rules.document_requirements).
     *
     * @return array<string, array{label: string, ok: bool, paths: array<int, string>, required: bool, description?: ?string}>
     */
    public static function forApplication(LoanApplication $app): array
    {
        $defs = app(LoanProductDocumentRequirementsService::class)->definitionsForApplication($app);

        return self::buildStatus($defs, $app->documents ?? []);
    }

    /**
     * @param  array<string, mixed>|null  $documents  JSON from loan_applications.documents
     * @return array<string, array{label: string, ok: bool, paths: array<int, string>}>
     */
    public static function forGeneralLoanType(?string $loanType, ?array $documents): array
    {
        $loanType = $loanType ?: '';
        $documents = $documents ?? [];
        $defs = app(LoanProductDocumentRequirementsService::class)->definitions($loanType, null);

        return self::buildStatus($defs, $documents);
    }

    /**
     * @param  array<string, array<string, mixed>>  $defs
     * @param  array<string, mixed>|null  $documents
     * @return array<string, array{label: string, ok: bool, paths: array<int, string>, required: bool, description?: ?string}>
     */
    private static function buildStatus(array $defs, ?array $documents): array
    {
        $documents = $documents ?? [];
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
            $row = [
                'label' => (string) ($meta['label'] ?? $key),
                'ok' => $ok,
                'paths' => $list,
                'required' => $required,
            ];
            if (! empty($meta['description'])) {
                $row['description'] = (string) $meta['description'];
            }
            $out[$key] = $row;
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
