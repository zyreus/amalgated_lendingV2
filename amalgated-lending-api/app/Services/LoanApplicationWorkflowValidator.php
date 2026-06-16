<?php

namespace App\Services;

use App\Models\LoanApplication;
use App\Models\LoanProduct;
use App\Support\LoanApplicationDocumentStatus;
use Illuminate\Validation\ValidationException;

class LoanApplicationWorkflowValidator
{
    public function __construct(
        private LoanCalculator $loanCalculator,
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

            return array_merge($errors, $this->validateLoanProductBasics($data));
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

        return array_merge($errors, $this->validateLoanProductBasics($data));
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
        if (! $section || in_array($section, ['documents', 'review'], true)) {
            return [];
        }

        $rows = config('amalgated_loans.product_application_fields.'.$loanType.'.'.$section, []);
        $errors = $this->validateFieldRows($rows, $data);

        return $section === 'loan' ? array_merge($errors, $this->validateLoanProductBasics($data)) : $errors;
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

        $loanAmount = isset($data['loan_amount']) ? (float) $data['loan_amount'] : 0.0;
        if ($loanAmount <= 0) {
            $errors[] = 'Loan amount must be greater than zero.';
        }

        $termMonths = isset($data['term_months']) ? (int) $data['term_months'] : 0;
        if ($termMonths <= 0) {
            $errors[] = 'Term in months is required.';
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

        $status = $loanType === LoanApplication::TYPE_TRAVEL_ASSISTANCE
            ? LoanApplicationDocumentStatus::forTravelPurpose((string) (($app->form_data ?? [])['travel_purpose'] ?? ''), $app->documents ?? [])
            : LoanApplicationDocumentStatus::forGeneralLoanType($loanType, $app->documents ?? []);
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
            $this->validateDocumentsComplete($app)
        );
    }

    /**
     * Enforce product max term / max amount / pension caps using the official calculator.
     *
     * @return array<int, string>
     */
    private function validateProductLoanRules(LoanApplication $app): array
    {
        if (! $app->loan_product_id || ! $app->loan_amount || (float) $app->loan_amount <= 0) {
            return [];
        }

        $form = is_array($app->form_data) ? $app->form_data : [];
        $nature = (string) ($form['application_nature'] ?? 'new');

        try {
            $this->loanCalculator->compute([
                'product_id' => (int) $app->loan_product_id,
                'loan_amount' => (float) $app->loan_amount,
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
