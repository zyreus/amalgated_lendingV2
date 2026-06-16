<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BorrowerAuthIdentifierLoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_borrower_can_login_with_email_identifier(): void
    {
        User::factory()->create([
            'email' => 'borrower@example.com',
            'phone' => '09171234567',
            'phone_verified_at' => now(),
            'borrower_status' => 'verified',
            'role' => 'borrower',
            'is_active' => true,
        ]);

        $res = $this->postJson('/api/v1/borrower/login', [
            'identifier' => 'borrower@example.com',
            'password' => 'password',
        ]);

        $res->assertOk()
            ->assertJson([
                'ok' => true,
                'token_type' => 'bearer',
            ])
            ->assertJsonStructure(['access_token', 'user' => ['id', 'email', 'phone']]);
    }

    public function test_borrower_can_login_with_normalized_mobile_identifier(): void
    {
        User::factory()->create([
            'email' => 'mobile-borrower@example.com',
            'phone' => '09171234567',
            'phone_verified_at' => now(),
            'borrower_status' => 'verified',
            'role' => 'borrower',
            'is_active' => true,
        ]);

        $res = $this->postJson('/api/v1/borrower/login', [
            'identifier' => '+639171234567',
            'password' => 'password',
        ]);

        $res->assertOk()
            ->assertJsonPath('user.phone', '09171234567');
    }

    public function test_login_uses_generic_error_for_unverified_borrower(): void
    {
        User::factory()->create([
            'email' => 'unverified@example.com',
            'phone' => '09170000000',
            'phone_verified_at' => null,
            'borrower_status' => 'pending_verification',
            'role' => 'borrower',
            'is_active' => true,
        ]);

        $res = $this->postJson('/api/v1/borrower/login', [
            'identifier' => 'unverified@example.com',
            'password' => 'password',
        ]);

        $res->assertUnauthorized()
            ->assertJson([
                'ok' => false,
                'message' => 'Invalid email/mobile number or password.',
            ])
            ->assertJsonMissing(['verification_required' => true]);
    }
}
