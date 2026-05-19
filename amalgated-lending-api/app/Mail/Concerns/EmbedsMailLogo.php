<?php

namespace App\Mail\Concerns;

/**
 * Marker trait for mailables using mail.layout.
 * Logo src is resolved when the view renders ($message->embed in mail.layout).
 */
trait EmbedsMailLogo
{
    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function mailViewData(array $data = []): array
    {
        return $data;
    }
}
