<?php

namespace App\Services;

use App\Jobs\SendBorrowerLoanApplicationUpdateJob;
use App\Models\BorrowerNotification;
use App\Models\EmailLog;
use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\User;
use App\Support\DeferredDispatch;

class BorrowerLoanApplicationNotifier
{
    public function __construct(
        private NotificationCenter $notifications,
    ) {}

    /**
     * Notify borrower when approved loan amount is set or changed.
     *
     * @return array{in_app: bool, email_queued: bool, skipped: bool, reason: ?string}
     */
    public function notifyApprovedAmountChanged(
        Loan $loan,
        User $actor,
        float $previousAmount,
        float $newAmount,
        ?string $remarks = null,
    ): array {
        $previousAmount = round($previousAmount, 2);
        $newAmount = round($newAmount, 2);

        if (abs($previousAmount - $newAmount) < 0.01) {
            return ['in_app' => false, 'email_queued' => false, 'skipped' => true, 'reason' => 'no_amount_change'];
        }

        $loan->loadMissing(['borrower', 'loanApplication']);
        $borrower = $loan->borrower;
        if (! $borrower) {
            return ['in_app' => false, 'email_queued' => false, 'skipped' => true, 'reason' => 'no_borrower'];
        }

        $requested = $this->requestedAmount($loan);
        $statusLabel = $this->statusLabel($loan);
        $remarksText = $this->normalizeRemarks($remarks, $loan);

        $title = $previousAmount <= 0 ? 'Loan amount evaluated' : 'Loan amount updated';
        $body = $this->formatAmountBody($requested, $newAmount, $previousAmount);

        $dedupeKey = 'loan_amount_updated:'.$loan->id.':'.(int) round($newAmount * 100).':'.now()->format('YmdHi');

        $inApp = $this->sendInApp(
            $borrower,
            NotificationCenter::CATEGORY_LOAN_AMOUNT_UPDATED,
            'loan_amount_updated',
            $title,
            $body,
            [
                'loan_id' => $loan->id,
                'loan_application_id' => $loan->loanApplication?->id,
                'requested_amount' => $requested,
                'approved_amount' => $newAmount,
                'previous_approved_amount' => $previousAmount > 0 ? $previousAmount : null,
                'actor_name' => $actor->name,
            ],
            $dedupeKey,
        );

        $emailQueued = $this->queueEmail(
            $loan,
            'amount_updated',
            $dedupeKey,
            $requested,
            $newAmount,
            $previousAmount > 0 ? $previousAmount : null,
            $statusLabel,
            $remarksText,
            null,
            $inApp?->id,
        );

        return [
            'in_app' => $inApp !== null,
            'email_queued' => $emailQueued,
            'skipped' => false,
            'reason' => null,
            'dedupe_key' => $dedupeKey,
        ];
    }

    /**
     * @return array{in_app: bool, email_queued: bool, skipped: bool}
     */
    public function notifyEvaluationUpdated(Loan $loan, User $actor, ?string $remarks = null): array
    {
        $loan->loadMissing(['borrower', 'loanApplication']);
        $borrower = $loan->borrower;
        if (! $borrower) {
            return ['in_app' => false, 'email_queued' => false, 'skipped' => true];
        }

        if ($loan->amount_modified_at && $loan->amount_modified_at->gt(now()->subSeconds(15))) {
            return ['in_app' => false, 'email_queued' => false, 'skipped' => true];
        }

        $remarksText = $this->normalizeRemarks($remarks, $loan);
        if ($remarksText === null || $remarksText === '') {
            return ['in_app' => false, 'email_queued' => false, 'skipped' => true];
        }

        $requested = $this->requestedAmount($loan);
        $approved = $this->approvedAmount($loan);
        $dedupeKey = 'loan_evaluation:'.$loan->id.':'.substr(md5($remarksText), 0, 12).':'.now()->format('Ymd');

        $inApp = $this->sendInApp(
            $borrower,
            NotificationCenter::CATEGORY_LOAN_EVALUATION_UPDATED,
            'loan_evaluation_updated',
            'Loan evaluation updated',
            'Your loan application evaluation has been updated. '.$remarksText,
            [
                'loan_id' => $loan->id,
                'loan_application_id' => $loan->loanApplication?->id,
                'requested_amount' => $requested,
                'approved_amount' => $approved,
                'actor_name' => $actor->name,
            ],
            $dedupeKey,
        );

        $emailQueued = $this->queueEmail(
            $loan,
            'evaluation_updated',
            $dedupeKey,
            $requested,
            $approved,
            null,
            $this->statusLabel($loan),
            $remarksText,
            null,
            $inApp?->id,
        );

        return ['in_app' => $inApp !== null, 'email_queued' => $emailQueued, 'skipped' => false];
    }

