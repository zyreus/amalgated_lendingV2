<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AdminAuthController;
use App\Http\Controllers\Api\AdminChatController;
use App\Http\Controllers\Api\AdminFeedbackController;
use App\Http\Controllers\Api\AdminLeadController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BorrowerAuthController;
use App\Http\Controllers\Api\BorrowerEmailVerificationController;
use App\Http\Controllers\Api\BorrowerController;
use App\Http\Controllers\Api\BorrowerLendingSignatureController;
use App\Http\Controllers\Api\BorrowerLoanApplicationWizardController;
use App\Http\Controllers\Api\BorrowerNotificationController;
use App\Http\Controllers\Api\BorrowerPortalController;
use App\Http\Controllers\Api\ChatController;
use App\Http\Controllers\Api\ChattelMortgageController;
use App\Http\Controllers\Api\CmsController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DocumentLoanAdminController;
use App\Http\Controllers\Api\DocumentLoanApplicationController;
use App\Http\Controllers\Api\FaceRecognitionController;
use App\Http\Controllers\Api\AdminChatKnowledgeController;
use App\Http\Controllers\Api\HealthCheckController;
use App\Http\Controllers\Api\InternalChatRagController;
use App\Http\Controllers\Api\LivenessController;
use App\Http\Controllers\Api\LoanApplicationController;
use App\Http\Controllers\Api\LoanComputationController;
use App\Http\Controllers\Api\LoanController;
use App\Http\Controllers\Api\LoanProductController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\NavigationController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\NotificationPreferenceController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PermissionController;
use App\Http\Controllers\Api\PrintableFormAdminController;
use App\Http\Controllers\Api\PrintableFormBorrowerController;
use App\Http\Controllers\Api\PublicChatController;
use App\Http\Controllers\Api\PublicFeedbackSubmitController;
use App\Http\Controllers\Api\PublicWebsiteTestimonialsController;
use App\Http\Controllers\Api\ChatbotFeedbackController;
use App\Http\Controllers\Api\PublicFileController;
use App\Http\Controllers\Api\PublicInquiryController;
use App\Http\Controllers\Api\PublicLeadController;
use App\Http\Controllers\Api\RealEstateMortgageController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\SalaryLoanController;
use App\Http\Controllers\Api\SssPensionLoanController;
use App\Http\Controllers\Api\SupportChatSyncController;
use App\Http\Controllers\Api\SystemSettingController;
use App\Http\Controllers\Api\TravelAssistanceController;
use App\Http\Controllers\Api\TravelLoanApplicationAdminController;
use App\Http\Controllers\Api\TravelLoanWizardController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

/*
| Amalgated Lending — REST API (JWT + dynamic RBAC)
*/

