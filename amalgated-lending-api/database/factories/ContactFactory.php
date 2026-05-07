<?php

namespace Database\Factories;

use App\Models\Contact;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Contact>
 */
class ContactFactory extends Factory
{
    protected $model = Contact::class;

    public function definition(): array
    {
        return [
            'public_id' => (string) Str::uuid(),
            'owner_user_id' => User::factory(),
            'name' => $this->faker->name(),
            'email' => $this->faker->unique()->safeEmail(),
            'phone' => $this->faker->phoneNumber(),
            'company' => $this->faker->company(),
            'job_title' => $this->faker->jobTitle(),
            'source' => $this->faker->randomElement(['web', 'referral', 'manual']),
            'status' => $this->faker->randomElement([
                Contact::STATUS_ACTIVE,
                Contact::STATUS_ACTIVE,
                Contact::STATUS_ARCHIVED,
            ]),
            'notes' => $this->faker->optional()->paragraph(),
            'metadata' => [
                'timezone' => $this->faker->timezone(),
                'tags' => $this->faker->randomElements(['vip', 'support', 'demo', 'newsletter'], $this->faker->numberBetween(0, 2)),
            ],
            'ai_summary' => null,
            'ai_summary_generated_at' => null,
            'last_contacted_at' => now()->subDays($this->faker->numberBetween(0, 30)),
        ];
    }
}
