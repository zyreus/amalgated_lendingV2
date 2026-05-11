<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BorrowerNotification;
use App\Models\EmailLog;
use App\Models\Lead;
use App\Models\LeadMessage;
use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\Payment;
use App\Models\TravelApplication;
use App\Services\NotificationCenter;
use App\Services\PaymentReceiptPdfService;
use App\Support\LoanApplicationDocumentStatus;
use App\Support\PublicStorageUrl;
use App\Support\SignedPrintUrls;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class BorrowerPortalController extends Controller
{
    /**
     * @param  array<string, mixed>  $docStatus
     * @return array<int, array{key:string,label:string,url:string,name:string}>
     */
    private function flattenDocumentLinks(array $docStatus): array
    {
        $links = [];
        foreach ($docStatus as $key => $row) {
            $label = (string) ($row['label'] ?? $key);
            $paths = is_array($row['paths'] ?? null) ? $row['paths'] : [];
            foreach ($paths as $path) {
                if (! is_string($path) || $path === '') {
                    continue;
                }
                $links[] = [
                    'key' => (string) $key,
                    'label' => $label,
                    'url' => PublicStorageUrl::apiUrl($path),
                    'name' => basename($path),
                ];
            }
        }

        return $links;
    }

    /**
     * @param  array<string, mixed>|null  $formData
     * @return array<int, array{label:string,value:string}>
     */
    private function buildFormPreview(?array $formData): array
    {
        if (! is_array($formData) || $formData === []) {
            return [];
        }

        $out = [];
        foreach ($formData as $key => $value) {
            if (is_array($value) || is_object($value) || $value === null || $value === '') {
                continue;
            }
            $text = trim((string) $value);
            if ($text === '') {
                continue;
            }
            $out[] = [
                'label' => Str::title(str_replace('_', ' ', (string) $key)),
                'value' => Str::limit($text, 120),
            ];
            if (count($out) >= 8) {
                break;
            }
        }

        return $out;
    }

    private function normalizeEmail(?string $email): string
    {
        return strtolower(trim((string) $email));
    }

    /**
     * Keep only applications that truly belong to the logged-in borrower account.
     * Primary ownership is user_id; when applicant email exists in form_data, it must match too.
     */
    private function isGeneralApplicationOwnedByUser(LoanApplication $application, $user): bool
    {
        if ((int) $application->user_id !== (int) $user->id) {
            return false;
        }

        $formData = is_array($application->form_data) ? $application->form_data : [];
        $appEmail = $this->normalizeEmail(
            data_get($formData, 'email') ?: data_get($formData, 'personal.email')
        );
        if ($appEmail === '') {
            return true;
        }

        return $appEmail === $this->normalizeEmail($user->email);
    }

    /**
     * Which loan drives the payment schedule on the dashboard.
     * Prefer in-progress lending over newer pending applications (otherwise `orderByDesc(id)->first`
     * hid older ongoing loans when the borrower applied again).
     */
    private function selectPrimaryLoan(Collection $loans): ?Loan
    {
        if ($loans->isEmpty()) {
            return null;
        }

        $priority = [
            Loan::STATUS_ONGOING => 1,
            Loan::STATUS_APPROVED => 2,
            Loan::STATUS_PENDING => 3,
            Loan::STATUS_REJECTED => 4,
            Loan::STATUS_COMPLETED => 5,
        ];

        return $loans->sort(function ($a, $b) use ($priority) {
            $pa = $priority[$a->status] ?? 99;
            $pb = $priority[$b->status] ?? 99;
            if ($pa !== $pb) {
                return $pa <=> $pb;
            }

            return $b->id <=> $a->id;
        })->first();
    }

    private function resolveBorrowerLead($user): Lead
    {
        $lead = Lead::query()
            ->where('email', $user->email)
            ->orderByDesc('id')
            ->first();

        if ($lead) {
            if ($lead->user_id !== $user->id) {
                $lead->user_id = $user->id;
                $lead->save();
            }

            return $lead;
        }

        return Lead::create([
            'user_id' => $user->id,
            'name' => (string) $user->name,
            'email' => (string) $user->email,
            'organization' => null,
            'loan_type' => 'Borrower Support',
            'status' => 'ongoing',
            'initial_message' => 'Borrower opened support chat.',
            'chat_token' => bin2hex(random_bytes(20)),
            'last_message_at' => now(),
        ]);
    }

    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        $driver = DB::connection()->getDriverName();
        /**
         * MySQL/MariaDB: never hydrate full `application_payload` / `schedule_json` for every loan row
         * (wizard snapshots can be large — this was a major TTFB cost on `/borrower`).
         */
        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            $allLoans = Loan::query()
                ->where('borrower_id', $user->id)
                ->orderByDesc('id')
                ->select([
                    'id',
                    'borrower_id',
                    'principal',
                    'requested_principal',
                    'term_months',
                    'annual_interest_rate',
                    'status',
                    'rejection_reason',
                    'monthly_payment',
                    'outstanding_balance',
                    'created_at',
                ])
                ->selectRaw(
                    'JSON_UNQUOTE(JSON_EXTRACT(application_payload, \'$.loan_product_slug\')) AS dash_loan_product_slug, '.
                    'JSON_EXTRACT(application_payload, \'$.selected_interest_rate\') AS dash_selected_interest_rate, '.
                    'JSON_UNQUOTE(JSON_EXTRACT(application_payload, \'$.selected_rate_type\')) AS dash_selected_rate_type, '.
                    '(schedule_json IS NOT NULL AND COALESCE(JSON_LENGTH(schedule_json), 0) > 0) AS dash_has_schedule'
                )
                ->get();
        } else {
            $allLoans = Loan::query()
                ->where('borrower_id', $user->id)
                ->orderByDesc('id')
                ->get([
                    'id',
                    'borrower_id',
                    'principal',
                    'requested_principal',
                    'term_months',
                    'annual_interest_rate',
                    'status',
                    'rejection_reason',
                    'application_payload',
                    'schedule_json',
                    'monthly_payment',
                    'outstanding_balance',
                    'created_at',
                ]);
        }

        $primaryRef = $this->selectPrimaryLoan($allLoans);
        BorrowerNotificationController::syncPaymentRemindersForUser($user, $primaryRef);

        // Re-fetch the primary loan with all financial columns + relations. The list query above uses a
        // minimal column set; serializing that model omitted fee/amortization fields the dashboard needs.
        $loan = null;
        if ($primaryRef) {
            $loan = Loan::query()
                ->whereKey($primaryRef->id)
                ->with([
                    'payments' => fn ($q) => $q->orderBy('due_date'),
                    'loanApplication:id,loan_id,loan_type,loan_amount,approved_amount,monthly_pension',
                ])
                ->first();
        }

        $loansSummary = $allLoans->map(function (Loan $l) {
            $attrs = $l->getAttributes();
            $hasSchedule = array_key_exists('dash_has_schedule', $attrs)
                ? (bool) $l->dash_has_schedule
                : (is_array($l->schedule_json) && count($l->schedule_json) > 0);
            $pl = is_array($l->application_payload) ? $l->application_payload : [];
            $slug = array_key_exists('dash_loan_product_slug', $attrs)
                ? ($l->dash_loan_product_slug ?: null)
                : ($pl['loan_product_slug'] ?? null);
            $rate = array_key_exists('dash_selected_interest_rate', $attrs)
                ? $l->dash_selected_interest_rate
                : ($pl['selected_interest_rate'] ?? null);
            $rateType = array_key_exists('dash_selected_rate_type', $attrs)
                ? ($l->dash_selected_rate_type ?: null)
                : ($pl['selected_rate_type'] ?? null);

            return [
                'id' => $l->id,
                'status' => $l->status,
                'principal' => $l->principal,
                'requested_principal' => $l->requested_principal !== null ? (float) $l->requested_principal : null,
                'applied_principal' => (float) ($l->requested_principal ?? $l->principal),
                'term_months' => $l->term_months,
                'annual_interest_rate' => $l->annual_interest_rate,
                'loan_product_slug' => $slug,
                'selected_interest_rate' => $rate !== null && $rate !== '' ? (float) $rate : null,
                'selected_rate_type' => $rateType,
                'monthly_payment' => $l->monthly_payment,
                'outstanding_balance' => $l->outstanding_balance,
                'created_at' => optional($l->created_at)?->toIso8601String(),
                'rejection_reason' => $l->rejection_reason,
                'print_statement_url' => $hasSchedule
                    ? SignedPrintUrls::temporaryRoute(
                        'print.loan-soa',
                        now()->addMinutes(45),
                        ['loan' => $l->id]
                    )
                    : null,
            ];
        })->values();

        $pendingRows = collect();
        $historyRows = collect();
        $summary = [
            'total_loan_balance' => 0,
            'monthly_payment' => 0,
            'next_due_date' => null,
            'overdue_amount' => 0,
            'paid_amount' => 0,
            'total_payable' => 0,
            'progress_percent' => 0,
        ];

        $notifications = BorrowerNotification::query()
            ->where('user_id', $user->id)
            ->whereNull('archived_at')
            ->orderByDesc('created_at')
            ->limit(8)
            ->get()
            ->map(fn (BorrowerNotification $n) => [
                'id' => $n->id,
                'type' => $n->type,
                'read' => $n->read_at !== null,
                'priority' => (int) ($n->priority ?? 2),
                'message' => $n->body ? $n->title.' — '.$n->body : $n->title,
            ])
            ->values()
            ->all();

        if ($loan) {
            $all = collect($loan->payments ?? []);
            $pendingRows = $all
                ->filter(fn (Payment $p) => $p->status !== Payment::STATUS_PAID)
                ->values();
            $historyRows = $all
                ->filter(fn (Payment $p) => $p->status === Payment::STATUS_PAID)
                ->sortByDesc(fn (Payment $p) => $p->paid_at?->timestamp ?? 0)
                ->values();

            $dueTotal = (float) $all->sum(fn (Payment $p) => (float) $p->amount_due + (float) ($p->penalty_amount ?? 0));
            $paidTotal = (float) $all->sum(fn (Payment $p) => (float) $p->amount_paid);
            $overdueAmount = (float) $pendingRows
                ->filter(fn (Payment $p) => $p->due_date && $p->due_date->isPast())
                ->sum(fn (Payment $p) => max(0, ((float) $p->amount_due + (float) ($p->penalty_amount ?? 0)) - (float) $p->amount_paid));

            $nextDue = $pendingRows
                ->filter(fn (Payment $p) => $p->due_date !== null)
                ->sortBy(fn (Payment $p) => $p->due_date->timestamp)
                ->first();

            $summary = [
                'total_loan_balance' => (float) ($loan->outstanding_balance ?? 0),
                'monthly_payment' => (float) ($loan->monthly_payment ?? 0),
                'next_due_date' => $nextDue?->due_date?->toDateString(),
                'overdue_amount' => round($overdueAmount, 2),
                'paid_amount' => round($paidTotal, 2),
                'total_payable' => round($dueTotal, 2),
                'progress_percent' => $dueTotal > 0 ? round(min(100, ($paidTotal / $dueTotal) * 100), 2) : 0,
            ];

        }

        return response()->json([
            'ok' => true,
            'data' => [
                'summary' => $summary,
                'loans' => $loansSummary,
                'active_loan' => $loan,
                'pending_payments' => $pendingRows->values(),
                'payment_history' => $historyRows->values(),
                'notifications' => $notifications,
            ],
        ]);
    }

    public function payments(Request $request): JsonResponse
    {
        $user = $request->user();
        $loanIdSub = Loan::query()->where('borrower_id', $user->id)->select('id');

        $payments = Payment::query()
            ->whereIn('loan_id', $loanIdSub)
            ->with('loan')
            ->orderBy('due_date')
            ->paginate((int) $request->query('per_page', 15));

        return response()->json(['ok' => true, 'data' => $payments]);
    }

    public function paymentHistory(Request $request): JsonResponse
    {
        $user = $request->user();
        $loanIdSub = Loan::query()->where('borrower_id', $user->id)->select('id');

        $rows = Payment::query()
            ->whereIn('loan_id', $loanIdSub)
            ->where('status', Payment::STATUS_PAID)
            ->with([
                'loan' => fn ($q) => $q->select(['id', 'borrower_id', 'term_months']),
            ])
            ->orderByDesc('paid_at')
            ->paginate((int) $request->query('per_page', 15));

        $statusMap = $this->borrowerReceiptEmailStatusMap($rows->getCollection()->pluck('id'));
        $rows->getCollection()->each(function (Payment $p) use ($statusMap): void {
            $p->setAttribute('receipt_email_status', $statusMap[(int) $p->getKey()] ?? null);
            $path = $p->invoice_pdf_path;
            $p->setAttribute('official_receipt_pdf_url', $path ? PublicStorageUrl::apiUrl((string) $path) : null);
        });

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    public function downloadOfficialReceipt(Request $request, Payment $payment, PaymentReceiptPdfService $pdfService): BinaryFileResponse|JsonResponse
    {
        $user = $request->user();
        $payment->loadMissing('loan');
        if (! $payment->loan || (int) $payment->loan->borrower_id !== (int) $user->id) {
            return response()->json(['ok' => false, 'message' => 'Forbidden'], 403);
        }
        if ($payment->status !== Payment::STATUS_PAID) {
            return response()->json(['ok' => false, 'message' => 'Receipt not available for this installment.'], 422);
        }

        $path = trim((string) ($payment->invoice_pdf_path ?? ''));
        if ($path === '' || ! Storage::disk('public')->exists($path)) {
            $generated = $pdfService->ensureOfficialPdf($payment->fresh(['loan']), null);
            $path = $generated ? trim((string) $generated) : '';
        }
        $payment->refresh();
        $path = trim((string) ($payment->invoice_pdf_path ?? ''));
        if ($path === '' || ! Storage::disk('public')->exists($path)) {
            return response()->json(['ok' => false, 'message' => 'Official PDF could not be generated.'], 404);
        }

        $or = preg_replace('/\W+/', '_', (string) ($payment->official_receipt_number ?: 'receipt'));

        return response()->download(Storage::disk('public')->path($path), 'Official-Receipt-'.$or.'.pdf', [
            'Content-Type' => 'application/pdf',
        ]);
    }

    /**
     * @param  Collection<int, mixed>  $paymentIds
     * @return array<int, string>
     */
    private function borrowerReceiptEmailStatusMap(Collection $paymentIds): array
    {
        $ids = $paymentIds->filter(fn ($id) => (int) $id > 0)->map(fn ($id) => (int) $id)->unique()->values();
        if ($ids->isEmpty()) {
            return [];
        }

        $latestIds = EmailLog::query()
            ->selectRaw('max(id) as agg_id')
            ->whereIn('payment_id', $ids)
            ->where('notification_type', EmailLog::NOTIFICATION_PAYMENT_RECEIPT)
            ->groupBy('payment_id')
            ->pluck('agg_id');
        if ($latestIds->isEmpty()) {
            return [];
        }

        return EmailLog::query()
            ->whereIn('id', $latestIds)
            ->get()
            ->mapWithKeys(fn (EmailLog $e) => [(int) $e->payment_id => (string) $e->status])
            ->all();
    }

    /**
     * Back-compat: some environments may have cached routes pointing
     * `/api/v1/borrower/notifications` here. Delegate to the dedicated controller.
     */
    public function notifications(Request $request): JsonResponse
    {
        /** @var BorrowerNotificationController $controller */
        $controller = app(BorrowerNotificationController::class);

        return $controller->index($request);
    }

    public function uploadPayment(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'payment_id' => 'required|integer|exists:payments,id',
            'reference_number' => 'required|string|max:128',
            'payment_method' => 'required|string|in:gcash,bank,cash',
            // Phone photos can exceed 5MB; allow up to 15MB and common web image format.
            'receipt' => 'required|file|mimes:jpg,jpeg,png,webp,pdf|max:15360',
        ]);

        $payment = Payment::query()
            ->whereKey($data['payment_id'])
            ->whereHas('loan', function ($q) use ($user) {
                $q->where('borrower_id', $user->id);
            })
            ->first();

        if (! $payment) {
            return response()->json(['ok' => false, 'message' => 'Payment record not found for borrower.'], 404);
        }

        if ($payment->status === Payment::STATUS_PAID) {
            return response()->json([
                'ok' => false,
                'message' => 'This installment is already marked paid.',
            ], 422);
        }

        $refTrim = trim((string) $data['reference_number']);
        $dupRef = Payment::query()
            ->where('loan_id', $payment->loan_id)
            ->whereKeyNot($payment->id)
            ->where('reference_number', $refTrim)
            ->exists();
        if ($dupRef) {
            return response()->json([
                'ok' => false,
                'message' => 'This reference number was already used for another installment on this loan.',
            ], 422);
        }

        /** @var UploadedFile $file */
        $file = $data['receipt'];
        $path = $file->store('borrower-receipts', 'public');

        $payment->reference_number = $data['reference_number'];
        $payment->payment_method = $data['payment_method'];
        $payment->receipt_path = $path;
        $payment->receipt_name = $file->getClientOriginalName();
        $payment->submitted_at = now();
        $payment->source = 'manual';
        $payment->notes = trim((string) ($payment->notes ?? '').' | Receipt uploaded by borrower');
        $payment->save();

        app(NotificationCenter::class)->notifyBorrower(
            $user,
            NotificationCenter::CATEGORY_PAYMENT_SUBMITTED,
            'borrower_payment_submitted_ack',
            'Receipt received',
            'Installment #'.($payment->installment_no ?? '—').': we received your proof. An officer will verify it shortly.',
            ['payment_id' => $payment->id, 'loan_id' => $payment->loan_id],
            ['dedupe_key' => 'payment_proof_upload:'.$payment->id, 'module' => NotificationCenter::MODULE_PAYMENTS],
        );

        // Admin notifications page: reflect borrower-submitted payment proof.
        $payment->loadMissing('loan');
        app(NotificationCenter::class)->notifyStaff(
            NotificationCenter::CATEGORY_PAYMENT_SUBMITTED,
            'borrower_payment_submitted',
            'Payment submitted from '.$user->name,
            'Installment #'.($payment->installment_no ?? '—').' · Amount '.number_format((float) ($payment->amount_due ?? 0), 2).' · Ref '.$payment->reference_number,
            [
                'payment_id' => $payment->id,
                'loan_id' => $payment->loan_id,
                'borrower_id' => $user->id,
                'receipt_path' => $payment->receipt_path,
            ],
            null,
            [
                'module' => NotificationCenter::MODULE_PAYMENTS,
                'priority' => 3,
                'throttle_key' => 'borrower_payment_proof:'.$payment->id,
                'throttle_max' => 1,
                'throttle_decay_seconds' => 7200,
            ],
        );

        return response()->json([
            'ok' => true,
            'message' => 'Payment receipt uploaded. Waiting for admin confirmation.',
            'payment' => $payment->fresh('loan'),
            'receipt_url' => PublicStorageUrl::apiUrl($path),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:32',
            'id_document' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
            'profile_photo' => 'nullable|file|mimes:jpg,jpeg,png,webp|max:5120',
        ]);

        $user->name = $data['name'];
        $user->phone = $data['phone'] ?? $user->phone;

        if ($request->hasFile('id_document')) {
            /** @var UploadedFile $idDoc */
            $idDoc = $request->file('id_document');
            $path = $idDoc->store('borrower-id-docs', 'public');
            $user->id_document_path = $path;
            $user->id_document_name = $idDoc->getClientOriginalName();
        }

        if ($request->hasFile('profile_photo')) {
            /** @var UploadedFile $photo */
            $photo = $request->file('profile_photo');
            $path = $photo->store('borrower-profile-photos', 'public');
            // Backward-compatible fallback: if dedicated profile photo columns are not yet migrated,
            // use existing ID document fields so photo updates still work.
            if (array_key_exists('profile_photo_path', $user->getAttributes())) {
                $user->profile_photo_path = $path;
                $user->profile_photo_name = $photo->getClientOriginalName();
            } else {
                $user->id_document_path = $path;
                $user->id_document_name = $photo->getClientOriginalName();
            }
        }

        $user->save();

        return response()->json([
            'ok' => true,
            'message' => 'Profile updated successfully.',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'id_document_name' => $user->id_document_name,
                'id_document_url' => $user->id_document_path ? PublicStorageUrl::apiUrl($user->id_document_path) : null,
                'profile_photo_name' => $user->profile_photo_name ?: $user->id_document_name,
                'profile_photo_url' => $user->profile_photo_path
                    ? PublicStorageUrl::apiUrl($user->profile_photo_path)
                    : ($user->id_document_path ? PublicStorageUrl::apiUrl($user->id_document_path) : null),
            ],
        ]);
    }

    public function chatMessages(Request $request): JsonResponse
    {
        $user = $request->user();
        $lead = $this->resolveBorrowerLead($user);

        /**
         * Long-running borrower chats can accumulate hundreds of rows. The previous
         * `->get()` returned the entire history every poll, which both slowed the
         * Laravel response and bloated the React payload. Returning the most recent
         * 200 messages keeps the chat snappy; older history is paged via `before_id`.
         */
        $limit = max(20, min(200, (int) $request->query('limit', 100)));
        $beforeId = $request->query('before_id');

        $query = $lead->messages()
            ->with(['adminUser:id,name'])
            ->orderByDesc('id')
            ->limit($limit);

        if (is_numeric($beforeId)) {
            $query->where('id', '<', (int) $beforeId);
        }

        $messages = $query->get()
            ->reverse()
            ->values()
            ->map(function (LeadMessage $m) {
                return [
                    'id' => $m->id,
                    'sender_type' => $m->sender_type,
                    'message' => $m->message,
                    'attachment_name' => $m->attachment_name,
                    'attachment_url' => $m->attachment_path ? PublicStorageUrl::apiUrl($m->attachment_path) : null,
                    'admin_name' => $m->adminUser?->name,
                    'created_at' => optional($m->created_at)?->toIso8601String(),
                ];
            });

        return response()->json([
            'ok' => true,
            'lead' => [
                'id' => $lead->id,
                'status' => $lead->status,
            ],
            'data' => $messages,
        ]);
    }

    public function sendChatMessage(Request $request): JsonResponse
    {
        $user = $request->user();
        $lead = $this->resolveBorrowerLead($user);
        $data = $request->validate([
            'message' => 'nullable|string|max:5000',
            'attachment' => 'nullable|file|max:5120|mimes:jpg,jpeg,png,pdf,doc,docx',
        ]);
        if (! $request->hasFile('attachment') && trim((string) ($data['message'] ?? '')) === '') {
            return response()->json(['ok' => false, 'message' => 'Message or attachment is required.'], 422);
        }

        $path = null;
        $name = null;
        if ($request->hasFile('attachment')) {
            /** @var UploadedFile $file */
            $file = $request->file('attachment');
            $path = $file->store('lead-chat', 'public');
            $name = $file->getClientOriginalName();
        }

        $msg = LeadMessage::create([
            'lead_id' => $lead->id,
            'sender_type' => 'borrower',
            'message' => trim((string) ($data['message'] ?? '')) ?: null,
            'attachment_path' => $path,
            'attachment_name' => $name,
        ]);
        $lead->last_message_at = now();
        if ($lead->status === 'closed') {
            $lead->status = 'ongoing';
        }
        $lead->save();

        return response()->json([
            'ok' => true,
            'message' => [
                'id' => $msg->id,
                'sender_type' => $msg->sender_type,
                'message' => $msg->message,
                'attachment_name' => $msg->attachment_name,
                'attachment_url' => $msg->attachment_path ? PublicStorageUrl::apiUrl($msg->attachment_path) : null,
                'created_at' => optional($msg->created_at)?->toIso8601String(),
            ],
        ], 201);
    }

    /**
     * All uploaded documents from general loan applications + profile ID, for Borrower Profile → Documents.
     */
    public function profileDocuments(Request $request): JsonResponse
    {
        $user = $request->user();
        $items = [];

        if ($user->id_document_path) {
            $items[] = [
                'source' => 'profile',
                'label' => 'Valid ID (profile)',
                'url' => PublicStorageUrl::apiUrl($user->id_document_path),
                'path' => $user->id_document_path,
            ];
        }

        $apps = LoanApplication::query()
            ->where('user_id', $user->id)
            ->whereIn('loan_type', array_keys(config('amalgated_loans.general_loan_types')))
            ->orderByDesc('id')
            ->get();

        foreach ($apps as $app) {
            if (! $app->isOfficiallySubmitted()) {
                continue;
            }
            $loanLabel = config('amalgated_loans.general_loan_types')[$app->loan_type] ?? $app->loan_type;
            foreach ($app->documents ?? [] as $key => $paths) {
                $docLabel = config('amalgated_loans.general_documents.'.$app->loan_type.'.'.$key.'.label') ?? $key;
                $list = is_array($paths) ? $paths : ($paths ? [$paths] : []);
                foreach ($list as $p) {
                    if (! $p) {
                        continue;
                    }
                    $items[] = [
                        'source' => 'loan_application',
                        'application_id' => $app->id,
                        'loan_type_label' => $loanLabel,
                        'doc_key' => $key,
                        'label' => $docLabel,
                        'url' => PublicStorageUrl::apiUrl($p),
                        'path' => $p,
                    ];
                }
            }
        }

        return response()->json(['ok' => true, 'data' => $items]);
    }

    /**
     * General + travel applications for the borrower dashboard (document checklist, signatures).
     */
    public function lendingApplications(Request $request): JsonResponse
    {
        $user = $request->user();

        $generalOwned = LoanApplication::query()
            ->where('user_id', $user->id)
            ->whereIn('loan_type', array_keys(config('amalgated_loans.general_loan_types')))
            ->orderByDesc('id')
            ->get()
            ->filter(fn (LoanApplication $a) => $this->isGeneralApplicationOwnedByUser($a, $user));

        $generalSubmitted = $generalOwned
            ->filter(fn (LoanApplication $a) => $a->isOfficiallySubmitted())
            ->sortByDesc(fn (LoanApplication $a) => $a->submitted_at?->getTimestamp() ?? $a->id)
            ->values()
            ->map(fn (LoanApplication $a) => $this->serializeSubmittedGeneralLendingApplication($a));

        $generalDrafts = $generalOwned
            ->reject(fn (LoanApplication $a) => $a->isOfficiallySubmitted())
            ->sortByDesc(fn (LoanApplication $a) => $a->draft_updated_at?->getTimestamp() ?? $a->updated_at?->getTimestamp() ?? $a->id)
            ->values()
            ->map(fn (LoanApplication $a) => $this->serializeGeneralDraftLendingApplication($a));

        $travel = TravelApplication::query()
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->get()
            ->map(function (TravelApplication $a) {
                $docStatus = LoanApplicationDocumentStatus::forTravel($a->documents);

                return [
                    'id' => $a->id,
                    'kind' => 'travel',
                    'status' => $a->status,
                    'created_at' => $a->created_at?->toIso8601String(),
                    'documents_checklist' => collect($docStatus)->map(fn ($row, $k) => [
                        'key' => $k,
                        'label' => $row['label'],
                        'uploaded' => $row['ok'],
                    ])->values(),
                    'uploaded_documents' => $this->flattenDocumentLinks($docStatus),
                    'form_preview' => $this->buildFormPreview($a->travel_specific_fields),
                    'signatures' => [
                        'applicant' => $a->applicant_signature ? PublicStorageUrl::apiUrl($a->applicant_signature) : null,
                        'spouse' => $a->spouse_signature ? PublicStorageUrl::apiUrl($a->spouse_signature) : null,
                    ],
                    'terms_accepted' => $a->terms_accepted,
                    'terms_url' => url('/travel-assistance/terms'),
                ];
            });

        return response()->json([
            'ok' => true,
            'data' => [
                'general' => $generalSubmitted,
                'general_drafts' => $generalDrafts,
                'travel' => $travel,
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeSubmittedGeneralLendingApplication(LoanApplication $a): array
    {
        $docStatus = LoanApplicationDocumentStatus::forGeneralLoanType($a->loan_type, $a->documents);

        return [
            'id' => $a->id,
            'kind' => 'general',
            'loan_type' => $a->loan_type,
            'loan_type_label' => config('amalgated_loans.general_loan_types')[$a->loan_type] ?? $a->loan_type,
            'status' => $a->status,
            'is_submitted' => true,
            'submitted_at' => $a->submitted_at?->toIso8601String(),
            'created_at' => $a->created_at?->toIso8601String(),
            'documents_checklist' => collect($docStatus)->map(fn ($row, $k) => [
                'key' => $k,
                'label' => $row['label'],
                'uploaded' => $row['ok'],
            ])->values(),
            'uploaded_documents' => $this->flattenDocumentLinks($docStatus),
            'form_preview' => $this->buildFormPreview($a->form_data),
            'signatures' => [
                'applicant' => $a->applicant_signature ? PublicStorageUrl::apiUrl($a->applicant_signature) : null,
                'spouse' => $a->spouse_signature ? PublicStorageUrl::apiUrl($a->spouse_signature) : null,
                'comaker' => $a->comaker_signature ? PublicStorageUrl::apiUrl($a->comaker_signature) : null,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeGeneralDraftLendingApplication(LoanApplication $a): array
    {
        return [
            'id' => $a->id,
            'kind' => 'general_draft',
            'loan_type' => $a->loan_type,
            'loan_type_label' => config('amalgated_loans.general_loan_types')[$a->loan_type] ?? $a->loan_type,
            'status' => $a->status,
            'draft_step' => $a->draft_step,
            'draft_updated_at' => ($a->draft_updated_at ?? $a->updated_at)?->toIso8601String(),
            'resume_path' => '/borrower/apply-loan/'.$a->id,
        ];
    }
}
