<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use App\Services\ActivityLogger;
use App\Services\SettingsService;
use App\Services\SettingsValidator;
use App\Support\SettingsAuthorization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SystemSettingController extends Controller
{
    public function __construct(private SettingsService $settingsService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! SettingsAuthorization::canView($user)) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        return response()->json(['ok' => true, 'settings' => $this->settingsService->all()]);
    }

    public function show(Request $request, string $key): JsonResponse
    {
        $user = $request->user();
        if (! SettingsAuthorization::canView($user)) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        $row = SystemSetting::where('key', $key)->first();
        if (! $row) {
            return response()->json(['ok' => false, 'message' => 'Setting not found.'], 404);
        }

        return response()->json([
            'ok' => true,
            'setting' => [
                'key_name' => $row->key,
                'value' => $row->value ?? [],
                'updated_at' => $row->updated_at,
            ],
        ]);
    }

    public function upsert(Request $request, string $key, ActivityLogger $logger): JsonResponse
    {
        $user = $request->user();
        if (! SettingsAuthorization::canManageKey($user, $key)) {
            return response()->json(['ok' => false, 'message' => 'You do not have permission to change this setting.'], 403);
        }

        try {
            $value = $this->parseValue($request);
            $value = SettingsValidator::validate($key, $value);
        } catch (ValidationException $e) {
            return response()->json([
                'ok' => false,
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
                'key' => $key,
            ], 422);
        }

        $row = $this->persistSetting($user, $key, $value, $logger);

        return response()->json([
            'ok' => true,
            'setting' => [
                'key_name' => $row->key,
                'value' => $row->value ?? [],
                'updated_at' => $row->updated_at,
            ],
        ]);
    }

    public function batchUpsert(Request $request, ActivityLogger $logger): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'settings' => 'required|array|min:1|max:25',
        ]);

        $settingsInput = $data['settings'];
        $errors = [];
        $validated = [];

        foreach ($settingsInput as $key => $value) {
            if (! is_string($key) || $key === '') {
                continue;
            }
            if (! SettingsAuthorization::canManageKey($user, $key)) {
                return response()->json([
                    'ok' => false,
                    'message' => "You do not have permission to change \"{$key}\".",
                    'key' => $key,
                ], 403);
            }
            if (! is_array($value)) {
                $errors[$key] = ['value' => ['Setting value must be an object.']];

                continue;
            }
            try {
                $validated[$key] = SettingsValidator::validate($key, $value);
            } catch (ValidationException $e) {
                foreach ($e->errors() as $field => $messages) {
                    $errors["{$key}.{$field}"] = $messages;
                }
            }
        }

        if ($errors !== []) {
            return response()->json([
                'ok' => false,
                'message' => 'Validation failed.',
                'errors' => $errors,
            ], 422);
        }

        $saved = [];
        DB::transaction(function () use ($validated, $user, $logger, &$saved) {
            foreach ($validated as $key => $value) {
                $saved[$key] = $this->persistSetting($user, $key, $value, $logger);
            }
        });

        $payload = [];
        foreach ($saved as $key => $row) {
            $payload[$key] = [
                'key_name' => $row->key,
                'value' => $row->value ?? [],
                'updated_at' => $row->updated_at,
            ];
        }

        return response()->json(['ok' => true, 'settings' => $payload]);
    }

    /**
     * @return array<string, mixed>
     */
    private function parseValue(Request $request): array
    {
        $data = $request->validate([
            'value' => 'required',
        ]);

        $value = $data['value'];
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                abort(response()->json(['ok' => false, 'message' => 'Invalid JSON value.'], 422));
            }
            $value = $decoded;
        }
        if (! is_array($value)) {
            abort(response()->json(['ok' => false, 'message' => 'Setting value must be a JSON object/array.'], 422));
        }

        return $value;
    }

    private function persistSetting($user, string $key, array $value, ActivityLogger $logger): SystemSetting
    {
        $existing = SystemSetting::where('key', $key)->first();
        $oldValue = $existing?->value ?? [];

        if ($key === 'loan_defaults' && isset($value['interest_rate']) && ! isset($value['default_annual_rate'])) {
            $value['default_annual_rate'] = $value['interest_rate'];
        }
        if ($key === 'loan_configuration' && isset($value['penalty_rate'])) {
            $existingDefaults = SystemSetting::where('key', 'loan_defaults')->first();
            $defaultsValue = array_merge($existingDefaults?->value ?? [], ['penalty_percent' => $value['penalty_rate']]);
            SystemSetting::updateOrCreate(
                ['key' => 'loan_defaults'],
                ['value' => $defaultsValue]
            );
            $this->settingsService->forget('loan_defaults');
        }

        $row = SystemSetting::updateOrCreate(
            ['key' => $key],
            ['value' => $value]
        );

        $this->settingsService->forget($key);

        $changes = $this->diffSettings($oldValue, $row->value ?? []);
        $logger->log($user, 'settings.update', $row, [
            'key' => $row->key,
            'changed_fields' => array_keys($changes),
            'changes' => $this->maskSensitiveChanges($changes),
        ], 'settings', $row->id);

        return $row;
    }

    /**
     * @param  array<string, mixed>  $old
     * @param  array<string, mixed>  $new
     * @return array<string, array{old: mixed, new: mixed}>
     */
    private function diffSettings(array $old, array $new, string $prefix = ''): array
    {
        $changes = [];
        $keys = array_unique(array_merge(array_keys($old), array_keys($new)));

        foreach ($keys as $field) {
            $path = $prefix === '' ? (string) $field : "{$prefix}.{$field}";
            $oldVal = $old[$field] ?? null;
            $newVal = $new[$field] ?? null;

            if (is_array($oldVal) && is_array($newVal)) {
                $changes = array_merge($changes, $this->diffSettings($oldVal, $newVal, $path));

                continue;
            }

            if ($oldVal !== $newVal) {
                $changes[$path] = ['old' => $oldVal, 'new' => $newVal];
            }
        }

        return $changes;
    }

    /**
     * @param  array<string, array{old: mixed, new: mixed}>  $changes
     * @return array<string, array{old: mixed, new: mixed}>
     */
    private function maskSensitiveChanges(array $changes): array
    {
        foreach ($changes as $path => $change) {
            if (str_contains($path, 'api_keys') || str_contains($path, 'password') || str_contains($path, 'secret')) {
                $changes[$path] = ['old' => '[redacted]', 'new' => '[redacted]'];
            }
        }

        return $changes;
    }
}
