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
        config(['services.borrower_verify.base_url' => 'http://testhost']);

        $user = User::factory()->create([
            'role' => 'borrower',
            'email_verified_at' => null,
        ]);
        $url = BorrowerVerificationUrl::signedVerifyUrl($user);

        $this->assertStringContainsString('/borrower/email/verify/'.$user->id.'/', $url);

        $res = $this->get($url);

        $res->assertOk();
        $res->assertSee('Email verified', false);
        $res->assertSee('http://127.0.0.1:5174/login', false);
        $res->assertSee('verified=1', false);
        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    public function test_email_links_never_use_loopback_even_when_env_is_local(): void
    {
        config()->set('app.env', 'local');
        config()->set('app.url', 'http://localhost');
        config()->set('app.frontend_url', 'http://localhost:5174');
        config(['services.borrower_verify.base_url' => 'http://127.0.0.1:8001']);

        $user = User::factory()->create([
            'role' => 'borrower',
            'email_verified_at' => null,
        ]);

        $url = BorrowerVerificationUrl::signedVerifyUrl($user);

        $this->assertStringStartsWith('https://amalgatedlending.com/borrower/email/verify/', $url);
        $this->assertStringNotContainsString('127.0.0.1', $url);
        $this->assertStringNotContainsString('localhost', $url);
    }

    public function test_production_env_uses_configured_public_base(): void
    {
        config()->set('app.env', 'production');
        config()->set('app.url', 'https://api.amalgatedlending.com');
        config()->set('app.frontend_url', 'https://amalgatedlending.com');
        config(['services.borrower_verify.base_url' => 'https://amalgatedlending.com']);

        $user = User::factory()->create([
            'role' => 'borrower',
            'email_verified_at' => null,
        ]);

        $url = BorrowerVerificationUrl::signedVerifyUrl($user);

        $this->assertStringStartsWith('https://amalgatedlending.com/borrower/email/verify/', $url);
        $this->assertStringContainsString('signature=', $url);
        $this->assertStringContainsString('expires=', $url);
    }

    public function test_legacy_query_verification_still_works(): void
    {
        config()->set('app.frontend_url', 'http://testhost');
        config(['services.borrower_verify.base_url' => 'http://testhost']);

        $user = User::factory()->create([
            'role' => 'borrower',
            'email_verified_at' => null,
        ]);

        $canonical = BorrowerVerificationUrl::signedVerifyUrl($user);
        parse_str((string) parse_url($canonical, PHP_URL_QUERY), $query);

        $legacyUrl = 'http://testhost/borrower/email/verify?'
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
        $res->assertStatus(403);
        $res->assertSee('Link invalid', false);
    }
}
