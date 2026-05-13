<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class ActivityLogger
{
    public function __construct(private Request $request)
    {
    }

    public function log(
        ?User $user,
        string $action,
        ?Model $subject = null,
        array $properties = [],
        ?string $module = null,
        int|string|null $recordId = null,
    ): ActivityLog {
        $resolvedModule = $module ?? ($subject ? $subject->getTable() : null);
        $resolvedRecordId = $recordId ?? ($subject ? $subject->getKey() : null);
        if (is_string($resolvedRecordId) && ctype_digit($resolvedRecordId)) {
            $resolvedRecordId = (int) $resolvedRecordId;
        }
        if (! is_int($resolvedRecordId)) {
            $resolvedRecordId = null;
        }

        return ActivityLog::create([
            'user_id' => $user?->id,
            'action' => $action,
            'module' => $resolvedModule,
            'record_id' => $resolvedRecordId,
            'subject_type' => $subject ? $subject->getMorphClass() : null,
            'subject_id' => $subject?->getKey(),
            'properties' => $properties ?: null,
            'ip_address' => $this->request->ip(),
            'user_agent' => substr((string) $this->request->userAgent(), 0, 512),
        ]);
    }
}
