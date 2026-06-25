<?php

namespace App\Services;

use App\Models\LoanApplication;
use App\Support\LoanApplicationCategoryResolver;
use Carbon\Carbon;

/**
 * Maps borrower wizard form_data and type-specific detail records into the
 * extended_application_form structure used by the print/PDF application form.
 */
class LoanApplicationPrintFormHydrator
{
    /**
     * @param  array<string, mixed>  $form
     * @return array<string, mixed>
     */
    public function hydrate(array $form, LoanApplication $loanApplication): array
    {
        $loanApplication->loadMissing([
            'borrower',
            'loan',
            'loanProduct',
            'salaryLoanDetail',
            'chattelMortgageDetail',
            'realEstateDetail',
            'pensionLoanDetail',
            'travelAssistanceDetail',
            'dependents',
        ]);

        $existing = is_array($form['extended_application_form'] ?? null)
            ? $form['extended_application_form']
            : [];

        $detail = $this->specificDetails($loanApplication);
        $loan = is_array($form['loan'] ?? null) ? $form['loan'] : [];
        $personal = is_array($form['personal'] ?? null) ? $form['personal'] : [];
        $employment = is_array($form['employment'] ?? null) ? $form['employment'] : [];
        $spouse = is_array($form['spouse'] ?? null) ? $form['spouse'] : [];
        $dependents = is_array($form['dependents'] ?? null) ? $form['dependents'] : [];

        $fullName = $this->firstNonEmpty(
            $detail['full_name'] ?? null,
            trim(implode(' ', array_filter([
                $form['first_name'] ?? null,
                $form['middle_name'] ?? null,
                $form['last_name'] ?? null,
                $form['suffix'] ?? null,
            ]))),
            trim(implode(' ', array_filter([
                $personal['first_name'] ?? null,
                $personal['middle_name'] ?? null,
                $personal['last_name'] ?? null,
            ]))),
            $form['full_name'] ?? null,
            $loanApplication->borrower?->name,
        );

        $birthdate = $this->firstNonEmpty(
            $detail['birthdate'] ?? null,
            $form['birthdate'] ?? null,
        );

        $loanTypeLabel = config('amalgated_loans.general_loan_types')[$loanApplication->loan_type]
            ?? $loanApplication->loan_type;
        $productSlug = $form['loan_product_slug']
            ?? $loanApplication->loan?->application_payload['loan_product_slug']
            ?? $loanApplication->loanProduct?->slug;

        $monthlyGross = $this->firstNonEmpty(
            $detail['monthly_gross_salary'] ?? null,
            $form['monthly_gross_salary'] ?? null,
        );
        $monthlyNet = $this->firstNonEmpty(
            $detail['monthly_net_salary'] ?? null,
            $form['monthly_net_salary'] ?? null,
            $loanApplication->monthly_salary,
        );
        $otherIncome = $this->firstNonEmpty(
            $detail['other_income'] ?? null,
            $form['other_income'] ?? null,
        );
        $monthlyPension = $this->firstNonEmpty(
            $detail['monthly_pension'] ?? null,
            $form['monthly_pension'] ?? null,
            $loanApplication->monthly_pension,
        );

        $hydrated = [
            'branch_name' => $this->firstNonEmpty($form['branch_name'] ?? null, $existing['branch_name'] ?? null) ?? '',
            'application_nature' => $this->firstNonEmpty(
                $form['application_nature'] ?? null,
                $existing['application_nature'] ?? null,
                'new',
            ),
            'loan_categories' => LoanApplicationCategoryResolver::resolve(
                $loanApplication->loan_type,
                is_string($productSlug) ? $productSlug : null,
                is_string($loanTypeLabel) ? $loanTypeLabel : null,
                is_array($existing['loan_categories'] ?? null) ? $existing['loan_categories'] : null,
            ),
            'loan_principal_php' => $this->firstNonEmpty(
                $loan['amount_of_loan'] ?? null,
                $form['loan_amount'] ?? null,
                $loanApplication->loan_amount,
                $loanApplication->loan?->principal,
            ),
            'loan_term_months' => $this->firstNonEmpty(
                $loan['desired_term'] ?? null,
                $form['term_months'] ?? null,
                $form['loan_term_months'] ?? null,
                $loanApplication->term_months,
                $loanApplication->loan?->term_months,
            ),
            'applicant' => [
                'name' => $fullName,
                'email' => $this->firstNonEmpty(
                    $personal['email'] ?? null,
                    $form['email'] ?? null,
                    $loanApplication->borrower?->email,
                ),
                'mobile_phone' => $this->firstNonEmpty(
                    $detail['phone'] ?? null,
                    $personal['mobile_no'] ?? null,
                    $form['phone'] ?? null,
                    $loanApplication->borrower?->phone,
                ),
                'age' => $this->firstNonEmpty(
                    $form['age'] ?? null,
                    $loanApplication->age,
                    $this->ageFromBirthdate($birthdate),
                ),
                'civil_status' => $this->firstNonEmpty(
                    $detail['civil_status'] ?? null,
                    $personal['civil_status'] ?? null,
                    $form['civil_status'] ?? null,
                ),
                'tin' => $this->firstNonEmpty(
                    $employment['tin'] ?? null,
                    $form['tin_number'] ?? null,
                    $loanApplication->tin_number,
                ),
                'city' => $this->firstNonEmpty(
                    $personal['city'] ?? null,
                    $form['city'] ?? null,
                ),
                'province' => $this->firstNonEmpty(
                    $personal['province'] ?? null,
                    $form['province'] ?? null,
                ),
                'residence_address' => $this->firstNonEmpty(
                    $detail['address'] ?? null,
                    $personal['home_address'] ?? null,
                    $form['address'] ?? null,
                ),
                'residence_tel' => $this->firstNonEmpty(
                    $personal['telephone_no'] ?? null,
                    $form['telephone_no'] ?? null,
                ),
                'business_address' => $this->firstNonEmpty(
                    $detail['company_address'] ?? null,
                    $employment['employer_address'] ?? null,
                    $form['company_address'] ?? null,
                    $detail['property_address'] ?? null,
                    $form['property_address'] ?? null,
                ),
                'business_tel' => $this->firstNonEmpty(
                    $employment['employer_tel'] ?? null,
                    $form['employer_tel'] ?? null,
                ),
                'sss_gsis' => $this->firstNonEmpty(
                    $employment['sss_gsis'] ?? null,
                    $detail['sss_number'] ?? null,
                    $detail['gsis_bp_number'] ?? null,
                    $form['sss_number'] ?? null,
                    $form['gsis_bp_number'] ?? null,
                ),
                'philhealth' => $this->firstNonEmpty(
                    $form['philhealth'] ?? null,
                ),
                'ctc_number' => $this->firstNonEmpty(
                    $form['ctc_number'] ?? null,
                ),
                'ctc_date' => $this->firstNonEmpty(
                    $form['ctc_date'] ?? null,
                ),
                'ctc_place' => $this->firstNonEmpty(
                    $form['ctc_place'] ?? null,
                ),
            ],
            'spouse' => [
                'name' => $this->firstNonEmpty($spouse['spouse_name'] ?? null, $form['spouse_name'] ?? null),
                'sss' => $this->firstNonEmpty($spouse['spouse_sss'] ?? null, $form['spouse_sss'] ?? null),
                'business_address' => $this->firstNonEmpty(
                    $spouse['spouse_employer_address'] ?? null,
                    $form['spouse_employer_address'] ?? null,
                ),
                'business_tel' => $this->firstNonEmpty($spouse['spouse_tel'] ?? null, $form['spouse_tel'] ?? null),
                'position' => $this->firstNonEmpty($spouse['spouse_position'] ?? null, $form['spouse_position'] ?? null),
            ],
            'employed' => [
                'employer_name' => $this->firstNonEmpty(
                    $detail['employer_name'] ?? null,
                    $employment['employer_name'] ?? null,
                    $form['employer_name'] ?? null,
                    $loanApplication->employer_name,
                ),
                'address' => $this->firstNonEmpty(
                    $detail['company_address'] ?? null,
                    $employment['employer_address'] ?? null,
                    $form['company_address'] ?? null,
                ),
                'position' => $this->firstNonEmpty(
                    $detail['position'] ?? null,
                    $employment['position'] ?? null,
                    $form['position'] ?? null,
                ),
                'length_of_service' => $this->firstNonEmpty(
                    $detail['years_of_service'] ?? null,
                    $employment['start_date'] ?? null,
                    $form['years_of_service'] ?? null,
                ),
            ],
            'self_employed' => is_array($existing['self_employed'] ?? null) ? $existing['self_employed'] : [],
            'product_extra' => [
                'destination_country' => $this->firstNonEmpty(
                    $loan['country_destination'] ?? null,
                    $detail['destination_country'] ?? null,
                    $form['destination_country'] ?? null,
                    $loanApplication->destination_country,
                ),
                'travel_date' => $this->firstNonEmpty(
                    $loan['travel_date'] ?? null,
                    $detail['departure_date'] ?? null,
                    $form['travel_date'] ?? null,
                    $loanApplication->travel_date,
                ),
                'travel_purpose' => $this->firstNonEmpty(
                    $loan['purpose_of_loan'] ?? null,
                    $detail['travel_purpose'] ?? null,
                    $detail['loan_purpose'] ?? null,
                    $form['loan_purpose'] ?? null,
                    $form['purpose'] ?? null,
                    $loanApplication->purpose,
                ),
                'loan_purpose' => $this->firstNonEmpty(
                    $detail['loan_purpose'] ?? null,
                    $form['loan_purpose'] ?? null,
                    $form['purpose'] ?? null,
                    $loanApplication->purpose,
                ),
                'repayment_frequency' => $this->firstNonEmpty(
                    $form['repayment_frequency'] ?? null,
                ),
                'travel_cost' => $this->firstNonEmpty(
                    $form['travel_cost'] ?? null,
                ),
                'bank_account_number' => $this->firstNonEmpty(
                    $detail['bank_account_number'] ?? null,
                    $form['bank_account_number'] ?? null,
                ),
                'emergency_contact_name' => $this->firstNonEmpty($form['emergency_contact_name'] ?? null),
                'emergency_contact_phone' => $this->firstNonEmpty($form['emergency_contact_phone'] ?? null),
                'emergency_contact_relationship' => $this->firstNonEmpty($form['emergency_contact_relationship'] ?? null),
                'emergency_contact_address' => $this->firstNonEmpty($form['emergency_contact_address'] ?? null),
                'gender' => $this->firstNonEmpty($form['gender'] ?? null),
                'referred_by' => $this->firstNonEmpty($loan['referred_by'] ?? null, $form['referred_by'] ?? null),
                'employment_type' => $this->firstNonEmpty(
                    $detail['employment_type'] ?? null,
                    $employment['employment_type'] ?? null,
                    $form['employment_type'] ?? null,
                ),
                'spouse_employment_type' => $this->firstNonEmpty(
                    $spouse['spouse_employment_type'] ?? null,
                    $form['spouse_employment_type'] ?? null,
                ),
                'monthly_salary' => $monthlyNet,
                'monthly_gross_salary' => $monthlyGross,
                'monthly_income' => $this->firstNonEmpty(
                    $detail['monthly_income'] ?? null,
                    $form['monthly_income'] ?? null,
                ),
                'other_income_sources' => $this->firstNonEmpty(
                    $detail['other_income_sources'] ?? null,
                    $form['other_income_sources'] ?? null,
                ),
                'employment_status' => $this->firstNonEmpty(
                    $detail['employment_status'] ?? null,
                    $form['employment_status'] ?? null,
                ),
                'monthly_pension' => $monthlyPension,
                'pension_type' => $this->firstNonEmpty(
                    $detail['pension_type'] ?? null,
                    $form['pension_type'] ?? null,
                    $loanApplication->pension_type,
                ),
            ],
            'dependents' => $this->firstNonEmpty(
                count($dependents) > 0 ? count($dependents) : null,
                $loanApplication->dependents->count() ?: null,
            ),
            'monthly_income_rows' => $this->buildIncomeRows($monthlyGross, $monthlyNet, $otherIncome, $monthlyPension),
            'expense_rows' => is_array($existing['expense_rows'] ?? null) ? $existing['expense_rows'] : [],
            'collateral_other' => $this->buildCollateralRows($loanApplication, $detail, $existing),
            'bank_references' => is_array($existing['bank_references'] ?? null) ? $existing['bank_references'] : [],
            'outstanding_obligations' => is_array($existing['outstanding_obligations'] ?? null)
                ? $existing['outstanding_obligations']
                : [],
            'certification_date' => $this->firstNonEmpty(
                $existing['certification_date'] ?? null,
                $loanApplication->submitted_at?->format('Y-m-d'),
            ),
        ];

        return $this->mergeExtendedForm($existing, $hydrated);
    }

