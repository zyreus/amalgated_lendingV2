<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="robots" content="noindex, nofollow">
    <meta name="theme-color" content="#111827">
    <title>{{ $title }} — {{ config('app.name', 'Amalgated Lending') }}</title>
    @php
        $statusKey = $status ?? ($ok ? 'success' : 'invalid');
        $redirectSeconds = (int) ($redirectSeconds ?? 6);
        $showRedirect = !empty($loginUrl) && ($ok ?? false) && $redirectSeconds > 0;
        $logoSrc = $logoUrl ?? \App\Support\MailLogo::pageLogoUrl();
    @endphp
    @if($showRedirect)
    <meta http-equiv="refresh" content="{{ $redirectSeconds }};url={{ $loginUrl }}">
    @endif
    <style>
        *, *::before, *::after { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(145deg, #0f172a 0%, #1e293b 42%, #334155 100%);
            color: #0f172a;
            -webkit-font-smoothing: antialiased;
        }
        .page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
        }
        .card {
            width: 100%;
            max-width: 420px;
            background: #fff;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45);
            border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .card-head {
            background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
            padding: 24px 24px 20px;
            text-align: center;
            border-bottom: 3px solid #dc2626;
        }
        .card-head img {
            height: 56px;
            width: auto;
            max-width: 200px;
            object-fit: contain;
            margin: 0 auto 12px;
            display: block;
        }
        .card-head .eyebrow {
            margin: 0;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: #fca5a5;
        }
        .card-head .brand {
            margin: 6px 0 0;
            font-size: 17px;
            font-weight: 700;
            color: #f8fafc;
        }
        .card-body { padding: 28px 24px 24px; text-align: center; }
        .icon-ring {
            width: 72px;
            height: 72px;
            margin: 0 auto 20px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .icon-ring--success { background: #d1fae5; color: #059669; }
        .icon-ring--warn { background: #fef3c7; color: #d97706; }
        .icon-ring--info { background: #e0f2fe; color: #0284c7; }
        .icon-ring svg { width: 36px; height: 36px; }
        .badge {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            margin-bottom: 10px;
        }
        .badge--success { background: #d1fae5; color: #065f46; }
        .badge--warn { background: #fef3c7; color: #92400e; }
        .badge--info { background: #e0f2fe; color: #075985; }
        h1 {
            margin: 0 0 10px;
            font-size: 1.45rem;
            line-height: 1.25;
            font-weight: 700;
            color: #0f172a;
        }
        .message {
            margin: 0 0 22px;
            font-size: 0.95rem;
            line-height: 1.6;
            color: #475569;
        }
        .btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 14px 20px;
            border: none;
            border-radius: 12px;
            background: linear-gradient(180deg, #dc2626 0%, #b91c1c 100%);
            color: #fff !important;
            font-size: 0.95rem;
            font-weight: 600;
            text-decoration: none;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(220, 38, 38, 0.35);
            transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 18px rgba(220, 38, 38, 0.45);
        }
        .btn-secondary {
            display: block;
            margin-top: 12px;
            font-size: 0.82rem;
            color: #64748b;
            text-decoration: none;
        }
        .btn-secondary:hover { color: #dc2626; text-decoration: underline; }
        .redirect-box {
            margin-top: 20px;
            padding: 14px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
        }
        .redirect-box p {
            margin: 0 0 10px;
            font-size: 0.8rem;
            color: #64748b;
        }
        .progress-track {
            height: 6px;
            background: #e2e8f0;
            border-radius: 999px;
            overflow: hidden;
        }
        .progress-fill {
            height: 100%;
            width: 100%;
            background: linear-gradient(90deg, #dc2626, #f87171);
            border-radius: 999px;
            transform-origin: left center;
            animation: countdown {{ $redirectSeconds }}s linear forwards;
        }
        @keyframes countdown {
            from { transform: scaleX(1); }
            to { transform: scaleX(0); }
        }
        .footer-note {
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid #f1f5f9;
            font-size: 0.78rem;
            line-height: 1.5;
            color: #94a3b8;
        }
        .footer-note strong { color: #64748b; }
    </style>
</head>
<body>
    <div class="page">
        <main class="card" role="main">
            <header class="card-head">
                <img src="{{ $logoSrc }}" alt="{{ config('app.name', 'Amalgated Lending Inc.') }}">
                <p class="eyebrow">Borrower Portal</p>
                <p class="brand">{{ config('app.name', 'Amalgated Lending Inc.') }}</p>
            </header>

            <div class="card-body">
                @php
                    $iconRing = match ($statusKey) {
                        'success', 'already_verified' => 'icon-ring--success',
                        'expired', 'invalid', 'not_found', 'unauthorized' => 'icon-ring--warn',
                        default => 'icon-ring--info',
                    };
                    $badgeClass = match ($statusKey) {
                        'success', 'already_verified' => 'badge--success',
                        'expired', 'invalid', 'not_found', 'unauthorized' => 'badge--warn',
                        default => 'badge--info',
                    };
                    $badgeLabel = match ($statusKey) {
                        'success' => 'Verified',
                        'already_verified' => 'Already verified',
                        'expired' => 'Expired',
                        'not_found' => 'Not found',
                        'unauthorized' => 'Unauthorized',
                        'notice' => 'Check your inbox',
                        default => 'Action needed',
                    };
                @endphp

                <div class="icon-ring {{ $iconRing }}" aria-hidden="true">
                    @if(in_array($statusKey, ['success', 'already_verified'], true))
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                    @elseif($statusKey === 'expired')
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    @else
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    @endif
                </div>

                <span class="badge {{ $badgeClass }}">{{ $badgeLabel }}</span>
                <h1>{{ $title }}</h1>
                <p class="message">{{ $message }}</p>

                @if(!empty($loginUrl))
                    <a class="btn" href="{{ $loginUrl }}">
                        Continue to borrower sign in
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                        </svg>
                    </a>
                @endif

                @if($showRedirect)
                    <div class="redirect-box" id="redirect-box">
                        <p>Redirecting in <strong id="countdown">{{ $redirectSeconds }}</strong> seconds…</p>
                        <div class="progress-track" aria-hidden="true">
                            <div class="progress-fill"></div>
                        </div>
                    </div>
                @endif

                <p class="footer-note">
                    Need a new link? <strong>Sign in</strong> and tap
                    <strong>Resend verification email</strong> on your dashboard.
                </p>
            </div>
        </main>
    </div>

    @if($showRedirect)
    <script>
        (function () {
            var seconds = {{ $redirectSeconds }};
            var el = document.getElementById('countdown');
            var n = seconds;
            var t = setInterval(function () {
                n -= 1;
                if (el && n >= 0) el.textContent = String(n);
                if (n <= 0) clearInterval(t);
            }, 1000);
        })();
    </script>
    @endif
</body>
</html>
