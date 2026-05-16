<?php

namespace App\Models;

use App\Jobs\SendBorrowerEmailVerificationJob;
use App\Services\BrevoMailService;
use Illuminate\Auth\MustVerifyEmail as MustVerifyEmailTrait;
use Illuminate\Auth\Notifications\ResetPassword as ResetPasswordNotification;
use Illuminate\Auth\Passwords\CanResetPassword;
use Illuminate\Contracts\Auth\MustVerifyEmail as MustVerifyEmailContract;
use Illuminate\Contracts\Auth\CanResetPassword as CanResetPasswordContract;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use PHPOpenSourceSaver\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements CanResetPasswordContract, JWTSubject, MustVerifyEmailContract
{
    use MustVerifyEmailTrait;
    use CanResetPassword;
    use HasFactory;
    use Notifiable;

    protected $fillable = [
        'name',
        'username',
        'email',
        'password',
        'phone',
        'is_active',
        'role',
        'credit_score',
        'risk_level',
        'id_document_path',
        'id_document_name',
        'profile_photo_path',
        'profile_photo_name',
        'timezone',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'is_active' => 'boolean',
        'credit_score' => 'decimal:2',
    ];

    public function getJWTIdentifier(): mixed
    {
        return $this->getKey();
    }

    public function getJWTCustomClaims(): array
    {
        return [];
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_user');
    }

    public function loans(): HasMany
    {
        return $this->hasMany(Loan::class, 'borrower_id');
    }

    public function creditWellness(): HasOne
    {
        return $this->hasOne(BorrowerCreditWellness::class, 'borrower_id');
    }

    public function loanApplications(): HasMany
    {
        return $this->hasMany(LoanApplication::class, 'user_id');
    }

    public function documentLoanApplications(): HasMany
    {
        return $this->hasMany(DocumentLoanApplication::class, 'user_id');
    }

    public function coMakerLoanApplications(): HasMany
    {
        return $this->hasMany(LoanApplication::class, 'co_maker_id');
    }

    public function livenessVerifications(): HasMany
    {
        return $this->hasMany(LivenessVerification::class, 'borrower_id');
    }

    public function faceVerifications(): HasMany
    {
        return $this->hasMany(FaceVerification::class, 'borrower_id');
    }

    public function borrowerProfile(): HasOne
    {
        return $this->hasOne(BorrowerProfile::class);
    }

    /**
     * Borrower portal login + forgot-password: same idea as BorrowerController (role column, RBAC
     * borrower slug, or at least one loan as borrower — applicants matched to a user without pivot).
     */
    public function canUseBorrowerPortal(): bool
    {
        if (($this->role ?? '') === 'borrower') {
            return true;
        }
        $this->loadMissing('roles');
        if ($this->roles->contains(fn ($r) => strtolower((string) ($r->slug ?? '')) === 'borrower')) {
            return true;
        }
        if ($this->loans()->exists()) {
            return true;
        }
        if (! $this->canAccessAdminPortal() && $this->derivePrimaryRoleFromRoles() === 'borrower') {
            return true;
        }

        return false;
    }

    /**
     * Prefer Brevo REST when BREVO_API_KEY is set (same as loan emails); otherwise Laravel mail/SMTP.
     */
    public function sendPasswordResetNotification($token): void
    {
        $brevo = app(BrevoMailService::class);
        if ($brevo->isConfigured()) {
            try {
                $base = rtrim((string) config('app.frontend_url', 'http://localhost:5173'), '/');
                $email = $this->getEmailForPasswordReset();
                $url = $base.'/reset-password?token='.urlencode($token).'&email='.urlencode($email);
                $name = trim((string) ($this->name ?? ''));
                $appName = (string) config('app.name', 'Amalgated Lending Inc.');
                $greeting = $name !== '' ? 'Hi '.$name : 'Hello';
                $html = '<p>'.e($greeting).',</p>'
                    .'<p>We received a request to reset your password for your '.e($appName).' borrower account.</p>'
                    .'<p><a href="'.e($url).'">Reset your password</a></p>'
                    .'<p>This link expires in 60 minutes. If you did not request a reset, you can ignore this email.</p>';

                $brevo->sendHtml($email, $name !== '' ? $name : null, 'Reset your password — '.$appName, $html);

                return;
            } catch (\Throwable $e) {
                report($e);
            }
        }

        $this->notify(new ResetPasswordNotification($token));
    }

    /**
     * Dynamic permission check — all data from DB (roles + permission_role).
     */
    public function hasPermission(string $slug): bool
    {
        return $this->roles()->whereHas('permissions', function ($q) use ($slug) {
            $q->where('permissions.slug', $slug);
        })->exists();
    }

    public function allPermissionSlugs(): array
    {
        return $this->roles()
            ->with('permissions')
            ->get()
            ->pluck('permissions')
            ->flatten()
            ->unique('id')
            ->pluck('slug')
            ->values()
            ->all();
    }

    /** Primary `role` column values that may use the admin portal (matches frontend + AuthController). */
    private const ADMIN_PRIMARY_ROLES = ['admin', 'loan_officer', 'collector', 'accountant'];

    /** Role slugs that may use the admin portal (RBAC). */
    private const ADMIN_ROLE_SLUGS = ['super-admin', 'admin-staff', 'loan-officer', 'collector', 'accountant'];

    public function canAccessAdminPortal(): bool
    {
        $primary = (string) ($this->role ?? '');
        if ($primary !== '' && in_array($primary, self::ADMIN_PRIMARY_ROLES, true)) {
            return true;
        }

        $this->loadMissing('roles');
        $slugs = $this->roles->pluck('slug')->map(fn ($s) => strtolower((string) $s))->all();

        foreach (self::ADMIN_ROLE_SLUGS as $slug) {
            if (in_array($slug, $slugs, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Same shape as AuthController::userPayload — used by /auth/me and /admin/me.
     */
    public function toAuthPayload(): array
    {
        $this->loadMissing(['roles.permissions']);

        return [
            'id' => $this->id,
            'name' => $this->name,
            'username' => $this->username,
            'email' => $this->email,
            'role' => $this->role ?: $this->derivePrimaryRoleFromRoles(),
            'phone' => $this->phone,
            'timezone' => $this->timezone,
            'is_active' => $this->is_active,
            'roles' => $this->roles->map(fn ($r) => [
                'id' => $r->id,
                'name' => $r->name,
                'slug' => $r->slug,
            ]),
            'permissions' => $this->roles
                ->pluck('permissions')
                ->flatten()
                ->unique('id')
                ->values()
                ->map(fn ($p) => ['slug' => $p->slug, 'name' => $p->name, 'group' => $p->group_name])
                ->all(),
        ];
    }

    public function derivePrimaryRoleFromRoles(): string
    {
        $this->loadMissing('roles');
        $slugs = $this->roles->pluck('slug')->map(fn ($s) => strtolower((string) $s))->all();
        if (in_array('super-admin', $slugs, true) || in_array('admin', $slugs, true) || in_array('admin-staff', $slugs, true)) {
            return 'admin';
        }
        if (in_array('loan-officer', $slugs, true)) {
            return 'loan_officer';
        }
        if (in_array('collector', $slugs, true)) {
            return 'collector';
        }
        if (in_array('accountant', $slugs, true)) {
            return 'accountant';
        }

        return 'borrower';
    }

    /** Queue transactional verification email (JWT API — Laravel's default Mail notification is bypassed). */
    public function sendEmailVerificationNotification(): void
    {
        SendBorrowerEmailVerificationJob::dispatch((int) $this->getKey());
    }
}
