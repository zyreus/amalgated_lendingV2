<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Immutable audit row for admin changes to scheduled installment amounts (final payment only).
 */
class PaymentAdjustmentAudit extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'payment_id',
        'loan_id',
        'previous_amount_due',
        'new_amount_due',
        'admin_user_id',
        'reason',
        'created_at',
    ];

    protected $casts = [
        'previous_amount_due' => 'decimal:2',
        'new_amount_due' => 'decimal:2',
        'created_at' => 'datetime',
    ];

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function loan(): BelongsTo
    {
        return $this->belongsTo(Loan::class);
    }

    public function adminUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_user_id');
    }
}
