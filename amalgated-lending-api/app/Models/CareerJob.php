<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class CareerJob extends Model
{
    use SoftDeletes;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_CLOSED = 'closed';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'careers_jobs';

    protected $fillable = [
        'department_id',
        'branch_id',
        'title',
        'slug',
        'employment_type',
        'salary_min',
        'salary_max',
        'salary_currency',
        'qualifications',
        'responsibilities',
        'requirements',
        'benefits',
        'application_instructions',
        'status',
        'application_deadline',
        'published_at',
        'seo_title',
        'seo_description',
        'created_by',
    ];

    protected $casts = [
        'application_deadline' => 'date',
        'published_at' => 'datetime',
        'salary_min' => 'decimal:2',
        'salary_max' => 'decimal:2',
    ];

    public function department(): BelongsTo
    {
        return $this->belongsTo(CareerDepartment::class, 'department_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(CareerBranch::class, 'branch_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function applications(): HasMany
    {
        return $this->hasMany(CareerApplication::class, 'careers_job_id');
    }

    public function scopeListedPublic($query)
    {
        return $query->where('status', self::STATUS_PUBLISHED)
            ->whereNotNull('published_at')
            ->where(function ($q) {
                $q->whereNull('application_deadline')
                    ->orWhereDate('application_deadline', '>=', now()->toDateString());
            });
    }

    public function acceptsApplications(): bool
    {
        if ($this->status !== self::STATUS_PUBLISHED || $this->published_at === null) {
            return false;
        }
        if ($this->application_deadline && $this->application_deadline->isPast()) {
            return false;
        }

        return true;
    }
}
