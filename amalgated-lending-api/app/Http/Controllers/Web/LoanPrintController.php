<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\TravelApplication;
use App\Services\LoanApplicationPrintFormHydrator;
use App\Services\LoanStatementOfAccountService;
use App\Support\LoanApplicationCategoryResolver;
use App\Support\LoanApplicationDocumentStatus;
use Illuminate\Http\Request;
use Illuminate\View\View;

class LoanPrintController extends Controller
{
    public function __construct(
        private LoanStatementOfAccountService $soa,
        private LoanApplicationPrintFormHydrator $printFormHydrator,
    ) {}

    public function generalLoan(Request $request, LoanApplication $loanApplication): View
    {
        $this->authorizePrint($request, $loanApplication->user_id);

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

        $documents = $loanApplication->documents ?? [];
        $docStatus = LoanApplicationDocumentStatus::forGeneralLoanType($loanApplication->loan_type, $documents);

        // Merge loan.application_payload with form_data so print matches admin/submitted data without gaps;
        // form_data wins on key conflicts.
        $payload = $loanApplication->loan?->application_payload;
        $payload = is_array($payload) ? $payload : [];
        $formData = $loanApplication->form_data ?? [];
        $form = array_merge($payload, is_array($formData) ? $formData : []);
        $form = $this->hydrateExtendedApplicationFormForPrint($form, $loanApplication);
        $form = $this->resolveLoanCategoriesOnForm($form, $loanApplication);

        $loanTypeLabel = config('amalgated_loans.general_loan_types')[$loanApplication->loan_type] ?? $loanApplication->loan_type;

        return view('print.general_loan_application', [
            'app' => $loanApplication,
            'borrower' => $loanApplication->borrower,
            'form' => $form,
            'documents' => $documents,
            'docStatus' => $docStatus,
            'loanTypeLabel' => $loanTypeLabel,
        ]);
    }

    private function resolveLoanCategoriesOnForm(array $form, LoanApplication $loanApplication): array
    {
        $loanTypeLabel = config('amalgated_loans.general_loan_types')[$loanApplication->loan_type] ?? $loanApplication->loan_type;
        $extended = is_array($form['extended_application_form'] ?? null) ? $form['extended_application_form'] : [];
        $existing = is_array($extended['loan_categories'] ?? null) ? $extended['loan_categories'] : [];

        $payload = $loanApplication->loan?->application_payload;
        $payload = is_array($payload) ? $payload : [];
        $slug = $form['loan_product_slug'] ?? $payload['loan_product_slug'] ?? null;

        $extended['loan_categories'] = LoanApplicationCategoryResolver::resolve(
            $loanApplication->loan_type,
            is_string($slug) ? $slug : null,
            is_string($loanTypeLabel) ? $loanTypeLabel : null,
            $existing,
        );
        $form['extended_application_form'] = $extended;

        return $form;
    }

    /**
     * Ensures print view has a complete `extended_application_form` structure
     * from borrower wizard form_data and type-specific detail records.
     */
    private function hydrateExtendedApplicationFormForPrint(array $form, LoanApplication $loanApplication): array
    {
        $form['extended_application_form'] = $this->printFormHydrator->hydrate($form, $loanApplication);

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
