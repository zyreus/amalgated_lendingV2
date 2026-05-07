<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class BorrowerAuthController extends Controller
{
    public function login(Request $request, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = $this->resolveUser($data['username']);
        if (! $user || ! Hash::check($data['password'], (string) $user->password)) {
            return response()->json(['ok' => false, 'message' => 'Invalid username or password.'], 401);
        }
        if (! $user->is_active) {
            return response()->json(['ok' => false, 'message' => 'Account is deactivated.'], 403);
        }
        if (! $user->canUseBorrowerPortal()) {
            return response()->json(['ok' => false, 'message' => 'Only borrower accounts can use borrower login.'], 403);
        }

        $token = auth('api')->login($user);
        $authUser = auth('api')->user();
        $logger->log($authUser, 'auth.borrower_login');

        return response()->json([
            'ok' => true,
            'token' => $token,
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => auth('api')->factory()->getTTL() * 60,
            'user' => [
                'id' => $authUser->id,
                'name' => $authUser->name,
                'username' => $authUser->username,
                'email' => $authUser->email,
                'role' => $authUser->role,
                'is_active' => (bool) $authUser->is_active,
                'id_document_path' => $authUser->id_document_path,
                'id_document_url' => $authUser->id_document_path ? Storage::disk('public')->url($authUser->id_document_path) : null,
                'profile_photo_path' => $authUser->profile_photo_path ?: $authUser->id_document_path,
                'profile_photo_url' => $authUser->profile_photo_path
                    ? Storage::disk('public')->url($authUser->profile_photo_path)
                    : ($authUser->id_document_path ? Storage::disk('public')->url($authUser->id_document_path) : null),
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'ok' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role,
                'is_active' => (bool) $user->is_active,
                'id_document_name' => $user->id_document_name,
                'id_document_path' => $user->id_document_path,
                'id_document_url' => $user->id_document_path ? Storage::disk('public')->url($user->id_document_path) : null,
                'profile_photo_name' => $user->profile_photo_name ?: $user->id_document_name,
                'profile_photo_path' => $user->profile_photo_path ?: $user->id_document_path,
                'profile_photo_url' => $user->profile_photo_path
                    ? Storage::disk('public')->url($user->profile_photo_path)
                    : ($user->id_document_path ? Storage::disk('public')->url($user->id_document_path) : null),
            ],
        ]);
    }

    public function logout(Request $request, ActivityLogger $logger): JsonResponse
    {
        $logger->log($request->user(), 'auth.borrower_logout');
        auth('api')->logout();

        return response()->json(['ok' => true]);
    }

    public function changePassword(Request $request, ActivityLogger $logger): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $data = $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|max:72|confirmed',
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

        return User::query()
            ->where(function ($q) use ($lower) {
                $q->whereRaw('LOWER(username) = ?', [$lower])
                    ->orWhereRaw('LOWER(email) = ?', [$lower]);
            })
            ->first();
    }
}
