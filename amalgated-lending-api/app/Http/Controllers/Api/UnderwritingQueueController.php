<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentLoanApplication;
use App\Models\Loan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UnderwritingQueueController extends Controller
{
  private const SLA_TARGET_HOURS = 8;

  public function index(Request $request): JsonResponse
  {
    $perPage = max(1, min(100, (int) $request->query('per_page', 50)));

    $loanRows = Loan::query()
      ->where('status', Loan::STATUS_PENDING)
      ->with([
        'borrower:id,name,email,phone,credit_score,risk_level',
        'loanApplication.documents:id,loan_application_id,verification_status',
      ])
      ->orderByDesc('id')
      ->limit($perPage)
      ->get()
      ->map(fn (Loan $loan) => $this->mapLoanRow($loan));

    $docRows = DocumentLoanApplication::query()
      ->where('status', DocumentLoanApplication::STATUS_PENDING)
      ->whereNotNull('submitted_at')
      ->with([
        'user:id,name,email,phone,credit_score,risk_level',
        'loanProduct:id,name,slug',
        'uploadedDocuments:id,document_loan_application_id,status',
      ])
      ->orderByDesc('id')
      ->limit($perPage)
      ->get()
      ->map(fn (DocumentLoanApplication $app) => $this->mapDocumentLoanRow($app));

    $merged = $loanRows
      ->concat($docRows)
      ->sortBy([
        ['sla_overdue', 'desc'],
        ['sla_sort', 'asc'],
        ['created_at', 'desc'],
      ])
      ->values()
      ->take($perPage);

    return response()->json([
      'ok' => true,
      'data' => $merged,
      'meta' => [
        'total' => $merged->count(),
        'sla_target_hours' => self::SLA_TARGET_HOURS,
      ],
    ]);
  }

  /**
   * @return array<string, mixed>
   */
  private function mapLoanRow(Loan $loan): array
  {
    $borrower = $loan->borrower;
    $risk = $borrower?->risk_level;
    $underwritingStatus = $this->deriveLoanUnderwritingStatus($loan, $risk);
    $sla = $this->slaFromTimestamp($loan->created_at);

    $payload = is_array($loan->application_payload) ? $loan->application_payload : [];
    $slug = isset($payload['loan_product_slug']) ? (string) $payload['loan_product_slug'] : '';

    return [
      'kind' => 'loan',
      'id' => $loan->id,
      'application_ref' => $loan->loan_number,
      'loan_id' => $loan->id,
      'document_loan_application_id' => null,
      'borrower' => $this->borrowerSnippet($borrower),
      'product' => $this->productLabelFromSlug($slug),
      'score' => $borrower?->credit_score !== null ? (float) $borrower->credit_score : null,
      'risk' => $risk,
      'status' => $loan->status,
      'underwriting_status' => $underwritingStatus,
      'sla_label' => $sla['label'],
      'sla_overdue' => $sla['overdue'],
      'sla_sort' => $sla['sort'],
      'created_at' => optional($loan->created_at)?->toIso8601String(),
    ];
  }

  /**
   * @return array<string, mixed>
   */
  private function mapDocumentLoanRow(DocumentLoanApplication $app): array
  {
    $borrower = $app->user;
    $risk = $borrower?->risk_level;
    $underwritingStatus = $this->deriveDocumentUnderwritingStatus($app, $risk);
    $sla = $this->slaFromTimestamp($app->submitted_at ?? $app->created_at);

    return [
      'kind' => 'document',
      'id' => $app->id,
      'application_ref' => 'DOC-'.str_pad((string) $app->id, 5, '0', STR_PAD_LEFT),
      'loan_id' => null,
      'document_loan_application_id' => $app->id,
      'borrower' => $this->borrowerSnippet($borrower),
      'product' => $app->loanProduct?->name ?? $this->productLabelFromSlug($app->loanProduct?->slug ?? ''),
      'score' => $borrower?->credit_score !== null ? (float) $borrower->credit_score : null,
      'risk' => $risk,
      'status' => $app->status,
      'underwriting_status' => $underwritingStatus,
      'sla_label' => $sla['label'],
      'sla_overdue' => $sla['overdue'],
      'sla_sort' => $sla['sort'],
      'created_at' => optional($app->submitted_at ?? $app->created_at)?->toIso8601String(),
    ];
  }

  /**
   * @return array<string, mixed>|null
   */
  private function borrowerSnippet(?object $user): ?array
  {
    if (! $user) {
      return null;
    }

    return [
      'id' => $user->id,
      'name' => $user->name,
      'email' => $user->email,
      'phone' => $user->phone ?? null,
      'credit_score' => $user->credit_score !== null ? (float) $user->credit_score : null,
      'risk_level' => $user->risk_level,
    ];
  }

  private function deriveLoanUnderwritingStatus(Loan $loan, ?string $riskLevel): string
  {
    if ($this->loanNeedsStip($loan)) {
      return 'Needs stip';
    }
    if (strtolower((string) $riskLevel) === 'high') {
      return 'Fraud flag';
    }
    if (strtolower((string) $riskLevel) === 'low') {
      return 'Auto path';
    }

    return 'In review';
  }

  private function deriveDocumentUnderwritingStatus(DocumentLoanApplication $app, ?string $riskLevel): string
  {
    $uploads = $app->relationLoaded('uploadedDocuments')
      ? $app->uploadedDocuments
      : collect();

    $needsStip = $uploads->contains(function ($doc) {
      $st = strtolower((string) ($doc->status ?? ''));

      return in_array($st, ['rejected', 'requires_resubmission'], true);
    });

    if ($needsStip) {
      return 'Needs stip';
    }
    if (strtolower((string) $riskLevel) === 'high') {
      return 'Fraud flag';
    }
    if (strtolower((string) $riskLevel) === 'low') {
      return 'Auto path';
    }

    return 'In review';
  }

  private function loanNeedsStip(Loan $loan): bool
  {
    $reviews = is_array($loan->document_reviews) ? $loan->document_reviews : [];
    foreach ($reviews as $review) {
      if (! is_array($review)) {
        continue;
      }
      $st = strtolower((string) ($review['status'] ?? ''));
      if (in_array($st, ['rejected', 'requires_resubmission'], true)) {
        return true;
      }
    }

    $app = $loan->loanApplication;
    if ($app && $app->relationLoaded('documents')) {
      foreach ($app->documents as $doc) {
        $st = strtolower((string) ($doc->verification_status ?? ''));
        if (in_array($st, ['rejected', 'requires_resubmission'], true)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * @return array{label: string, overdue: bool, sort: float}
   */
  private function slaFromTimestamp(mixed $timestamp): array
  {
    if ($timestamp === null) {
      return ['label' => '—', 'overdue' => false, 'sort' => PHP_FLOAT_MAX];
    }

    $t = $timestamp instanceof \DateTimeInterface ? $timestamp->getTimestamp() : strtotime((string) $timestamp);
    if ($t === false) {
      return ['label' => '—', 'overdue' => false, 'sort' => PHP_FLOAT_MAX];
    }

    $ageHours = (time() - $t) / 3600;
    $remaining = self::SLA_TARGET_HOURS - $ageHours;

    if ($remaining <= 0) {
      return ['label' => 'Overdue', 'overdue' => true, 'sort' => $remaining];
    }

    return [
      'label' => max(0, (int) ceil($remaining)).'h',
      'overdue' => false,
      'sort' => $remaining,
    ];
  }

  private function productLabelFromSlug(string $slug): string
  {
    $map = [
      'personal-loan' => 'Personal',
      'business-loan' => 'Business',
      'salary-loan' => 'Salary',
      'travel-assistance-loan' => 'Travel',
      'sss-pension-loan' => 'Pension',
      'real-estate-mortgage' => 'Real estate',
      'chattel-mortgage' => 'Chattel',
    ];

    $s = trim($slug);
    if ($s !== '' && isset($map[$s])) {
      return $map[$s];
    }
    if ($s === '') {
      return '—';
    }

    return ucwords(str_replace(['-', '_'], ' ', $s));
  }
}
