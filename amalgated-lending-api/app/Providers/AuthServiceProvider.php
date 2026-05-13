<?php

namespace App\Providers;

use App\Models\Chat;
use App\Models\Contact;
use App\Models\Message;
use App\Models\Payment;
use App\Policies\ChatPolicy;
use App\Policies\ContactPolicy;
use App\Policies\MessagePolicy;
use App\Policies\PaymentPolicy;
// use Illuminate\Support\Facades\Gate;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    /**
     * The model to policy mappings for the application.
     *
     * @var array<class-string, class-string>
     */
    protected $policies = [
        Contact::class => ContactPolicy::class,
        Chat::class => ChatPolicy::class,
        Message::class => MessagePolicy::class,
        Payment::class => PaymentPolicy::class,
    ];

    /**
     * Register any authentication / authorization services.
     *
     * @return void
     */
    public function boot()
    {
        $this->registerPolicies();

        //
    }
}