Route::prefix('v1')->group(function () {
    Route::get('/health', HealthCheckController::class);

    Route::post('/admin/login', [AdminAuthController::class, 'login']);
    Route::post('/borrower/login', [BorrowerAuthController::class, 'login']);
    Route::post('/borrower/register', [BorrowerAuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/borrower/forgot-password', [PasswordResetController::class, 'requestBorrower']);
    Route::post('/admin/forgot-password', [PasswordResetController::class, 'requestAdmin']);
    Route::post('/password/reset', [PasswordResetController::class, 'reset']);

    /** Signed inbox link — redirects to SPA after marking email_verified_at. */
    Route::get('/borrower/email/verify', [BorrowerEmailVerificationController::class, 'verify'])
        ->middleware(['throttle:72,1'])
        ->name('api.borrower.email.verify');

    Route::post('/liveness/verify', [LivenessController::class, 'verify'])
        ->middleware(['auth:api', 'active', 'borrower', 'throttle:liveness']);

    Route::post('/liveness/faceio-verify', [LivenessController::class, 'verifyFaceIO'])
        ->middleware(['auth:api', 'active', 'borrower', 'throttle:liveness']);

    Route::post('/liveness/amplify-session', [LivenessController::class, 'createAmplifySession'])
        ->middleware(['auth:api', 'active', 'borrower', 'throttle:liveness']);

    Route::get('/liveness/amplify-session/{sessionId}/results', [LivenessController::class, 'getAmplifySessionResults'])
        ->where('sessionId', '[a-zA-Z0-9\-]+')
        ->middleware(['auth:api', 'active', 'borrower', 'throttle:liveness']);

    Route::post('/face/verify', [FaceRecognitionController::class, 'verify'])
        ->middleware(['auth:api', 'active', 'borrower', 'throttle:face_verify']);

    Route::get('/public/cms', [CmsController::class, 'publicSection']);
    Route::get('/public-files/{path}', [PublicFileController::class, 'show'])->where('path', '.*');
    Route::get('/public/loan-products', [LoanProductController::class, 'publicIndex']);
    Route::post('/public/loan-products/calculate', [LoanProductController::class, 'calculate']);
    Route::post('/public/loan-computations/quick', [LoanComputationController::class, 'compute']);
    Route::get('/loan-products', [LoanProductController::class, 'publicIndex']);
    Route::get('/loan-products/slug/{slug}/requirements', [LoanProductController::class, 'documentRequirementsBySlug']);
    Route::get('/loan-products/{loanProduct}/requirements', [LoanProductController::class, 'documentRequirements']);

    Route::post('/loan-applications', [DocumentLoanApplicationController::class, 'store']);
    Route::post('/public/loan-applications', [LoanController::class, 'publicApply']);
    Route::post('/public/chattel-mortgage/apply', [ChattelMortgageController::class, 'apply']);
    Route::post('/public/real-estate-mortgage/apply', [RealEstateMortgageController::class, 'apply']);
    Route::post('/public/salary-loan/apply', [SalaryLoanController::class, 'apply']);
    Route::post('/public/travel-assistance-loan/apply', [TravelAssistanceController::class, 'apply']);
    // Travel wizard endpoint used by frontend `postTravelLoanWizardApplication`.
    Route::post('/loan/apply', [TravelLoanWizardController::class, 'apply']);
    Route::post('/public/sss-pension-loan/apply', [SssPensionLoanController::class, 'apply']);
    Route::post('/public/leads', [PublicLeadController::class, 'store']);
    Route::post('/public/inquiry', [PublicInquiryController::class, 'store'])->middleware('throttle:20,1');
    Route::get('/public/leads/{lead}/messages', [PublicLeadController::class, 'messages']);
    Route::post('/public/leads/{lead}/messages', [PublicLeadController::class, 'sendMessage']);
    Route::post('/public/chat/messages', [PublicChatController::class, 'storeMessage']);
    Route::get('/public/chat/messages/{sessionId}', [PublicChatController::class, 'messages']);
    /** Aliases aligned with unified support API naming */
    Route::post('/public/chat/send', [PublicChatController::class, 'storeMessage'])->middleware('throttle:120,1');
    Route::get('/public/chat/history/{sessionId}', [PublicChatController::class, 'messages']);
    Route::get('/public/chat/conversation-meta/{sessionId}', [PublicChatController::class, 'conversationMeta']);
    Route::post('/public/chat/feedback', [PublicChatController::class, 'feedbackStore'])->middleware('throttle:45,1');
    Route::post('/public/feedback', [PublicChatController::class, 'feedbackStore'])->middleware('throttle:45,1');
    Route::post('/public/feedback/submit', [PublicFeedbackSubmitController::class, 'store'])->middleware('throttle:12,1');
    Route::post('/feedback/submit', [PublicFeedbackSubmitController::class, 'store'])->middleware('throttle:12,1');
    Route::get('/public/feedback/testimonials', [PublicWebsiteTestimonialsController::class, 'legacyList'])->middleware('throttle:120,1');
    Route::get('/public/website/testimonials', [PublicWebsiteTestimonialsController::class, 'website'])->middleware('throttle:120,1');
    Route::get('/public/testimonials', [PublicWebsiteTestimonialsController::class, 'website'])->middleware('throttle:120,1');
    Route::get('/website/testimonials', [PublicWebsiteTestimonialsController::class, 'website'])->middleware('throttle:120,1');
    Route::post('/chatbot/feedback', [ChatbotFeedbackController::class, 'store'])->middleware('throttle:30,1');

    Route::post('/internal/support/sync/message', [SupportChatSyncController::class, 'syncMessage'])
        ->middleware(['support.sync', 'throttle:600,1']);
    Route::post('/internal/support/sync/feedback', [SupportChatSyncController::class, 'syncFeedback'])
        ->middleware(['support.sync', 'throttle:120,1']);
    Route::post('/internal/chat/rag/context', [InternalChatRagController::class, 'context'])
        ->middleware(['support.sync', 'throttle:120,1']);

    Route::middleware(['auth:api', 'active'])->group(function () {
        Route::get('/loan-applications/draft', [DocumentLoanApplicationController::class, 'currentDraft']);
        Route::get('/application/{documentLoanApplication}/print', [DocumentLoanApplicationController::class, 'printApplication']);
        Route::get('/loan-applications/{documentLoanApplication}', [DocumentLoanApplicationController::class, 'show']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::post('/auth/refresh', [AuthController::class, 'refresh']);
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::get('/navigation', [NavigationController::class, 'index']);

        Route::middleware('permission:dashboard.view')->group(function () {
            Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
            Route::get('/dashboard/charts', [DashboardController::class, 'charts']);
        });

        Route::middleware('permission:users.view')->group(function () {
            Route::get('/users', [UserController::class, 'index']);
            Route::get('/users/{user}', [UserController::class, 'show']);
            Route::get('/users-export', [UserController::class, 'export']);
        });
        Route::middleware('permission:users.manage')->group(function () {
            Route::post('/users', [UserController::class, 'store']);
            Route::put('/users/{user}', [UserController::class, 'update']);
            Route::post('/users/{user}/verify-email', [UserController::class, 'verifyBorrowerEmail']);
            Route::post('/users/{user}/resend-verification', [UserController::class, 'resendBorrowerEmailVerification']);
            Route::delete('/users/{user}', [UserController::class, 'destroy']);
        });

        Route::middleware('permission:roles.manage')->group(function () {
            Route::get('/roles', [RoleController::class, 'index']);
            Route::post('/roles', [RoleController::class, 'store']);
            Route::get('/roles/{role}', [RoleController::class, 'show']);
            Route::put('/roles/{role}', [RoleController::class, 'update']);
            Route::delete('/roles/{role}', [RoleController::class, 'destroy']);
            Route::get('/permissions', [RoleController::class, 'permissionsIndex']);
            Route::post('/permissions', [PermissionController::class, 'store']);
            Route::put('/permissions/{permission}', [PermissionController::class, 'update']);
            Route::delete('/permissions/{permission}', [PermissionController::class, 'destroy']);
        });

        Route::middleware('permission:loans.view')->group(function () {
            Route::get('/loans', [LoanController::class, 'index']);
            Route::get('/loans/{loan}', [LoanController::class, 'show']);
        });
        Route::middleware('permission:loans.approve')->group(function () {
            Route::post('/loans', [LoanController::class, 'store']);
            Route::patch('/loans/{loan}/document-review', [LoanController::class, 'patchDocumentReview']);
            Route::post('/loans/{loan}/approve', [LoanController::class, 'approve']);
            Route::post('/loans/{loan}/reject', [LoanController::class, 'reject']);
            Route::put('/loan/{loanApplication}', [TravelLoanApplicationAdminController::class, 'update']);
            Route::delete('/loan/{loanApplication}', [TravelLoanApplicationAdminController::class, 'destroy']);
            Route::post('/loan/{loanApplication}/receipt', [TravelLoanApplicationAdminController::class, 'upsertReceipt']);
        });

        Route::middleware('permission:loans.view')->group(function () {
            Route::get('/loan/list', [TravelLoanApplicationAdminController::class, 'index']);
            Route::get('/loan/export', [TravelLoanApplicationAdminController::class, 'exportExcel']);
            Route::get('/loan/{loanApplication}', [TravelLoanApplicationAdminController::class, 'show']);
        });

        Route::middleware('permission:loans.assign')->group(function () {
            Route::patch('/loans/{loan}/assign-officer', [LoanController::class, 'assignOfficer']);
        });

        Route::middleware('permission:borrowers.view')->group(function () {
            Route::get('/borrowers', [BorrowerController::class, 'index']);
            Route::get('/borrowers/{borrower}/uploaded-files', [BorrowerController::class, 'uploadedFiles']);
            Route::get('/borrowers/{borrower}', [BorrowerController::class, 'show']);
        });

        Route::middleware('permission:users.manage')->group(function () {
            Route::post('/borrowers', [BorrowerController::class, 'store']);
            // Alias for historical / naming alignment with "admin/borrowers".
            Route::post('/admin/borrowers', [BorrowerController::class, 'store']);
        });

        Route::middleware('permission:borrowers.delete')->group(function () {
            Route::delete('/borrowers/{borrower}', [BorrowerController::class, 'destroy']);
        });

        Route::middleware('permission:reports.view')->group(function () {
            Route::get('/reports/summary', [ReportController::class, 'summary']);
        });

        Route::middleware('permission:payments.manage')->group(function () {
            Route::get('/payments', [PaymentController::class, 'index']);
            Route::put('/payments/{payment}', [PaymentController::class, 'record']);
            Route::patch('/payments/{payment}/status', [PaymentController::class, 'updateStatus']);
            Route::get('/users/{user}/payment-history', [PaymentController::class, 'forUser']);

            Route::middleware('permission:payments.adjust_final')->group(function () {
                Route::patch('/payments/{payment}/adjust-final', [PaymentController::class, 'adjustFinal']);
                Route::get('/payments/{payment}/adjustment-audits', [PaymentController::class, 'adjustmentAudits']);
            });
        });

        Route::middleware('permission:cms.manage')->group(function () {
            Route::get('/cms', [CmsController::class, 'index']);
            Route::post('/cms', [CmsController::class, 'upsert']);
        });

        Route::middleware('permission:settings.manage')->group(function () {
            Route::get('/settings', [SystemSettingController::class, 'index']);
            Route::get('/settings/{key}', [SystemSettingController::class, 'show']);
            Route::post('/settings/{key}', [SystemSettingController::class, 'upsert']);
        });

        Route::middleware('permission:activity.view')->group(function () {
            Route::get('/activity-logs', [ActivityLogController::class, 'index']);
        });

        Route::middleware('permission:dashboard.view')->group(function () {
            Route::get('/feedbacks', [AdminFeedbackController::class, 'index']);
            Route::get('/feedbacks/reporting/summary', [AdminFeedbackController::class, 'reportingSummary']);
            Route::get('/feedbacks/{ticket}', [AdminFeedbackController::class, 'show']);
            Route::patch('/feedbacks/{ticket}/status', [AdminFeedbackController::class, 'updateStatus']);
            Route::patch('/feedbacks/{ticket}', [AdminFeedbackController::class, 'updateTicket']);
            Route::delete('/feedbacks/{ticket}', [AdminFeedbackController::class, 'destroy']);
            Route::get('/feedbacks/{ticket}/analytics', [AdminFeedbackController::class, 'analytics']);
            Route::put('/feedbacks/{ticket}/approve', [AdminFeedbackController::class, 'approveForWebsite']);
            Route::put('/feedbacks/{ticket}/reject', [AdminFeedbackController::class, 'rejectForWebsite']);
            Route::put('/feedbacks/{ticket}/feature', [AdminFeedbackController::class, 'featureForWebsite']);
            Route::put('/feedbacks/{ticket}/unfeature', [AdminFeedbackController::class, 'unfeatureForWebsite']);
            Route::put('/feedbacks/{ticket}/verify-borrower', [AdminFeedbackController::class, 'verifyBorrower']);
        });

        Route::middleware('permission:notifications.view')->group(function () {
            Route::get('/notifications/poll', [NotificationController::class, 'poll']);
            Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
            Route::get('/notifications', [NotificationController::class, 'index']);
            Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
            Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
            Route::post('/notifications/{notification}/unread', [NotificationController::class, 'markUnread']);
            Route::delete('/notifications/{notification}', [NotificationController::class, 'destroy']);
            Route::post('/notifications/bulk-delete', [NotificationController::class, 'bulkDestroy']);
            Route::get('/notification-preferences', [NotificationPreferenceController::class, 'show']);
            Route::put('/notification-preferences', [NotificationPreferenceController::class, 'update']);
        });

        Route::middleware('permission:loans.view')->group(function () {
            Route::get('/document-loan-applications', [DocumentLoanAdminController::class, 'index']);
            Route::get('/document-loan-applications/{documentLoanApplication}', [DocumentLoanAdminController::class, 'show']);
        });
        Route::middleware('permission:loans.approve')->group(function () {
            Route::patch('/uploaded-documents/{uploadedDocument}', [DocumentLoanAdminController::class, 'updateUpload']);
        });

        Route::middleware('permission:forms.printable.manage')->group(function () {
            Route::get('/printable-forms', [PrintableFormAdminController::class, 'index']);
            Route::post('/printable-forms', [PrintableFormAdminController::class, 'store']);
            Route::put('/printable-forms/{printableForm}', [PrintableFormAdminController::class, 'update']);
            Route::delete('/printable-forms/{printableForm}', [PrintableFormAdminController::class, 'destroy']);
            Route::post('/printable-forms/{printableForm}/upload-template', [PrintableFormAdminController::class, 'uploadTemplate']);
            Route::post('/printable-forms/{printableForm}/test-pdf', [PrintableFormAdminController::class, 'testPdf']);
            Route::get('/printable-forms/{printableForm}/master-template', [PrintableFormAdminController::class, 'downloadMasterTemplate']);
            Route::get('/printable-form-logs', [PrintableFormAdminController::class, 'logs']);
        });

        Route::middleware('borrower')->group(function () {
            Route::post('/loan-applications/borrower-draft', [DocumentLoanApplicationController::class, 'createBorrowerDraft']);
            Route::patch('/loan-applications/{documentLoanApplication}/wizard', [DocumentLoanApplicationController::class, 'patchWizard']);
            Route::post('/loan-applications/{documentLoanApplication}/embedded-documents', [DocumentLoanApplicationController::class, 'uploadEmbeddedDocument']);
            Route::post('/upload-document', [DocumentLoanApplicationController::class, 'upload']);
            Route::post('/reupload-document', [DocumentLoanApplicationController::class, 'reupload']);
            Route::post('/upload-signed-form', [DocumentLoanApplicationController::class, 'uploadSignedForm']);
            Route::post('/loan-applications/{documentLoanApplication}/submit', [DocumentLoanApplicationController::class, 'submit']);
        });
    });

    Route::prefix('admin')->middleware(['auth:api', 'active', 'admin'])->group(function () {
        Route::get('/me', [AdminAuthController::class, 'me']);
        Route::post('/logout', [AdminAuthController::class, 'logout']);
        Route::get('/dashboard', [DashboardController::class, 'summary']);
        Route::apiResource('/contacts', ContactController::class);
        Route::apiResource('/chats', ChatController::class);
        Route::get('/chats/{chat}/messages', [MessageController::class, 'index']);
        Route::post('/chats/{chat}/messages', [MessageController::class, 'store']);
        Route::post('/chats/{chat}/messages/stream-ai', [MessageController::class, 'streamAi']);
        Route::get('/leads', [AdminLeadController::class, 'index']);
        Route::get('/leads/{lead}', [AdminLeadController::class, 'show']);
        Route::put('/leads/{lead}', [AdminLeadController::class, 'update']);
        Route::delete('/leads/{lead}', [AdminLeadController::class, 'destroy']);
        Route::get('/leads/{lead}/messages', [AdminLeadController::class, 'messages']);
        Route::post('/leads/{lead}/messages', [AdminLeadController::class, 'sendMessage']);
        Route::post('/leads/{leadRef}/email', [AdminLeadController::class, 'sendEmail']);
        Route::get('/chat/conversations', [AdminChatController::class, 'conversations']);
        Route::get('/chat/conversations/{sessionId}/messages', [AdminChatController::class, 'messages']);
        Route::post('/chat/conversations/{sessionId}/messages', [AdminChatController::class, 'sendMessage']);
        Route::get('/chat/support-analytics', [AdminChatController::class, 'analytics']);
        Route::patch('/chat/conversations/{sessionId}/warehouse-status', [AdminChatController::class, 'patchStatus']);
        Route::post('/chat/conversations/{sessionId}/warehouse-assign', [AdminChatController::class, 'assignConversation']);
        Route::delete('/chat/conversations/{sessionId}/warehouse', [AdminChatController::class, 'destroyConversation']);
        Route::get('/chat/knowledge', [AdminChatKnowledgeController::class, 'stats']);
        Route::post('/chat/knowledge/sync', [AdminChatKnowledgeController::class, 'sync']);
        Route::get('/loan-products', [LoanProductController::class, 'adminIndex']);
        Route::post('/loan-products', [LoanProductController::class, 'store']);
        Route::put('/loan-products/{loanProduct}', [LoanProductController::class, 'update']);
        Route::delete('/loan-products/{loanProduct}', [LoanProductController::class, 'destroy']);
        Route::apiResource('/loan-applications', LoanApplicationController::class);
    });

    Route::prefix('borrower')->middleware(['auth:api', 'active', 'borrower'])->group(function () {
        Route::get('/loan-calculator/applications', [LoanApplicationController::class, 'index']);
        Route::post('/loan-calculator/applications', [LoanApplicationController::class, 'store']);
        Route::get('/loan-calculator/applications/{loanApplication}', [LoanApplicationController::class, 'show']);
        Route::patch('/loan-calculator/applications/{loanApplication}', [LoanApplicationController::class, 'update']);
        Route::get('/loan-applications/wizard/schema', [BorrowerLoanApplicationWizardController::class, 'schema']);
        Route::get('/loan-applications', [BorrowerLoanApplicationWizardController::class, 'index']);
        Route::post('/loan-applications', [BorrowerLoanApplicationWizardController::class, 'store']);
        Route::get('/loan-applications/{loanApplication}', [BorrowerLoanApplicationWizardController::class, 'show']);
        Route::patch('/loan-applications/{loanApplication}', [BorrowerLoanApplicationWizardController::class, 'update']);
        Route::post('/loan-applications/{loanApplication}/documents/{docKey}', [BorrowerLoanApplicationWizardController::class, 'uploadDocument']);
        Route::delete('/loan-applications/{loanApplication}/documents/{docKey}', [BorrowerLoanApplicationWizardController::class, 'removeDocument']);
        Route::post('/loan-applications/{loanApplication}/validate-step', [BorrowerLoanApplicationWizardController::class, 'validateStep']);
        Route::post('/loan-applications/{loanApplication}/signature', [BorrowerLoanApplicationWizardController::class, 'saveSignature']);
        Route::post('/loan-applications/{loanApplication}/submit', [BorrowerLoanApplicationWizardController::class, 'submit']);
        Route::delete('/loan-applications/{loanApplication}', [BorrowerLoanApplicationWizardController::class, 'destroy']);
        Route::get('/document-loan-applications', [DocumentLoanApplicationController::class, 'borrowerIndex']);
        Route::get('/profile/documents', [BorrowerPortalController::class, 'profileDocuments']);
        Route::get('/lending-applications', [BorrowerPortalController::class, 'lendingApplications']);
        Route::post('/lending-applications/general/{loanApplication}/signature/applicant', [BorrowerLendingSignatureController::class, 'generalApplicant']);
        Route::post('/lending-applications/general/{loanApplication}/signature/spouse', [BorrowerLendingSignatureController::class, 'generalSpouse']);
        Route::post('/lending-applications/general/{loanApplication}/signature/comaker', [BorrowerLendingSignatureController::class, 'generalComaker']);
        Route::post('/lending-applications/travel/{travelApplication}/signature/applicant', [BorrowerLendingSignatureController::class, 'travelApplicant']);
        Route::post('/lending-applications/travel/{travelApplication}/signature/spouse', [BorrowerLendingSignatureController::class, 'travelSpouse']);
        Route::get('/me', [BorrowerAuthController::class, 'me']);
        Route::post('/logout', [BorrowerAuthController::class, 'logout']);
        Route::post('/email/resend-verification', [BorrowerEmailVerificationController::class, 'resend'])
            ->middleware('throttle:6,1');
        Route::post('/change-password', [BorrowerAuthController::class, 'changePassword']);
        Route::get('/dashboard', [BorrowerPortalController::class, 'dashboard']);
        Route::get('/payments', [BorrowerPortalController::class, 'payments']);
        Route::get('/payments/history', [BorrowerPortalController::class, 'paymentHistory']);
        Route::get('/payments/{payment}/official-receipt', [BorrowerPortalController::class, 'downloadOfficialReceipt']);
        Route::post('/upload-payment', [BorrowerPortalController::class, 'uploadPayment']);
        Route::get('/notifications/poll', [BorrowerNotificationController::class, 'poll']);
        Route::get('/notifications/unread-count', [BorrowerNotificationController::class, 'unreadCount']);
        Route::get('/notifications', [BorrowerNotificationController::class, 'index']);
        Route::post('/notifications/read-all', [BorrowerNotificationController::class, 'markAllRead']);
        Route::post('/notifications/{borrowerNotification}/read', [BorrowerNotificationController::class, 'markRead']);
        Route::post('/notifications/{borrowerNotification}/unread', [BorrowerNotificationController::class, 'markUnread']);
        Route::post('/notifications/{borrowerNotification}/archive', [BorrowerNotificationController::class, 'archive']);
        Route::post('/notifications/clear-all', [BorrowerNotificationController::class, 'clearAll']);
        Route::get('/notification-preferences', [NotificationPreferenceController::class, 'show']);
        Route::put('/notification-preferences', [NotificationPreferenceController::class, 'update']);
        Route::post('/profile', [BorrowerPortalController::class, 'updateProfile']);
        Route::get('/chat/messages', [BorrowerPortalController::class, 'chatMessages']);
        Route::post('/chat/messages', [BorrowerPortalController::class, 'sendChatMessage']);

        Route::get('/printable-forms', [PrintableFormBorrowerController::class, 'index']);
        Route::post('/printable-forms/{printableForm}/generate', [PrintableFormBorrowerController::class, 'generate']);
        Route::post('/printable-forms/download-log', [PrintableFormBorrowerController::class, 'recordDownload']);
    });
});

/** Short path for public SPA / legacy clients (same handler as `/api/v1/public/inquiry`). */
Route::post('/inquiry', [PublicInquiryController::class, 'store'])
    ->middleware('throttle:20,1')
    ->name('inquiry.submit');
