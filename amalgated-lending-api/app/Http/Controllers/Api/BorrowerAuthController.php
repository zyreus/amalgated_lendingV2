<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BorrowerProfile;
use App\Models\Role;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\AuthSecurityRecorder;
use App\Services\BorrowerOtpService;
use App\Support\PublicStorageUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class BorrowerAuthController extends Controller
{
    private const GENERIC_LOGIN_MESSAGE = 'Invalid email/mobile number or password.';

    public function register(Request $request, ActivityLogger $logger, BorrowerOtpService $otp): JsonResponse
    {
        $request->merge([
            'phone' => BorrowerOtpService::normalizePhone((string) $request->input('phone')),
        ]);

        $data = $request->validate([
            'first_name' => 'required|string|max:128',
            'middle_name' => 'nullable|string|max:128',
            'last_name' => 'required|string|max:128',
            'date_of_birth' => 'required|date|before:today',
            'gender' => 'required|string|max:32',
            'phone' => ['required', 'string', 'regex:/^09\d{9}$/', 'unique:users,phone'],
            'email' => 'required|email|max:255|unique:users,email',
            'province' => 'required|string|max:128',
            'city' => 'required|string|max:128',
            'barangay' => 'required|string|max:128',
            'complete_address' => 'required|string|max:500',
            'password' => ['required', 'string', 'max:72', 'confirmed', Password::min(8)->mixedCase()->numbers()->symbols()],
            'government_id' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
            'selfie_with_id' => 'nullable|file|mimes:jpg,jpeg,png|max:5120',
        ]);

        $user = DB::transaction(function () use ($data, $request) {
            $fullName = trim(implode(' ', array_filter([
                $data['first_name'],
                $data['middle_name'] ?? null,
                $data['last_name'],
            ])));
            $base = Str::slug(Str::before((string) $data['email'], '@'), '_') ?: 'borrower';
            $username = $base;
            $suffix = 1;
            while (User::query()->whereRaw('LOWER(username) = ?', [mb_strtolower($username)])->exists()) {
                $suffix++;
                $username = $base.'_'.$suffix;
            }

            $user = User::create([
                'name' => $fullName,
                'username' => $username,
                'email' => mb_strtolower(trim((string) $data['email'])),
                'password' => Hash::make($data['password']),
                'phone' => $data['phone'],
                'phone_verified_at' => null,
                'borrower_status' => 'pending_verification',
                'role' => 'borrower',
                'is_active' => true,
            ]);

            $governmentId = $request->file('government_id');
            $selfie = $request->file('selfie_with_id');
            if ($governmentId) {
                $path = $governmentId->store('borrower-documents/'.$user->id, 'public');
                $user->forceFill([
                    'id_document_path' => $path,
                    'id_document_name' => $governmentId->getClientOriginalName(),
                ])->save();
            }
            if ($selfie) {
                $path = $selfie->store('borrower-selfies/'.$user->id, 'public');
                $user->forceFill([
                    'profile_photo_path' => $path,
                    'profile_photo_name' => $selfie->getClientOriginalName(),
                ])->save();
            }

            BorrowerProfile::create([
                'user_id' => $user->id,
                'first_name' => trim((string) $data['first_name']),
                'middle_name' => isset($data['middle_name']) ? trim((string) $data['middle_name']) : null,
                'last_name' => trim((string) $data['last_name']),
                'phone_number' => $data['phone'],
                'date_of_birth' => $data['date_of_birth'],
                'gender' => $data['gender'],
                'province' => $data['province'],
                'city' => $data['city'],
                'barangay' => $data['barangay'],
                'complete_address' => $data['complete_address'],
                'address' => trim($data['complete_address'].', '.$data['barangay'].', '.$data['city'].', '.$data['province']),
            ]);

            $borrowerRole = Role::query()->where('slug', 'borrower')->first();
            if ($borrowerRole) {
                $user->roles()->syncWithoutDetaching([$borrowerRole->id]);
            }

            return $user->refresh();
        });

        $logger->log($user, 'auth.borrower_register');
        $otpResult = $otp->requestCode($user);

        return response()->json([
            'ok' => true,
            'message' => ($otpResult['ok'] ?? false)
                ? 'Borrower account created. Enter the OTP to verify your phone number.'
                : 'Borrower account created, but OTP delivery failed. You can resend the code.',
            'verification_required' => true,
            'phone' => $user->phone,
            'otp_message' => $otpResult['message'] ?? null,
            'user' => $this->borrowerPayload($user),
        ], 201);
    }

    public function login(Request $request, ActivityLogger $logger, AuthSecurityRecorder $security): JsonResponse
    {
        $data = $request->validate([
            'identifier' => 'nullable|string|max:255',
            'username' => 'nullable|string|max:255',
            'password' => 'required|string',
        ]);

        $login = $this->requestIdentifier($request);
        if ($login === '' || ! $this->isValidLoginIdentifier($login)) {
            $security->recordFailure('borrower_api', $login, ['reason' => 'invalid_identifier']);

            return $this->genericLoginFailure();
        }

        $user = $this->resolveUser($login);
        if (! $user || ! Hash::check($data['password'], (string) $user->password)) {
            $security->recordFailure('borrower_api', $login);

            return $this->genericLoginFailure();
        }
        if (! $user->is_active) {
            $security->recordFailure('borrower_api', $login, ['reason' => 'inactive']);

            return $this->genericLoginFailure();
        }
        if (! $user->canUseBorrowerPortal()) {
            $security->recordFailure('borrower_api', $login, ['reason' => 'not_borrower']);

            return $this->genericLoginFailure();
        }
        if (($user->borrower_status ?? 'verified') === 'pending_verification' && ! $user->phone_verified_at) {
            $security->recordFailure('borrower_api', $login, ['reason' => 'phone_unverified']);

            return $this->genericLoginFailure();
        }
        if (in_array((string) ($user->borrower_status ?? ''), ['blocked', 'suspended'], true)) {
            $security->recordFailure('borrower_api', $login, ['reason' => $user->borrower_status]);

            return $this->genericLoginFailure();
        }

        $token = auth('api')->login($user);
        $authUser = auth('api')->user();
        $logger->log($authUser, 'auth.borrower_login');
        $security->recordSuccess('borrower_api', $authUser);

        return response()->json([
            'ok' => true,
            'token' => $token,
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => auth('api')->factory()->getTTL() * 60,
            'user' => $this->borrowerPayload($authUser),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'ok' => true,
            'user' => $this->borrowerPayload($user),
        ]);
    }

    public function logout(Request $request, ActivityLogger $logger, AuthSecurityRecorder $security): JsonResponse
    {
        $user = $request->user();
        $logger->log($user, 'auth.borrower_logout');
        $security->recordLogout('borrower_api', $user);
        auth('api')->logout();

        return response()->json(['ok' => true]);
    }

    public function requestOtp(Request $request, BorrowerOtpService $otp): JsonResponse
    {
        $data = $request->validate([
            'username' => 'required|string|max:255',
        ]);

        $user = $otp->resolveUserByLogin($data['username']);
        if (! $user || ! $user->canUseBorrowerPortal()) {
            return response()->json(['ok' => true, 'message' => 'If an account exists, a sign-in code was sent.']);
        }

        if (! $user->is_active) {
            return response()->json(['ok' => false, 'message' => 'Account is deactivated.'], 403);
        }

        $result = $otp->requestCode($user);
        if (! ($result['ok'] ?? false)) {
            $status = isset($result['cooldown_seconds']) ? 429 : 422;

            return response()->json([
                'ok' => false,
                'message' => $result['message'] ?? 'Could not send code.',
                'cooldown_seconds' => $result['cooldown_seconds'] ?? null,
            ], $status);
        }

        return response()->json(['ok' => true, 'message' => $result['message']]);
    }

    public function verifyOtpLogin(Request $request, BorrowerOtpService $otp, ActivityLogger $logger, AuthSecurityRecorder $security): JsonResponse
    {
        $data = $request->validate([
            'username' => 'required|string|max:255',
            'code' => 'required|string|min:4|max:12',
        ]);

        $user = $otp->resolveUserByLogin($data['username']);
        if (! $user || ! $user->canUseBorrowerPortal() || ! $user->is_active) {
            return response()->json(['ok' => false, 'message' => 'Invalid code or account.'], 401);
        }

        if (! $otp->verifyCode($user, $data['code'])) {
            $security->recordFailure('borrower_otp', $data['username']);

            return response()->json(['ok' => false, 'message' => 'Invalid or expired code.'], 401);
        }

        if (! $user->phone_verified_at) {
            $user->forceFill([
                'phone_verified_at' => now(),
                'borrower_status' => 'verified',
                'otp_resend_attempts' => 0,
            ])->save();
        }

        $token = auth('api')->login($user);
        $authUser = auth('api')->user();
        $logger->log($authUser, 'auth.borrower_otp_login');
        $security->recordSuccess('borrower_otp', $authUser);

        return response()->json([
            'ok' => true,
            'token' => $token,
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => auth('api')->factory()->getTTL() * 60,
            'user' => $this->borrowerPayload($authUser),
        ]);
    }

    public function requestPasswordOtp(Request $request, BorrowerOtpService $otp): JsonResponse
    {
        $identifier = $this->requestIdentifier($request, ['identifier', 'phone', 'username']);
        if ($identifier === '' || ! $this->isValidLoginIdentifier($identifier)) {
            return response()->json([
                'ok' => true,
                'message' => 'If a borrower account exists, a reset OTP was sent.',
                'identifier' => $identifier,
            ]);
        }

        $user = $this->resolveUser($identifier);
        if ($user && $user->is_active && $user->canUseBorrowerPortal()) {
            $result = $otp->requestCode($user);
            if (! ($result['ok'] ?? false)) {
                $status = isset($result['cooldown_seconds']) ? 429 : 422;

                return response()->json([
                    'ok' => false,
                    'message' => $result['message'] ?? 'Could not send code.',
                    'cooldown_seconds' => $result['cooldown_seconds'] ?? null,
                ], $status);
            }
        }

        return response()->json([
            'ok' => true,
            'message' => 'If a borrower account exists, a reset OTP was sent.',
            'identifier' => $this->normalizedIdentifierForResponse($identifier),
        ]);
    }

    public function resetPasswordWithOtp(Request $request, BorrowerOtpService $otp, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'identifier' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:255',
            'code' => 'required|string|min:4|max:12',
            'password' => ['required', 'string', 'max:72', 'confirmed', Password::min(8)->mixedCase()->numbers()->symbols()],
        ]);

        $identifier = $this->requestIdentifier($request, ['identifier', 'phone']);
        if ($identifier === '' || ! $this->isValidLoginIdentifier($identifier)) {
            return response()->json(['ok' => false, 'message' => 'Invalid code or account.'], 401);
        }

        $user = $this->resolveUser($identifier);
        if (! $user || ! $user->is_active || ! $user->canUseBorrowerPortal()) {
            return response()->json(['ok' => false, 'message' => 'Invalid code or account.'], 401);
        }

        if (! $otp->verifyCode($user, $data['code'])) {
            return response()->json(['ok' => false, 'message' => 'Invalid or expired code.'], 401);
        }

        $user->forceFill([
            'password' => Hash::make($data['password']),
            'phone_verified_at' => $user->phone_verified_at ?: now(),
            'borrower_status' => 'verified',
            'otp_resend_attempts' => 0,
        ])->setRememberToken(Str::random(60));
        $user->save();

        $token = auth('api')->login($user);
        $authUser = auth('api')->user();
        $logger->log($authUser, 'auth.borrower_password_reset_otp');

        return response()->json([
            'ok' => true,
            'message' => 'Password reset successfully.',
            'token' => $token,
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => auth('api')->factory()->getTTL() * 60,
            'user' => $this->borrowerPayload($authUser),
        ]);
    }

    public function changePassword(Request $request, ActivityLogger $logger): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $data = $request->validate([
            'current_password' => 'required|string',
            'new_password' => ['required', 'string', 'max:72', 'confirmed', Password::min(8)->mixedCase()->numbers()->symbols()],
        ]);

        if (! Hash::check($data['current_password'], (string) $user->password)) {
            return response()->json([
                'ok' => false,
                'message' => 'Current password is incorrect.',
            ], 422);
        }

        if (Hash::check($data['new_password'], (string) $user->password)) {
            return response()->json([
                'ok' => false,
                'message' => 'New password must be different from current password.',
            ], 422);
        }

        $user->password = Hash::make($data['new_password']);
        $user->save();
        $logger->log($user, 'auth.borrower_password_changed');

        return response()->json([
            'ok' => true,
            'message' => 'Password updated successfully.',
        ]);
    }

    private function resolveUser(string $login): ?User
    {
        $lower = mb_strtolower(trim($login));
        $phone = BorrowerOtpService::normalizePhone($login);

        if (str_contains($lower, '@')) {
            $user = User::query()
                ->whereRaw('LOWER(email) = ?', [$lower])
                ->first();
            if ($user) {
                return $user;
            }
        }

        if ($phone !== '' && preg_match('/^09\d{9}$/', $phone) === 1) {
            $user = User::query()
                ->where('phone', $phone)
                ->first();
            if ($user) {
                return $user;
            }

            return User::query()
                ->whereHas('borrowerProfile', fn ($q) => $q->where('phone_number', $phone))
                ->first();
        }

        return null;
    }

    /**
     * @param array<int, string> $keys
     */
    private function requestIdentifier(Request $request, array $keys = ['identifier', 'username']): string
    {
        foreach ($keys as $key) {
            $value = trim((string) $request->input($key, ''));
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }

    private function isValidLoginIdentifier(string $identifier): bool
    {
        $trimmed = trim($identifier);
        if ($trimmed === '') {
            return false;
        }

        if (str_contains($trimmed, '@')) {
            return filter_var($trimmed, FILTER_VALIDATE_EMAIL) !== false;
        }

        return preg_match('/^09\d{9}$/', BorrowerOtpService::normalizePhone($trimmed)) === 1;
    }

    private function normalizedIdentifierForResponse(string $identifier): string
    {
        if (str_contains($identifier, '@')) {
            return mb_strtolower(trim($identifier));
        }

        return BorrowerOtpService::normalizePhone($identifier);
    }

    private function genericLoginFailure(): JsonResponse
    {
        return response()->json(['ok' => false, 'message' => self::GENERIC_LOGIN_MESSAGE], 401);
    }

    /**
     * @return array<string, mixed>
     */
    private function borrowerPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
            'phone' => $user->phone,
            'phone_verified' => (bool) $user->phone_verified_at,
            'phone_verified_at' => optional($user->phone_verified_at)?->toIso8601String(),
            'borrower_status' => $user->borrower_status ?? 'verified',
            'email_verified' => (bool) $user->email_verified_at,
            'email_verified_at' => optional($user->email_verified_at)?->toIso8601String(),
            'role' => $user->role,
            'is_active' => (bool) $user->is_active,
            'id_document_name' => $user->id_document_name,
            'id_document_path' => $user->id_document_path,
            'id_document_url' => $user->id_document_path ? PublicStorageUrl::apiUrl($user->id_document_path) : null,
            'profile_photo_name' => $user->profile_photo_name ?: $user->id_document_name,
            'profile_photo_path' => $user->profile_photo_path ?: $user->id_document_path,
            'profile_photo_url' => $user->profile_photo_path
                ? PublicStorageUrl::apiUrl($user->profile_photo_path)
                : ($user->id_document_path ? PublicStorageUrl::apiUrl($user->id_document_path) : null),
            'timezone' => $user->timezone,
        ];
    }
}
