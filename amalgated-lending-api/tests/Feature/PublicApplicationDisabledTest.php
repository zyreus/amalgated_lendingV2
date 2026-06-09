<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicApplicationDisabledTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_salary_loan_apply_returns_auth_required(): void
    {
        config()->set('app.frontend_url', 'http://localhost:5173');

        $response = $this->postJson('/api/v1/public/salary-loan/apply', [
            'email' => 'test@example.com',
        ]);

        $response->assertStatus(401)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'auth_required')
            ->assertJsonPath('login_url', 'http://localhost:5173/borrower/login')
            ->assertJsonPath('register_url', 'http://localhost:5173/borrower/register');
    }

    public function test_public_loan_applications_endpoint_returns_auth_required(): void
    {
        $response = $this->postJson('/api/v1/public/loan-applications', []);

        $response->assertStatus(401)->assertJsonPath('code', 'auth_required');
    }
}
