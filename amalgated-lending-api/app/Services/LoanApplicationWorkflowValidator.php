<?php

namespace App\Services;

use App\Models\LoanApplication;
use App\Models\LoanProduct;
use App\Services\CoMakerRequirementService;
use App\Support\LoanApplicationDocumentStatus;
use Illuminate\Validation\ValidationException;

class LoanApplicationWorkflowValidator
{
    public function __construct(
        private LoanCalculator $loanCalculator,
        private PensionLoanCapacityService $pensionCapacity,
    ) {}

    /**
     * @return array<int, string> Error messages (empty if valid)
     */
    public function validateForm(LoanApplication $app): array
    {
        $errors = [];
        $loanType = $app->loan_type;
        if (! $loanType) {
            return ['Select a loan type.'];
        }

        $data = $app->form_data ?? [];

        $productFields = config('amalgated_loans.product_application_fields.'.$loanType, []);
        if ($productFields !== []) {
            foreach ($productFields as $rows) {
                $errors = array_merge($errors, $this->validateFieldRows($rows, $data));
            }

            return array_merge(
                $errors,
                $this->validateLoanProductBasics($data),
                $this->validatePensionMonthlyAmount($app, $data),
                $this->validatePensionLoanCapacity($app, $data),
            );
        }

        foreach (config('amalgated_loans.wizard_common', []) as $row) {
            if (! $this->fieldRequiredForLoanType($row, $loanType)) {
                continue;
            }
            $key = $row['key'];
            $val = $data[$key] ?? null;
            if ($val === null || $val === '') {
                $errors[] = ($row['label'] ?? $key).' is required.';
            }
        }

        foreach (config('amalgated_loans.general_form_fields.'.$loanType, []) as $row) {
            if (! ($row['required'] ?? false)) {
                continue;
            }
            $key = $row['key'];
            $val = $data[$key] ?? null;
            if ($val === null || $val === '') {
                $errors[] = ($row['label'] ?? $key).' is required.';
            }
        }

        return array_merge(
            $errors,
            $this->validateLoanProductBasics($data),
            $this->validatePensionMonthlyAmount($app, $data),
            $this->validatePensionLoanCapacity($app, $data),
        );
    }

    /**
     * @return array<int, string>
     */
    public function validateFormStep(LoanApplication $app, int $step): array
    {
        $loanType = $app->loan_type;
        if (! $loanType) {
            return ['Select a loan type.'];
        }

        $data = $app->form_data ?? [];
        $stepConfig = collect(config('amalgated_loans.product_application_steps.'.$loanType, []))->firstWhere('id', $step);
        $section = is_array($stepConfig) ? ($stepConfig['section'] ?? null) : null;
        if ($section === 'co_makers') {
            $app->loadMissing('loanProduct');
            if (! CoMakerRequirementService::requiresCoMakers($app)) {
                return [];
            }

            return $this->validateCoMakersStepMinimum($app);
        }
        if (! $section || in_array($section, ['documents', 'review'], true)) {
            return [];
        }

        $rows = config('amalgated_loans.product_application_fields.'.$loanType.'.'.$section, []);
        $errors = $this->validateFieldRows($rows, $data);

        if ($section === 'pension' && $loanType === LoanApplication::TYPE_SSS_PENSION) {
            return array_merge($errors, $this->validatePensionMonthlyAmount($app, $data));
        }

        return $section === 'loan'
            ? array_merge(
                $errors,
                $this->validateLoanProductBasics($data),
                $this->validatePensionLoanCapacity($app, $data),
            )
            : $errors;
    }

    /**
     * @return array<int, string>
     */
    private function validateLoanProductBasics(array $data): array
    {
        $errors = [];
        $selectedProductId = isset($data['loan_product_id']) ? (int) $data['loan_product_id'] : 0;
        if ($selectedProductId <= 0) {
            $errors[] = 'Loan product is required.';
        } else {
            $product = LoanProduct::query()->active()->find($selectedProductId);
            if (! $product) {
                $errors[] = 'Selected loan product is invalid or inactive.';
            }
        }

        $termMonths = isset($data['term_months']) ? (int) $data['term_months'] : 0;
        if ($termMonths <= 0) {
            $errors[] = 'Term in months is required.';
        }

        return $errors;
    }

