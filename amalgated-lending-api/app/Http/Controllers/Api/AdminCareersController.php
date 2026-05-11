<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CareerApplication;
use App\Models\CareerBranch;
use App\Models\CareerDepartment;
use App\Models\CareerInterview;
use App\Models\CareerJob;
use App\Models\CareersEmailLog;
use App\Services\ActivityLogger;
use App\Services\CareersMailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminCareersController extends Controller
{
    public function dashboard(): JsonResponse
    {
        $from = now()->subMonths(5)->startOfMonth();
        $apps = CareerApplication::query()
            ->where('applied_at', '>=', $from)
            ->get(['applied_at']);
        $byMonth = [];
        foreach ($apps as $a) {
            $k = $a->applied_at?->format('Y-m') ?? '';
            if ($k === '') {
                continue;
            }
            $byMonth[$k] = ($byMonth[$k] ?? 0) + 1;
        }
        ksort($byMonth);

        $statusCounts = CareerApplication::query()
            ->selectRaw('status, COUNT(*) as c')
            ->groupBy('status')
            ->pluck('c', 'status')
            ->all();

        $jobStatusCounts = CareerJob::query()
            ->selectRaw('status, COUNT(*) as c')
            ->whereNull('deleted_at')
            ->groupBy('status')
            ->pluck('c', 'status')
            ->all();

        $publishedLive = CareerJob::query()->listedPublic()->count();

        return response()->json([
            'ok' => true,
            'data' => [
                'jobs' => [
                    'active_listed' => $publishedLive,
                    'draft' => (int) ($jobStatusCounts[CareerJob::STATUS_DRAFT] ?? 0),
                    'published' => (int) ($jobStatusCounts[CareerJob::STATUS_PUBLISHED] ?? 0),
                    'closed' => (int) ($jobStatusCounts[CareerJob::STATUS_CLOSED] ?? 0),
                    'archived' => (int) ($jobStatusCounts[CareerJob::STATUS_ARCHIVED] ?? 0),
                ],
                'applicants' => [
                    'total_applications' => CareerApplication::query()->count(),
                    'by_status' => $statusCounts,
                    'interview_scheduled' => (int) ($statusCounts[CareerApplication::STATUS_INTERVIEW_SCHEDULED] ?? 0),
                    'hired' => (int) ($statusCounts[CareerApplication::STATUS_HIRED] ?? 0),
                    'rejected' => (int) ($statusCounts[CareerApplication::STATUS_REJECTED] ?? 0),
                ],
                'trends' => [
                    'applications_by_month' => $byMonth,
                ],
            ],
        ]);
    }

    public function departments(): JsonResponse
    {
        $rows = CareerDepartment::query()->orderBy('sort_order')->orderBy('name')->get();

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    public function storeDepartment(Request $request, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'sort_order' => 'nullable|integer|min:0|max:65535',
            'is_active' => 'nullable|boolean',
        ]);
        $slug = $data['slug'] ?? Str::slug($data['name']);
        $slug = $this->uniqueDepartmentSlug($slug);
        $row = CareerDepartment::create([
            'name' => $data['name'],
            'slug' => $slug,
            'sort_order' => $data['sort_order'] ?? 0,
            'is_active' => $data['is_active'] ?? true,
        ]);
        $logger->log($request->user(), 'careers.department_created', $row);

        return response()->json(['ok' => true, 'data' => $row], 201);
    }

    public function updateDepartment(Request $request, CareerDepartment $careerDepartment, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'slug' => 'nullable|string|max:255',
            'sort_order' => 'nullable|integer|min:0|max:65535',
            'is_active' => 'nullable|boolean',
        ]);
        if (isset($data['name'])) {
            $careerDepartment->name = $data['name'];
        }
        if (array_key_exists('slug', $data) && $data['slug'] !== null) {
            $careerDepartment->slug = $this->uniqueDepartmentSlug(Str::slug($data['slug']), $careerDepartment->id);
        }
        if (isset($data['sort_order'])) {
            $careerDepartment->sort_order = $data['sort_order'];
        }
        if (isset($data['is_active'])) {
            $careerDepartment->is_active = $data['is_active'];
        }
        $careerDepartment->save();
        $logger->log($request->user(), 'careers.department_updated', $careerDepartment);

        return response()->json(['ok' => true, 'data' => $careerDepartment->fresh()]);
    }

    public function destroyDepartment(Request $request, CareerDepartment $careerDepartment, ActivityLogger $logger): JsonResponse
    {
        $careerDepartment->delete();
        $logger->log($request->user(), 'careers.department_deleted', $careerDepartment);

        return response()->json(['ok' => true]);
    }

    public function branches(): JsonResponse
    {
        $rows = CareerBranch::query()->orderBy('sort_order')->orderBy('name')->get();

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    public function storeBranch(Request $request, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:64',
            'address' => 'nullable|string|max:512',
            'sort_order' => 'nullable|integer|min:0|max:65535',
            'is_active' => 'nullable|boolean',
        ]);
        $row = CareerBranch::create([
            'name' => $data['name'],
            'code' => $data['code'] ?? null,
            'address' => $data['address'] ?? null,
            'sort_order' => $data['sort_order'] ?? 0,
            'is_active' => $data['is_active'] ?? true,
        ]);
        $logger->log($request->user(), 'careers.branch_created', $row);

        return response()->json(['ok' => true, 'data' => $row], 201);
    }

    public function updateBranch(Request $request, CareerBranch $careerBranch, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'code' => 'nullable|string|max:64',
            'address' => 'nullable|string|max:512',
            'sort_order' => 'nullable|integer|min:0|max:65535',
            'is_active' => 'nullable|boolean',
        ]);
        $careerBranch->fill($data);
        $careerBranch->save();
        $logger->log($request->user(), 'careers.branch_updated', $careerBranch);

        return response()->json(['ok' => true, 'data' => $careerBranch->fresh()]);
    }

    public function destroyBranch(Request $request, CareerBranch $careerBranch, ActivityLogger $logger): JsonResponse
    {
        $careerBranch->delete();
        $logger->log($request->user(), 'careers.branch_deleted', $careerBranch);

        return response()->json(['ok' => true]);
    }

    public function jobs(Request $request): JsonResponse
    {
        $q = CareerJob::query()
            ->with(['department:id,name', 'branch:id,name'])
            ->withCount('applications')
            ->orderByDesc('id');
        if ($request->query('status')) {
            $q->where('status', $request->query('status'));
        }
        if ($request->query('q')) {
            $term = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $request->query('q')).'%';
            $q->where(function ($w) use ($term) {
                $w->where('title', 'like', $term)->orWhere('slug', 'like', $term);
            });
        }
        $per = min(100, max(1, (int) $request->query('per_page', 25)));

        return response()->json(['ok' => true, 'data' => $q->paginate($per)]);
    }

    public function showJob(CareerJob $careerJob): JsonResponse
    {
        $careerJob->load(['department', 'branch']);

        return response()->json(['ok' => true, 'data' => $this->jobPayload($careerJob)]);
    }

    public function storeJob(Request $request, ActivityLogger $logger): JsonResponse
    {
        $data = $this->validateJob($request);
        $slugSource = isset($data['slug']) && $data['slug'] !== '' ? (string) $data['slug'] : (string) $data['title'];
        unset($data['slug']);
        $slug = $this->uniqueJobSlug(Str::slug($slugSource) ?: 'position');
        $job = CareerJob::create(array_merge($data, [
            'slug' => $slug,
            'created_by' => $request->user()?->id,
        ]));
        if ($job->status === CareerJob::STATUS_PUBLISHED && $job->published_at === null) {
            $job->published_at = now();
            $job->save();
        }
        $logger->log($request->user(), 'careers.job_created', $job);

        return response()->json(['ok' => true, 'data' => $this->jobPayload($job->fresh(['department', 'branch']))], 201);
    }

    public function updateJob(Request $request, CareerJob $careerJob, ActivityLogger $logger): JsonResponse
    {
        $data = $this->validateJob($request, partial: true);
        if (isset($data['title']) && ! isset($data['slug'])) {
            $data['slug'] = Str::slug($data['title']);
        }
        if (isset($data['slug'])) {
            $data['slug'] = $this->uniqueJobSlug(Str::slug($data['slug']), $careerJob->id);
        }
        $careerJob->fill($data);
        if ($careerJob->status === CareerJob::STATUS_PUBLISHED && $careerJob->published_at === null) {
            $careerJob->published_at = now();
        }
        $careerJob->save();
        $logger->log($request->user(), 'careers.job_updated', $careerJob);

        return response()->json(['ok' => true, 'data' => $this->jobPayload($careerJob->fresh(['department', 'branch']))]);
    }

    public function destroyJob(Request $request, CareerJob $careerJob, ActivityLogger $logger): JsonResponse
    {
        $careerJob->delete();
        $logger->log($request->user(), 'careers.job_deleted', $careerJob);

        return response()->json(['ok' => true]);
    }

    public function publishJob(Request $request, CareerJob $careerJob, ActivityLogger $logger): JsonResponse
    {
        $careerJob->status = CareerJob::STATUS_PUBLISHED;
        $careerJob->published_at = now();
        $careerJob->save();
        $logger->log($request->user(), 'careers.job_published', $careerJob);

        return response()->json(['ok' => true, 'data' => $this->jobPayload($careerJob->fresh(['department', 'branch']))]);
    }

    public function unpublishJob(Request $request, CareerJob $careerJob, ActivityLogger $logger): JsonResponse
    {
        $careerJob->status = CareerJob::STATUS_DRAFT;
        $careerJob->published_at = null;
        $careerJob->save();
        $logger->log($request->user(), 'careers.job_unpublished', $careerJob);

        return response()->json(['ok' => true, 'data' => $this->jobPayload($careerJob->fresh(['department', 'branch']))]);
    }

    public function applications(Request $request): JsonResponse
    {
        $q = CareerApplication::query()
            ->with(['applicant', 'job:id,title,slug,status', 'recruiter:id,name'])
            ->orderByDesc('applied_at');
        if ($request->query('status')) {
            $q->where('status', $request->query('status'));
        }
        if ($request->query('job_id')) {
            $q->where('careers_job_id', (int) $request->query('job_id'));
        }
        if ($request->query('q')) {
            $term = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $request->query('q')).'%';
            $q->whereHas('applicant', function ($w) use ($term) {
                $w->where('email', 'like', $term)
                    ->orWhere('first_name', 'like', $term)
                    ->orWhere('last_name', 'like', $term)
                    ->orWhere('phone', 'like', $term);
            });
        }
        $per = min(100, max(1, (int) $request->query('per_page', 25)));

        return response()->json(['ok' => true, 'data' => $q->paginate($per)]);
    }

    public function showApplication(CareerApplication $careerApplication): JsonResponse
    {
        $careerApplication->load(['applicant', 'job.department', 'job.branch', 'recruiter', 'interviews.creator']);

        return response()->json(['ok' => true, 'data' => $this->applicationPayload($careerApplication)]);
    }

    public function updateApplication(Request $request, CareerApplication $careerApplication, CareersMailService $mail, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'status' => 'sometimes|string|in:'.implode(',', [
                CareerApplication::STATUS_NEW,
                CareerApplication::STATUS_UNDER_REVIEW,
                CareerApplication::STATUS_INTERVIEW_SCHEDULED,
                CareerApplication::STATUS_PASSED,
                CareerApplication::STATUS_REJECTED,
                CareerApplication::STATUS_HIRED,
            ]),
            'internal_notes' => 'nullable|string|max:20000',
            'interview_feedback' => 'nullable|string|max:20000',
            'recruiter_id' => 'nullable|integer|exists:users,id',
            'send_automated_emails' => 'nullable|boolean',
        ]);

        $oldStatus = $careerApplication->status;
        $careerApplication->fill($data);
        $careerApplication->save();

        if (isset($data['status']) && $data['status'] !== $oldStatus && $careerApplication->send_automated_emails) {
            $this->notifyStatusChange($mail, $careerApplication, $oldStatus, $data['status']);
        }

        $logger->log($request->user(), 'careers.application_updated', $careerApplication, [
            'from_status' => $oldStatus,
            'to_status' => $careerApplication->status,
        ]);

        return response()->json(['ok' => true, 'data' => $this->applicationPayload($careerApplication->fresh(['applicant', 'job', 'recruiter', 'interviews']))]);
    }

    public function storeInterview(Request $request, CareerApplication $careerApplication, CareersMailService $mail, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'scheduled_at' => 'required|date',
            'timezone' => 'nullable|string|max:64',
            'location' => 'nullable|string|max:512',
            'meeting_link' => 'nullable|string|max:512',
            'interviewer_name' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:10000',
            'outcome' => 'nullable|string|max:32',
            'send_invitation_email' => 'nullable|boolean',
        ]);

        $interview = CareerInterview::create([
            'careers_application_id' => $careerApplication->id,
            'scheduled_at' => $data['scheduled_at'],
            'timezone' => $data['timezone'] ?? 'Asia/Manila',
            'location' => $data['location'] ?? null,
            'meeting_link' => $data['meeting_link'] ?? null,
            'interviewer_name' => $data['interviewer_name'] ?? null,
            'notes' => $data['notes'] ?? null,
            'outcome' => $data['outcome'] ?? null,
            'created_by' => $request->user()?->id,
        ]);

        $careerApplication->status = CareerApplication::STATUS_INTERVIEW_SCHEDULED;
        $careerApplication->save();

        if (($data['send_invitation_email'] ?? true) && $careerApplication->send_automated_emails) {
            $mail->sendInterviewInvitation($careerApplication->fresh(['applicant', 'job']), $interview);
        }

        $logger->log($request->user(), 'careers.interview_scheduled', $interview);

        return response()->json(['ok' => true, 'data' => $interview], 201);
    }

    public function updateInterview(Request $request, CareerInterview $careerInterview, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'scheduled_at' => 'sometimes|date',
            'timezone' => 'nullable|string|max:64',
            'location' => 'nullable|string|max:512',
            'meeting_link' => 'nullable|string|max:512',
            'interviewer_name' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:10000',
            'outcome' => 'nullable|string|max:32',
        ]);
        $careerInterview->fill($data);
        $careerInterview->save();
        $logger->log($request->user(), 'careers.interview_updated', $careerInterview);

        return response()->json(['ok' => true, 'data' => $careerInterview->fresh()]);
    }

    public function destroyInterview(Request $request, CareerInterview $careerInterview, ActivityLogger $logger): JsonResponse
    {
        $careerInterview->delete();
        $logger->log($request->user(), 'careers.interview_deleted', $careerInterview);

        return response()->json(['ok' => true]);
    }

    public function resume(CareerApplication $careerApplication): StreamedResponse|JsonResponse
    {
        if (! $careerApplication->resume_path || ! Storage::disk($careerApplication->resume_disk)->exists($careerApplication->resume_path)) {
            return response()->json(['ok' => false, 'message' => 'Resume file not found.'], 404);
        }

        return Storage::disk($careerApplication->resume_disk)->download(
            $careerApplication->resume_path,
            $careerApplication->resume_original_name ?: 'resume.pdf'
        );
    }

    public function exportApplications(Request $request): StreamedResponse
    {
        $q = CareerApplication::query()->with(['applicant', 'job:id,title']);
        if ($request->query('status')) {
            $q->where('status', $request->query('status'));
        }
        if ($request->query('job_id')) {
            $q->where('careers_job_id', (int) $request->query('job_id'));
        }

        $filename = 'careers-applications-'.now()->format('Y-m-d-His').'.csv';

        return response()->streamDownload(function () use ($q): void {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['id', 'job', 'applicant_name', 'email', 'phone', 'status', 'applied_at']);
            $q->orderByDesc('id')->chunk(500, function ($chunk) use ($out): void {
                foreach ($chunk as $row) {
                    /** @var CareerApplication $row */
                    fputcsv($out, [
                        $row->id,
                        $row->job?->title,
                        trim(($row->applicant?->first_name ?? '').' '.($row->applicant?->last_name ?? '')),
                        $row->applicant?->email,
                        $row->applicant?->phone,
                        $row->status,
                        $row->applied_at?->toIso8601String(),
                    ]);
                }
            });
            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function emailLogs(Request $request): JsonResponse
    {
        $q = CareersEmailLog::query()->orderByDesc('id');
        if ($request->query('application_id')) {
            $app = CareerApplication::query()->find((int) $request->query('application_id'));
            if ($app) {
                $q->where('related_type', $app->getMorphClass())->where('related_id', $app->id);
            }
        }
        $per = min(100, max(1, (int) $request->query('per_page', 40)));

        return response()->json(['ok' => true, 'data' => $q->paginate($per)]);
    }

    private function notifyStatusChange(CareersMailService $mail, CareerApplication $application, string $old, string $new): void
    {
        $application->loadMissing(['applicant', 'job']);
        $jobTitle = $application->job?->title ?? 'your application';
        if ($new === CareerApplication::STATUS_REJECTED) {
            $mail->sendStatusChange(
                $application,
                'status_rejected',
                'Update on your application — '.$jobTitle,
                $mail->buildRejectionBody($application)
            );
        } elseif ($new === CareerApplication::STATUS_HIRED) {
            $mail->sendStatusChange(
                $application,
                'status_hired',
                'Congratulations — '.$jobTitle,
                $mail->buildHiredBody($application)
            );
        } elseif ($new === CareerApplication::STATUS_PASSED) {
            $mail->sendStatusChange(
                $application,
                'status_passed',
                'Update on your application — '.$jobTitle,
                $mail->buildPassedBody($application)
            );
        } elseif ($new === CareerApplication::STATUS_UNDER_REVIEW && $old === CareerApplication::STATUS_NEW) {
            $mail->sendStatusChange(
                $application,
                'status_under_review',
                'Your application is under review — '.$jobTitle,
                '<p>Hi '.e($application->applicant?->first_name ?? 'there').',</p>'
                    .'<p>Your application for <strong>'.e($jobTitle).'</strong> is now under review by our hiring team.</p>'
            );
        }
    }

    private function validateJob(Request $request, bool $partial = false): array
    {
        $rules = [
            'department_id' => 'nullable|exists:careers_departments,id',
            'branch_id' => 'nullable|exists:careers_branches,id',
            'title' => ($partial ? 'sometimes|' : '').'required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'employment_type' => ($partial ? 'sometimes|' : '').'required|string|max:64',
            'salary_min' => 'nullable|numeric|min:0',
            'salary_max' => 'nullable|numeric|min:0',
            'salary_currency' => 'nullable|string|max:8',
            'qualifications' => 'nullable|string|max:65000',
            'responsibilities' => 'nullable|string|max:65000',
            'requirements' => 'nullable|string|max:65000',
            'benefits' => 'nullable|string|max:65000',
            'application_instructions' => 'nullable|string|max:65000',
            'status' => 'nullable|string|in:'.implode(',', [
                CareerJob::STATUS_DRAFT,
                CareerJob::STATUS_PUBLISHED,
                CareerJob::STATUS_CLOSED,
                CareerJob::STATUS_ARCHIVED,
            ]),
            'application_deadline' => 'nullable|date',
            'published_at' => 'nullable|date',
            'seo_title' => 'nullable|string|max:255',
            'seo_description' => 'nullable|string|max:512',
        ];

        return $request->validate($rules);
    }

    private function jobPayload(CareerJob $j): array
    {
        return [
            'id' => $j->id,
            'department_id' => $j->department_id,
            'branch_id' => $j->branch_id,
            'department' => $j->department?->only(['id', 'name']),
            'branch' => $j->branch?->only(['id', 'name']),
            'title' => $j->title,
            'slug' => $j->slug,
            'employment_type' => $j->employment_type,
            'salary_min' => $j->salary_min,
            'salary_max' => $j->salary_max,
            'salary_currency' => $j->salary_currency,
            'qualifications' => $j->qualifications,
            'responsibilities' => $j->responsibilities,
            'requirements' => $j->requirements,
            'benefits' => $j->benefits,
            'application_instructions' => $j->application_instructions,
            'status' => $j->status,
            'application_deadline' => optional($j->application_deadline)?->toDateString(),
            'published_at' => optional($j->published_at)?->toIso8601String(),
            'seo_title' => $j->seo_title,
            'seo_description' => $j->seo_description,
            'accepts_applications' => $j->acceptsApplications(),
            'applications_count' => $j->applications_count ?? $j->applications()->count(),
            'created_at' => optional($j->created_at)?->toIso8601String(),
            'updated_at' => optional($j->updated_at)?->toIso8601String(),
        ];
    }

    private function applicationPayload(CareerApplication $a): array
    {
        return [
            'id' => $a->id,
            'status' => $a->status,
            'status_label' => CareerApplication::statusLabels()[$a->status] ?? $a->status,
            'applied_at' => optional($a->applied_at)?->toIso8601String(),
            'cover_letter' => $a->cover_letter,
            'internal_notes' => $a->internal_notes,
            'interview_feedback' => $a->interview_feedback,
            'send_automated_emails' => $a->send_automated_emails,
            'recruiter' => $a->recruiter ? ['id' => $a->recruiter->id, 'name' => $a->recruiter->name] : null,
            'recruiter_id' => $a->recruiter_id,
            'has_resume' => (bool) $a->resume_path,
            'applicant' => $a->applicant ? [
                'id' => $a->applicant->id,
                'first_name' => $a->applicant->first_name,
                'last_name' => $a->applicant->last_name,
                'email' => $a->applicant->email,
                'phone' => $a->applicant->phone,
                'portfolio_url' => $a->applicant->portfolio_url,
            ] : null,
            'job' => $a->job ? $this->jobPayload($a->job) : null,
            'interviews' => $a->interviews->map(fn (CareerInterview $i) => [
                'id' => $i->id,
                'scheduled_at' => optional($i->scheduled_at)?->toIso8601String(),
                'timezone' => $i->timezone,
                'location' => $i->location,
                'meeting_link' => $i->meeting_link,
                'interviewer_name' => $i->interviewer_name,
                'notes' => $i->notes,
                'outcome' => $i->outcome,
            ]),
        ];
    }

    private function uniqueJobSlug(string $base, ?int $ignoreId = null): string
    {
        $slug = $base !== '' ? $base : 'position';
        $i = 0;
        while (CareerJob::withTrashed()
            ->where('slug', $slug)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->exists()) {
            $slug = $base.'-'.(++$i);
        }

        return $slug;
    }

    private function uniqueDepartmentSlug(string $base, ?int $ignoreId = null): string
    {
        $slug = $base !== '' ? $base : 'department';
        $i = 0;
        while (CareerDepartment::query()
            ->where('slug', $slug)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->exists()) {
            $slug = $base.'-'.(++$i);
        }

        return $slug;
    }
}
