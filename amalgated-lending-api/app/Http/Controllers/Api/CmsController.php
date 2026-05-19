<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CmsContent;
use App\Models\Lead;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CmsController extends Controller
{
    public function publicSection(Request $request): JsonResponse
    {
        $locale = $request->query('locale', 'en');

        // Exact key (used by landing newsletter + other blocks)
        if ($request->filled('section_key')) {
            $row = CmsContent::query()
                ->where('section_key', $request->query('section_key'))
                ->where('locale', $locale)
                ->first();

            return response()->json(['ok' => true, 'data' => $row ? [$row] : []]);
        }

        $section = $request->query('section', 'landing');
        $blocks = CmsContent::where('section_key', 'like', $section.'%')
            ->where('locale', $locale)
            ->get();

        return response()->json(['ok' => true, 'data' => $blocks]);
    }

    public function index(Request $request): JsonResponse
    {
        $q = CmsContent::query();
        if ($request->filled('section_key')) {
            $q->where('section_key', $request->query('section_key'));
        }
        if ($request->filled('locale')) {
            $q->where('locale', $request->query('locale'));
        }

        return response()->json(['ok' => true, 'data' => $q->orderBy('section_key')->paginate(50)]);
    }

    public function upsert(Request $request, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'section_key' => 'required|string|max:255',
            'locale' => 'required|string|max:8',
            'title' => 'nullable|string|max:500',
            'body' => 'nullable|string',
            'meta' => 'nullable|array',
        ]);

        $row = CmsContent::updateOrCreate(
            [
                'section_key' => $data['section_key'],
                'locale' => $data['locale'],
            ],
            [
                'title' => $data['title'] ?? null,
                'body' => $data['body'] ?? null,
                'meta' => $data['meta'] ?? null,
                'updated_by' => $request->user()->id,
            ]
        );

        $logger->log($request->user(), 'cms.upsert', $row, ['section' => $row->section_key]);

        return response()->json(['ok' => true, 'content' => $row]);
    }

    public function newsletterSubscribers(Request $request): JsonResponse
    {
        $q = Lead::query()->newsletter();
        if ($search = trim((string) $request->query('search', ''))) {
            $q->where(function ($w) use ($search) {
                $w->where('name', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%');
            });
        }

        $rows = $q->orderByDesc('created_at')->orderByDesc('id')
            ->paginate((int) $request->query('per_page', 50));

        $rows->getCollection()->transform(function (Lead $lead) {
            return [
                'id' => $lead->id,
                'name' => $lead->name,
                'email' => $lead->email,
                'status' => $lead->status,
                'source' => $lead->source,
                'subscribed_at' => optional($lead->created_at)?->toIso8601String(),
            ];
        });

        return response()->json(['ok' => true, 'data' => $rows]);
    }
}
