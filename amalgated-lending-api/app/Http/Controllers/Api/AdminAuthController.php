<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\AuthSecurityRecorder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminAuthController extends Controller
{
    private function chatApiSecret(): ?string
    {
        $secret = trim((string) config('app.lending_admin_api_secret', ''));

        return $secret !== '' ? $secret : null;
    }

    public function login(Request $request, ActivityLogger $logger, AuthSecurityRecorder $security): JsonResponse
    {
        $data = $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $login = trim($data['username']);
        $user = $this->resolveUser($login);
        if (! $user || ! Hash::check($data['password'], (string) $user->password)) {
            $security->recordFailure('admin_api', $login);

            return response()->json(['ok' => false, 'message' => 'Invalid username or password.'], 401);
        }
        if (! $user->is_active) {
            $security->recordFailure('admin_api', $login, ['reason' => 'inactive']);

            return response()->json(['ok' => false, 'message' => 'Account is deactivated.'], 403);
        }
        if (! $user->canAccessAdminPortal()) {
            $security->recordFailure('admin_api', $login, ['reason' => 'not_staff']);

            return response()->json(['ok' => false, 'message' => 'Only staff accounts can use admin login.'], 403);
        }

        $token = auth('api')->login($user);
        /** @var User $authUser */
        $authUser = auth('api')->user();
        $authUser->load(['roles.permissions']);
        $logger->log($authUser, 'auth.admin_login');
        $security->recordSuccess('admin_api', $authUser);

        return response()->json([
            'ok' => true,
            'token' => $token,
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => auth('api')->factory()->getTTL() * 60,
            'user' => $authUser->toAuthPayload(),
            'chat_api_secret' => $this->chatApiSecret(),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->load(['roles.permissions']);

        return response()->json([
            'ok' => true,
            'user' => $user->toAuthPayload(),
            'chat_api_secret' => $this->chatApiSecret(),
        ]);
    }

    public function logout(Request $request, ActivityLogger $logger, AuthSecurityRecorder $security): JsonResponse
    {
        $user = $request->user();
        $logger->log($user, 'auth.admin_logout');
        $security->recordLogout('admin_api', $user);
        auth('api')->logout();

        return response()->json(['ok' => true]);
    }

    private function resolveUser(string $login): ?User
    {
        $lower = mb_strtolower(trim($login));

        return User::query()
            ->where(function ($q) use ($lower) {
                $q->whereRaw('LOWER(username) = ?', [$lower])
                    ->orWhereRaw('LOWER(email) = ?', [$lower]);
            })
            ->first();
    }
}
