<?php

namespace App\Services;

use App\Models\CareerApplication;
use App\Models\CareerInterview;
use App\Models\CareersEmailLog;
use Illuminate\Support\Facades\Log;
use Throwable;

class CareersMailService
{
    public function __construct(private BrevoMailService $brevo)
    {
    }

    public function isConfigured(): bool
    {
        return $this->brevo->isConfigured();
    }

    public function sendApplicationReceived(CareerApplication $application): void
    {
        $application->loadMissing(['applicant', 'job']);
        $applicant = $application->applicant;
        $job = $application->job;
        if (! $applicant || ! $job) {
            return;
        }
        $appName = (string) config('app.name', 'Amalgated Lending');
        $subject = 'We received your application — '.$job->title;
        $html = $this->wrap(
            '<p>Hi '.e($applicant->first_name).',</p>'
            .'<p>Thank you for applying for the <strong>'.e($job->title).'</strong> role at '.e($appName).'. Our talent team will review your profile and follow up if there is a fit.</p>'
            .'<p>Role: '.e($job->title).'<br>Applied: '.e(optional($application->applied_at)?->toDayDateTimeString() ?? '').'</p>'
        );
        $this->sendLogged($application, $applicant->email, $subject, 'application_received', $html);
    }

    public function sendInterviewInvitation(CareerApplication $application, CareerInterview $interview): void
    {
        $application->loadMissing(['applicant', 'job']);
        $applicant = $application->applicant;
        $job = $application->job;
        if (! $applicant || ! $job) {
            return;
        }
        $when = $interview->scheduled_at?->timezone($interview->timezone ?? 'Asia/Manila')->format('l, F j, Y \a\t g:i A T');
        $link = $interview->meeting_link ? '<p>Meeting link: <a href="'.e($interview->meeting_link).'">'.e($interview->meeting_link).'</a></p>' : '';
        $loc = $interview->location ? '<p>Location: '.e($interview->location).'</p>' : '';
        $subject = 'Interview invitation — '.$job->title;
        $html = $this->wrap(
            '<p>Hi '.e($applicant->first_name).',</p>'
            .'<p>We would like to schedule an interview with you regarding your application for <strong>'.e($job->title).'</strong>.</p>'
            .'<p><strong>When:</strong> '.e((string) $when).'</p>'
            .$loc.$link
            .'<p>If you need to reschedule, reply to this email and we will assist you.</p>'
        );
        $this->sendLogged($application, $applicant->email, $subject, 'interview_invitation', $html);
    }

    public function sendStatusChange(CareerApplication $application, string $templateKey, string $subject, string $bodyHtml): void
    {
        $application->loadMissing('applicant');
        $applicant = $application->applicant;
        if (! $applicant) {
            return;
        }
        $this->sendLogged($application, $applicant->email, $subject, $templateKey, $this->wrap($bodyHtml));
    }

    public function buildRejectionBody(CareerApplication $application): string
    {
        $application->loadMissing(['applicant', 'job']);
        $applicant = $application->applicant;
        $job = $application->job;

        return '<p>Hi '.e($applicant?->first_name ?? 'there').',</p>'
            .'<p>Thank you for your interest in the <strong>'.e($job?->title ?? 'role').'</strong> position. After careful review, we will not be moving forward with your application at this time.</p>'
            .'<p>We appreciate the time you invested and encourage you to watch our careers page for future openings.</p>';
    }

    public function buildHiredBody(CareerApplication $application): string
    {
        $application->loadMissing(['applicant', 'job']);
        $applicant = $application->applicant;
        $job = $application->job;

        return '<p>Hi '.e($applicant?->first_name ?? 'there').',</p>'
            .'<p>Congratulations — we are pleased to extend an offer regarding your application for <strong>'.e($job?->title ?? 'the role').'</strong>.</p>'
            .'<p>A member of our HR team will reach out shortly with next steps and onboarding details.</p>';
    }

    public function buildPassedBody(CareerApplication $application): string
    {
        $application->loadMissing(['applicant', 'job']);
        $applicant = $application->applicant;
        $job = $application->job;

        return '<p>Hi '.e($applicant?->first_name ?? 'there').',</p>'
            .'<p>Your application for <strong>'.e($job?->title ?? 'the role').'</strong> continues to progress positively. We will be in touch with the next steps shortly.</p>';
    }

    private function wrap(string $inner): string
    {
        $appName = e((string) config('app.name', 'Amalgated Lending'));

        return '<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111827">'
            .$inner
            .'<p style="margin-top:24px;font-size:12px;color:#6b7280">'.$appName.'</p>'
            .'</body></html>';
    }

    private function sendLogged(CareerApplication $application, string $to, string $subject, string $templateKey, string $html): void
    {
        try {
            if (! $this->brevo->isConfigured()) {
                CareersEmailLog::create([
                    'related_type' => $application->getMorphClass(),
                    'related_id' => $application->getKey(),
                    'to_email' => $to,
                    'subject' => $subject,
                    'template_key' => $templateKey,
                    'status' => 'skipped',
                    'error_message' => 'Mail provider not configured (BREVO_API_KEY).',
                    'meta' => null,
                ]);

                return;
            }
            $this->brevo->sendHtml($to, null, $subject, $html);
            CareersEmailLog::create([
                'related_type' => $application->getMorphClass(),
                'related_id' => $application->getKey(),
                'to_email' => $to,
                'subject' => $subject,
                'template_key' => $templateKey,
                'status' => 'sent',
                'error_message' => null,
                'meta' => null,
            ]);
        } catch (Throwable $e) {
            Log::warning('careers.mail_failed', ['error' => $e->getMessage(), 'template' => $templateKey]);
            CareersEmailLog::create([
                'related_type' => $application->getMorphClass(),
                'related_id' => $application->getKey(),
                'to_email' => $to,
                'subject' => $subject,
                'template_key' => $templateKey,
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'meta' => null,
            ]);
        }
    }
}
