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
use App\Models\SoaLog;
use App\Models\SoaStatement;
use App\Models\User;
use App\Notifications\ReceiptGeneratedNotification;
use App\Services\ActivityLogger;
use App\Services\CreditWellnessService;
use App\Services\FinalPaymentAdjustmentService;
use App\Services\LoanPaymentBalanceService;
use App\Services\NotificationCenter;
use App\Services\PaymentFilterService;
use App\Services\PaymentReceiptComplianceService;
use App\Services\PaymentReceiptMutationService;
use App\Services\PaymentReceiptPdfService;
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
        private PaymentFilterService $paymentFilters,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $q = $this->paymentFilters->sort($this->filteredPaymentsQuery($request), $request);

        $perPage = max(10, min(100, (int) $request->query('per_page', 25)));
        $rows = $q->paginate($perPage);

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

    public function manualOptions(Request $request): JsonResponse
    {
        $data = $request->validate([
            'borrower_id' => 'required|integer|exists:users,id',
        ]);

        $loans = Loan::query()
            ->where('borrower_id', (int) $data['borrower_id'])
            ->whereIn('status', [Loan::STATUS_APPROVED, Loan::STATUS_ONGOING])
            ->with(['payments' => function ($query): void {
                $query->whereNotIn('status', [Payment::STATUS_PAID, Payment::STATUS_WAIVED])
                    ->whereRaw('(amount_due - COALESCE(amount_paid, 0)) > 0.009')
                    ->orderBy('due_date')
                    ->orderBy('installment_no');
            }])
            ->orderByDesc('id')
            ->get()
            ->map(function (Loan $loan): array {
                return [
                    'id' => $loan->id,
                    'loan_number' => $loan->loan_number,
                    'status' => $loan->status,
                    'outstanding_balance' => (float) ($loan->outstanding_balance ?? 0),
                    'payments' => $loan->payments->map(fn (Payment $payment): array => [
                        'id' => $payment->id,
                        'installment_no' => $payment->installment_no,
                        'due_date' => optional($payment->due_date)?->toDateString(),
                        'amount_due' => (float) $payment->amount_due,
                        'amount_paid' => (float) $payment->amount_paid,
                        'remaining_due' => max(0, (float) $payment->amount_due - (float) $payment->amount_paid),
                        'status' => $payment->status,
                    ])->values(),
                ];
            })
            ->filter(fn (array $loan): bool => count($loan['payments']) > 0)
            ->values();

        return response()->json(['ok' => true, 'data' => $loans]);
    }

    public function record(Request $request, Payment $payment, ActivityLogger $logger): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'amount_paid' => 'required|numeric|min:0',
            'paid_at' => 'nullable|date',
            'payment_date' => 'nullable|date',
            'source' => 'nullable|string|in:manual,api',
            'external_ref' => 'nullable|string|max:255',
            'reference_number' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'payment_method' => 'nullable|string|max:32',
            'payment_type' => 'nullable|string|in:partial,full,advance',
            'penalty_amount' => 'nullable|numeric|min:0',
            'official_receipt_number' => 'nullable|string|max:64',
            'acknowledgement_receipt_number' => 'nullable|string|max:64',
            'or_number' => 'nullable|string|max:255',
            'ar_number' => 'nullable|string|max:255',
            'auto_mint_receipt_numbers' => 'nullable|boolean',
        ]);

        if (! isset($data['official_receipt_number']) && isset($data['or_number'])) {
            $data['official_receipt_number'] = $data['or_number'];
        }
        if (! isset($data['acknowledgement_receipt_number']) && isset($data['ar_number'])) {
            $data['acknowledgement_receipt_number'] = $data['ar_number'];
        }

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
                $amountPaid = round((float) $data['amount_paid'], 2);
                $scheduledDue = round((float) $p->amount_due, 2);
                if ($amountPaid - $scheduledDue > 0.009) {
                    throw ValidationException::withMessages([
                        'amount_paid' => ['Payment amount cannot exceed the selected installment remaining balance.'],
                    ]);
                }

                $p->amount_paid = $amountPaid;
                $p->paid_at = isset($data['paid_at']) || isset($data['payment_date'])
                    ? Carbon::parse($data['paid_at'] ?? $data['payment_date'])
                    : now();
                $p->source = $data['source'] ?? 'manual';
                if (isset($data['external_ref'])) {
                    $p->external_ref = $data['external_ref'];
                }
                if (isset($data['reference_number'])) {
                    $p->reference_number = $data['reference_number'];
                    $p->external_ref = $p->external_ref ?: $data['reference_number'];
                }
                if (isset($data['notes'])) {
                    $p->notes = $data['notes'];
                }
                if (array_key_exists('penalty_amount', $data)) {
                    $p->penalty_amount = (float) ($data['penalty_amount'] ?? 0);
                }
                if (array_key_exists('payment_method', $data) && $data['payment_method'] !== null) {
                    $p->payment_method = $data['payment_method'];
                }
                if (array_key_exists('payment_type', $data) && $data['payment_type'] !== null) {
                    $p->payment_type = $data['payment_type'];
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
                $this->stampManualEncoder($p, $user);
                $p->save();
                $becamePaid = $this->paymentJustBecamePaid($previousStatus, $p->status);
                if ($becamePaid) {
                    $this->markMatchingSoaPaid($p, (int) $user->id);
                }

                $this->loanPaymentBalances->refreshLoanAfterPaymentChange($p->loan_id);
                $freshPayment = $p->fresh([
                    'loan.borrower',
                    'confirmedByUser',
                    'recordedByUser',
                    'encodedByUser',
                    'processedByUser',
                    'approvedByUser',
                    'receiptIssuedByUser',
                ]);
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
            $borrowerEmail = trim((string) ($freshPayment->loan?->borrower?->email ?? ''));
            $receiptEmail = filter_var($borrowerEmail, FILTER_VALIDATE_EMAIL)
                ? ['sent' => true, 'note' => 'queued']
                : ['sent' => false, 'note' => 'no_borrower_email'];
            $this->deferPaymentPaidNotifications($freshPayment, $request->user());
            $freshPayment = $freshPayment->fresh([
                'loan.borrower',
                'confirmedByUser',
                'recordedByUser',
                'encodedByUser',
                'processedByUser',
                'approvedByUser',
                'receiptIssuedByUser',
            ]);
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
            'encodedByUser',
            'processedByUser',
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
                            'encodedByUser',
                            'processedByUser',
                            'approvedByUser',
                            'receiptIssuedByUser',
                        ]);

                        return;
                    }
                    if (! $this->hasPaymentEvidence($p)) {
                        throw ValidationException::withMessages([
                            'payment' => ['Borrower proof, reference number, or recorded payment amount is required before confirmation.'],
                        ]);
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
                    $this->stampManualEncoder($p, $user);
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
                    $p->receipt_pdf_path = null;
                    $p->emailed_at = null;
                    $p->notification_sent_at = null;
                    $p->processed_by_user_id = null;
                    $p->processed_by_name = null;
                    $p->encoded_by = null;
                    $p->encoder_name = null;
                    $p->encoder_role = null;
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
                $becamePaid = $data['status'] === Payment::STATUS_PAID && $this->paymentJustBecamePaid($previousStatus, $p->status);
                if ($becamePaid) {
                    $this->markMatchingSoaPaid($p, (int) $user->id);
                }

                $this->loanPaymentBalances->refreshLoanAfterPaymentChange($p->loan_id);
                $freshPayment = $p->fresh([
                    'loan.borrower',
                    'confirmedByUser',
                    'recordedByUser',
                    'encodedByUser',
                    'processedByUser',
                    'approvedByUser',
                    'receiptIssuedByUser',
                ]);
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
            $borrowerEmail = trim((string) ($freshPayment->loan?->borrower?->email ?? ''));
            $receiptEmail = filter_var($borrowerEmail, FILTER_VALIDATE_EMAIL)
                ? ['sent' => true, 'note' => 'queued']
                : ['sent' => false, 'note' => 'no_borrower_email'];
            $this->deferPaymentPaidNotifications($freshPayment, $request->user());
            $freshPayment = $freshPayment->fresh([
                'loan.borrower',
                'confirmedByUser',
                'recordedByUser',
                'encodedByUser',
                'processedByUser',
                'approvedByUser',
                'receiptIssuedByUser',
            ]);
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
            'encodedByUser',
            'processedByUser',
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
        if (! in_array(strtolower((string) $payment->status), [Payment::STATUS_PENDING, Payment::STATUS_PARTIAL, Payment::STATUS_OVERDUE], true)
            || ! $this->hasPaymentEvidence($payment)) {
            return response()->json([
                'ok' => false,
                'message' => 'Only submitted unpaid payments can be verified.',
            ], 422);
        }
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
            'encodedByUser',
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

        $q = $this->paymentFilters->sort($this->filteredPaymentsQuery($request), $request)->limit(5000);

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
            'payment_type',
                'official_receipt_number',
                'acknowledgement_receipt_number',
                'paid_at',
                'recorded_by',
            'processed_by',
            'processed_by_role',
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
                        $p->payment_type,
                        $p->official_receipt_number,
                        $p->acknowledgement_receipt_number,
                        optional($p->paid_at)?->toIso8601String(),
                        $p->recordedByUser?->name,
                        $p->encoder_name ?: $p->encodedByUser?->name ?: $p->recordedByUser?->name,
                        $p->encoder_role ?: $p->receipt_issued_role,
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
        return $this->paymentFilters->apply($this->paymentFilters->baseQuery(), $request);
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

    private function stampManualEncoder(Payment $payment, User $user): void
    {
        $payment->encoded_by = $user->id;
        $payment->encoder_name = trim((string) ($user->name ?? '')) ?: $user->email;
        $payment->encoder_role = $this->staffRoleDisplayLabel($user);
        $payment->processed_by_user_id = $user->id;
        $payment->processed_by_name = $payment->encoder_name;
    }

    private function canOverrideLocked(User $user): bool
    {
        return $user->hasPermission('payments.override_locked') || $user->hasPermission('roles.manage');
    }

    private function staffRoleLabelForReceipt(User $user): string
    {
        return $this->staffRoleDisplayLabel($user);
    }

    private function staffRoleDisplayLabel(User $user): string
    {
        $slug = $user->derivePrimaryRoleFromRoles();
        $primary = strtolower((string) ($user->role ?? ''));
        $role = $primary !== '' ? $primary : $slug;

        return ucwords(str_replace(['_', '-'], ' ', $role));
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

        try {
            app(PaymentReceiptPdfService::class)->ensureOfficialPdf($payment, (int) $admin->id);
            $payment->refresh();
        } catch (\Throwable $e) {
            report($e);
        }

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
        $adminId = (int) $admin->id;
        $self = $this;

        try {
            $pay = Payment::query()->with(['loan.borrower'])->find($paymentId);
            if (! $pay || ! $pay->loan?->borrower) {
                return;
            }

            $borrower = $pay->loan->borrower;
            $loanNumber = $pay->loan?->loan_number ?? ('LN-'.str_pad((string) $pay->loan_id, 6, '0', STR_PAD_LEFT));
            $or = trim((string) ($pay->official_receipt_number ?? ''));
            $message = 'Your payment for Loan '.$loanNumber.' has been successfully posted. Amount Paid: ₱'.number_format((float) $pay->amount_paid, 2).'. Receipt No: '.($or !== '' ? $or : 'Pending');

            app(NotificationCenter::class)->notifyBorrower(
                $borrower,
                NotificationCenter::CATEGORY_PAYMENT_RECEIVED,
                'receipt_generated',
                'Payment Received',
                $message,
                [
                    'payment_id' => $pay->id,
                    'loan_id' => $pay->loan_id,
                    'loan_number' => $loanNumber,
                    'amount_paid' => (float) $pay->amount_paid,
                    'official_receipt_number' => $or,
                    'acknowledgement_receipt_number' => $pay->acknowledgement_receipt_number,
                    'receipt_download_url' => '/borrower/payments/'.$pay->id.'/official-receipt',
                ],
                ['dedupe_key' => 'payment_paid:'.$pay->id, 'module' => NotificationCenter::MODULE_PAYMENTS],
            );

            $borrower->notify(new ReceiptGeneratedNotification($pay));

            $pay->forceFill(['notification_sent_at' => now()])->save();

            $adminUser = User::query()->find($adminId);
            if ($adminUser) {
                $self->notifyStaffPaymentConfirmed($pay, $adminUser);
            }
        } catch (\Throwable $e) {
            report($e);
        }
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

    private function markMatchingSoaPaid(Payment $payment, int $adminId): void
    {
        if (! $payment->due_date) {
            return;
        }

        $dueDate = $payment->due_date->copy();
        $statementMonth = $dueDate->copy()->startOfMonth()->toDateString();

        SoaStatement::query()
            ->where('loan_id', $payment->loan_id)
            ->where('status', '!=', SoaStatement::STATUS_PAID)
            ->where(function (Builder $query) use ($dueDate, $statementMonth): void {
                $query->whereDate('due_date', $dueDate->toDateString())
                    ->orWhereDate('statement_month', $statementMonth);
            })
            ->get()
            ->each(function (SoaStatement $statement) use ($adminId): void {
                $statement->forceFill(['status' => SoaStatement::STATUS_PAID])->save();

                SoaLog::query()->create([
                    'soa_id' => $statement->id,
                    'action' => 'paid',
                    'description' => 'SOA hidden from borrower portal after admin confirmed the matching payment.',
                    'created_by' => $adminId,
                ]);
            });
    }

    private function paymentJustBecamePaid(string $previousStatus, string $currentStatus): bool
    {
        $prev = strtolower(trim($previousStatus));
        $cur = strtolower(trim($currentStatus));

        return $cur === Payment::STATUS_PAID && $prev !== Payment::STATUS_PAID;
    }

    private function hasPaymentEvidence(Payment $payment): bool
    {
        return (float) ($payment->amount_paid ?? 0) > 0
            || trim((string) ($payment->reference_number ?? '')) !== ''
            || trim((string) ($payment->receipt_path ?? '')) !== '';
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
