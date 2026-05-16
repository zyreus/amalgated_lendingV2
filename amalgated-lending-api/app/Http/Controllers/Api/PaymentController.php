<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentListResource;
use App\Jobs\SendPaymentReceiptJob;
use App\Mail\PaymentReceiptMail;
use App\Models\EmailLog;
use App\Models\Loan;
use App\Models\Payment;
use App\Models\PaymentAdjustmentAudit;
use App\Models\PaymentReceiptAudit;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\CreditWellnessService;
use App\Services\FinalPaymentAdjustmentService;
use App\Services\LoanPaymentBalanceService;
use App\Services\NotificationCenter;
use App\Services\PaymentReceiptComplianceService;
use App\Services\PaymentReceiptMutationService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PaymentController extends Controller
{
    public function __construct(
        private LoanPaymentBalanceService $loanPaymentBalances,
        private FinalPaymentAdjustmentService $finalPaymentAdjustments,
        private PaymentReceiptComplianceService $receiptCompliance,
        private PaymentReceiptMutationService $receiptMutation,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $q = $this->filteredPaymentsQuery($request);

        $rows = $q->orderByDesc('due_date')->paginate((int) $request->query('per_page', 20));

        $statusMap = $this->receiptEmailStatusMapForPaymentIds($rows->getCollection()->pluck('id'));
        $rows->getCollection()->each(function (Payment $p) use ($statusMap): void {
            $p->setAttribute('_receipt_email_status', $statusMap[(int) $p->getKey()] ?? null);
        });

        $rows->setCollection(PaymentListResource::collection($rows->getCollection())->collection);

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    public function forUser(Request $request, User $user): JsonResponse
    {
        $loanIds = Loan::query()->where('borrower_id', $user->id)->pluck('id');
        $payments = Payment::query()
            ->whereIn('loan_id', $loanIds)
            ->with([
                'loan' => fn ($rel) => $rel->select([
                    'id', 'borrower_id', 'term_months', 'outstanding_balance', 'status', 'principal',
                ]),
                'loan.borrower:id,name,email',
            ])
            ->orderByDesc('due_date')
            ->paginate((int) $request->query('per_page', 15));

        return response()->json(['ok' => true, 'data' => $payments]);
    }

    public function record(Request $request, Payment $payment, ActivityLogger $logger): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'amount_paid' => 'required|numeric|min:0',
            'paid_at' => 'nullable|date',
            'source' => 'nullable|string|in:manual,api',
            'external_ref' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'payment_method' => 'nullable|string|max:32',
            'official_receipt_number' => 'nullable|string|max:64',
            'acknowledgement_receipt_number' => 'nullable|string|max:64',
            'auto_mint_receipt_numbers' => 'nullable|boolean',
        ]);

        $ext = isset($data['external_ref']) ? trim((string) $data['external_ref']) : '';
        if ($ext !== '') {
            $dup = Payment::query()
                ->where('loan_id', $payment->loan_id)
                ->whereKeyNot($payment->id)
                ->where('external_ref', $ext)
                ->where('status', Payment::STATUS_PAID)
                ->exists();
            if ($dup) {
                return response()->json([
                    'ok' => false,
                    'message' => 'This external reference is already recorded as paid on another installment for this loan.',
                ], 422);
            }
        }

        $becamePaid = false;
        $freshPayment = null;

        try {
            DB::transaction(function () use ($payment, $data, $user, &$becamePaid, &$freshPayment): void {
                $p = Payment::query()->whereKey($payment->getKey())->lockForUpdate()->firstOrFail();

                if ($p->isPaid() && ! $this->canOverrideLocked($user)) {
                    throw ValidationException::withMessages([
                        'payment' => ['This installment is already confirmed paid. Only a user with payment override permission may change it.'],
                    ]);
                }

                $previousStatus = $p->status;
                $origOr = trim((string) ($p->official_receipt_number ?? ''));
                $origAr = trim((string) ($p->acknowledgement_receipt_number ?? ''));

                $p->amount_paid = $data['amount_paid'];
                $p->paid_at = isset($data['paid_at']) ? Carbon::parse($data['paid_at']) : now();
                $p->source = $data['source'] ?? 'manual';
                if (isset($data['external_ref'])) {
                    $p->external_ref = $data['external_ref'];
                }
                if (isset($data['notes'])) {
                    $p->notes = $data['notes'];
                }
                if (array_key_exists('payment_method', $data) && $data['payment_method'] !== null) {
                    $p->payment_method = $data['payment_method'];
                }

                $incomingOr = $this->receiptCompliance->normalize($data['official_receipt_number'] ?? null);
                $incomingAr = $this->receiptCompliance->normalize($data['acknowledgement_receipt_number'] ?? null);
                if ($incomingOr !== null) {
                    $this->receiptCompliance->assertUniqueOfficialReceipt($incomingOr, (int) $p->id);
                    $p->official_receipt_number = $incomingOr;
                }
                if ($incomingAr !== null) {
                    $this->receiptCompliance->assertUniqueAcknowledgementReceipt($incomingAr, (int) $p->id);
                    $p->acknowledgement_receipt_number = $incomingAr;
                }

                if ($p->amount_paid >= $p->amount_due - 0.01) {
                    $p->status = Payment::STATUS_PAID;
                } elseif ($p->amount_paid > 0) {
                    $p->status = Payment::STATUS_PARTIAL;
                }

                if ($p->status !== Payment::STATUS_PAID && $p->due_date->isPast()) {
                    $p->status = Payment::STATUS_OVERDUE;
                }

                if ($this->paymentJustBecamePaid($previousStatus, $p->status)) {
                    $autoMint = (bool) ($data['auto_mint_receipt_numbers'] ?? true);
                    $or = $this->receiptCompliance->normalize($p->official_receipt_number);
                    $ar = $this->receiptCompliance->normalize($p->acknowledgement_receipt_number);
                    if ($autoMint && $or === null && $ar === null) {
                        $or = $this->receiptCompliance->mintOfficialReceiptNumber((int) $p->id);
                        $ar = $this->receiptCompliance->mintAcknowledgementReceiptNumber((int) $p->id);
                    }
                    $this->receiptCompliance->validateReceiptFormat($or, $ar, true);
                    $this->receiptCompliance->assertUniqueOfficialReceipt($or, (int) $p->id);
                    $this->receiptCompliance->assertUniqueAcknowledgementReceipt($ar, (int) $p->id);
                    $p->official_receipt_number = $or;
                    $p->acknowledgement_receipt_number = $ar;
                    $this->maybeStampReceiptIssuance($p, $user, $origOr, $origAr, $or ?? '', $ar ?? '');
                    $p->confirmed_by = $user->id;
                    $p->confirmation_date = now();
                    $p->approved_by = $user->id;
                    $p->approved_at = now();
                }

                if (trim((string) ($p->official_receipt_number ?? '')) !== $origOr
                    || trim((string) ($p->acknowledgement_receipt_number ?? '')) !== $origAr) {
                    $this->logReceiptAudit(
                        $p,
                        $user,
                        PaymentReceiptAudit::ACTION_ENCODED,
                        (string) ($p->official_receipt_number ?? ''),
                        (string) ($p->acknowledgement_receipt_number ?? ''),
                        ['context' => 'payments.record']
                    );
                }

                $p->recorded_by = $user->id;
                $p->save();

                $this->loanPaymentBalances->refreshLoanAfterPaymentChange($p->loan_id);
                $freshPayment = $p->fresh([
                    'loan.borrower',
                    'confirmedByUser',
                    'recordedByUser',
                    'approvedByUser',
                    'receiptIssuedByUser',
                ]);
                $becamePaid = $this->paymentJustBecamePaid($previousStatus, $p->status);
            });
        } catch (ValidationException $e) {
            return response()->json([
                'ok' => false,
                'message' => 'Unable to save payment.',
                'errors' => $e->errors(),
            ], 422);
        }

        if ($freshPayment?->loan?->borrower) {
            $borrowerIdForScore = (int) $freshPayment->loan->borrower_id;
            dispatch(function () use ($borrowerIdForScore): void {
                try {
                    $b = User::query()->find($borrowerIdForScore);
                    if ($b) {
                        app(CreditWellnessService::class)->recalculateForUser($b);
                    }
                } catch (\Throwable $e) {
                    report($e);
                }
            })->afterResponse();
        }

        $logger->log($request->user(), 'payments.record', $freshPayment ?? $payment);

        $receiptEmail = ['sent' => false, 'note' => null];
        if ($becamePaid && $freshPayment) {
            $this->logReceiptAudit(
                $freshPayment,
                $user,
                PaymentReceiptAudit::ACTION_APPROVED_PAID,
                (string) ($freshPayment->official_receipt_number ?? ''),
                (string) ($freshPayment->acknowledgement_receipt_number ?? ''),
                ['context' => 'payments.record']
            );
            $this->queuePaymentReceiptEmail($freshPayment, $request->user());
            $receiptEmail = ['sent' => true, 'note' => 'queued'];
            $this->deferPaymentPaidNotifications($freshPayment, $request->user());
        }

        $lastReceiptEmail = null;
        if ($freshPayment && trim((string) ($freshPayment->official_receipt_number ?? '')) !== '') {
            $lastReceiptEmail = EmailLog::query()
                ->where('dedupe_key', SendPaymentReceiptJob::dedupeKey($freshPayment->id, (string) $freshPayment->official_receipt_number))
                ->first();
        }

        $outPayment = $freshPayment ?? $payment;
        $outPayment->loadMissing([
            'loan.borrower',
            'confirmedByUser',
            'recordedByUser',
            'approvedByUser',
            'receiptIssuedByUser',
        ]);

        return response()->json([
            'ok' => true,
            'payment' => (new PaymentListResource($outPayment))->toArray($request),
            'receipt_email_sent' => $receiptEmail['sent'],
            'receipt_email_note' => $receiptEmail['note'],
            'last_payment_receipt_email' => $this->formatPaymentReceiptEmailLog($lastReceiptEmail),
        ]);
    }

    public function updateStatus(Request $request, Payment $payment, ActivityLogger $logger): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'status' => 'required|string|in:pending,paid',
            'official_receipt_number' => 'nullable|string|max:64',
            'acknowledgement_receipt_number' => 'nullable|string|max:64',
            'auto_mint_receipt_numbers' => 'nullable|boolean',
        ]);

        $becamePaid = false;
        $freshPayment = null;

        try {
            DB::transaction(function () use ($payment, $data, $user, &$becamePaid, &$freshPayment): void {
                $p = Payment::query()->whereKey($payment->getKey())->lockForUpdate()->firstOrFail();
                $previousStatus = $p->status;
                $origOr = trim((string) ($p->official_receipt_number ?? ''));
                $origAr = trim((string) ($p->acknowledgement_receipt_number ?? ''));

                if ($data['status'] === Payment::STATUS_PAID) {
                    if ($p->status === Payment::STATUS_PAID) {
                        $freshPayment = $p->fresh([
                            'loan.borrower',
                            'confirmedByUser',
                            'recordedByUser',
                            'approvedByUser',
                            'receiptIssuedByUser',
                        ]);

                        return;
                    }
                    $incomingOr = $this->receiptCompliance->normalize($data['official_receipt_number'] ?? null);
                    $incomingAr = $this->receiptCompliance->normalize($data['acknowledgement_receipt_number'] ?? null);
                    if ($incomingOr !== null) {
                        $this->receiptCompliance->assertUniqueOfficialReceipt($incomingOr, (int) $p->id);
                        $p->official_receipt_number = $incomingOr;
                    }
                    if ($incomingAr !== null) {
                        $this->receiptCompliance->assertUniqueAcknowledgementReceipt($incomingAr, (int) $p->id);
                        $p->acknowledgement_receipt_number = $incomingAr;
                    }

                    $autoMint = (bool) ($data['auto_mint_receipt_numbers'] ?? true);
                    $or = $this->receiptCompliance->normalize($p->official_receipt_number);
                    $ar = $this->receiptCompliance->normalize($p->acknowledgement_receipt_number);
                    if ($autoMint && $or === null && $ar === null) {
                        $or = $this->receiptCompliance->mintOfficialReceiptNumber((int) $p->id);
                        $ar = $this->receiptCompliance->mintAcknowledgementReceiptNumber((int) $p->id);
                    }
                    $this->receiptCompliance->validateReceiptFormat($or, $ar, true);
                    $this->receiptCompliance->assertUniqueOfficialReceipt($or, (int) $p->id);
                    $this->receiptCompliance->assertUniqueAcknowledgementReceipt($ar, (int) $p->id);
                    $p->official_receipt_number = $or;
                    $p->acknowledgement_receipt_number = $ar;
                    $this->maybeStampReceiptIssuance($p, $user, $origOr, $origAr, $or ?? '', $ar ?? '');

                    $p->status = Payment::STATUS_PAID;
                    $p->amount_paid = $p->amount_due;
                    $p->paid_at = now();
                    $p->source = $p->source ?: 'manual';
                    $p->confirmed_by = $user->id;
                    $p->confirmation_date = now();
                    $p->approved_by = $user->id;
                    $p->approved_at = now();
                    $p->recorded_by = $user->id;
                } else {
                    if ($p->status === Payment::STATUS_PAID && ! $this->canOverrideLocked($user)) {
                        $this->logReceiptAudit(
                            $p,
                            $user,
                            PaymentReceiptAudit::ACTION_REVERT_DENIED,
                            (string) ($p->official_receipt_number ?? ''),
                            (string) ($p->acknowledgement_receipt_number ?? ''),
                            ['context' => 'payments.status_update']
                        );
                        throw ValidationException::withMessages([
                            'status' => ['Reverting a confirmed payment requires a user with payment override permission.'],
                        ]);
                    }
                    $p->status = Payment::STATUS_PENDING;
                    $p->amount_paid = 0;
                    $p->paid_at = null;
                    $p->confirmed_by = null;
                    $p->confirmation_date = null;
                    $p->approved_by = null;
                    $p->approved_at = null;
                    $p->invoice_pdf_path = null;
                }

                if (trim((string) ($p->official_receipt_number ?? '')) !== $origOr
                    || trim((string) ($p->acknowledgement_receipt_number ?? '')) !== $origAr) {
                    $this->logReceiptAudit(
                        $p,
                        $user,
                        PaymentReceiptAudit::ACTION_ENCODED,
                        (string) ($p->official_receipt_number ?? ''),
                        (string) ($p->acknowledgement_receipt_number ?? ''),
                        ['context' => 'payments.status_update']
                    );
                }

                $p->save();
                $this->loanPaymentBalances->refreshLoanAfterPaymentChange($p->loan_id);
                $freshPayment = $p->fresh([
                    'loan.borrower',
                    'confirmedByUser',
                    'recordedByUser',
                    'approvedByUser',
                    'receiptIssuedByUser',
                ]);
                $becamePaid = $data['status'] === Payment::STATUS_PAID && $this->paymentJustBecamePaid($previousStatus, $p->status);
            });
        } catch (ValidationException $e) {
            return response()->json([
                'ok' => false,
                'message' => 'Unable to update payment status.',
                'errors' => $e->errors(),
            ], 422);
        }

        if ($freshPayment?->loan?->borrower) {
            $borrowerIdForScore = (int) $freshPayment->loan->borrower_id;
            dispatch(function () use ($borrowerIdForScore): void {
                try {
                    $b = User::query()->find($borrowerIdForScore);
                    if ($b) {
                        app(CreditWellnessService::class)->recalculateForUser($b);
                    }
                } catch (\Throwable $e) {
                    report($e);
                }
            })->afterResponse();
        }

        $logger->log($request->user(), 'payments.status_update', $freshPayment ?? $payment, ['status' => ($freshPayment ?? $payment)->status]);

        $receiptEmail = ['sent' => false, 'note' => null];
        if ($becamePaid && $freshPayment) {
            $this->logReceiptAudit(
                $freshPayment,
                $user,
                PaymentReceiptAudit::ACTION_APPROVED_PAID,
                (string) ($freshPayment->official_receipt_number ?? ''),
                (string) ($freshPayment->acknowledgement_receipt_number ?? ''),
                ['context' => 'payments.status_update']
            );
            $this->queuePaymentReceiptEmail($freshPayment, $request->user());
            $receiptEmail = ['sent' => true, 'note' => 'queued'];
            $this->deferPaymentPaidNotifications($freshPayment, $request->user());
        }

        $lastReceiptEmail = null;
        if ($freshPayment && trim((string) ($freshPayment->official_receipt_number ?? '')) !== '') {
            $lastReceiptEmail = EmailLog::query()
                ->where('dedupe_key', SendPaymentReceiptJob::dedupeKey($freshPayment->id, (string) $freshPayment->official_receipt_number))
                ->first();
        }

        $outPayment = $freshPayment ?? $payment;
        $outPayment->loadMissing([
            'loan.borrower',
            'confirmedByUser',
            'recordedByUser',
            'approvedByUser',
            'receiptIssuedByUser',
        ]);

        return response()->json([
            'ok' => true,
            'payment' => (new PaymentListResource($outPayment))->toArray($request),
            'receipt_email_sent' => $receiptEmail['sent'],
            'receipt_email_note' => $receiptEmail['note'],
            'last_payment_receipt_email' => $this->formatPaymentReceiptEmailLog($lastReceiptEmail),
        ]);
    }

    public function verify(Request $request, Payment $payment, ActivityLogger $logger): JsonResponse
    {
        if (! $request->user()->hasPermission('payments.verify')) {
            return response()->json(['ok' => false, 'message' => 'Forbidden'], 403);
        }

        $user = $request->user();
        $payment->verified_by = $user->id;
        $payment->verified_at = now();
        $payment->save();

        $this->logReceiptAudit(
            $payment,
            $user,
            PaymentReceiptAudit::ACTION_VERIFIED,
            (string) ($payment->official_receipt_number ?? ''),
            (string) ($payment->acknowledgement_receipt_number ?? ''),
            ['context' => 'payments.verify']
        );

        $logger->log($user, 'payments.verify', $payment);

        $payment->loadMissing([
            'loan.borrower',
            'verifiedByUser',
            'recordedByUser',
            'approvedByUser',
            'receiptIssuedByUser',
        ]);

        return response()->json([
            'ok' => true,
            'payment' => (new PaymentListResource($payment))->toArray($request),
        ]);
    }

    public function receiptAudits(Request $request, Payment $payment): JsonResponse
    {
        $rows = PaymentReceiptAudit::query()
            ->where('payment_id', $payment->id)
            ->with('user:id,name,email')
            ->orderByDesc('id')
            ->limit(200)
            ->get();

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    public function patchReceipts(Request $request, Payment $payment, ActivityLogger $logger): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'official_receipt_number' => 'nullable|string|max:64',
            'acknowledgement_receipt_number' => 'nullable|string|max:64',
        ]);

        $incomingOr = $this->receiptCompliance->normalize($data['official_receipt_number'] ?? null);
        $incomingAr = $this->receiptCompliance->normalize($data['acknowledgement_receipt_number'] ?? null);
        if ($incomingOr === null && $incomingAr === null) {
            return response()->json(['ok' => false, 'message' => 'Provide at least one receipt number to update.'], 422);
        }

        try {
            $payment = $this->receiptMutation->updateReceiptsFromStaff(
                $payment,
                $user,
                $data,
                'payments.patch_receipts',
                true,
                false
            );
        } catch (ValidationException $e) {
            $this->logReceiptAudit(
                $payment,
                $user,
                PaymentReceiptAudit::ACTION_DUPLICATE_ATTEMPT,
                (string) ($incomingOr ?? ''),
                (string) ($incomingAr ?? ''),
                ['errors' => $e->errors(), 'context' => 'payments.patch_receipts']
            );

            return response()->json([
                'ok' => false,
                'message' => 'Unable to update receipt numbers.',
                'errors' => $e->errors(),
            ], 422);
        }

        $payment->loadMissing([
            'loan.borrower',
            'recordedByUser',
            'receiptIssuedByUser',
            'verifiedByUser',
            'approvedByUser',
        ]);
        $logger->log($user, 'payments.patch_receipts', $payment);

        return response()->json([
            'ok' => true,
            'payment' => (new PaymentListResource($payment))->toArray($request),
        ]);
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        if (! $request->user()->hasPermission('payments.export')) {
            abort(403, 'Forbidden');
        }

        $q = $this->filteredPaymentsQuery($request)->orderByDesc('due_date')->limit(5000);

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="payments-export.csv"',
        ];

        return response()->streamDownload(function () use ($q): void {
            $out = fopen('php://output', 'w');
            fputcsv($out, [
                'payment_id',
                'loan_id',
                'borrower_name',
                'installment_no',
                'due_date',
                'amount_due',
                'amount_paid',
                'status',
                'receipt_status',
                'payment_method',
                'official_receipt_number',
                'acknowledgement_receipt_number',
                'paid_at',
                'recorded_by',
                'verified_by',
                'approved_by',
                'loan_officer',
            ]);
            $q->chunk(200, function ($rows) use ($out): void {
                foreach ($rows as $p) {
                    /** @var Payment $p */
                    $p->loadMissing(['loan.borrower', 'loan.assignedOfficer', 'recordedByUser', 'verifiedByUser', 'approvedByUser']);
                    fputcsv($out, [
                        $p->id,
                        $p->loan_id,
                        $p->loan?->borrower?->name,
                        $p->installment_no,
                        optional($p->due_date)?->toDateString(),
                        $p->amount_due,
                        $p->amount_paid,
                        $p->status,
                        $p->receipt_status,
                        $p->payment_method,
                        $p->official_receipt_number,
                        $p->acknowledgement_receipt_number,
                        optional($p->paid_at)?->toIso8601String(),
                        $p->recordedByUser?->name,
                        $p->verifiedByUser?->name,
                        $p->approvedByUser?->name,
                        $p->loan?->assignedOfficer?->name,
                    ]);
                }
            });
            fclose($out);
        }, 'payments-export.csv', $headers);
    }

    /**
     * Adjust scheduled amount for the final installment only (penalties/discounts/settlement corrections).
     */
    public function adjustFinal(Request $request, Payment $payment, ActivityLogger $logger, CreditWellnessService $creditWellness): JsonResponse
    {
        $data = $request->validate([
            'amount_due' => 'required|numeric|min:0',
            'adjustment_reason' => 'required|string|min:8|max:2000',
        ]);

        $result = $this->finalPaymentAdjustments->adjustFinalInstallmentDue(
            $payment,
            $request->user(),
            (float) $data['amount_due'],
            (string) $data['adjustment_reason'],
        );

        $fresh = $result['payment'];
        $loan = $fresh->loan()->with('borrower')->first();
        if ($loan?->borrower) {
            $creditWellness->recalculateForUser($loan->borrower);
        }

        $logger->log($request->user(), 'payments.adjust_final', $fresh, [
            'payment_id' => $fresh->id,
            'loan_id' => $fresh->loan_id,
            'audit_id' => $result['audit']->id,
        ]);

        if ($loan?->borrower) {
            app(NotificationCenter::class)->notifyBorrower(
                $loan->borrower,
                NotificationCenter::CATEGORY_LOAN_PAYMENT_ADJUSTED,
                'final_payment_adjusted',
                'Installment schedule updated',
                'Your final installment amount was updated by our team. Please review your borrower portal for the revised due amount.',
                [
                    'payment_id' => $fresh->id,
                    'loan_id' => $fresh->loan_id,
                    'new_amount_due' => (float) $fresh->amount_due,
                ],
                ['dedupe_key' => 'final_pay_adj:'.$result['audit']->id, 'module' => NotificationCenter::MODULE_PAYMENTS],
            );
        }

        return response()->json([
            'ok' => true,
            'payment' => $fresh->fresh(['loan.borrower', 'adjustmentAudits.adminUser']),
        ]);
    }

    public function adjustmentAudits(Request $request, Payment $payment): JsonResponse
    {
        $rows = PaymentAdjustmentAudit::query()
            ->where('payment_id', $payment->id)
            ->with('adminUser:id,name,email')
            ->orderByDesc('id')
            ->get();

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    private function filteredPaymentsQuery(Request $request): Builder
    {
        $q = Payment::query()
            ->with([
                'loan' => fn ($rel) => $rel->select([
                    'id', 'borrower_id', 'assigned_officer_id', 'term_months', 'outstanding_balance', 'status', 'principal',
                ]),
                'loan.borrower:id,name,email',
                'loan.assignedOfficer:id,name,email',
                'confirmedByUser:id,name',
                'recordedByUser:id,name',
                'verifiedByUser:id,name',
                'approvedByUser:id,name',
                'receiptIssuedByUser:id,name',
            ]);

        if ($request->query('loan_scope') === 'assigned') {
            $u = $request->user();
            $primary = (string) ($u->role ?? '');
            $derived = $u->derivePrimaryRoleFromRoles();
            if ($primary === 'loan_officer' || $derived === 'loan_officer') {
                $q->whereHas('loan', fn ($lq) => $lq->where('assigned_officer_id', $u->id));
            }
        }

        if ($request->filled('loan_id')) {
            $q->where('loan_id', $request->query('loan_id'));
        }
        if ($request->filled('loan_search')) {
            $loanId = $this->parseLoanSearchToId((string) $request->query('loan_search'));
            if ($loanId !== null) {
                $q->where('loan_id', $loanId);
            }
        }
        if ($request->filled('status')) {
            $q->where('status', $request->query('status'));
        }
        if ($request->filled('overdue')) {
            $q->where('status', '!=', Payment::STATUS_PAID)
                ->whereDate('due_date', '<', now()->toDateString());
        }

        if ($request->filled('installment_dpd_min') || $request->filled('installment_dpd_max')) {
            $minD = $request->filled('installment_dpd_min') ? max(0, (int) $request->query('installment_dpd_min')) : 0;
            $maxD = $request->filled('installment_dpd_max') ? max($minD, (int) $request->query('installment_dpd_max')) : 3650;
            $q->whereDate('due_date', '<', now()->toDateString())
                ->whereNotIn('status', [Payment::STATUS_PAID, Payment::STATUS_WAIVED])
                ->whereRaw('(amount_due - COALESCE(amount_paid, 0)) > 0.009')
                ->whereDate('due_date', '<=', now()->copy()->subDays($minD)->toDateString())
                ->whereDate('due_date', '>=', now()->copy()->subDays($maxD)->toDateString());
        }

        if ($request->filled('payment_method')) {
            $q->where('payment_method', $request->query('payment_method'));
        }

        if ($request->filled('recorded_by')) {
            $q->where('recorded_by', (int) $request->query('recorded_by'));
        }

        if ($request->filled('officer_user_id')) {
            $officerId = (int) $request->query('officer_user_id');
            $q->whereHas('loan', fn ($lq) => $lq->where('assigned_officer_id', $officerId));
        }

        if ($request->filled('official_receipt_q')) {
            $t = strtoupper(trim((string) $request->query('official_receipt_q')));
            $q->where('official_receipt_number', 'like', '%'.$t.'%');
        }
        if ($request->filled('acknowledgement_receipt_q')) {
            $t = strtoupper(trim((string) $request->query('acknowledgement_receipt_q')));
            $q->where('acknowledgement_receipt_number', 'like', '%'.$t.'%');
        }

        if ($request->filled('borrower_search')) {
            $b = trim((string) $request->query('borrower_search'));
            $q->whereHas('loan.borrower', function ($bq) use ($b): void {
                $bq->where('name', 'like', '%'.$b.'%')
                    ->orWhere('email', 'like', '%'.$b.'%');
            });
        }

        if ($request->filled('collector_search')) {
            $c = trim((string) $request->query('collector_search'));
            $q->whereHas('recordedByUser', function ($uq) use ($c): void {
                $uq->where('name', 'like', '%'.$c.'%');
            });
        }

        if ($request->filled('officer_search')) {
            $o = trim((string) $request->query('officer_search'));
            $q->whereHas('loan.assignedOfficer', function ($uq) use ($o): void {
                $uq->where('name', 'like', '%'.$o.'%');
            });
        }

        $dateField = $request->query('date_field', 'paid_at') === 'due_date' ? 'due_date' : 'paid_at';
        if ($request->filled('date_from')) {
            $from = Carbon::parse((string) $request->query('date_from'))->startOfDay();
            if ($dateField === 'due_date') {
                $q->whereDate('due_date', '>=', $from->toDateString());
            } else {
                $q->whereNotNull('paid_at')->whereDate('paid_at', '>=', $from->toDateString());
            }
        }
        if ($request->filled('date_to')) {
            $to = Carbon::parse((string) $request->query('date_to'))->endOfDay();
            if ($dateField === 'due_date') {
                $q->whereDate('due_date', '<=', $to->toDateString());
            } else {
                $q->whereDate('paid_at', '<=', $to->toDateString());
            }
        }

        if ($request->query('approval_status') === 'missing_receipts') {
            $q->where('status', Payment::STATUS_PAID)
                ->where(function ($w): void {
                    $w->where(function ($x): void {
                        $x->whereNull('official_receipt_number')->orWhere('official_receipt_number', '');
                    })->where(function ($x): void {
                        $x->whereNull('acknowledgement_receipt_number')->orWhere('acknowledgement_receipt_number', '');
                    });
                });
        } elseif ($request->query('approval_status') === 'verified') {
            $q->whereNotNull('verified_by');
        } elseif ($request->query('approval_status') === 'pending') {
            $q->where('status', Payment::STATUS_PENDING);
        } elseif ($request->query('approval_status') === 'paid') {
            $q->where('status', Payment::STATUS_PAID);
        }

        if ($request->filled('receipt_status')) {
            $q->where('receipt_status', (string) $request->query('receipt_status'));
        }

        if ($request->filled('receipt_document_coverage')) {
            $cov = (string) $request->query('receipt_document_coverage');
            if ($cov === 'or_only') {
                $q->where(function ($w): void {
                    $w->whereNotNull('official_receipt_number')->where('official_receipt_number', '!=', '')
                        ->where(function ($x): void {
                            $x->whereNull('acknowledgement_receipt_number')->orWhere('acknowledgement_receipt_number', '');
                        });
                });
            } elseif ($cov === 'ar_only') {
                $q->where(function ($w): void {
                    $w->whereNotNull('acknowledgement_receipt_number')->where('acknowledgement_receipt_number', '!=', '')
                        ->where(function ($x): void {
                            $x->whereNull('official_receipt_number')->orWhere('official_receipt_number', '');
                        });
                });
            } elseif ($cov === 'both') {
                $q->where(function ($w): void {
                    $w->whereNotNull('official_receipt_number')->where('official_receipt_number', '!=', '')
                        ->whereNotNull('acknowledgement_receipt_number')->where('acknowledgement_receipt_number', '!=', '');
                });
            } elseif ($cov === 'none') {
                $q->where(function ($w): void {
                    $w->where(function ($x): void {
                        $x->whereNull('official_receipt_number')->orWhere('official_receipt_number', '');
                    })->where(function ($x): void {
                        $x->whereNull('acknowledgement_receipt_number')->orWhere('acknowledgement_receipt_number', '');
                    });
                });
            }
        }

        return $q;
    }

    private function logReceiptAudit(
        Payment $payment,
        User $user,
        string $action,
        string $official,
        string $acknowledgement,
        array $meta = [],
    ): void {
        PaymentReceiptAudit::query()->create([
            'payment_id' => $payment->id,
            'user_id' => $user->id,
            'action' => $action,
            'official_receipt_number' => $official !== '' ? $official : null,
            'acknowledgement_receipt_number' => $acknowledgement !== '' ? $acknowledgement : null,
            'meta' => $meta ?: null,
            'ip_address' => $this->requestIp(),
            'user_agent' => substr((string) request()->userAgent(), 0, 512),
        ]);
    }

    private function requestIp(): ?string
    {
        try {
            return request()->ip();
        } catch (\Throwable) {
            return null;
        }
    }

    private function maybeStampReceiptIssuance(
        Payment $p,
        User $user,
        string $origOr,
        string $origAr,
        string $newOr,
        string $newAr,
    ): void {
        if ($p->receipt_issued_at) {
            return;
        }
        if (($origOr === '' && $newOr !== '') || ($origAr === '' && $newAr !== '')) {
            $p->receipt_issued_by = $user->id;
            $p->receipt_issued_role = $this->staffRoleLabelForReceipt($user);
            $p->receipt_issued_at = now();
        }
    }

    private function canOverrideLocked(User $user): bool
    {
        return $user->hasPermission('payments.override_locked') || $user->hasPermission('roles.manage');
    }

    private function staffRoleLabelForReceipt(User $user): string
    {
        $slug = $user->derivePrimaryRoleFromRoles();
        $primary = strtolower((string) ($user->role ?? ''));

        return $primary !== '' ? $primary : $slug;
    }

    private function queuePaymentReceiptEmail(Payment $payment, User $admin): void
    {
        $payment->loadMissing(['loan.borrower:id,name,email']);
        $or = trim((string) ($payment->official_receipt_number ?? ''));
        if ($or === '') {
            return;
        }

        $dedupeKey = SendPaymentReceiptJob::dedupeKey($payment->id, $or);
        $borrower = $payment->loan?->borrower;
        $email = trim((string) ($borrower?->email ?? ''));
        $validEmail = $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL);

        if (! $validEmail) {
            EmailLog::query()->updateOrCreate(
                ['dedupe_key' => $dedupeKey],
                [
                    'loan_id' => $payment->loan_id,
                    'payment_id' => $payment->id,
                    'notification_type' => EmailLog::NOTIFICATION_PAYMENT_RECEIPT,
                    'mailable_class' => PaymentReceiptMail::class,
                    'recipient_email' => $email !== '' ? $email : 'invalid@invalid.local',
                    'recipient_name' => $borrower?->name,
                    'subject' => null,
                    'status' => EmailLog::STATUS_FAILED,
                    'transport_detail' => 'invalid_recipient',
                    'error_message' => 'Missing or invalid borrower email.',
                    'meta' => ['source' => 'PaymentController::queuePaymentReceiptEmail'],
                ]
            );

            return;
        }

        EmailLog::query()->updateOrCreate(
            ['dedupe_key' => $dedupeKey],
            [
                'loan_id' => $payment->loan_id,
                'payment_id' => $payment->id,
                'notification_type' => EmailLog::NOTIFICATION_PAYMENT_RECEIPT,
                'mailable_class' => PaymentReceiptMail::class,
                'recipient_email' => $email,
                'recipient_name' => $borrower?->name,
                'subject' => null,
                'status' => EmailLog::STATUS_QUEUED,
                'transport_detail' => null,
                'error_message' => null,
                'meta' => ['source' => 'PaymentController::queuePaymentReceiptEmail'],
            ]
        );

        /**
         * Send in-process: `afterResponse()` is unreliable under PHP-FPM (callback may never run).
         * {@see SendPaymentReceiptJob} uses {@see TransactionalMailSender} so delivery does not depend on `queue:work`.
         */
        try {
            Bus::dispatchSync(new SendPaymentReceiptJob((int) $payment->id, $or, (int) $admin->id));
        } catch (\Throwable $e) {
            report($e);
        }
    }

    /**
     * In-app borrower + staff notifications after a payment is marked paid (not needed to block the HTTP response).
     */
    private function deferPaymentPaidNotifications(Payment $freshPayment, User $admin): void
    {
        $paymentId = (int) $freshPayment->id;
        $loanId = (int) $freshPayment->loan_id;
        $adminId = (int) $admin->id;
        $self = $this;

        dispatch(function () use ($self, $paymentId, $loanId, $adminId): void {
            try {
                $pay = Payment::query()->with(['loan.borrower'])->find($paymentId);
                if (! $pay || ! $pay->loan?->borrower) {
                    return;
                }

                $borrower = $pay->loan->borrower;
                $remaining = (float) (Payment::query()
                    ->where('loan_id', $loanId)
                    ->selectRaw('COALESCE(SUM(GREATEST(amount_due - amount_paid, 0)), 0) AS r')
                    ->value('r') ?? 0);
                $remainingTxt = number_format($remaining, 2);

                app(NotificationCenter::class)->notifyBorrower(
                    $borrower,
                    NotificationCenter::CATEGORY_PAYMENT_RECEIVED,
                    'payment_received',
                    'Payment recorded',
                    'Installment #'.($pay->installment_no ?? '—').' is marked paid. Remaining balance (scheduled): ₱'.$remainingTxt.'. Thank you.',
                    ['payment_id' => $pay->id, 'loan_id' => $pay->loan_id, 'remaining_balance' => $remaining],
                    ['dedupe_key' => 'payment_paid:'.$pay->id, 'module' => NotificationCenter::MODULE_PAYMENTS],
                );

                $adminUser = User::query()->find($adminId);
                if ($adminUser) {
                    $self->notifyStaffPaymentConfirmed($pay, $adminUser);
                }
            } catch (\Throwable $e) {
                report($e);
            }
        })->afterResponse();
    }

    private function notifyStaffPaymentConfirmed(Payment $payment, User $admin): void
    {
        $payment->loadMissing('loan.borrower');
        $borrowerName = $payment->loan?->borrower?->name ?? 'Borrower';
        $or = trim((string) ($payment->official_receipt_number ?? ''));
        app(NotificationCenter::class)->notifyStaff(
            NotificationCenter::CATEGORY_PAYMENT_RECEIVED,
            'payment_confirmed_staff',
            'Installment confirmed paid',
            'Loan #'.$payment->loan_id.' · '.$borrowerName.' · Inst #'.($payment->installment_no ?? '—').' · OR '.$or,
            [
                'payment_id' => $payment->id,
                'loan_id' => $payment->loan_id,
                'official_receipt_number' => $or,
            ],
            (int) $admin->id,
            [
                'module' => NotificationCenter::MODULE_PAYMENTS,
                'throttle_key' => 'payment_confirmed_staff:'.$payment->id,
                'throttle_max' => 1,
                'throttle_decay_seconds' => 3600,
            ],
        );
    }

    /**
     * @param  Collection<int, mixed>  $paymentIds
     * @return array<int, string>
     */
    private function receiptEmailStatusMapForPaymentIds(Collection $paymentIds): array
    {
        $ids = $paymentIds->filter(fn ($id) => (int) $id > 0)->map(fn ($id) => (int) $id)->unique()->values();
        if ($ids->isEmpty()) {
            return [];
        }

        $latestIds = EmailLog::query()
            ->selectRaw('max(id) as agg_id')
            ->whereIn('payment_id', $ids)
            ->where('notification_type', EmailLog::NOTIFICATION_PAYMENT_RECEIPT)
            ->groupBy('payment_id')
            ->pluck('agg_id');
        if ($latestIds->isEmpty()) {
            return [];
        }

        return EmailLog::query()
            ->whereIn('id', $latestIds)
            ->get()
            ->mapWithKeys(fn (EmailLog $e) => [(int) $e->payment_id => (string) $e->status])
            ->all();
    }

    /**
     * @return array<string, mixed>|null
     */
    private function formatPaymentReceiptEmailLog(?EmailLog $row): ?array
    {
        if (! $row) {
            return null;
        }

        return [
            'status' => $row->status,
            'recipient_email' => $row->recipient_email,
            'subject' => $row->subject,
            'transport_detail' => $row->transport_detail,
            'error_message' => $row->error_message,
            'sent_at' => $row->sent_at?->toIso8601String(),
            'created_at' => $row->created_at->toIso8601String(),
            'updated_at' => $row->updated_at->toIso8601String(),
        ];
    }

    private function paymentJustBecamePaid(string $previousStatus, string $currentStatus): bool
    {
        $prev = strtolower(trim($previousStatus));
        $cur = strtolower(trim($currentStatus));

        return $cur === Payment::STATUS_PAID && $prev !== Payment::STATUS_PAID;
    }

    /**
     * Resolve admin “loan number” filter: numeric id, #id, or LN-000123.
     */
    private function parseLoanSearchToId(string $raw): ?int
    {
        $t = strtolower(trim($raw));
        if ($t === '') {
            return null;
        }
        if (preg_match('/^ln-0*(\d+)$/', $t, $m)) {
            return (int) $m[1];
        }
        if (preg_match('/^#?(\d+)$/', $t, $m)) {
            return (int) $m[1];
        }

        return null;
    }
}
