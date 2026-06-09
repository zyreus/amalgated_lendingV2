<?php

namespace App\Services;

use App\Mail\SoaStatementMail;
use App\Models\EmailLog;
use App\Models\SoaLog;
use App\Models\SoaStatement;
use Illuminate\Support\Facades\Storage;

class EmailNotificationService
{
    public function __construct(
        private readonly TransactionalMailSender $sender,
        private readonly PDFGenerationService $pdfs,
    ) {}

    public function sendSoa(SoaStatement $statement, ?int $createdBy = null): array
    {
        $statement->loadMissing(['borrower', 'loan']);
        $borrower = $statement->borrower;
        $email = trim((string) ($borrower?->email ?? ''));
        $dedupeKey = 'soa_statement:'.$statement->id.':'.$statement->statement_month?->format('Y-m');
        $subject = 'Monthly Statement of Account - '.$statement->statement_month?->format('F Y').' - '.config('app.name', 'Amalgated Lending Inc.');

        $log = EmailLog::query()->updateOrCreate(
            ['dedupe_key' => $dedupeKey],
            [
                'loan_id' => $statement->loan_id,
                'soa_id' => $statement->id,
                'notification_type' => EmailLog::NOTIFICATION_SOA_STATEMENT,
                'mailable_class' => SoaStatementMail::class,
                'recipient_email' => $email !== '' ? $email : 'invalid@invalid.local',
                'recipient_name' => $borrower?->name,
                'subject' => $subject,
                'status' => EmailLog::STATUS_QUEUED,
                'meta' => ['statement_month' => $statement->statement_month?->toDateString()],
            ]
        );

        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $log->update(['status' => EmailLog::STATUS_FAILED, 'transport_detail' => 'invalid_recipient', 'error_message' => 'Missing or invalid borrower email.']);

            return ['ok' => false, 'detail' => 'invalid_recipient'];
        }

        $path = $this->pdfs->ensureSoaPdf($statement);
        $absolutePath = Storage::disk('public')->path($path);
        $result = $this->sender->sendHtmlMailable(
            new SoaStatementMail($statement),
            $email,
            (string) ($borrower?->name ?: $email),
            $subject,
            ['soa_id' => $statement->id, 'loan_id' => $statement->loan_id],
            [['name' => 'Statement-of-Account-'.$statement->statement_month?->format('Y-m').'.pdf', 'path' => $absolutePath]]
        );

        if ($result['ok'] ?? false) {
            $statement->forceFill(['email_sent' => true, 'email_sent_at' => now(), 'status' => SoaStatement::STATUS_SENT])->save();
            $log->update(['status' => EmailLog::STATUS_SENT, 'transport_detail' => $result['detail'] ?? null, 'sent_at' => now(), 'error_message' => null]);
            SoaLog::query()->create(['soa_id' => $statement->id, 'action' => 'email_sent', 'description' => 'SOA email sent to borrower.', 'created_by' => $createdBy]);
        } else {
            $log->update(['status' => EmailLog::STATUS_FAILED, 'transport_detail' => $result['detail'] ?? null, 'error_message' => $result['detail'] ?? 'send_failed']);
            SoaLog::query()->create(['soa_id' => $statement->id, 'action' => 'email_failed', 'description' => 'SOA email failed: '.($result['detail'] ?? 'send_failed'), 'created_by' => $createdBy]);
        }

        return $result;
    }
}
