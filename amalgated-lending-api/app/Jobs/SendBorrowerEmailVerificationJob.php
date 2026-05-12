<?php

namespace App\Jobs;

use App\Mail\BorrowerVerifyEmailMail;
use App\Models\EmailVerificationLog;
use App\Models\User;
use App\Services\TransactionalMailSender;
use App\Support\BorrowerVerificationUrl;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class SendBorrowerEmailVerificationJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    /** @var array<int, int> */
    public $backoff = [20, 60, 180];

    public function __construct(public int $userId)
    {
        $this->onQueue('notifications');
    }

    public function handle(TransactionalMailSender $sender): void
    {
        if (Cache::get('borrower_verify_email_recent:'.$this->userId)) {
            return;
        }

        $user = User::query()->find($this->userId);
        if (! $user || $user->role !== 'borrower' || $user->email_verified_at) {
            return;
        }

        $email = trim((string) $user->email);
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $link = BorrowerVerificationUrl::signedVerifyUrl($user);
        $mailable = new BorrowerVerifyEmailMail($user, $link);
        $subject = 'Verify your email — '.config('app.name', 'Amalgated Lending Inc.');

        $result = $sender->sendHtmlMailable($mailable, $email, (string) $user->name, $subject, [
            'job' => __CLASS__,
            'user_id' => $user->id,
            'purpose' => 'borrower_verify_email',
        ]);

        Cache::put('borrower_verify_email_recent:'.$this->userId, true, now()->addSeconds((int) config('services.borrower_verify.resend_cooldown_seconds', 120)));

        try {
            EmailVerificationLog::query()->create([
                'user_id' => $user->id,
                'event' => $result['ok'] ? 'sent' : 'failed',
                'ip_address' => null,
                'detail' => $result['detail'] ?? null,
            ]);
        } catch (\Throwable $e) {
            Log::debug('Email verification log save failed.', ['error' => $e->getMessage()]);
        }
    }

    public function failed(?\Throwable $e): void
    {
        try {
            EmailVerificationLog::query()->create([
                'user_id' => $this->userId,
                'event' => 'failed_job',
                'detail' => $e ? mb_substr($e->getMessage(), 0, 500) : 'unknown',
            ]);
        } catch (\Throwable) {
            /* ignore */
        }
    }
}
