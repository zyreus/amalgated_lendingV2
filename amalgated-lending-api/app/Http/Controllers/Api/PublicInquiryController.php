<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use App\Models\LeadMessage;
use App\Services\NotificationCenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PublicInquiryController extends Controller
{
    /**
     * Public website loan inquiry — persists to `leads` (CRM) and notifies staff.
     *
     * Accepts structured fields and optional legacy chat-server shape (name, phone, message, company).
     */
    public function store(Request $request): JsonResponse
    {
        if ($request->filled('website')) {
            // Honeypot — bots fill hidden "website" fields.
            return response()->json(['ok' => true, 'message' => 'Thank you.'], 201);
        }

        $data = $request->validate([
            'name' => 'required_without:full_name|string|max:255',
            'full_name' => 'sometimes|string|max:255',
            'email' => 'required|email|max:255',
            'contact_number' => 'sometimes|string|max:32',
            'phone' => 'sometimes|string|max:32',
            'preferred_loan_type' => 'sometimes|string|max:255',
            'loan_type' => 'sometimes|string|max:255',
            'estimated_loan_amount' => 'sometimes|numeric|min:1000|max:999999999.99',
            'estimated_amount' => 'sometimes|numeric|min:1000|max:999999999.99',
            'organization' => 'nullable|string|max:255',
            'company' => 'nullable|string|max:255',
            'message' => 'nullable|string|max:5000',
            'source_page' => 'nullable|string|max:500',
            'source' => 'nullable|string|max:120',
        ]);

        $name = trim((string) ($data['full_name'] ?? $data['name'] ?? ''));
        if ($name === '') {
            throw ValidationException::withMessages(['name' => ['Name is required.']]);
        }

        $phone = trim((string) ($data['contact_number'] ?? $data['phone'] ?? ''));
        if ($phone === '') {
            throw ValidationException::withMessages(['contact_number' => ['Contact number is required.']]);
        }

        $loanType = trim((string) ($data['preferred_loan_type'] ?? $data['loan_type'] ?? ''));
        if ($loanType === '') {
            throw ValidationException::withMessages(['preferred_loan_type' => ['Preferred loan type is required.']]);
        }

        $rawAmount = $data['estimated_loan_amount'] ?? $data['estimated_amount'] ?? null;
        if ($rawAmount === null || $rawAmount === '') {
            throw ValidationException::withMessages(['estimated_loan_amount' => ['Estimated loan amount is required.']]);
        }
        $estimatedAmount = round((float) $rawAmount, 2);

        $email = mb_strtolower(trim($data['email']));
        $organization = trim((string) ($data['organization'] ?? $data['company'] ?? '')) ?: null;
        $source = trim((string) ($data['source'] ?? 'Public Website')) ?: 'Public Website';
        $sourcePage = trim((string) ($data['source_page'] ?? '/contact')) ?: '/contact';

        $structuredLines = [
            'Website borrower inquiry',
            'Preferred loan type: '.$loanType,
            'Estimated amount: PHP '.number_format($estimatedAmount, 2),
            'Contact number: '.$phone,
        ];
        $customMessage = isset($data['message']) ? trim((string) $data['message']) : '';
        if ($customMessage !== '') {
            $structuredLines[] = $customMessage;
        }
        $initialMessage = implode("\n\n", array_filter($structuredLines));

        $dup = Lead::query()
            ->where('email', $email)
            ->where('source', $source)
            ->where('loan_type', $loanType)
            ->where('estimated_amount', $estimatedAmount)
            ->where('created_at', '>=', now()->subMinutes(10))
            ->first();

        if ($dup) {
            Log::info('public_inquiry.duplicate', ['lead_id' => $dup->id, 'email' => $email]);

            return response()->json([
                'ok' => true,
                'duplicate' => true,
                'message' => 'We already received a similar inquiry moments ago. Our team will contact you shortly.',
                'lead' => [
                    'id' => $dup->id,
                    'name' => $dup->name,
                    'email' => $dup->email,
                    'status' => $dup->status,
                ],
                'chat_token' => $dup->chat_token,
            ], 200);
        }

        $lead = Lead::create([
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'organization' => $organization,
            'loan_type' => $loanType,
            'estimated_amount' => $estimatedAmount,
            'source' => $source,
            'status' => 'new',
            'initial_message' => $initialMessage,
            'chat_token' => Str::random(40),
            'last_message_at' => now(),
        ]);

        LeadMessage::create([
            'lead_id' => $lead->id,
            'sender_type' => 'borrower',
            'message' => $initialMessage,
        ]);

        Log::info('public_inquiry.stored', [
            'lead_id' => $lead->id,
            'source' => $source,
            'source_page' => $sourcePage,
            'loan_type' => $loanType,
        ]);

        app(NotificationCenter::class)->notifyStaff(
            NotificationCenter::CATEGORY_CRM_INQUIRY,
            'website_loan_inquiry',
            'New loan inquiry — '.$name,
            $loanType.' · est. ₱'.number_format($estimatedAmount, 2).' · '.$phone,
            [
                'lead_id' => $lead->id,
                'email' => $email,
                'loan_type' => $loanType,
                'estimated_amount' => $estimatedAmount,
                'source' => $source,
            ],
            null,
            [
                'module' => NotificationCenter::MODULE_CRM,
                'dedupe_key' => 'lead_inquiry:'.$lead->id,
            ],
        );

        return response()->json([
            'ok' => true,
            'message' => 'Inquiry received. Our team will contact you soon.',
            'lead' => [
                'id' => $lead->id,
                'name' => $lead->name,
                'email' => $lead->email,
                'status' => $lead->status,
            ],
            'chat_token' => $lead->chat_token,
        ], 201);
    }
}
