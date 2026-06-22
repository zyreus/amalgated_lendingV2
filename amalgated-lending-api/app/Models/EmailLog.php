<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmailLog extends Model
{
    public const STATUS_QUEUED = 'queued';

    public const STATUS_SENT = 'sent';

    public const STATUS_FAILED = 'failed';

    public const STATUS_SKIPPED_DUPLICATE = 'skipped_duplicate';

    public const NOTIFICATION_LOAN_DECISION = 'loan_decision';

    public const NOTIFICATION_LOAN_PRE_APPROVED = 'loan_pre_approved';

    public const NOTIFICATION_PAYMENT_RECEIPT = 'payment_receipt';

    public const NOTIFICATION_SOA_STATEMENT = 'soa_statement';

    public const NOTIFICATION_PUBLIC_ACK = 'public_ack';

    public const NOTIFICATION_STAFF_ALERT = 'staff_alert';

    public const NOTIFICATION_PAYMENT_REMINDER = 'payment_reminder';

    public const NOTIFICATION_PAYMENT_OVERDUE = 'payment_overdue';

    public const NOTIFICATION_BORROWER_OTP = 'borrower_otp';

    public const NOTIFICATION_BORROWER_VERIFY = 'borrower_verify_email';

    public const NOTIFICATION_PASSWORD_RESET = 'password_reset';

    public const NOTIFICATION_REGISTRATION = 'registration_welcome';

    public const NOTIFICATION_NEWSLETTER_UPDATE = 'newsletter_update';

    protected $fillable = [
        'dedupe_key',
        'loan_id',
        'payment_id',
        'soa_id',
        'notification_type',
        'mailable_class',
        'recipient_email',
        'recipient_name',
        'subject',
        'status',
        'transport_detail',
        'error_message',
        'meta',
        'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'sent_at' => 'datetime',
        ];
    }

    public function loan(): BelongsTo
    {
        return $this->belongsTo(Loan::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function soaStatement(): BelongsTo
    {
        return $this->belongsTo(SoaStatement::class, 'soa_id');
    }
}