    /**
     * Pension step requires a positive monthly pension amount.
     *
     * @param  array<string, mixed>  $data
     * @return array<int, string>
     */
    private function validatePensionMonthlyAmount(LoanApplication $app, array $data): array
    {
        if ($app->loan_type !== LoanApplication::TYPE_SSS_PENSION) {
            return [];
        }

        $monthlyPension = isset($data['monthly_pension']) ? (float) $data['monthly_pension'] : 0.0;
        if ($monthlyPension <= 0) {
            return ['Monthly pension is required.'];
        }

        return [];
    }

    /**
     * Pension loan step: system derives amount from pension capacity — block if ineligible.
     *
     * @param  array<string, mixed>  $data
     * @return array<int, string>
     */
    private function validatePensionLoanCapacity(LoanApplication $app, array $data): array
    {
        if ($app->loan_type !== LoanApplication::TYPE_SSS_PENSION) {
            return [];
        }

        $errors = [];
        $monthlyPension = isset($data['monthly_pension']) ? (float) $data['monthly_pension'] : 0.0;
        if ($monthlyPension <= 0) {
            $errors[] = 'Monthly pension is required. Complete the Pension Information step first.';
        }

        $termMonths = isset($data['term_months']) ? (int) $data['term_months'] : 0;
        if ($termMonths <= 0) {
            return $errors;
        }

        $productId = isset($data['loan_product_id']) ? (int) $data['loan_product_id'] : (int) ($app->loan_product_id ?? 0);
        if ($productId <= 0 || $monthlyPension <= 0) {
            return $errors;
        }

        $product = LoanProduct::query()->active()->find($productId);
        if (! $product) {
            return array_merge($errors, ['Selected loan product is invalid or inactive.']);
        }

        $estimate = $this->pensionCapacity->estimateFromPension($product, [
            'monthly_pension' => $monthlyPension,
            'term_months' => $termMonths,
            'application_nature' => (string) ($data['application_nature'] ?? 'new'),
            'pension_type' => $data['pension_type'] ?? null,
        ]);

        if (! ($estimate['eligible'] ?? false) || (float) ($estimate['estimated_loanable_amount'] ?? 0) <= 0) {
            $flat = is_array($estimate['validation_errors'] ?? null) ? $estimate['validation_errors'] : [];
            if ($flat !== []) {
                return array_merge($errors, $flat);
            }

            return array_merge($errors, [
                $estimate['message'] ?? 'Pension capacity is insufficient for the selected term. Reduce the term or verify your monthly pension.',
            ]);
        }

        return $errors;
    }

    /**
     * @return array<int, string>
     */
    private function validateFieldRows(array $rows, array $data): array
    {
        $errors = [];
        foreach ($rows as $row) {
            if ($row['borrower_readonly'] ?? false) {
                continue;
            }
            if (! $this->isProductFieldRequired($row, $data)) {
                continue;
            }
            $key = $row['key'];
            $val = $data[$key] ?? null;
            if ($val === null || $val === '') {
                $errors[] = ($row['label'] ?? $key).' is required.';
            }
        }

        return $errors;
    }

