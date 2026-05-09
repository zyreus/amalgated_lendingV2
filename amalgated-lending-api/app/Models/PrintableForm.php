<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PrintableForm extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    protected $fillable = [
        'form_key',
        'title',
        'category',
        'branch',
        'description',
        'template_file',
        'pdf_version',
        'status',
        'watermark_enabled',
        'sort_order',
        'created_by',
    ];

    protected $casts = [
        'watermark_enabled' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(PrintableFormLog::class);
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function bladeView(): string
    {
        return match ($this->form_key) {
            'main_loan_application', 'loan_application_form' => 'pdf.forms.main_loan_application',
            'co_maker_statement', 'payment_receipt_invoice' => 'pdf.forms.co_maker_statement',
            'credit_verification', 'statement_of_account' => 'pdf.forms.credit_verification',
            'branch_application', 'borrower_information_summary' => 'pdf.forms.branch_application',
            default => 'pdf.forms.main_loan_application',
        };
    }
}