    /**
     * @return array<string, mixed>
     */
    private function specificDetails(LoanApplication $loanApplication): array
    {
        $model = match ($loanApplication->loan_type) {
            LoanApplication::TYPE_SALARY => $loanApplication->salaryLoanDetail,
            LoanApplication::TYPE_CHATTEL => $loanApplication->chattelMortgageDetail,
            LoanApplication::TYPE_REAL_ESTATE => $loanApplication->realEstateDetail,
            LoanApplication::TYPE_SSS_PENSION => $loanApplication->pensionLoanDetail,
            LoanApplication::TYPE_TRAVEL_ASSISTANCE => $loanApplication->travelAssistanceDetail,
            default => null,
        };

        if (! $model) {
            return [];
        }

        return collect($model->toArray())
            ->except(['id', 'loan_application_id', 'application_id', 'created_at', 'updated_at'])
            ->all();
    }

    /**
     * @param  array<string, mixed>  $existing
     * @param  array<string, mixed>  $hydrated
     * @return array<string, mixed>
     */
    private function mergeExtendedForm(array $existing, array $hydrated): array
    {
        $merged = $hydrated;

        foreach ($existing as $key => $value) {
            if (! is_array($value)) {
                $merged[$key] = $this->firstNonEmpty($value, $merged[$key] ?? null) ?? $merged[$key] ?? $value;

                continue;
            }

            if (! is_array($merged[$key] ?? null)) {
                $merged[$key] = $value;

                continue;
            }

            foreach ($value as $subKey => $subValue) {
                $merged[$key][$subKey] = $this->firstNonEmpty(
                    $subValue,
                    $merged[$key][$subKey] ?? null,
                ) ?? $merged[$key][$subKey] ?? $subValue;
            }
        }

        if ($this->hasIncomeRows($existing['monthly_income_rows'] ?? null)) {
            $merged['monthly_income_rows'] = $existing['monthly_income_rows'];
        }

        if ($this->hasIncomeRows($existing['expense_rows'] ?? null)) {
            $merged['expense_rows'] = $existing['expense_rows'];
        }

        if ($this->hasTableRows($existing['collateral_other'] ?? null)) {
            $merged['collateral_other'] = $existing['collateral_other'];
        }

        if ($this->hasTableRows($existing['bank_references'] ?? null)) {
            $merged['bank_references'] = $existing['bank_references'];
        }

        if ($this->hasTableRows($existing['outstanding_obligations'] ?? null)) {
            $merged['outstanding_obligations'] = $existing['outstanding_obligations'];
        }

        return $merged;
    }