    private function isProductFieldRequired(array $row, array $data): bool
    {
        if ($row['required'] ?? false) {
            return true;
        }

        $requiredIf = $row['required_if'] ?? null;
        if (! is_array($requiredIf)) {
            return false;
        }

        foreach ($requiredIf as $key => $expected) {
            if (($data[$key] ?? null) !== $expected) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array{required_for_loan_types?: ?array, key: string}  $row
     */
    private function fieldRequiredForLoanType(array $row, string $loanType): bool
    {
        $cond = $row['required_for_loan_types'] ?? null;
        if ($cond === null) {
            return true;
        }
        if ($cond === []) {
            return false;
        }

        return in_array($loanType, $cond, true);
    }

    /**
     * @return array<int, string>
     */
    public function validateDocumentsComplete(LoanApplication $app): array
    {
        $loanType = $app->loan_type;
        if (! $loanType) {
            return ['Loan type is required before documents.'];
        }

        $status = LoanApplicationDocumentStatus::forApplication($app);
        $errors = [];
        foreach ($status as $key => $row) {
            if (! $row['ok']) {
                $errors[] = 'Missing document: '.$row['label'];
            }
        }

        return $errors;
    }

    /**
     * @return array<int, string>
     */
    public function validateSignatures(LoanApplication $app): array
    {
        $errors = [];
        if (! $app->applicant_signature) {
            $errors[] = 'Applicant signature is required.';
        }
        if ($app->loan_type === LoanApplication::TYPE_CHATTEL && ! $app->comaker_signature) {
            $errors[] = 'Co-maker signature is required for Chattel Mortgage.';
        }

        return $errors;
    }

    /**
     * Full validation before submit.
     *
     * @return array<int, string>
     */
    public function validateSubmit(LoanApplication $app): array
    {
        return array_merge(
            $this->validateForm($app),
            $this->validateProductLoanRules($app),
            $this->validateCoMakers($app),
            $this->validateDocumentsComplete($app)
        );
    }

    /**
     * Step navigation: at least one saved co-maker is enough to continue.
     *
     * @return array<int, string>
     */
    public function validateCoMakersStepMinimum(LoanApplication $app): array
    {
        $app->loadMissing('loanProduct');
        if (! CoMakerRequirementService::requiresCoMakers($app)) {
            return [];
        }

        $count = $app->relationLoaded('coMakers')
            ? $app->coMakers->count()
            : $app->coMakers()->count();

        if ($count < 1) {
            return ['Add at least one co-maker before continuing.'];
        }

        return [];
    }

    /**
     * @return array<int, string>
     */
    public function validateCoMakers(LoanApplication $app): array
    {
        $app->loadMissing('loanProduct');
        if (! CoMakerRequirementService::requiresCoMakers($app)) {
            return [];
        }

        $coMakers = $app->relationLoaded('coMakers')
            ? $app->coMakers
            : $app->coMakers()->with('documents')->get();

        if ($coMakers->isEmpty()) {
            return ['At least one co-maker is required for this loan product.'];
        }

        $errors = [];
        $categories = CoMakerRequirementService::documentCategories();
        $requiredCategories = array_keys(array_filter(
            $categories,
            fn ($meta) => (bool) ($meta['required'] ?? false)
        ));

        foreach ($coMakers as $index => $coMaker) {
            $label = $coMaker->displayName() ?: ('Co-maker #'.($index + 1));
            if (! trim((string) ($coMaker->first_name ?? $coMaker->full_name))) {
                $errors[] = "{$label}: first name is required.";
            }
            if (! trim((string) ($coMaker->last_name ?? '')) && ! trim((string) ($coMaker->full_name ?? ''))) {
                $errors[] = "{$label}: last name is required.";
            }
            if (! $coMaker->date_of_birth) {
                $errors[] = "{$label}: date of birth is required.";
            }
            if (! trim((string) ($coMaker->gender ?? ''))) {
                $errors[] = "{$label}: gender is required.";
            }
            if (! trim((string) ($coMaker->civil_status ?? ''))) {
                $errors[] = "{$label}: civil status is required.";
            }
            if (! trim((string) ($coMaker->contact_number ?? ''))) {
                $errors[] = "{$label}: mobile number is required.";
            }
            if (! trim((string) ($coMaker->house_street ?? $coMaker->complete_address ?? $coMaker->address ?? ''))) {
                $errors[] = "{$label}: house no. / street is required.";
            }
            if (! trim((string) ($coMaker->barangay ?? ''))) {
                $errors[] = "{$label}: barangay is required.";
            }
            if (! trim((string) ($coMaker->city_municipality ?? ''))) {
                $errors[] = "{$label}: municipality / city is required.";
            }
            if (! trim((string) ($coMaker->province ?? ''))) {
                $errors[] = "{$label}: province is required.";
            }
            if (! trim((string) ($coMaker->relationship_to_borrower ?? ''))) {
                $errors[] = "{$label}: relationship to borrower is required.";
            }
            if (! trim((string) ($coMaker->employment_status ?? ''))) {
                $errors[] = "{$label}: employment status is required.";
            }
            if (! trim((string) ($coMaker->valid_id_type ?? ''))) {
                $errors[] = "{$label}: valid ID type is required.";
            }
            if (! trim((string) ($coMaker->valid_id_number ?? ''))) {
                $errors[] = "{$label}: valid ID number is required.";
            }

            foreach ($requiredCategories as $cat) {
                $hasDoc = $coMaker->documents->contains(
                    fn ($doc) => ($doc->document_category ?? '') === $cat
                );
                if (! $hasDoc) {
                    $catLabel = $categories[$cat]['label'] ?? $cat;
                    $errors[] = "{$label}: missing required document — {$catLabel}.";
                }
            }
        }

        return $errors;
    }

    /**
     * Enforce product max term / max amount / pension caps using the official calculator.
     *
     * @return array<int, string>
     */
    private function validateProductLoanRules(LoanApplication $app): array
    {
        if ($app->loan_type === LoanApplication::TYPE_TRAVEL_ASSISTANCE) {
            return [];
        }

        $form = is_array($app->form_data) ? $app->form_data : [];
        $loanAmount = (float) ($app->loan_amount ?? 0);

        if ($app->loan_type === LoanApplication::TYPE_SSS_PENSION) {
            if (! $app->loan_product_id) {
                return [];
            }

            $monthlyPension = isset($form['monthly_pension']) ? (float) $form['monthly_pension'] : 0.0;
            $termMonths = max(1, (int) ($app->term_months ?? $form['term_months'] ?? 1));
            if ($monthlyPension <= 0) {
                return ['Monthly pension is required.'];
            }

            $product = LoanProduct::query()->active()->find($app->loan_product_id);
            if (! $product) {
                return ['Selected loan product is invalid or inactive.'];
            }

            $estimate = $this->pensionCapacity->estimateFromPension($product, [
                'monthly_pension' => $monthlyPension,
                'term_months' => $termMonths,
                'application_nature' => (string) ($form['application_nature'] ?? 'new'),
                'pension_type' => $form['pension_type'] ?? null,
            ]);

            if (! ($estimate['eligible'] ?? false) || (float) ($estimate['estimated_loanable_amount'] ?? 0) <= 0) {
                $flat = is_array($estimate['validation_errors'] ?? null) ? $estimate['validation_errors'] : [];

                return $flat !== [] ? $flat : ['Pension capacity is insufficient for the selected term.'];
            }

            $estimated = (float) ($estimate['estimated_loanable_amount'] ?? 0);
            $requested = $this->parseMoneyAmount($form['loan_amount'] ?? null);
            if ($requested > 0 && $requested > $estimated) {
                return ['Requested loan amount exceeds your estimated loanable amount.'];
            }

            if ($loanAmount <= 0) {
                $loanAmount = $requested > 0 ? $requested : $estimated;
            }
        } elseif ($loanAmount <= 0) {
            $loanAmount = $this->parseMoneyAmount($form['loan_amount'] ?? null);
        }

        if (! $app->loan_product_id || $loanAmount <= 0) {
            return [];
        }

        $nature = (string) ($form['application_nature'] ?? 'new');

        try {
            $this->loanCalculator->compute([
                'product_id' => (int) $app->loan_product_id,
                'loan_amount' => $loanAmount,
                'term_months' => max(1, (int) ($app->term_months ?? 1)),
                'application_nature' => $nature,
                'age' => isset($form['age']) && $form['age'] !== '' ? (int) $form['age'] : null,
                'monthly_pension' => isset($form['monthly_pension']) && $form['monthly_pension'] !== ''
                    ? (float) $form['monthly_pension']
                    : null,
            ]);
        } catch (ValidationException $e) {
            $flat = [];
            foreach ($e->errors() as $msgs) {
                foreach ($msgs as $m) {
                    $flat[] = (string) $m;
                }
            }

            return $flat;
        }

        return [];
    }

    private function parseMoneyAmount(mixed $value): float
    {
        if ($value === null || $value === '') {
            return 0.0;
        }

        return (float) str_replace(',', '', (string) $value);
    }

    /**
     * Step gating: cannot open signature step until documents complete + form valid.
     *
     * @return array<int, string>
     */
    public function validateBeforeSignatureStep(LoanApplication $app): array
    {
        return array_merge(
            $this->validateForm($app),
            $this->validateProductLoanRules($app),
            $this->validateDocumentsComplete($app)
        );
    }
}
