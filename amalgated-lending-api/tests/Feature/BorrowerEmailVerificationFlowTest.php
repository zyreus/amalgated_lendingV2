<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\BorrowerVerificationUrl;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BorrowerEmailVerificationFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_signed_verification_redirects_to_login_and_marks_email_verified(): void
    {
        config()->set('app.frontend_url', 'https://amalgatedlending.com');

        $user = User::factory()->create([
            'role' => 'borrower',
            'email_verified_at' => null,
        ]);
        $url = BorrowerVerificationUrl::signedVerifyUrl($user);

        $res = $this->get($url);

        $res->assertRedirectContains('/borrower/login');
        $res->assertRedirectContains('verified=1');
        $res->assertRedirectContains('verification_status=success');
        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    public function test_invalid_signature_redirects_to_frontend_with_invalid_status(): void
    {
        config()->set('app.frontend_url', 'https://amalgatedlending.com');
        $user = User::factory()->create([
            'role' => 'borrower',
            'email_verified_at' => null,
        ]);

        $url = route('api.borrower.email.verify', [
            'id' => $user->id,
            'hash' => sha1((string) $user->email),
            'expires' => now()->addHour()->timestamp,
            'signature' => 'invalid-signature',
        ], true);

        $res = $this->get($url);
        $res->assertRedirectContains('/borrower/login');
        $res->assertRedirectContains('verification_status=invalid');
    }
}
