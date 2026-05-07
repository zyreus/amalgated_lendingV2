<?php

namespace App\Jobs;

use App\Models\AiUsage;
use App\Models\Chat;
use App\Models\Message;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Throwable;

class ProcessAiChatReply implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    /**
     * @param  array<string, mixed>  $options
     */
    public function __construct(
        public int $chatId,
        public int $triggerMessageId,
        public array $options = [],
    ) {}

    public function handle(): void
    {
        $chat = Chat::query()
            ->with([
                'contact',
                'messages' => fn ($query) => $query
                    ->latest('id')
                    ->limit((int) config('ai.max_context_messages', 20)),
            ])
            ->find($this->chatId);

        if (! $chat) {
            return;
        }

        $contextMessages = $chat->messages
            ->sortBy('id')
            ->values()
            ->map(function (Message $message) {
                $role = match ($message->sender_type) {
                    Message::SENDER_AI => 'assistant',
                    Message::SENDER_AGENT => 'assistant',
                    Message::SENDER_SYSTEM => 'system',
                    default => 'user',
                };

                return [
                    'role' => $role,
                    'content' => $message->content,
                ];
            })
            ->all();

        $provider = (string) config('ai.default_provider', 'openai');
        $model = (string) config('ai.chat_model', 'gpt-4o-mini');
        $startedAt = microtime(true);
        $usage = AiUsage::create([
            'chat_id' => $chat->id,
            'message_id' => $this->triggerMessageId,
            'provider' => $provider,
            'model' => $model,
            'status' => 'pending',
            'request_key' => (string) ($this->options['stream_request_key'] ?? ('chat-reply-'.$chat->id.'-'.$this->triggerMessageId)),
            'meta' => [
                'requested_by_user_id' => $this->options['requested_by_user_id'] ?? null,
                'context_messages' => count($contextMessages),
            ],
        ]);

        $fallback = "Thanks for your message. We've queued an AI-assisted reply pipeline for chat {$chat->public_id}.";

        try {
            $messages = array_merge([
                [
                    'role' => 'system',
                    'content' => implode("\n", array_filter([
                        'You are an internal CRM assistant.',
                        'Be concise, helpful, and action-oriented.',
                        $chat->contact?->ai_summary ? 'Known contact context: '.$chat->contact->ai_summary : null,
                        $chat->ai_summary ? 'Known chat summary: '.$chat->ai_summary : null,
                    ])),
                ],
            ], $contextMessages);

            $response = $this->chatCompletion($provider, $model, $messages);
            $reply = trim((string) data_get($response, 'choices.0.message.content', ''));

            if ($reply === '') {
                $reply = $fallback;
            }

            $assistantMessage = Message::create([
                'chat_id' => $chat->id,
                'sender_type' => Message::SENDER_AI,
                'sender_user_id' => null,
                'role' => 'assistant',
                'content' => $reply,
                'is_ai_generated' => true,
                'provider' => $provider,
                'model' => $model,
                'parent_message_id' => $this->triggerMessageId,
                'stream_request_key' => $usage->request_key,
                'metadata' => [
                    'context_messages' => count($contextMessages),
                ],
            ]);

            $chat->forceFill([
                'last_message_id' => $assistantMessage->id,
                'last_message_at' => $assistantMessage->created_at,
                'customer_unread_count' => $chat->customer_unread_count + 1,
            ])->save();

            $usage->update([
                'message_id' => $assistantMessage->id,
                'prompt_tokens' => (int) data_get($response, 'usage.prompt_tokens', 0),
                'completion_tokens' => (int) data_get($response, 'usage.completion_tokens', 0),
                'total_tokens' => (int) data_get($response, 'usage.total_tokens', 0),
                'latency_ms' => (int) round((microtime(true) - $startedAt) * 1000),
                'status' => 'completed',
                'meta' => array_merge($usage->meta ?? [], [
                    'response_id' => data_get($response, 'id'),
                ]),
            ]);
        } catch (Throwable $e) {
            report($e);

            $usage->update([
                'latency_ms' => (int) round((microtime(true) - $startedAt) * 1000),
                'status' => 'failed',
                'meta' => array_merge($usage->meta ?? [], ['error' => $e->getMessage()]),
            ]);
        }
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
                'temperature' => 0.4,
            ])
            ->throw()
            ->json();
    }
}
