<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class CareerApplication extends Model
{
    public const STATUS_NEW = 'new';

    public const STATUS_UNDER_REVIEW = 'under_review';

    public const STATUS_INTERVIEW_SCHEDULED = 'interview_scheduled';

    public const STATUS_PASSED = 'passed';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_HIRED = 'hired';

    protected $table = 'careers_applications';

    protected $fillable = [
        'careers_job_id',
        'careers_applicant_id',
        'cover_letter',
        'resume_disk',
        'resume_path',
        'resume_original_name',
        'status',
        'applied_at',
        'recruiter_id',
        'internal_notes',
        'interview_feedback',
        'send_automated_emails',
    ];

    protected $casts = [
        'applied_at' => 'datetime',
        'send_automated_emails' => 'boolean',
    ];

    public function job(): BelongsTo
    {
        return $this->belongsTo(CareerJob::class, 'careers_job_id');
    }

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(CareerApplicant::class, 'careers_applicant_id');
    }

    public function recruiter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recruiter_id');
    }

    public function interviews(): HasMany
    {
        return $this->hasMany(CareerInterview::class, 'careers_application_id')->orderBy('scheduled_at');
    }

    public function emailLogs(): MorphMany
    {
        return $this->morphMany(CareersEmailLog::class, 'related');
    }

    public static function statusLabels(): array
    {
        return [
            self::STATUS_NEW => 'New',
            self::STATUS_UNDER_REVIEW => 'Under review',
            self::STATUS_INTERVIEW_SCHEDULED => 'Interview scheduled',
            self::STATUS_PASSED => 'Passed',
            self::STATUS_REJECTED => 'Rejected',
            self::STATUS_HIRED => 'Hired',
        ];
    }
}
