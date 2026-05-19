<?php

namespace App\Services;

use App\Mail\AdminStaffAlertMail;
use App\Mail\BorrowerOtpMail;
use App\Mail\PaymentReminderMail;
use App\Mail\PublicFormAcknowledgementMail;
use App\Models\EmailLog;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Central orchestration for transactional emails with deduplication and email_logs.
 */
class EmailAutomationService
{
    public function __construct(
        private readonly EmailSettingsService $settings,
        private readonly TransactionalMailSender $sender,
    ) {}

    /**
     * @param  array<string, mixed>  $failureMeta
     * @return array{ok: bool, detail: ?string}
     */
    public function sendMailable(
        Mailable $mailable,
        string $toEmail,
        string $toName,
        string $subject,
        string $dedupeKey,
        string $notificationType,
        array $failureMeta = [],
        ?int $loanId = null,
        ?int $paymentId = null,
    ): array {
        if (! $this->settings->maySendTransactional()) {
            return ['ok' => false, 'detail' => 'email_disabled'];
        }

        $trimmed = trim($toEmail);
        if ($trimmed === '' || ! filter_var($trimmed, FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'detail' => 'invalid_recipient'];
        }

        if (EmailLog::query()->where('dedupe_key', $dedupeKey)->where('status', EmailLog::STATUS_SENT)->exists()) {
            return ['ok' => true, 'detail' => 'duplicate'];
        }

        EmailLog::query()->updateOrCreate(
            ['dedupe_key' => $dedupeKey],
            [
                'loan_id' => $loanId,
                'payment_id' => $paymentId,
                'notification_type' => $notificationType,
                'mailable_class' => $mailable::class,
                'recipient_email' => $trimmed,
                'recipient_name' => $toName !== '' ? $toName : null,
                'subject' => $subject,
                'status' => EmailLog::STATUS_QUEUED,
                'meta' => $failureMeta,
            ]
        );

        $result = $this->sender->sendHtmlMailable($mailable, $trimmed, $toName, $subject, array_merge($failureMeta, [
            'dedupe_key' => $dedupeKey,
            'notification_type' => $notificationType,
        ]));

        $ok = (bool) ($result['ok'] ?? false);
        $detail = (string) ($result['detail'] ?? '');

        EmailLog::query()->where('dedupe_key', $dedupeKey)->update([
            'status' => $ok ? EmailLog::STATUS_SENT : EmailLog::STATUS_FAILED,
            'transport_detail' => $detail !== '' ? $detail : null,
            'error_message' => $ok ? null : ($detail !== '' ? $detail : 'send_failed'),
            'sent_at' => $ok ? now() : null,
        ]);

        return $result;
    }

    /**
     * @param  array<string, mixed>  $context
     */
    public function sendPublicAcknowledgement(
        string $recipientEmail,
        string $recipientName,
        string $formType,
        string $summaryLine,
        array $context = [],
    ): void {
        if (! config('mail_automation.public_ack_enabled', true)) {
            return;
        }

        $dedupeKey = 'public_ack:'.md5(mb_strtolower($recipientEmail).'|'.$formType.'|'.($context['reference_id'] ?? now()->format('Y-m-d-H')));
        if (Cache::has('email_sent:'.$dedupeKey)) {
            return;
        }

        $subject = match ($formType) {
            'newsletter' => 'Welcome — you\'re subscribed — '.config('app.name'),
            'loan_inquiry' => 'We received your loan inquiry — '.config('app.name'),
            default => 'Thank you for contacting us — '.config('app.name'),
        };

        $mailable = new PublicFormAcknowledgementMail($recipientName, $formType, $summaryLine, $context);
        $send = $this->sendMailable(
            $mailable,
            $recipientEmail,
            $recipientName,
            $subject,
            $dedupeKey,
            EmailLog::NOTIFICATION_PUBLIC_ACK,
            ['form_type' => $formType],
        );

        if ($send['ok'] ?? false) {
            Cache::put('email_sent:'.$dedupeKey, true, now()->addHours(24));
        }
    }

    public function sendBorrowerOtp(User $user, string $code, int $expiresMinutes): array
    {
        if (! config('mail_automation.otp_enabled', true)) {
            return ['ok' => false, 'detail' => 'otp_disabled'];
        }

        $email = trim((string) $user->email);
        $dedupeKey = 'borrower_otp:'.$user->id.':'.now()->format('Y-m-d-H-i');
        $subject = 'Your sign-in code — '.config('app.name');

        if (! $this->settings->maySendTransactional()) {
            return $this->sender->sendCriticalMailable(
                new BorrowerOtpMail((string) $user->name, $code, $expiresMinutes),
                $email,
                (string) $user->name,
                $subject,
                ['user_id' => $user->id, 'dedupe_key' => $dedupeKey],
            );
        }

        return $this->sendMailable(
            new BorrowerOtpMail((string) $user->name, $code, $expiresMinutes),
            $email,
            (string) $user->name,
            $subject,
            $dedupeKey,
            EmailLog::NOTIFICATION_BORROWER_OTP,
            ['user_id' => $user->id],
        );
    }

    public function sendPaymentReminderEmail(Payment $payment, User $borrower, string $variant, int $daysOffset): array
    {
        $payment->loadMissing('loan');
        $loanRef = $payment->loan
            ? 'AL-'.str_pad((string) $payment->loan_id, 7, '0', STR_PAD_LEFT)
            : 'Loan #'.$payment->loan_id;

        $dedupeKey = 'payment_reminder:'.$payment->id.':'.$variant.':'.now()->toDateString();
        $subject = $variant === 'overdue'
            ? 'Overdue payment notice — '.$loanRef.' — '.config('app.name')
            : 'Payment reminder — '.$loanRef.' — '.config('app.name');

        return $this->sendMailable(
            new PaymentReminderMail($payment, $borrower, $variant, $daysOffset, $loanRef),
            (string) $borrower->email,
            (string) $borrower->name,
            $subject,
            $dedupeKey,
            $variant === 'overdue' ? EmailLog::NOTIFICATION_PAYMENT_OVERDUE : EmailLog::NOTIFICATION_PAYMENT_REMINDER,
            ['payment_id' => $payment->id, 'variant' => $variant],
            $payment->loan_id,
            $payment->id,
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function sendStaffAlert(
        string $recipientEmail,
        string $recipientName,
        string $title,
        ?string $body,
        string $category,
        string $adminPath,
        array $data = [],
        string $dedupeKey,
    ): array {
        if (! config('mail_automation.staff_email_enabled', true)) {
            return ['ok' => false, 'detail' => 'staff_email_disabled'];
        }

        $subject = '[Admin] '.$title.' — '.config('app.name');
        $actionUrl = $this->settings->adminUrl($adminPath);

        return $this->sendMailable(
            new AdminStaffAlertMail($title, $body, $category, $actionUrl, $data),
            $recipientEmail,
            $recipientName,
            $subject,
            $dedupeKey,
            EmailLog::NOTIFICATION_STAFF_ALERT,
            ['category' => $category],
        );
    }
}
