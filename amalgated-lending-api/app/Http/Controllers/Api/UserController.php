<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendBorrowerEmailVerificationJob;
use App\Models\EmailVerificationLog;
use App\Models\Role;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\SecurityPolicyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    private const EXPORT_COLUMNS = ['ID', 'Name', 'Username', 'Email', 'Phone', 'Roles', 'Loans', 'Status', 'Created At'];

    public function __construct(private SecurityPolicyService $securityPolicy)
    {
    }

    private function passwordRules(bool $required = true): array
    {
        $min = $this->securityPolicy->passwordMinLength();
        $rule = $required ? 'required' : 'nullable';

        return [$rule, 'string', 'min:'.$min, 'max:72'];
    }

    public function index(Request $request): JsonResponse
    {
        $q = User::query()
            ->with('roles')
            ->withCount('loans');

        if ($search = $request->query('search')) {
            $s = '%'.$search.'%';
            $q->where(function ($w) use ($s) {
                $w->where('name', 'like', $s)
                    ->orWhere('email', 'like', $s)
                    ->orWhere('phone', 'like', $s)
                    ->orWhere('username', 'like', $s);
            });
        }
        if ($request->filled('is_active')) {
            $q->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOLEAN));
        }
        if ($request->filled('role_slug')) {
            $roleSlug = trim((string) $request->query('role_slug'));
            if ($roleSlug !== '') {
                $q->whereHas('roles', fn ($w) => $w->where('slug', $roleSlug));
            }
        }

        $users = $q->orderByDesc('id')->paginate(max(5, min(100, (int) $request->query('per_page', 15))));

        return response()->json(['ok' => true, 'data' => $users]);
    }

    public function store(Request $request, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'username' => 'required|string|max:80|alpha_dash|unique:users,username',
            'email' => 'required|email|unique:users,email',
            'password' => $this->passwordRules(true),
            'phone' => 'nullable|string|max:32',
            'is_active' => 'boolean',
            'role' => 'nullable|in:admin,loan_officer,collector,accountant,borrower',
            'role_ids' => 'array',
            'role_ids.*' => 'exists:roles,id',
        ]);

        $resolvedRole = $data['role'] ?? $this->deriveRoleFromRoleIds($data['role_ids'] ?? []) ?? 'borrower';

        $user = User::create([
            'name' => $data['name'],
            'username' => $data['username'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'phone' => $data['phone'] ?? null,
            'is_active' => $data['is_active'] ?? true,
            'role' => $resolvedRole,
        ]);

        if (! empty($data['role_ids'])) {
            $user->roles()->sync($data['role_ids']);
            $user->load('roles');
            $user->syncPrimaryRoleFromRoles();
        } elseif ($resolvedRole === 'borrower') {
            $borrowerRole = Role::where('slug', 'borrower')->first();
            if ($borrowerRole) {
                $user->roles()->syncWithoutDetaching([$borrowerRole->id]);
            }
        }

        $logger->log($request->user(), 'users.create', $user, ['email' => $user->email]);

        return response()->json(['ok' => true, 'user' => $user->load('roles.permissions')], 201);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json(['ok' => true, 'user' => $user->load('roles.permissions')]);
    }

    public function update(Request $request, User $user, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'username' => ['sometimes', 'string', 'max:80', 'alpha_dash', Rule::unique('users', 'username')->ignore($user->id)],
            'email' => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => $this->passwordRules(false),
            'phone' => 'nullable|string|max:32',
            'is_active' => 'boolean',
            'role' => 'nullable|in:admin,loan_officer,collector,accountant,borrower',
            'role_ids' => 'array',
            'role_ids.*' => 'exists:roles,id',
        ]);

        if (isset($data['name'])) {
            $user->name = $data['name'];
        }
        if (isset($data['username'])) {
            $user->username = trim((string) $data['username']) !== '' ? trim((string) $data['username']) : null;
        }
        if (isset($data['email'])) {
            $newEmail = trim((string) $data['email']);
            if ($newEmail !== '' && strcasecmp($newEmail, (string) ($user->email ?? '')) !== 0) {
                $user->email = $newEmail;
                $user->email_verified_at = null;
            }
        }
        if (! empty($data['password'])) {
            $user->password = Hash::make($data['password']);
        }
        if (array_key_exists('phone', $data)) {
            $user->phone = $data['phone'];
        }
        if (isset($data['is_active'])) {
            $user->is_active = $data['is_active'];
        }
        if (array_key_exists('role', $data) && $data['role']) {
            $user->role = $data['role'];
        }
        $user->save();

        if (isset($data['role_ids'])) {
            $user->roles()->sync($data['role_ids']);
            $user->load('roles');
            $user->syncPrimaryRoleFromRoles();
        } elseif (($user->role ?? '') === 'borrower') {
            $borrowerRole = Role::where('slug', 'borrower')->first();
            if ($borrowerRole) {
                $user->roles()->syncWithoutDetaching([$borrowerRole->id]);
            }
        }

        $logger->log($request->user(), 'users.update', $user);

        return response()->json(['ok' => true, 'user' => $user->fresh()->load('roles.permissions')]);
    }

    public function verifyBorrowerEmail(Request $request, User $user, ActivityLogger $logger): JsonResponse
    {
        if (($user->role ?? '') !== 'borrower') {
            return response()->json([
                'ok' => false,
                'message' => 'Only borrower accounts can be marked as email-verified from this action.',
            ], 422);
        }

        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
        }

        try {
            EmailVerificationLog::query()->create([
                'user_id' => $user->id,
                'event' => 'admin_override',
                'ip_address' => $request->ip(),
                'detail' => 'Admin user '.$request->user()?->id,
            ]);
        } catch (\Throwable) {
            /* ignore */
        }

        $logger->log($request->user(), 'users.verify_email_override', $user);

        return response()->json([
            'ok' => true,
            'user' => $user->fresh()->load('roles'),
        ]);
    }

    public function resendBorrowerEmailVerification(Request $request, User $user, ActivityLogger $logger): JsonResponse
    {
        if (! $user->canUseBorrowerPortal()) {
            return response()->json([
                'ok' => false,
                'message' => 'Only borrower accounts can receive verification emails.',
            ], 422);
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'ok' => true,
                'message' => 'Borrower email is already verified.',
            ]);
        }

        SendBorrowerEmailVerificationJob::dispatchSync((int) $user->id);
        EmailVerificationLog::query()->create([
            'user_id' => $user->id,
            'event' => 'resent_admin',
            'ip_address' => $request->ip(),
            'detail' => 'Admin user '.$request->user()?->id,
        ]);
        $logger->log($request->user(), 'users.resend_email_verification', $user);

        return response()->json([
            'ok' => true,
            'message' => 'Verification email queued for borrower.',
        ]);
    }

    public function destroy(Request $request, User $user, ActivityLogger $logger): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['ok' => false, 'message' => 'Cannot delete yourself.'], 422);
        }
        $logger->log($request->user(), 'users.delete', $user);
        $user->delete();

        return response()->json(['ok' => true]);
    }

    public function export(Request $request)
    {
        $format = strtolower((string) $request->query('format', 'csv'));
        if (! in_array($format, ['csv', 'pdf'], true)) {
            return response()->json(['ok' => false, 'message' => 'Unsupported export format.'], 422);
        }
        if ($format === 'pdf') {
            return response()->json(['ok' => false, 'message' => 'PDF export is not yet enabled for users. Use CSV for now.'], 422);
        }

        $query = User::query()->with('roles')->withCount('loans')->orderByDesc('id');
        if ($search = trim((string) $request->query('search', ''))) {
            $s = '%'.$search.'%';
            $query->where(function ($w) use ($s) {
                $w->where('name', 'like', $s)
                    ->orWhere('email', 'like', $s)
                    ->orWhere('phone', 'like', $s)
                    ->orWhere('username', 'like', $s);
            });
        }
        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOLEAN));
        }
        if ($request->filled('role_slug')) {
            $roleSlug = trim((string) $request->query('role_slug'));
            if ($roleSlug !== '') {
                $query->whereHas('roles', fn ($w) => $w->where('slug', $roleSlug));
            }
        }

        $file = 'users-export-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fputcsv($out, self::EXPORT_COLUMNS);
            $query->chunk(250, function ($rows) use ($out) {
                foreach ($rows as $u) {
                    fputcsv($out, [
                        $u->id,
                        $u->name,
                        $u->username,
                        $u->email,
                        $u->phone,
                        ($u->roles ?? collect())->pluck('name')->implode(', '),
                        $u->loans_count ?? 0,
                        $u->is_active ? 'Active' : 'Inactive',
                        optional($u->created_at)?->format('Y-m-d H:i:s'),
                    ]);
                }
            });
            fclose($out);
        }, $file, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function deriveRoleFromRoleIds(array $roleIds): ?string
    {
        if (empty($roleIds)) {
            return null;
        }
        $slugs = Role::query()
            ->whereIn('id', $roleIds)
            ->pluck('slug')
            ->map(fn ($s) => strtolower((string) $s))
            ->all();

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
        if (in_array('borrower', $slugs, true)) {
            return 'borrower';
        }

        return null;
    }
}
