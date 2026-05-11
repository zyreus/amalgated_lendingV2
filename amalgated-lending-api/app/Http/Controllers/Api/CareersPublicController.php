<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CareerApplicant;
use App\Models\CareerApplication;
use App\Models\CareerJob;
use App\Services\CareersMailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CareersPublicController extends Controller
{
    public function jobs(): JsonResponse
    {
        $jobs = CareerJob::query()
            ->listedPublic()
            ->with(['department:id,name', 'branch:id,name'])
            ->orderByDesc('published_at')
            ->get()
            ->map(fn (CareerJob $j) => $this->publicJobSummary($j));

        return response()->json(['ok' => true, 'data' => $jobs]);
    }

    public function show(string $slug): JsonResponse
    {
        $job = CareerJob::query()
            ->listedPublic()
            ->where('slug', $slug)
            ->with(['department:id,name', 'branch:id,name'])
            ->first();
        if (! $job) {
            return response()->json(['ok' => false, 'message' => 'Job not found.'], 404);
        }

        return response()->json(['ok' => true, 'data' => $this->publicJobDetail($job)]);
    }

    public function apply(Request $request, string $slug, CareersMailService $mail): JsonResponse
    {
        $job = CareerJob::query()
            ->where('slug', $slug)
            ->first();
        if (! $job || ! $job->acceptsApplications()) {
            return response()->json(['ok' => false, 'message' => 'This position is not accepting applications.'], 422);
        }

        $data = $request->validate([
            'first_name' => 'required|string|max:120',
            'last_name' => 'required|string|max:120',
            'email' => 'required|email|max:255',
            'phone' => 'nullable|string|max:64',
            'portfolio_url' => 'nullable|url|max:512',
            'cover_letter' => 'nullable|string|max:12000',
            'resume' => 'required|file|mimes:pdf,doc,docx|max:5120',
        ]);

        try {
            $application = DB::transaction(function () use ($data, $job, $request) {
                $applicant = CareerApplicant::query()->firstOrCreate(
                    ['email' => mb_strtolower(trim($data['email']))],
                    [
                        'phone' => $data['phone'] ?? null,
                        'first_name' => $data['first_name'],
                        'last_name' => $data['last_name'],
                        'portfolio_url' => $data['portfolio_url'] ?? null,
                    ]
                );

                $applicant->fill([
                    'phone' => $data['phone'] ?? $applicant->phone,
                    'first_name' => $data['first_name'],
                    'last_name' => $data['last_name'],
                    'portfolio_url' => $data['portfolio_url'] ?? $applicant->portfolio_url,
                ])->save();

                if (CareerApplication::query()
                    ->where('careers_job_id', $job->id)
                    ->where('careers_applicant_id', $applicant->id)
                    ->exists()) {
                    throw new \RuntimeException('duplicate');
                }

                $file = $request->file('resume');
                $ext = $file->getClientOriginalExtension() ?: 'pdf';
                $storedName = Str::uuid().'.'.$ext;
                $path = $file->storeAs('career_resumes', $storedName, 'local');

                return CareerApplication::create([
                    'careers_job_id' => $job->id,
                    'careers_applicant_id' => $applicant->id,
                    'cover_letter' => $data['cover_letter'] ?? null,
                    'resume_disk' => 'local',
                    'resume_path' => $path,
                    'resume_original_name' => $file->getClientOriginalName(),
                    'status' => CareerApplication::STATUS_NEW,
                    'applied_at' => now(),
                    'send_automated_emails' => true,
                ]);
            });
        } catch (\RuntimeException $e) {
            if ($e->getMessage() === 'duplicate') {
                return response()->json([
                    'ok' => false,
                    'message' => 'You have already applied for this position.',
                ], 422);
            }
            throw $e;
        }

        $application->load(['job', 'applicant']);
        if ($application->send_automated_emails) {
            $mail->sendApplicationReceived($application);
        }

        return response()->json([
            'ok' => true,
            'message' => 'Application submitted successfully.',
            'application_id' => $application->id,
        ], 201);
    }

    private function publicJobSummary(CareerJob $j): array
    {
        return [
            'id' => $j->id,
            'title' => $j->title,
            'slug' => $j->slug,
            'employment_type' => $j->employment_type,
            'department' => $j->department?->name,
            'branch' => $j->branch?->name,
            'salary_min' => $j->salary_min,
            'salary_max' => $j->salary_max,
            'salary_currency' => $j->salary_currency,
            'application_deadline' => optional($j->application_deadline)?->toDateString(),
            'published_at' => optional($j->published_at)?->toIso8601String(),
            'seo_description' => $j->seo_description,
        ];
    }

    private function publicJobDetail(CareerJob $j): array
    {
        return array_merge($this->publicJobSummary($j), [
            'qualifications' => $j->qualifications,
            'responsibilities' => $j->responsibilities,
            'requirements' => $j->requirements,
            'benefits' => $j->benefits,
            'application_instructions' => $j->application_instructions,
            'seo_title' => $j->seo_title ?: $j->title,
        ]);
    }
}
