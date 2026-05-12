<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentReceiptAudit extends Model
{
    public const ACTION_ENCODED = 'receipt_encoded';

    public const ACTION_UPDATED = 'receipt_updated';

    public const ACTION_VERIFIED = 'payment_verified';

    public const ACTION_APPROVED_PAID = 'approved_paid';

    public const ACTION_DUPLICATE_ATTEMPT = 'duplicate_receipt_attempt';

    public const ACTION_OVERRIDE_UPDATE = 'override_locked_update';

    public const ACTION_REVERT_DENIED = 'revert_paid_denied';

    protected $fillable = [
        'payment_id',
        'user_id',
        'action',
        'official_receipt_number',
        'acknowledgement_receipt_number',
        'meta',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
