<?php

namespace App\Jobs;

use App\Models\AiUsage;
use App\Models\Contact;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Throwable;

class GenerateAiContactSummary implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(public int $contactId) {}

    public function handle(): void
    {
        $contact = Contact::query()
            ->with([
                'chats' => fn ($query) => $query->latest('last_message_at')->limit(3),
            ])
            ->find($this->contactId);

        if (! $contact) {
            return;
        }

        $latestChats = $contact->chats->map(function ($chat) {
            return sprintf(
                '[%s] %s',
                $chat->status,
                trim((string) ($chat->subject ?: $chat->ai_summary ?: 'No subject'))
            );
        })->filter()->values()->all();

        $prompt = implode("\n", array_filter([
            'Summarize this CRM contact for an internal agent in 2 concise sentences.',
            'Name: '.$contact->name,
            'Email: '.($contact->email ?: 'n/a'),
            'Phone: '.($contact->phone ?: 'n/a'),
            'Company: '.($contact->company ?: 'n/a'),
            'Source: '.($contact->source ?: 'n/a'),
            'Latest chats:',
            ...$latestChats,
        ]));

        $fallback = collect([
            $contact->company ? "{$contact->name} works with {$contact->company}." : "{$contact->name} is an active CRM contact.",
            $contact->email ? "Primary email: {$contact->email}." : null,
            $contact->phone ? "Phone: {$contact->phone}." : null,
        ])->filter()->implode(' ');

        $summary = $fallback !== '' ? $fallback : 'No AI summary available yet.';

        $provider = (string) config('ai.default_provider', 'openai');
        $model = (string) config('ai.summary_model', 'gpt-4o-mini');
        $startedAt = microtime(true);
        $usage = null;

        try {
            $usage = AiUsage::create([
                'chat_id' => $contact->chats()->value('id'),
                'message_id' => null,
                'provider' => $provider,
                'model' => $model,
                'status' => 'pending',
                'request_key' => 'contact-summary-'.$contact->id,
                'meta' => ['contact_id' => $contact->id],
            ]);

            $response = $this->chatCompletion($provider, $model, [
                ['role' => 'system', 'content' => 'You are a concise CRM assistant.'],
                ['role' => 'user', 'content' => $prompt],
            ]);

            $content = trim((string) data_get($response, 'choices.0.message.content', ''));
            if ($content !== '') {
                $summary = $content;
            }

            if ($usage) {
                $usage->update([
                    'prompt_tokens' => (int) data_get($response, 'usage.prompt_tokens', 0),
                    'completion_tokens' => (int) data_get($response, 'usage.completion_tokens', 0),
                    'total_tokens' => (int) data_get($response, 'usage.total_tokens', 0),
                    'latency_ms' => (int) round((microtime(true) - $startedAt) * 1000),
                    'status' => 'completed',
                    'meta' => array_merge($usage->meta ?? [], ['response_id' => data_get($response, 'id')]),
                ]);
            }
        } catch (Throwable $e) {
            report($e);

            if ($usage) {
                $usage->update([
                    'latency_ms' => (int) round((microtime(true) - $startedAt) * 1000),
                    'status' => 'failed',
                    'meta' => array_merge($usage->meta ?? [], ['error' => $e->getMessage()]),
                ]);
            }
        }

        $contact->forceFill([
            'ai_summary' => $summary,
            'ai_summary_generated_at' => now(),
        ])->save();
    }

    private function chatCompletion(string $provider, string $model, array $messages): array
    {
        $baseUrl = rtrim((string) config("ai.providers.{$provider}.base_url"), '/');
        $apiKey = (string) config("ai.providers.{$provider}.api_key");

        abort_if($baseUrl === '' || $apiKey === '', 500, "AI provider [{$provider}] is not configured.");

        return Http::baseUrl($baseUrl)
            ->timeout((int) config('ai.http_timeout', 60))
            ->withToken($apiKey)
            ->acceptJson()
            ->post('/chat/completions', [
                'model' => $model,
                'messages' => $messages,
                'temperature' => 0.2,
            ])
            ->throw()
            ->json();
    }
}
