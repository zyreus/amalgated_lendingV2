<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\TravelApplication;
use App\Services\LoanStatementOfAccountService;
use App\Support\LoanApplicationDocumentStatus;
use Illuminate\Http\Request;
use Illuminate\View\View;

class LoanPrintController extends Controller
{
    public function __construct(
        private LoanStatementOfAccountService $soa,
    ) {}

    public function generalLoan(Request $request, LoanApplication $loanApplication): View
    {
        $this->authorizePrint($request, $loanApplication->user_id);

        $loanApplication->loadMissing(['borrower', 'loan']);

        $documents = $loanApplication->documents ?? [];
        $docStatus = LoanApplicationDocumentStatus::forGeneralLoanType($loanApplication->loan_type, $documents);

        // Merge loan.application_payload with form_data so print matches admin/submitted data without gaps;
        // form_data wins on key conflicts.
        $payload = $loanApplication->loan?->application_payload;
        $payload = is_array($payload) ? $payload : [];
        $formData = $loanApplication->form_data ?? [];
        $form = array_merge($payload, is_array($formData) ? $formData : []);
        $form = $this->hydrateExtendedApplicationFormForPrint($form, $loanApplication);

        return view('print.general_loan_application', [
            'app' => $loanApplication,
            'borrower' => $loanApplication->borrower,
            'form' => $form,
            'documents' => $documents,
            'docStatus' => $docStatus,
            'loanTypeLabel' => config('amalgated_loans.general_loan_types')[$loanApplication->loan_type] ?? $loanApplication->loan_type,
        ]);
    }

    /**
     * Ensures print view has a complete `extended_application_form` structure
     * even when source data came from travel wizard payload.
     */
    private function hydrateExtendedApplicationFormForPrint(array $form, LoanApplication $loanApplication): array
    {
        $existing = $form['extended_application_form'] ?? null;
        if (is_array($existing) && count($existing) > 0) {
            return $form;
        }

        $loan = is_array($form['loan'] ?? null) ? $form['loan'] : [];
        $personal = is_array($form['personal'] ?? null) ? $form['personal'] : [];
        $employment = is_array($form['employment'] ?? null) ? $form['employment'] : [];
        $spouse = is_array($form['spouse'] ?? null) ? $form['spouse'] : [];
        $dependents = is_array($form['dependents'] ?? null) ? $form['dependents'] : [];

        // Support both travel wizard keys and older public travel endpoint keys.
        $fullName = trim(implode(' ', array_filter([
            $personal['first_name'] ?? null,
            $personal['middle_name'] ?? null,
            $personal['last_name'] ?? null,
        ])));
        if ($fullName === '') {
            $fullName = (string) ($form['full_name'] ?? ($loanApplication->borrower?->name ?? ''));
        }

        $extended = [
            'branch_name' => $form['branch_name'] ?? '',
            'application_nature' => $form['application_nature'] ?? 'new',
            'loan_categories' => [
                'businessLoan' => false,
                'chattelMortgage' => false,
                'realEstateMortgage' => false,
                'salaryLoan' => false,
                'otherSpecify' => $form['loan_product_slug'] ?? 'Travel Assistance',
            ],
            'loan_principal_php' => $loan['amount_of_loan'] ?? ($form['loan_amount'] ?? ($loanApplication->loan?->principal ?? null)),
            'loan_term_months' => $loan['desired_term'] ?? ($form['loan_term_months'] ?? ($loanApplication->loan?->term_months ?? null)),
            'applicant' => [
                'name' => $fullName,
                'email' => $personal['email'] ?? ($form['email'] ?? ($loanApplication->borrower?->email ?? null)),
                'mobile_phone' => $personal['mobile_no'] ?? ($form['phone'] ?? ($loanApplication->borrower?->phone ?? null)),
                'age' => $form['age'] ?? null,
                'civil_status' => $personal['civil_status'] ?? null,
                'tin' => $employment['tin'] ?? ($form['tin_number'] ?? null),
                'city' => $personal['city'] ?? ($form['city'] ?? null),
                'province' => $personal['province'] ?? ($form['province'] ?? null),
                'residence_address' => $personal['home_address'] ?? ($form['address'] ?? null),
                'residence_tel' => $personal['telephone_no'] ?? null,
                'business_address' => $employment['employer_address'] ?? null,
                'business_tel' => $employment['employer_tel'] ?? null,
                'sss_gsis' => $employment['sss_gsis'] ?? null,
                'philhealth' => $form['philhealth'] ?? null,
                'ctc_number' => $form['ctc_number'] ?? null,
                'ctc_date' => $form['ctc_date'] ?? null,
                'ctc_place' => $form['ctc_place'] ?? null,
            ],
            'spouse' => [
                'name' => $spouse['spouse_name'] ?? null,
                'sss' => $spouse['spouse_sss'] ?? null,
                'business_address' => $spouse['spouse_employer_address'] ?? null,
                'business_tel' => $spouse['spouse_tel'] ?? null,
                'position' => $spouse['spouse_position'] ?? null,
            ],
            'employed' => [
                'employer_name' => $employment['employer_name'] ?? ($form['employer_name'] ?? null),
                'address' => $employment['employer_address'] ?? null,
                'position' => $employment['position'] ?? null,
                'length_of_service' => $employment['start_date'] ?? null,
            ],
            'self_employed' => [],
            'product_extra' => [
                'destination_country' => $loan['country_destination'] ?? ($form['destination_country'] ?? null),
                'travel_date' => $loan['travel_date'] ?? ($form['travel_date'] ?? null),
                'travel_purpose' => $loan['purpose_of_loan'] ?? ($form['purpose'] ?? null),
                'referred_by' => $loan['referred_by'] ?? null,
                'employment_type' => $employment['employment_type'] ?? null,
                'spouse_employment_type' => $spouse['spouse_employment_type'] ?? null,
            ],
            'dependents' => count($dependents) > 0 ? count($dependents) : null,
            'monthly_income_rows' => [],
            'expense_rows' => [],
            'collateral_other' => [],
            'bank_references' => [],
            'outstanding_obligations' => [],
        ];

        $form['extended_application_form'] = $extended;

        return $form;
    }

    public function travelLoan(Request $request, TravelApplication $travelApplication): View
    {
        $this->authorizePrint($request, $travelApplication->user_id);

        $travelApplication->loadMissing('borrower');

        $documents = $travelApplication->documents ?? [];
        $docStatus = LoanApplicationDocumentStatus::forTravel($documents);

        return view('print.travel_application', [
            'app' => $travelApplication,
            'borrower' => $travelApplication->borrower,
            't' => $travelApplication->travel_specific_fields ?? [],
            'documents' => $documents,
            'docStatus' => $docStatus,
        ]);
    }

    public function loanSoa(Request $request, Loan $loan): View
    {
        $this->authorizePrint($request, (int) $loan->borrower_id);

        $statement = $this->soa->build($loan);

        return view('print.loan_statement_of_account_v2', [
            'statement' => $statement,
        ]);
    }

    private function authorizePrint(Request $request, int $ownerUserId): void
    {
        if ($request->hasValidSignature(false)) {
            return;
        }

        $user = $request->user();
        if ($user && (int) $user->id === $ownerUserId) {
            return;
        }
        if ($user && method_exists($user, 'canAccessAdminPortal') && $user->canAccessAdminPortal()) {
            return;
        }
        abort(403);
    }
}
