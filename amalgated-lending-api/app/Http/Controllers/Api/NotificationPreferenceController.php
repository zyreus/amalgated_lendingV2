<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotificationPreference;
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
            'data' => [
                'in_app' => (bool) $pref->in_app,
                'email' => (bool) $pref->email,
                'sms' => (bool) $pref->sms,
                'muted_categories' => is_array($pref->muted_categories) ? $pref->muted_categories : [],
            ],
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
        ]);

        $pref = NotificationPreference::query()->firstOrCreate(
            ['user_id' => $request->user()->id],
            ['in_app' => true, 'email' => true, 'sms' => false, 'muted_categories' => []],
        );

        $pref->fill(array_intersect_key($data, array_flip(['in_app', 'email', 'sms', 'muted_categories'])));
        $pref->save();

        return $this->show($request);
    }
}
