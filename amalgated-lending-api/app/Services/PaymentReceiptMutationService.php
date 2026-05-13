<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\PaymentReceiptAudit;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Central OR/AR mutation, uniqueness, audit, and issuance stamping for admin API + Filament.
 */
final class PaymentReceiptMutationService
{
    public function __construct(
        private PaymentReceiptComplianceService $compliance,
        private PaymentReceiptStatusManager $statusManager,
    ) {}

    /**
     * @param  array<string, mixed>  $data  Keys may include official_receipt_number, acknowledgement_receipt_number, notes.
     *
     * @throws ValidationException
     */
    public function updateReceiptsFromStaff(
        Payment $payment,
        User $user,
        array $data,
        string $auditContext,
        bool $requireAtLeastOneReceiptField = true,
        bool $allowClearingReceiptFields = false,
    ): Payment {
        return DB::transaction(function () use ($payment, $user, $data, $auditContext, $requireAtLeastOneReceiptField, $allowClearingReceiptFields): Payment {
            $p = Payment::query()->whereKey($payment->getKey())->lockForUpdate()->firstOrFail();
            $origOr = trim((string) ($p->official_receipt_number ?? ''));
            $origAr = trim((string) ($p->acknowledgement_receipt_number ?? ''));
            $prevCoverage = $this->statusManager->documentCoverageLabel($p);

            if ($p->isPaid() && ! $this->canOverrideLocked($user)) {
                throw ValidationException::withMessages([
                    'payment' => ['This payment is locked after approval. Receipt numbers cannot be changed without override permission.'],
                ]);
            }

            foreach (['official_receipt_number', 'acknowledgement_receipt_number'] as $field) {
                if (! array_key_exists($field, $data)) {
                    continue;
                }
                $raw = $data[$field];
                if ($raw === null || trim((string) $raw) === '') {
                    if ($allowClearingReceiptFields) {
                        $p->{$field} = null;
                    }

                    continue;
                }
                $normalized = $this->compliance->normalize((string) $raw);
                if ($field === 'official_receipt_number') {
                    $this->compliance->assertUniqueOfficialReceipt($normalized, (int) $p->id);
                    $p->official_receipt_number = $normalized;
                } else {
                    $this->compliance->assertUniqueAcknowledgementReceipt($normalized, (int) $p->id);
                    $p->acknowledgement_receipt_number = $normalized;
                }
            }

            $this->compliance->validateReceiptFormat(
                $this->compliance->normalize($p->official_receipt_number),
                $this->compliance->normalize($p->acknowledgement_receipt_number),
                false
            );

            $normOr = $this->compliance->normalize($p->official_receipt_number);
            $normAr = $this->compliance->normalize($p->acknowledgement_receipt_number);
            if ($requireAtLeastOneReceiptField && $normOr === null && $normAr === null) {
                throw ValidationException::withMessages([
                    'official_receipt_number' => ['Provide at least an OR number or an AR number.'],
                ]);
            }

            $this->stampFirstIssuanceIfNeeded(
                $p,
                $user,
                $origOr,
                $origAr,
                trim((string) ($p->official_receipt_number ?? '')),
                trim((string) ($p->acknowledgement_receipt_number ?? ''))
            );

            if (array_key_exists('notes', $data) && $data['notes'] !== null) {
                $p->notes = (string) $data['notes'];
            }

            $p->recorded_by = $user->id;
            $p->save();

            $newCoverage = $this->statusManager->documentCoverageLabel($p);
            $loggedPartial = false;
            if ($prevCoverage === 'none' && in_array($newCoverage, ['or_only', 'ar_only'], true)) {
                $this->logAudit(
                    $p,
                    $user,
                    PaymentReceiptAudit::ACTION_PARTIAL_RECEIPT_ISSUED,
                    trim((string) ($p->official_receipt_number ?? '')),
                    trim((string) ($p->acknowledgement_receipt_number ?? '')),
                    ['context' => $auditContext, 'coverage' => $newCoverage]
                );
                $loggedPartial = true;
            }

            if (! $loggedPartial && (
                trim((string) ($p->official_receipt_number ?? '')) !== $origOr
                || trim((string) ($p->acknowledgement_receipt_number ?? '')) !== $origAr
            )) {
                $this->logAudit(
                    $p,
                    $user,
                    $p->isPaid() ? PaymentReceiptAudit::ACTION_OVERRIDE_UPDATE : PaymentReceiptAudit::ACTION_UPDATED,
                    trim((string) ($p->official_receipt_number ?? '')),
                    trim((string) ($p->acknowledgement_receipt_number ?? '')),
                    ['context' => $auditContext]
                );
            }

            return $p->fresh() ?? $p;
        });
    }

    private function canOverrideLocked(User $user): bool
    {
        return $user->hasPermission('payments.override_locked') || $user->hasPermission('roles.manage');
    }

    private function stampFirstIssuanceIfNeeded(
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
            $p->receipt_issued_role = $this->staffRoleLabel($user);
            $p->receipt_issued_at = now();
        }
    }

    private function staffRoleLabel(User $user): string
    {
        $primary = strtolower((string) ($user->role ?? ''));

        return $primary !== '' ? $primary : $user->derivePrimaryRoleFromRoles();
    }

    private function logAudit(
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
            'user_agent' => substr((string) request()?->userAgent(), 0, 512),
        ]);
    }

    private function requestIp(): ?string
    {
        try {
            return request()?->ip();
        } catch (\Throwable) {
            return null;
        }
    }
}
