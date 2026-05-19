<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\BorrowerVerificationUrl;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BorrowerEmailVerificationFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_signed_path_verification_marks_email_verified_and_shows_page(): void
    {
        config()->set('app.frontend_url', 'http://127.0.0.1:5174');
        config(['services.borrower_verify.base_url' => 'http://localhost']);

        $user = User::factory()->create([
            'role' => 'borrower',
            'email_verified_at' => null,
        ]);
        $url = BorrowerVerificationUrl::signedVerifyUrl($user);

        $this->assertStringContainsString('/borrower/email/verify/'.$user->id.'/', $url);

        $res = $this->get($url);

        $res->assertOk();
        $res->assertSee('Email verified', false);
        $res->assertSee('http://127.0.0.1:5174/borrower/login', false);
        $res->assertSee('verified=1', false);
        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    public function test_legacy_query_verification_still_works(): void
    {
        config()->set('app.frontend_url', 'http://127.0.0.1:5174');
        config(['services.borrower_verify.base_url' => 'http://localhost']);

        $user = User::factory()->create([
            'role' => 'borrower',
            'email_verified_at' => null,
        ]);

        $canonical = BorrowerVerificationUrl::signedVerifyUrl($user);
        parse_str((string) parse_url($canonical, PHP_URL_QUERY), $query);

        $legacyUrl = 'http://localhost/borrower/email/verify?'
            .http_build_query([
                'id' => $user->id,
                'hash' => sha1((string) $user->getEmailForVerification()),
                'expires' => $query['expires'] ?? '',
                'signature' => $query['signature'] ?? '',
            ]);

        $res = $this->followingRedirects()->get($legacyUrl);

        $res->assertOk();
        $res->assertSee('Email verified', false);
        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    public function test_invalid_signature_shows_invalid_page(): void
    {
        config()->set('app.frontend_url', 'https://amalgatedlending.com');
        $user = User::factory()->create([
            'role' => 'borrower',
            'email_verified_at' => null,
        ]);

        $url = route('borrower.email.verify', [
            'id' => $user->id,
            'hash' => sha1((string) $user->getEmailForVerification()),
            'expires' => now()->addHour()->timestamp,
            'signature' => 'invalid-signature',
        ], true);

        $res = $this->get($url);
        $res->assertOk();
        $res->assertSee('Link invalid', false);
    }
}
