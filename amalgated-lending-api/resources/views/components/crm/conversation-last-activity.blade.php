@props(['conversation'])
@php
    $c = $conversation;
    $raw = is_object($c) ? ($c->last_message_at ?? $c->updated_at ?? $c->created_at ?? null) : null;
    $carbon = $raw ? \Carbon\Carbon::parse($raw)->timezone(config('app.timezone')) : null;
@endphp
@if ($carbon)
    <time datetime="{{ $carbon->toIso8601String() }}">
        {{ $carbon->format('M d, Y, g:i A') }}
    </time>
@else
    <span class="text-muted">—</span>
@endif
