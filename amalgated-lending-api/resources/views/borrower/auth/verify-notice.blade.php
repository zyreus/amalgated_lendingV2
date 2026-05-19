@include('borrower.auth.verify-email', [
    'ok' => false,
    'title' => 'Verify your email',
    'message' => 'Check your inbox for the verification link we sent when you registered. If it expired, sign in and tap resend verification email.',
    'status' => 'notice',
    'loginUrl' => rtrim((string) config('app.frontend_url', ''), '/').'/borrower/login',
])