    /**
     * @return array{in_app: bool, email_queued: bool}
     */
    public function notifyStatusChanged(Loan $loan, User $actor, string $statusLabel, ?string $remarks = null, bool $queueEmail = false): array
    {
        $loan->loadMissing(['borrower', 'loanApplication']);
        $borrower = $loan->borrower;
        if (! $borrower) {
            return ['in_app' => false, 'email_queued' => false];
        }

        $requested = $this->requestedAmount($loan);
        $approved = $this->approvedAmount($loan);
        $remarksText = $this->normalizeRemarks($remarks, $loan);
        $dedupeKey = 'loan_status:'.$loan->id.':'.strtolower(preg_replace('/\s+/', '_', $statusLabel) ?: 'status').':'.now()->format('YmdHi');

        $body = 'Current status: '.$statusLabel.'.';
        if ($approved !== null) {
            $body .= ' Approved amount: ₱'.number_format($approved, 2).'.';
        }

        $inApp = $this->sendInApp(
            $borrower,
            NotificationCenter::CATEGORY_LOAN_STATUS_UPDATED,
            'loan_status_updated',
            'Loan status update',
            $body,
            [
                'loan_id' => $loan->id,
                'loan_application_id' => $loan->loanApplication?->id,
                'status_label' => $statusLabel,
                'requested_amount' => $requested,
                'approved_amount' => $approved,
                'actor_name' => $actor->name,
            ],
            $dedupeKey,
        );

        $emailQueued = false;
        if ($queueEmail) {
            $emailQueued = $this->queueEmail(
                $loan,
                'status_updated',
                $dedupeKey,
                $requested,
                $approved,
                null,
                $statusLabel,
                $remarksText,
                null,
                $inApp?->id,
            );
        }

        return ['in_app' => $inApp !== null, 'email_queued' => $emailQueued];
    }

