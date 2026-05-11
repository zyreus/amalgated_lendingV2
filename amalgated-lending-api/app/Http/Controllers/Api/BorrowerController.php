<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BorrowerProfile;
use App\Models\LoanApplication;
use App\Models\Role;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\BorrowerUploadedFilesManifest;
use App\Support\SignedPrintUrls;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class BorrowerController extends Controller
{
    /**
     * Resolve optional verification-table presence using the SAME connection as the User model.
     * Uses Schema::connection() so probes match Eloquent queries (avoids mismatches when
     * DB_CONNECTION differs from assumptions or replicas lag). Wrapped in try/catch so transient
     * DB failures return safe defaults instead of breaking Admin > Borrowers.
     *
     * @return array{liveness: bool, face: bool}
     */
    private function verificationTables(): array
    {
        /** @var array<string, array{liveness: bool, face: bool}> */
        static $cached = [];

        $connectionName = (new User)->getConnection()->getName();
        if (isset($cached[$connectionName])) {
            return $cached[$connectionName];
        }

        $result = ['liveness' => false, 'face' => false];

        try {
            $schema = Schema::connection($connectionName);
            $result['liveness'] = $schema->hasTable('liveness_verifications');
            $result['face'] = $schema->hasTable('face_verifications');
        } catch (\Throwable $e) {
            Log::warning('BorrowerController: verification table probe failed', [
                'connection' => $connectionName,
                'error' => $e->getMessage(),
            ]);
        }

        return $cached[$connectionName] = $result;
    }

    /** @param mixed $scheduleJson Model cast may be array; DB may send JSON text or object. */
    private function loanHasNonEmptySchedule(mixed $scheduleJson): bool
    {
        $data = $scheduleJson;
        if (is_string($data)) {
            $decoded = json_decode($data, true);
            $data = is_array($decoded) ? $decoded : [];
        } elseif ($data instanceof \stdClass) {
            $data = (array) $data;
        } elseif ($data instanceof \JsonSerializable) {
            $decoded = $data->jsonSerialize();
            $data = is_array($decoded) ? $decoded : [];
        } elseif (! is_array($data)) {
            $data = [];
        }

        return count($data) > 0;
    }

    /**
     * Remove rows that still block `users` delete on databases without FK CASCADE (restored dumps, manual tables).
     */
    private function purgeBorrowerDeleteBlockers(User $borrower): void
    {
        $tables = $this->verificationTables();
        $connectionName = $borrower->getConnection()->getName();

        foreach (
            [
                'liveness_verifications' => $tables['liveness'],
                'face_verifications' => $tables['face'],
            ] as $table => $present
        ) {
            if (! $present) {
                continue;
            }
            DB::connection($connectionName)->table($table)->where('borrower_id', $borrower->id)->delete();
        }

        LoanApplication::on($connectionName)->where('co_maker_id', $borrower->id)->update(['co_maker_id' => null]);
    }

    /**
     * Generate a strong password of a fixed length.
     * Ensures at least one lowercase, uppercase, digit, and symbol.
     */
    private function generateStrongPassword(int $length = 12): string
    {
        $lower = 'abcdefghijklmnopqrstuvwxyz';
        $upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        $digits = '0123456789';
        $symbols = '!@#$%^&*()-_=+[]{}:,.?';
        $all = $lower.$upper.$digits.$symbols;

        if ($length < 4) {
            throw new \InvalidArgumentException('Password length must be >= 4.');
        }

        $required = [
            $lower[random_int(0, strlen($lower) - 1)],
            $upper[random_int(0, strlen($upper) - 1)],
            $digits[random_int(0, strlen($digits) - 1)],
            $symbols[random_int(0, strlen($symbols) - 1)],
        ];

        $remaining = $length - count($required);
        for ($i = 0; $i < $remaining; $i++) {
            $required[] = $all[random_int(0, strlen($all) - 1)];
        }

        shuffle($required);

        return implode('', $required);
    }

    /**
     * Users with the borrower role — CRM / loan history context.
     */
    public function index(Request $request): JsonResponse
    {
        $tables = $this->verificationTables();
        $hasLivenessTable = $tables['liveness'];
        $hasFaceTable = $tables['face'];
        $withCount = ['loans', 'loanApplications'];
        if ($hasLivenessTable) {
            $withCount[] = 'livenessVerifications';
        }
        if ($hasFaceTable) {
            $withCount[] = 'faceVerifications';
        }

        $q = User::query()
            ->withCount($withCount)
            ->with(['roles']);
        // Admin borrower list should show applicants / actual borrowers only.
        // Co-maker-only accounts stay accessible through the applicant's borrower detail / loan detail.
        // Include users with identity-verification history so portal checks are visible in Admin > Borrowers.
        // Include borrowers even when they have no loan / application history yet.
        $q->where(function ($w) use ($hasLivenessTable, $hasFaceTable) {
            $w->where(function ($h) use ($hasLivenessTable, $hasFaceTable) {
                $h->whereHas('loanApplications')
                    ->orWhereHas('loans');

                if ($hasLivenessTable) {
                    $h->orWhereHas('livenessVerifications');
                }
                if ($hasFaceTable) {
                    $h->orWhereHas('faceVerifications');
                }
            })->orWhere(function ($r) {
                $r->where('role', 'borrower')
                    ->orWhereHas('roles', function ($rq) {
                        $rq->where('slug', 'borrower');
                    });
            });
        });

        if ($search = $request->query('search')) {
            $q->where(function ($w) use ($search) {
                $w->where('name', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%')
                    ->orWhere('phone', 'like', '%'.$search.'%');
            });
        }

        if ($request->filled('risk_level')) {
            $q->where('risk_level', $request->query('risk_level'));
        }

        $perPage = max(1, min(100, (int) $request->query('per_page', 15)));
        $rows = $q->orderByDesc('id')->paginate($perPage);

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    public function show(User $borrower): JsonResponse
    {
        $deny = $this->borrowerCrmAccessDeniedResponse($borrower);
        if ($deny instanceof JsonResponse) {
            return $deny;
        }

        $tables = $this->verificationTables();
        $hasLivenessTable = $tables['liveness'];
        $hasFaceTable = $tables['face'];

        $relations = [
            'borrowerProfile',
            'roles',
            'loans' => function ($q) {
                $q->with([
                    'loanApplication:id,loan_id,loan_type,co_maker_id,co_maker_name,co_maker_email,co_maker_phone',
                    'loanApplication.coMaker:id,name,email',
                ])
                    ->orderByDesc('id')
                    ->limit(50);
            },
        ];
        if ($hasLivenessTable) {
            $relations['livenessVerifications'] = function ($q) {
                $q->orderByDesc('id')->limit(20);
            };
        }
        if ($hasFaceTable) {
            $relations['faceVerifications'] = function ($q) {
                $q->orderByDesc('id')->limit(20);
            };
        }
        $borrower->load($relations);

        $self = $this;
        $borrower->loans->each(static function ($loan) use ($self) {
            $la = $loan->loanApplication;
            $loan->setAttribute(
                'print_application_url',
                $la
                    ? SignedPrintUrls::temporaryRoute(
                        'print.general-loan',
                        now()->addMinutes(45),
                        ['loanApplication' => $la->id]
                    )
                    : null
            );
            $hasSchedule = $self->loanHasNonEmptySchedule($loan->schedule_json);
            $loan->setAttribute(
                'print_statement_url',
                $hasSchedule
                    ? SignedPrintUrls::temporaryRoute(
                        'print.loan-soa',
                        now()->addMinutes(45),
                        ['loan' => $loan->id]
                    )
                    : null
            );
        });

        return response()->json(['ok' => true, 'borrower' => $borrower]);
    }

    /**
     * Unified manifest of borrower uploads (document loans, portal ID, loan KYC, payments) for admin review.
     */
    public function uploadedFiles(User $borrower): JsonResponse
    {
        $deny = $this->borrowerCrmAccessDeniedResponse($borrower);
        if ($deny instanceof JsonResponse) {
            return $deny;
        }

        return response()->json([
            'ok' => true,
            'data' => BorrowerUploadedFilesManifest::build($borrower),
        ]);
    }

    /**
     * @return JsonResponse|null 404 when the user is not eligible for borrower CRM views.
     */
    private function borrowerCrmAccessDeniedResponse(User $borrower): ?JsonResponse
    {
        $tables = $this->verificationTables();
        $hasLivenessTable = $tables['liveness'];
        $hasFaceTable = $tables['face'];

        $hasApplicantHistory = $borrower->loanApplications()->exists();
        $hasLoanAsBorrower = $borrower->loans()->exists();
        $hasLivenessHistory = $hasLivenessTable ? $borrower->livenessVerifications()->exists() : false;
        $hasFaceHistory = $hasFaceTable ? $borrower->faceVerifications()->exists() : false;

        $hasBorrowerRole = ($borrower->role ?? '') === 'borrower'
            || $borrower->roles()->where('slug', 'borrower')->exists();

        if (
            ! $hasApplicantHistory
            && ! $hasLoanAsBorrower
            && ! $hasLivenessHistory
            && ! $hasFaceHistory
            && ! $hasBorrowerRole
        ) {
            return response()->json(['ok' => false, 'message' => 'User is not a borrower.'], 404);
        }

        return null;
    }

    /**
     * Create a new borrower account (admin).
     *
     * Returns the temporary password when one is not provided.
     */
    public function store(Request $request, ActivityLogger $logger): JsonResponse
    {
        // Normalize empty strings to null so validation can treat fields as optional.
        $request->merge([
            'phone_number' => trim((string) ($request->input('phone_number') ?? '')) !== ''
                ? $request->input('phone_number')
                : null,
            'date_of_birth' => trim((string) ($request->input('date_of_birth') ?? '')) !== ''
                ? $request->input('date_of_birth')
                : null,
            'address' => trim((string) ($request->input('address') ?? '')) !== ''
                ? $request->input('address')
                : null,
            'monthly_income' => trim((string) ($request->input('monthly_income') ?? '')) !== ''
                ? $request->input('monthly_income')
                : null,
            'employment_status' => trim((string) ($request->input('employment_status') ?? '')) !== ''
                ? $request->input('employment_status')
                : null,
            'password' => trim((string) ($request->input('password') ?? '')) !== ''
                ? $request->input('password')
                : null,
        ]);

        $allowedEmploymentStatuses = [
            'Employed',
            'Self-Employed',
            'Unemployed',
            'Student',
            'Retired',
            'Other',
        ];

        $data = $request->validate([
            'first_name' => 'required|string|max:128',
            'last_name' => 'required|string|max:128',
            'email' => 'required|email|unique:users,email',
            'phone_number' => 'nullable|string|max:32',
            'date_of_birth' => 'nullable|date',
            'address' => 'nullable|string|max:500',
            'monthly_income' => 'nullable|numeric|min:0',
            'employment_status' => ['nullable', Rule::in($allowedEmploymentStatuses)],
            'password' => 'nullable|string|min:8|max:72',
        ]);

        $temporaryPassword = null;
        $plainPassword = $data['password'] ?? null;
        if (! $plainPassword) {
            $temporaryPassword = $this->generateStrongPassword(12);
            $plainPassword = $temporaryPassword;
        }

        /** @var User $user */
        $user = DB::transaction(function () use ($data, $plainPassword) {
            $name = trim($data['first_name'].' '.$data['last_name']);

            /** @var User $user */
            $user = User::create([
                'name' => $name,
                'email' => $data['email'],
                'password' => Hash::make((string) $plainPassword),
                'phone' => $data['phone_number'] ?? null,
                'is_active' => true,
                'role' => 'borrower',
            ]);

            // Attach borrower RBAC role so permissions work consistently.
            $borrowerRole = Role::where('slug', 'borrower')->first();
            if ($borrowerRole) {
                $user->roles()->syncWithoutDetaching([$borrowerRole->id]);
            }

            BorrowerProfile::create([
                'user_id' => $user->id,
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'phone_number' => $data['phone_number'] ?? null,
                'date_of_birth' => $data['date_of_birth'] ?? null,
                'address' => $data['address'] ?? null,
                'monthly_income' => $data['monthly_income'] ?? null,
                'employment_status' => $data['employment_status'] ?? null,
            ]);

            return $user->load(['roles', 'borrowerProfile']);
        });

        $logger->log($request->user(), 'borrowers.create', $user, ['email' => $user->email]);

        return response()->json([
            'ok' => true,
            'message' => 'Borrower account created.',
            'temporary_password' => $temporaryPassword,
            'borrower' => $user,
        ], 201);
    }

    /**
     * Remove a borrower account (no loans or application history).
     * Admin users cannot be deleted from this endpoint.
     */
    public function destroy(Request $request, User $borrower): JsonResponse
    {
        $admin = $request->user();
        if (! $admin) {
            return response()->json(['ok' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $connectionName = $borrower->getConnection()->getName();
        $tables = $this->verificationTables();
        $role = Role::on($connectionName)->where('slug', 'borrower')->first();
        $hasBorrowerPivot = $role && $borrower->roles()->where('roles.id', $role->id)->exists();
        $hasBorrowerColumn = ($borrower->role ?? '') === 'borrower';
        $hasLoanAsBorrower = $borrower->loans()->exists();
        $hasLivenessOnlyProfile = ($tables['liveness'] ?? false) && $borrower->livenessVerifications()->exists();
        $hasFaceOnlyProfile = ($tables['face'] ?? false) && $borrower->faceVerifications()->exists();
        if (
            ! $hasBorrowerPivot
            && ! $hasBorrowerColumn
            && ! $hasLoanAsBorrower
            && ! $hasLivenessOnlyProfile
            && ! $hasFaceOnlyProfile
        ) {
            return response()->json(['ok' => false, 'message' => 'User is not a borrower.'], 404);
        }

        if ($borrower->id === $admin->id) {
            return response()->json(['ok' => false, 'message' => 'You cannot delete your own account.'], 403);
        }

        if ($borrower->canAccessAdminPortal()) {
            return response()->json(['ok' => false, 'message' => 'Cannot delete a user with admin portal access.'], 403);
        }

        if ($borrower->loans()->exists()) {
            return response()->json([
                'ok' => false,
                'message' => 'Cannot delete borrower with existing loan records. Close or archive loans first.',
            ], 422);
        }

        $hasSubmittedLoanHistory = LoanApplication::on($connectionName)
            ->where('user_id', $borrower->id)
            ->officiallySubmitted()
            ->exists();

        if ($hasSubmittedLoanHistory) {
            return response()->json([
                'ok' => false,
                'message' => 'Cannot delete borrower with loan application history.',
            ], 422);
        }

        try {
            DB::transaction(function () use ($borrower) {
                $this->purgeBorrowerDeleteBlockers($borrower);
                $borrower->roles()->detach();
                $borrower->delete();
            });
        } catch (QueryException $e) {
            Log::error('BorrowerController: destroy QueryException', [
                'borrower_id' => $borrower->id,
                'sqlState' => $e->errorInfo[0] ?? null,
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'ok' => false,
                'message' => ($e->errorInfo[0] ?? '') === '23000'
                    ? 'Cannot delete borrower: related database records are still attached (constraints). Prune dependents or fix schema.'
                    : 'Could not delete borrower due to a database error.',
            ], 422);
        }

        return response()->json(['ok' => true, 'message' => 'Borrower account deleted.']);
    }
}
