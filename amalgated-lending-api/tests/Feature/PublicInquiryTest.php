<?php

namespace Tests\Feature;

use App\Models\Lead;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicInquiryTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_inquiry_v1_accepts_post_and_creates_lead(): void
    {
        $payload = [
            'name' => 'Juan Dela Cruz',
            'email' => 'juan@example.com',
            'contact_number' => '+639171234567',
            'preferred_loan_type' => 'Salary Loan',
            'estimated_loan_amount' => 150000,
            'source' => 'Public Website',
            'source_page' => '/contact',
        ];

        $res = $this->postJson('/api/v1/public/inquiry', $payload);

        $res->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonStructure(['lead' => ['id', 'name', 'email', 'status'], 'chat_token']);

        $this->assertDatabaseHas('leads', [
            'email' => 'juan@example.com',
            'loan_type' => 'Salary Loan',
            'source' => 'Public Website',
            'source_page' => '/contact',
        ]);
    }

    public function test_short_api_inquiry_path_accepts_post(): void
    {
        $payload = [
            'name' => 'Maria Santos',
            'email' => 'maria@example.com',
            'contact_number' => '09171234567',
            'preferred_loan_type' => 'Real Estate Mortgage',
            'estimated_loan_amount' => 1000000,
        ];

        $res = $this->postJson('/api/inquiry', $payload);

        $res->assertCreated()->assertJsonPath('ok', true);
        $this->assertSame(1, Lead::query()->where('email', 'maria@example.com')->count());
    }

    public function test_validation_requires_core_fields(): void
    {
        $res = $this->postJson('/api/v1/public/inquiry', [
            'email' => 'not-an-email',
        ]);

        $res->assertStatus(422);
    }
}
