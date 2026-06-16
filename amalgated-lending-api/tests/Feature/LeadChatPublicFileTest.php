<?php

namespace Tests\Feature;

use App\Models\Lead;
use App\Models\LeadMessage;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Support\PublicStorageUrl;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class LeadChatPublicFileTest extends TestCase
{
    use RefreshDatabase;

    public function test_signed_lead_chat_attachment_is_publicly_readable(): void
    {
        Storage::fake('public');
        $path = 'lead-chat/test-image.jpg';
        Storage::disk('public')->put($path, 'fake-image-bytes');

        $signed = PublicStorageUrl::signedApiUrl($path);
        $this->assertNotNull($signed);
        $this->assertStringContainsString('/api/v1/public-files/', $signed);
        $this->assertStringContainsString('signature=', $signed);

        $this->get($signed)->assertOk();
    }

    public function test_unsigned_lead_chat_attachment_returns_not_found(): void
    {
        Storage::fake('public');
        $path = 'lead-chat/private.jpg';
        Storage::disk('public')->put($path, 'bytes');

        $this->get('/api/v1/public-files/'.$path)->assertNotFound();
    }

    public function test_borrower_chat_message_is_visible_in_admin_lead_messages(): void
    {
        $borrower = User::factory()->create([
            'role' => 'borrower',
            'borrower_status' => 'verified',
        ]);
        $admin = User::factory()->create([
            'role' => 'admin',
            'is_active' => true,
        ]);

        $lead = Lead::create([
            'user_id' => $borrower->id,
            'name' => $borrower->name,
            'email' => $borrower->email,
            'loan_type' => 'Borrower Support',
            'status' => 'ongoing',
            'initial_message' => 'Borrower opened support chat.',
            'chat_token' => bin2hex(random_bytes(20)),
            'last_message_at' => now(),
        ]);

        LeadMessage::create([
            'lead_id' => $lead->id,
            'sender_type' => 'borrower',
            'message' => 'Hello from borrower portal',
        ]);

        $token = auth('api')->login($admin);

        $res = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson("/api/v1/admin/leads/{$lead->id}/messages");

        $res->assertOk();
        $res->assertJsonFragment(['message' => 'Hello from borrower portal']);
        $res->assertJsonFragment(['sender_type' => 'borrower']);
    }

    public function test_admin_can_manage_borrower_portal_thread_state(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $lead = Lead::create([
            'name' => 'Borrower Thread',
            'email' => 'borrower-thread@example.com',
            'loan_type' => 'Borrower Support',
            'status' => 'ongoing',
            'initial_message' => 'Borrower opened support chat.',
            'chat_token' => bin2hex(random_bytes(20)),
            'last_message_at' => now(),
            'unread_count' => 3,
        ]);
        $token = auth('api')->login($admin);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/admin/leads/{$lead->id}/read")
            ->assertOk()
            ->assertJsonPath('message', 'Conversation marked as read');

        $this->assertSame(0, (int) $lead->fresh()->unread_count);
        $this->assertNotNull($lead->fresh()->last_read_at);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/admin/leads/{$lead->id}/unread")
            ->assertOk()
            ->assertJsonPath('message', 'Conversation marked as unread');

        $this->assertSame(1, (int) $lead->fresh()->unread_count);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/admin/leads/{$lead->id}/archive")
            ->assertOk()
            ->assertJsonPath('message', 'Conversation archived');

        $this->assertTrue((bool) $lead->fresh()->is_archived);
        $this->assertNotNull($lead->fresh()->archived_at);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/v1/admin/leads/{$lead->id}/unarchive")
            ->assertOk()
            ->assertJsonPath('message', 'Conversation unarchived');

        $this->assertFalse((bool) $lead->fresh()->is_archived);
        $this->assertNull($lead->fresh()->archived_at);
    }

    public function test_only_system_admin_can_delete_borrower_portal_thread(): void
    {
        $supportAgent = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $systemAdmin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $role = Role::create(['name' => 'System Admin', 'slug' => 'system-admin']);
        $permission = Permission::create(['name' => 'Manage users', 'slug' => 'users.manage', 'group_name' => 'Users']);
        $role->permissions()->attach($permission->id);
        $systemAdmin->roles()->attach($role->id);

        $lead = Lead::create([
            'name' => 'Delete Me',
            'email' => 'delete-me@example.com',
            'loan_type' => 'Borrower Support',
            'status' => 'ongoing',
            'initial_message' => 'Borrower opened support chat.',
            'chat_token' => bin2hex(random_bytes(20)),
            'last_message_at' => now(),
        ]);

        $this->withHeader('Authorization', 'Bearer '.auth('api')->login($supportAgent))
            ->deleteJson("/api/v1/admin/leads/{$lead->id}")
            ->assertForbidden();

        $this->withHeader('Authorization', 'Bearer '.auth('api')->login($systemAdmin))
            ->deleteJson("/api/v1/admin/leads/{$lead->id}")
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertSoftDeleted('leads', ['id' => $lead->id]);
    }
}
