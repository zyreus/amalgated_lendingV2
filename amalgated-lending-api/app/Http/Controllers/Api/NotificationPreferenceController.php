<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotificationPreference;
use App\Services\NotificationCenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationPreferenceController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $pref = NotificationPreference::query()->firstOrCreate(
            ['user_id' => $request->user()->id],
            ['in_app' => true, 'email' => true, 'sms' => false, 'muted_categories' => []],
        );

        return response()->json([
            'ok' => true,
            'data' => $this->serialize($pref),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'in_app' => 'sometimes|boolean',
            'email' => 'sometimes|boolean',
            'sms' => 'sometimes|boolean',
            'muted_categories' => 'sometimes|array',
            'muted_categories.*' => 'string|max:96',
            'website_chat_settings' => 'sometimes|array',
            'website_chat_settings.enabled' => 'sometimes|boolean',
            'website_chat_settings.sound' => 'sometimes|boolean',
            'website_chat_settings.browser' => 'sometimes|boolean',
            'website_chat_settings.badge_updates' => 'sometimes|boolean',
            'website_chat_settings.crm_inbox_updates' => 'sometimes|boolean',
            'website_chat_settings.auto_open_crm' => 'sometimes|boolean',
            'website_chat_settings.sound_volume' => 'sometimes|numeric|min:0|max:1',
        ]);

        $pref = NotificationPreference::query()->firstOrCreate(
            ['user_id' => $request->user()->id],
            ['in_app' => true, 'email' => true, 'sms' => false, 'muted_categories' => []],
        );

        $pref->fill(array_intersect_key($data, array_flip(['in_app', 'email', 'sms', 'muted_categories'])));

        if (array_key_exists('website_chat_settings', $data)) {
            $pref->website_chat_settings = NotificationCenter::mergeWebsiteChatSettings(
                is_array($pref->website_chat_settings) ? $pref->website_chat_settings : [],
                $data['website_chat_settings'],
            );
        }

        $pref->save();

        return $this->show($request);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(NotificationPreference $pref): array
    {
        return [
            'in_app' => (bool) $pref->in_app,
            'email' => (bool) $pref->email,
            'sms' => (bool) $pref->sms,
            'muted_categories' => is_array($pref->muted_categories) ? $pref->muted_categories : [],
            'website_chat_settings' => NotificationCenter::mergeWebsiteChatSettings(
                is_array($pref->website_chat_settings) ? $pref->website_chat_settings : [],
                [],
            ),
        ];
    }
}