    /**
     * @return list<array{description: string, amount: mixed}>
     */
    private function buildIncomeRows(mixed $gross, mixed $net, mixed $other, mixed $pension): array
    {
        $rows = [];

        if ($gross !== null && $gross !== '') {
            $rows[] = ['description' => 'Monthly Gross Salary', 'amount' => $gross];
        }
        if ($net !== null && $net !== '') {
            $rows[] = ['description' => 'Monthly Net Salary', 'amount' => $net];
        }
        if ($other !== null && $other !== '' && (float) $other != 0.0) {
            $rows[] = ['description' => 'Other Income', 'amount' => $other];
        }
        if ($pension !== null && $pension !== '') {
            $rows[] = ['description' => 'Monthly Pension', 'amount' => $pension];
        }

        return $rows;
    }

    /**
     * @param  array<string, mixed>  $detail
     * @param  array<string, mixed>  $existing
     * @return list<array<string, mixed>>
     */
    private function buildCollateralRows(LoanApplication $loanApplication, array $detail, array $existing): array
    {
        if ($this->hasTableRows($existing['collateral_other'] ?? null)) {
            return $existing['collateral_other'];
        }

        return match ($loanApplication->loan_type) {
            LoanApplication::TYPE_CHATTEL => [[
                'bank' => null,
                'description' => trim(implode(' ', array_filter([
                    $detail['vehicle_type'] ?? null,
                    $detail['brand'] ?? null,
                    $detail['model'] ?? null,
                    isset($detail['year_model']) ? '('.$detail['year_model'].')' : null,
                    $detail['plate_number'] ? 'Plate '.$detail['plate_number'] : null,
                ]))),
                'dateAvailed' => null,
                'amount' => $detail['market_value'] ?? null,
            ]],
            LoanApplication::TYPE_REAL_ESTATE => [[
                'bank' => null,
                'description' => trim(implode(' · ', array_filter([
                    $detail['property_type'] ?? null,
                    $detail['property_address'] ?? null,
                    isset($detail['title_number']) ? 'Title '.$detail['title_number'] : null,
                ]))),
                'dateAvailed' => null,
                'amount' => $detail['market_value'] ?? ($detail['assessed_value'] ?? null),
            ]],
            default => [],
        };
    }

    private function hasIncomeRows(mixed $rows): bool
    {
        if (! is_array($rows) || $rows === []) {
            return false;
        }

        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            if (($row['description'] ?? '') !== '' || ($row['amount'] ?? '') !== '') {
                return true;
            }
        }

        return false;
    }

    private function hasTableRows(mixed $rows): bool
    {
        if (! is_array($rows) || $rows === []) {
            return false;
        }

        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            foreach ($row as $value) {
                if ($value !== null && $value !== '') {
                    return true;
                }
            }
        }

        return false;
    }

    private function ageFromBirthdate(mixed $birthdate): ?int
    {
        if ($birthdate === null || $birthdate === '') {
            return null;
        }

        try {
            $date = $birthdate instanceof Carbon ? $birthdate : Carbon::parse((string) $birthdate);

            return $date->age;
        } catch (\Throwable) {
            return null;
        }
    }

    private function firstNonEmpty(mixed ...$values): mixed
    {
        foreach ($values as $value) {
            if ($value === null || $value === '') {
                continue;
            }

            return $value;
        }

        return null;
    }
}
