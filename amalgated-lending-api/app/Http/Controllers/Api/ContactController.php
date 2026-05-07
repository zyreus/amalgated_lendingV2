<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\IndexContactRequest;
use App\Http\Requests\Api\StoreContactRequest;
use App\Http\Requests\Api\UpdateContactRequest;
use App\Http\Resources\ContactResource;
use App\Jobs\GenerateAiContactSummary;
use App\Models\Contact;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class ContactController extends Controller
{
    public function index(IndexContactRequest $request)
    {
        $this->authorize('viewAny', Contact::class);

        $user = $request->user();
        $validated = $request->validated();

        $contacts = Contact::query()
            ->where('owner_user_id', $user->id)
            ->when($validated['search'] ?? null, function ($query, $search) {
                $like = '%'.trim((string) $search).'%';

                $query->where(function ($nested) use ($like) {
                    $nested->where('name', 'like', $like)
                        ->orWhere('email', 'like', $like)
                        ->orWhere('phone', 'like', $like)
                        ->orWhere('company', 'like', $like);
                });
            })
            ->when($validated['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($validated['source'] ?? null, fn ($query, $source) => $query->where('source', $source))
            ->withCount('chats')
            ->select('contacts.*')
            ->selectSub(function ($query) {
                $query->from('chats')
                    ->selectRaw('MAX(last_message_at)')
                    ->whereColumn('chats.contact_id', 'contacts.id');
            }, 'latest_chat_at')
            ->orderByDesc('latest_chat_at')
            ->orderByDesc('updated_at')
            ->paginate((int) ($validated['per_page'] ?? 20))
            ->withQueryString();

        return ContactResource::collection($contacts);
    }

    public function show(Contact $contact): ContactResource
    {
        $this->authorize('view', $contact);

        $contact->loadCount('chats');

        return new ContactResource($contact);
    }

    public function store(StoreContactRequest $request): ContactResource
    {
        $this->authorize('create', Contact::class);

        $contact = Contact::create([
            ...$request->validated(),
            'owner_user_id' => $request->user()->id,
        ]);

        Cache::forget($this->contactStatsCacheKey($request->user()->id));
        GenerateAiContactSummary::dispatch($contact->id);

        return new ContactResource($contact->fresh());
    }

    public function update(UpdateContactRequest $request, Contact $contact): ContactResource
    {
        $this->authorize('update', $contact);

        $contact->fill($request->validated());
        if ($contact->isDirty(['name', 'email', 'phone', 'company', 'job_title', 'notes', 'metadata'])) {
            $contact->ai_summary_generated_at = null;
        }
        $contact->save();

        Cache::forget($this->contactStatsCacheKey($request->user()->id));
        GenerateAiContactSummary::dispatch($contact->id);

        return new ContactResource($contact->fresh());
    }

    public function destroy(Contact $contact): JsonResponse
    {
        $this->authorize('delete', $contact);

        $ownerId = (int) $contact->owner_user_id;
        $contact->delete();
        Cache::forget($this->contactStatsCacheKey($ownerId));

        return response()->json(['ok' => true]);
    }

    private function contactStatsCacheKey(int $userId): string
    {
        return "crm_contacts:stats:user:{$userId}";
    }
}
