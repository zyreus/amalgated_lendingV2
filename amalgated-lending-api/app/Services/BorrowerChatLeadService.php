<?php

namespace App\Services;

use App\Models\Lead;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

class BorrowerChatLeadService
{
    public const LOAN_TYPE = 'Borrower Support';

    public const AUTO_INITIAL_MESSAGE = 'Borrower account — ready for staff messaging.';

    public const CHAT_OPENED_INITIAL_MESSAGE = 'Borrower opened support chat.';

    public function ensureForUser(User $user, bool $borrowerInitiated = false): Lead
    {
        $email = mb_strtolower(trim((string) $user->email));

        $lead = Lead::query()
            ->where('loan_type', self::LOAN_TYPE)
            ->where(function ($query) use ($user, $email) {
                $query->where('user_id', $user->id)
                    ->orWhereRaw('LOWER(email) = ?', [$email]);
            })
            ->orderByDesc('id')
            ->first();

        if ($lead) {
            $updates = [];

            if ((int) $lead->user_id !== (int) $user->id) {
                $updates['user_id'] = $user->id;
            }

            if ($borrowerInitiated && ! $lead->messages()->exists()) {
                $updates['initial_message'] = self::CHAT_OPENED_INITIAL_MESSAGE;
            }

            if ($updates !== []) {
                $lead->forceFill($updates)->save();
            }

            return $lead->fresh();
        }

        return Lead::create([
            'user_id' => $user->id,
            'name' => (string) $user->name,
            'email' => (string) $user->email,
            'phone' => $user->phone ?: null,
            'organization' => null,
            'loan_type' => self::LOAN_TYPE,
            'status' => 'ongoing',
            'initial_message' => $borrowerInitiated
                ? self::CHAT_OPENED_INITIAL_MESSAGE
                : self::AUTO_INITIAL_MESSAGE,
            'chat_token' => bin2hex(random_bytes(20)),
            'last_message_at' => $user->created_at ?? now(),
        ]);
    }

    public function syncMissingForAllBorrowers(): int
    {
        $created = 0;

        User::query()
            ->where(function ($query) {
                $query->where('role', 'borrower')
                    ->orWhereHas('roles', fn ($roleQuery) => $roleQuery->where('slug', 'borrower'));
            })
            ->where(function ($query) {
                $query->where('is_archived', false)->orWhereNull('is_archived');
            })
            ->whereNotExists(function ($query) {
                $query->selectRaw('1')
                    ->from('leads')
                    ->whereColumn('leads.user_id', 'users.id')
                    ->where('leads.loan_type', self::LOAN_TYPE)
                    ->whereNull('leads.deleted_at');
            })
            ->orderBy('id')
            ->chunkById(200, function ($borrowers) use (&$created) {
                foreach ($borrowers as $borrower) {
                    $beforeId = Lead::query()
                        ->where('loan_type', self::LOAN_TYPE)
                        ->where('user_id', $borrower->id)
                        ->value('id');

                    $this->ensureForUser($borrower);

                    $afterId = Lead::query()
                        ->where('loan_type', self::LOAN_TYPE)
                        ->where('user_id', $borrower->id)
                        ->value('id');

                    if (! $beforeId && $afterId) {
                        $created++;
                    }
                }
            });

        return $created;
    }

    public function syncMissingIfNeeded(): void
    {
        Cache::remember('borrower_chat_leads_sync_check', 60, function () {
            $this->syncMissingForAllBorrowers();

            return true;
        });
    }
}
