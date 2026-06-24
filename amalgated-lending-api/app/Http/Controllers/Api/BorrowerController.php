<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BorrowerProfile;
use App\Models\Loan;
use App\Models\Role;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\BorrowerChatLeadService;
use App\Services\BorrowerUploadedFilesManifest;
use App\Services\StaffScopeService;
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
    private const REASON_APPLICATION_REJECTED = 'Application Rejected';
    private const REASON_MANUALLY_ARCHIVED = 'Manually Archived';
    private const REASON_DELETED_PENDING = 'Deleted Pending';
    private const ONGOING_LOAN_DELETE_MESSAGE = 'This borrower cannot be deleted because they still have an ongoing loan.';

    private const ARCHIVE_REQUIRES_NO_LOANS_MESSAGE = 'Only borrowers with no loans can be archived.';

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

    private function borrowerListQuery()
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
            ->withExists([
                'loans as has_ongoing_loan' => fn ($loanQuery) => $loanQuery->where('status', Loan::STATUS_ONGOING),
            ])
            ->with(['roles:id,name,slug']);

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

        return $q;
    }

    private function applyBorrowerSearchAndRiskFilters($q, Request $request): void
    {
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
    }

    private function assertBorrowerManageable(User $admin, User $borrower): ?JsonResponse
    {
        $deny = $this->borrowerCrmAccessDeniedResponse($borrower);
        if ($deny instanceof JsonResponse) {
            return $deny;
        }

        if ($borrower->id === $admin->id) {
            return response()->json(['ok' => false, 'message' => 'You cannot manage your own account as a borrower.'], 403);
        }

        if ($borrower->canAccessAdminPortal()) {
            return response()->json(['ok' => false, 'message' => 'Cannot manage a user with admin portal access as a borrower.'], 403);
        }

        return null;
    }

    private function archiveBorrower(User $borrower, User $admin, string $reason, ?ActivityLogger $logger = null): User
    {
        $borrower->forceFill([
            'is_archived' => true,
            'archived_at' => now(),
            'archive_reason' => $reason,
            'deleted_at' => $reason === self::REASON_DELETED_PENDING ? now() : null,
            'archived_by' => $admin->id,
            'restored_by' => null,
            'deleted_by' => $reason === self::REASON_DELETED_PENDING ? $admin->id : null,
        ])->save();

        $logger?->log($admin, 'borrowers.archive', $borrower, [
            'reason' => $reason,
            'borrower_id' => $borrower->id,
        ]);

        return $borrower->fresh();
    }

    /**
     * Remove rows that still block `users` delete on databases without FK CASCADE (restored dumps, manual tables).
     */
    private function purgeBorrowerDeleteBlockers(User $borrower): void
    {
        $tables = $this->verificationTables();
        $connectionName = $borrower->getConnection()->getName();
        $schema = Schema::connection($connectionName);
        $db = DB::connection($connectionName);

        $hasColumn = static function (string $table, string $column) use ($schema): bool {
            return $schema->hasTable($table) && $schema->hasColumn($table, $column);
        };

        $idsWhere = static function (string $table, string $column, int $value) use ($db, $hasColumn): array {
            if (! $hasColumn($table, $column) || ! $hasColumn($table, 'id')) {
                return [];
            }

            return $db->table($table)->where($column, $value)->pluck('id')->map(static fn ($id) => (int) $id)->all();
        };

        $idsWhereIn = static function (string $table, string $column, array $values) use ($db, $hasColumn): array {
            if ($values === [] || ! $hasColumn($table, $column) || ! $hasColumn($table, 'id')) {
                return [];
            }

            return $db->table($table)->whereIn($column, $values)->pluck('id')->map(static fn ($id) => (int) $id)->all();
        };

        $deleteWhere = static function (string $table, string $column, int $value) use ($db, $hasColumn): void {
            if ($hasColumn($table, $column)) {
                $db->table($table)->where($column, $value)->delete();
            }
        };

        $deleteWhereIn = static function (string $table, string $column, array $values) use ($db, $hasColumn): void {
            if ($values !== [] && $hasColumn($table, $column)) {
                $db->table($table)->whereIn($column, $values)->delete();
            }
        };

        $nullWhere = static function (string $table, string $column, int $value) use ($db, $hasColumn): void {
            if ($hasColumn($table, $column)) {
                $db->table($table)->where($column, $value)->update([$column => null]);
            }
        };

        $nullWhereIn = static function (string $table, string $column, array $values) use ($db, $hasColumn): void {
            if ($values !== [] && $hasColumn($table, $column)) {
                $db->table($table)->whereIn($column, $values)->update([$column => null]);
            }
        };

        foreach (
            [
                'liveness_verifications' => $tables['liveness'],
                'face_verifications' => $tables['face'],
            ] as $table => $present
        ) {
            if (! $present) {
                continue;
            }
            $db->table($table)->where('borrower_id', $borrower->id)->delete();
        }

        $loanIds = $idsWhere('loans', 'borrower_id', (int) $borrower->id);
        $paymentIds = $idsWhereIn('payments', 'loan_id', $loanIds);
        $loanApplicationIds = $idsWhere('loan_applications', 'user_id', (int) $borrower->id);
        $documentLoanApplicationIds = $idsWhere('document_loan_applications', 'user_id', (int) $borrower->id);

        $portalConversationIds = $idsWhere('portal_conversations', 'borrower_id', (int) $borrower->id);
        $deleteWhereIn('portal_messages', 'portal_conversation_id', $portalConversationIds);
        $deleteWhereIn('portal_conversations', 'id', $portalConversationIds);

        $supportTicketIds = $idsWhere('support_tickets', 'borrower_id', (int) $borrower->id);
        $supportTicketMessageIds = $idsWhereIn('support_ticket_messages', 'support_ticket_id', $supportTicketIds);
        $deleteWhereIn('support_ticket_attachments', 'support_ticket_message_id', $supportTicketMessageIds);
        $deleteWhereIn('support_ticket_attachments', 'support_ticket_id', $supportTicketIds);
        $deleteWhereIn('support_ticket_notes', 'support_ticket_id', $supportTicketIds);
        $deleteWhereIn('support_ticket_messages', 'support_ticket_id', $supportTicketIds);
        $deleteWhereIn('support_tickets', 'id', $supportTicketIds);

        $feedbackTicketIds = $idsWhere('feedback_tickets', 'borrower_id', (int) $borrower->id);
        $deleteWhereIn('feedback_replies', 'feedback_id', $feedbackTicketIds);
        $deleteWhereIn('feedback_analytics', 'feedback_id', $feedbackTicketIds);
        $nullWhere('feedback_tickets', 'borrower_id', (int) $borrower->id);

        $deleteWhere('borrower_notifications', 'user_id', (int) $borrower->id);
        $deleteWhere('borrower_notification_preferences', 'user_id', (int) $borrower->id);
        $deleteWhere('borrower_profiles', 'user_id', (int) $borrower->id);
        $deleteWhereIn('uploaded_documents', 'document_loan_application_id', $documentLoanApplicationIds);
        $deleteWhereIn('document_loan_applications', 'id', $documentLoanApplicationIds);
        $deleteWhereIn('travel_loan_wizard_forms', 'loan_application_id', $loanApplicationIds);
        $deleteWhereIn('loan_application_dependents', 'loan_application_id', $loanApplicationIds);
        $deleteWhereIn('loan_application_contact_persons', 'loan_application_id', $loanApplicationIds);
        $deleteWhereIn('loan_credit_memoranda', 'loan_application_id', $loanApplicationIds);
        $deleteWhereIn('loan_documents', 'loan_application_id', $loanApplicationIds);
        $deleteWhereIn('loan_applications', 'id', $loanApplicationIds);
        $nullWhere('loan_applications', 'co_maker_id', (int) $borrower->id);
        $nullWhere('leads', 'user_id', (int) $borrower->id);

        $deleteWhereIn('payment_receipt_audits', 'payment_id', $paymentIds);
        $deleteWhereIn('payment_adjustment_audits', 'payment_id', $paymentIds);
        $deleteWhereIn('payment_receipts', 'payment_id', $paymentIds);
        $nullWhereIn('email_logs', 'payment_id', $paymentIds);
        $nullWhereIn('email_logs', 'loan_id', $loanIds);

        $deleteWhereIn('loan_health_metrics', 'loan_id', $loanIds);
        $deleteWhereIn('loan_receipts', 'loan_id', $loanIds);
        $deleteWhereIn('loan_statements', 'loan_id', $loanIds);
        $deleteWhere('loan_statements', 'borrower_id', (int) $borrower->id);
        $deleteWhereIn('soa_statements', 'loan_id', $loanIds);
        $deleteWhere('soa_statements', 'borrower_id', (int) $borrower->id);
        $deleteWhereIn('payments', 'loan_id', $loanIds);
        $deleteWhereIn('loans', 'id', $loanIds);
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
        $q = $this->borrowerListQuery()->where('is_archived', false);
        app(StaffScopeService::class)->applyAssignedBorrowerScope($q, $request->user());
        $this->applyBorrowerSearchAndRiskFilters($q, $request);

        $perPage = max(1, min(100, (int) $request->query('per_page', 15)));
        $rows = $q->orderByDesc('id')->paginate($perPage);

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    public function archived(Request $request): JsonResponse
    {
        $q = $this->borrowerListQuery()->where('is_archived', true);
        $this->applyBorrowerSearchAndRiskFilters($q, $request);

        $reason = (string) $request->query('archive_reason', '');
        if ($reason === 'rejected') {
            $q->where('archive_reason', self::REASON_APPLICATION_REJECTED);
        } elseif ($reason === 'manual') {
            $q->where('archive_reason', self::REASON_MANUALLY_ARCHIVED);
        } elseif ($reason === 'deleted_pending') {
            $q->where('archive_reason', self::REASON_DELETED_PENDING);
        }

        $perPage = max(1, min(100, (int) $request->query('per_page', 15)));
        $rows = $q->orderByDesc('archived_at')->orderByDesc('id')->paginate($perPage);

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
        $borrower->setAttribute('has_ongoing_loan', $borrower->hasOngoingLoan());

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

        app(BorrowerChatLeadService::class)->ensureForUser($user);

        $logger->log($request->user(), 'borrowers.create', $user, ['email' => $user->email]);

        return response()->json([
            'ok' => true,
            'message' => 'Borrower account created.',
            'temporary_password' => $temporaryPassword,
            'borrower' => $user,
        ], 201);
    }

    public function archive(Request $request, User $borrower, ActivityLogger $logger): JsonResponse
    {
        $admin = $request->user();
        if (! $admin) {
            return response()->json(['ok' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $deny = $this->assertBorrowerManageable($admin, $borrower);
        if ($deny instanceof JsonResponse) {
            return $deny;
        }

        if ($borrower->is_archived) {
            return response()->json(['ok' => false, 'message' => 'Borrower is already archived.'], 422);
        }

        if ($borrower->loans()->exists()) {
            return response()->json(['ok' => false, 'message' => self::ARCHIVE_REQUIRES_NO_LOANS_MESSAGE], 422);
        }

        $archived = $this->archiveBorrower($borrower, $admin, self::REASON_MANUALLY_ARCHIVED, $logger);

        return response()->json([
            'ok' => true,
            'message' => 'Borrower archived successfully.',
            'borrower' => $archived,
        ]);
    }

    public function restore(Request $request, User $borrower, ActivityLogger $logger): JsonResponse
    {
        $admin = $request->user();
        if (! $admin) {
            return response()->json(['ok' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $deny = $this->assertBorrowerManageable($admin, $borrower);
        if ($deny instanceof JsonResponse) {
            return $deny;
        }

        if (! $borrower->is_archived) {
            return response()->json(['ok' => false, 'message' => 'Borrower is not archived.'], 422);
        }

        $previousReason = $borrower->archive_reason;
        $borrower->forceFill([
            'is_archived' => false,
            'archived_at' => null,
            'archive_reason' => null,
            'deleted_at' => null,
            'restored_by' => $admin->id,
            'deleted_by' => null,
        ])->save();

        $logger->log($admin, 'borrowers.restore', $borrower, [
            'previous_reason' => $previousReason,
            'borrower_id' => $borrower->id,
        ]);

        return response()->json([
            'ok' => true,
            'message' => 'Borrower restored successfully.',
            'borrower' => $borrower->fresh(),
        ]);
    }

    public function destroy(Request $request, User $borrower, ActivityLogger $logger): JsonResponse
    {
        $admin = $request->user();
        if (! $admin) {
            return response()->json(['ok' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $deny = $this->assertBorrowerManageable($admin, $borrower);
        if ($deny instanceof JsonResponse) {
            return $deny;
        }

        if ($borrower->is_archived) {
            return response()->json(['ok' => false, 'message' => 'Use permanent delete from archived borrowers.'], 422);
        }

        if ($borrower->hasOngoingLoan()) {
            return response()->json(['ok' => false, 'message' => self::ONGOING_LOAN_DELETE_MESSAGE], 422);
        }

        $archived = $this->archiveBorrower($borrower, $admin, self::REASON_DELETED_PENDING, $logger);

        return response()->json([
            'ok' => true,
            'message' => 'Borrower moved to deleted pending.',
            'borrower' => $archived,
        ]);
    }

    /**
     * Permanently remove an archived borrower and cascade related borrower records.
     * Admin users cannot be deleted from this endpoint.
     */
    public function permanentDestroy(Request $request, User $borrower, ActivityLogger $logger): JsonResponse
    {
        $admin = $request->user();
        if (! $admin) {
            return response()->json(['ok' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $deny = $this->assertBorrowerManageable($admin, $borrower);
        if ($deny instanceof JsonResponse) {
            return $deny;
        }

        if (! $borrower->is_archived) {
            return response()->json(['ok' => false, 'message' => 'Archive the borrower before permanent deletion.'], 422);
        }

        if ($borrower->hasOngoingLoan()) {
            return response()->json(['ok' => false, 'message' => self::ONGOING_LOAN_DELETE_MESSAGE], 422);
        }

        try {
            DB::transaction(function () use ($borrower, $admin, $logger) {
                $logger->log($admin, 'borrowers.permanent_delete', $borrower, [
                    'borrower_id' => $borrower->id,
                    'email' => $borrower->email,
                    'archive_reason' => $borrower->archive_reason,
                ]);
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