    /**
     * @return array{in_app: bool, email_queued: bool}
     */
    public function notifyDocumentResubmissionRequired(Loan $loan, User $actor, string $documentLabel, ?string $notes = null): array
    {
        $loan->loadMissing(['borrower', 'loanApplication']);
        $borrower = $loan->borrower;
        if (! $borrower) {
            return ['in_app' => false, 'email_queued' => false];
        }

        $dedupeKey = 'loan_docs_requested:'.$loan->id.':'.substr(md5($documentLabel), 0, 10).':'.now()->format('YmdHi');
        $remarks = $notes !== null && trim($notes) !== '' ? trim($notes) : 'Please upload a clearer copy of the requested document.';

        $inApp = $this->sendInApp(
            $borrower,
            NotificationCenter::CATEGORY_MISSING_DOCUMENTS,
            'documents_requested',
            'Additional documents requested',
            $documentLabel.' — '.$remarks,
            [
                'loan_id' => $loan->id,
                'loan_application_id' => $loan->loanApplication?->id,
                'document_label' => $documentLabel,
                'actor_name' => $actor->name,
            ],
            $dedupeKey,
        );

        $emailQueued = $this->queueEmail(
            $loan,
            'documents_requested',
            $dedupeKey,
            $this->requestedAmount($loan),
            $this->approvedAmount($loan),
            null,
            $this->statusLabel($loan),
            $remarks,
            $documentLabel,
            $inApp?->id,
        );

        return ['in_app' => $inApp !== null, 'email_queued' => $emailQueued];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function sendInApp(
        User $borrower,
        string $category,
        string $type,
        string $title,
        string $body,
        array $data,
        string $dedupeKey,
    ): ?BorrowerNotification {
        return $this->notifications->notifyBorrower(
            $borrower,
            $category,
            $type,
            $title,
            $body,
            $data,
            [
                'dedupe_key' => $dedupeKey,
                'module' => NotificationCenter::MODULE_LOANS,
                'delivery_channels' => ['in_app'],
            ],
        );
    }

    private function queueEmail(
        Loan $loan,
        string $eventType,
        string $dedupeKey,
        ?float $requested,
        ?float $approved,
        ?float $previousApproved,
        ?string $statusLabel,
        ?string $remarks,
        ?string $documentLabel,
        ?int $borrowerNotificationId,
    ): bool {
        EmailLog::query()->updateOrCreate(
            ['dedupe_key' => $dedupeKey],
            [
                'loan_id' => $loan->id,
                'notification_type' => EmailLog::NOTIFICATION_LOAN_APPLICATION_UPDATE,
                'mailable_class' => \App\Mail\LoanApplicationUpdateMail::class,
                'recipient_email' => $loan->borrower?->email ?? 'pending@invalid.local',
                'recipient_name' => $loan->borrower?->name,
                'status' => EmailLog::STATUS_QUEUED,
                'meta' => ['event_type' => $eventType, 'borrower_notification_id' => $borrowerNotificationId],
            ]
        );

        DeferredDispatch::run(new SendBorrowerLoanApplicationUpdateJob(
            $loan->id,
            $eventType,
            $dedupeKey,
            $requested,
            $approved,
            $previousApproved,
            $statusLabel,
            $remarks,
            $documentLabel,
            $borrowerNotificationId,
        ));

        return true;
    }

    private function requestedAmount(Loan $loan): ?float
    {
        if ($loan->requested_principal !== null) {
            return round((float) $loan->requested_principal, 2);
        }
        if ($loan->loanApplication?->loan_amount !== null) {
            return round((float) $loan->loanApplication->loan_amount, 2);
        }

        return null;
    }

    private function approvedAmount(Loan $loan): ?float
    {
        $val = $loan->approved_principal ?? $loan->loanApplication?->approved_amount ?? $loan->principal;

        return $val !== null ? round((float) $val, 2) : null;
    }

    private function normalizeRemarks(?string $remarks, Loan $loan): ?string
    {
        $text = trim((string) ($remarks ?? $loan->approval_notes ?? ''));

        return $text !== '' ? $text : null;
    }

    private function formatAmountBody(?float $requested, float $approved, float $previous): string
    {
        $parts = [];
        if ($requested !== null && $requested > 0) {
            $parts[] = 'Your requested loan amount of ₱'.number_format($requested, 2).' has been evaluated.';
        } else {
            $parts[] = 'Your loan application has been evaluated.';
        }
        if ($previous > 0 && abs($previous - $approved) >= 0.01) {
            $parts[] = 'Approved amount changed from ₱'.number_format($previous, 2).' to ₱'.number_format($approved, 2).'.';
        } else {
            $parts[] = 'Approved amount: ₱'.number_format($approved, 2).'.';
        }
        $parts[] = 'Tap to view details.';

        return implode(' ', $parts);
    }

    private function statusLabel(Loan $loan): string
    {
        $status = (string) ($loan->loanApplication?->status ?? $loan->status);

        return match ($status) {
            LoanApplication::STATUS_FOR_EVALUATION, 'for-evaluation' => 'For Evaluation',
            LoanApplication::STATUS_UNDER_REVIEW, 'under-review' => 'Under Review',
            LoanApplication::STATUS_PARTIALLY_APPROVED, 'partially-approved', 'pre-approved' => 'Partially Approved',
            LoanApplication::STATUS_APPROVED, Loan::STATUS_RELEASED, 'ongoing', 'released' => 'Approved',
            LoanApplication::STATUS_REJECTED, Loan::STATUS_REJECTED => 'Rejected',
            LoanApplication::STATUS_PENDING_DOCUMENTS, 'pending-documents' => 'Pending Documents',
            default => ucwords(str_replace(['_', '-'], ' ', $status)),
        };
    }
}
