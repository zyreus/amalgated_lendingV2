<?php

namespace App\Services;

use App\Models\AuthSecurityEvent;
use App\Models\User;
use Illuminate\Http\Request;

class AuthSecurityRecorder
{
    public function __construct(private Request $request)
    {
    }

    public function recordSuccess(string $guard, ?User $user, array $metadata = []): void
    {
        AuthSecurityEvent::query()->create([
            'guard' => $guard,
            'user_id' => $user?->id,
            'event' => AuthSecurityEvent::EVENT_LOGIN_SUCCESS,
            'identifier' => $user?->email ?? $user?->username,
            'ip_address' => $this->request->ip(),
            'user_agent' => substr((string) $this->request->userAgent(), 0, 512),
            'metadata' => $metadata ?: null,
        ]);
    }

    public function recordFailure(string $guard, ?string $identifier, array $metadata = []): void
    {
        AuthSecurityEvent::query()->create([
            'guard' => $guard,
            'user_id' => null,
            'event' => AuthSecurityEvent::EVENT_LOGIN_FAILED,
            'identifier' => $identifier ? mb_substr($identifier, 0, 191) : null,
            'ip_address' => $this->request->ip(),
            'user_agent' => substr((string) $this->request->userAgent(), 0, 512),
            'metadata' => $metadata ?: null,
        ]);
    }

    public function recordLogout(string $guard, ?User $user, array $metadata = []): void
    {
        AuthSecurityEvent::query()->create([
            'guard' => $guard,
            'user_id' => $user?->id,
            'event' => AuthSecurityEvent::EVENT_LOGOUT,
            'identifier' => $user?->email ?? $user?->username,
            'ip_address' => $this->request->ip(),
            'user_agent' => substr((string) $this->request->userAgent(), 0, 512),
            'metadata' => $metadata ?: null,
        ]);
    }
}
