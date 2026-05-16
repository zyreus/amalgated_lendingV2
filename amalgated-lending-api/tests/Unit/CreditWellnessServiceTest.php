<?php

namespace Tests\Unit;

use App\Models\BorrowerCreditWellness;
use App\Models\Loan;
use App\Models\LoanHealthMetric;
use App\Models\Payment;
use App\Models\User;
use App\Models\WellnessHistory;
use App\Services\CreditWellnessService;
use App\Services\CreditScoreService;
use App\Services\NotificationCenter;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class CreditWellnessServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->configureInMemoryDatabase();
        $this->createMinimalSchema();
    }

    private function configureInMemoryDatabase(): void
    {
        config(['database.default' => 'sqlite']);
        config(['database.connections.sqlite.database' => ':memory:']);
        $this->app['db']->purge('sqlite');
        $this->app['db']->connection('sqlite')->getSchemaBuilder();
    }

    private function createMinimalSchema(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->string('email')->unique();
            $table->string('password');
            $table->string('role')->nullable();
            $table->boolean('is_active')->default(true);
            $table->decimal('credit_score', 8, 2)->nullable();
            $table->string('risk_level', 16)->nullable();
            $table->timestamps();
        });

        Schema::create('loans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('borrower_id');
            $table->decimal('principal', 12, 2)->default(0);
            $table->decimal('requested_principal', 12, 2)->nullable();
            $table->unsignedInteger('term_months')->default(1);
            $table->decimal('annual_interest_rate', 8, 4)->default(0);
            $table->string('status')->default('ongoing');
            $table->decimal('outstanding_balance', 12, 2)->nullable();
            $table->decimal('monthly_payment', 12, 2)->nullable();
            $table->json('application_payload')->nullable();
            $table->timestamps();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('loan_id');
            $table->unsignedInteger('installment_no')->default(1);
            $table->date('due_date')->nullable();
            $table->decimal('amount_due', 12, 2)->default(0);
            $table->decimal('principal_portion', 12, 2)->default(0);
            $table->decimal('interest_portion', 12, 2)->default(0);
            $table->decimal('amount_paid', 12, 2)->default(0);
            $table->decimal('penalty_amount', 12, 2)->default(0);
            $table->timestamp('paid_at')->nullable();
            $table->string('status')->default('pending');
            $table->string('receipt_status')->default('pending');
            $table->timestamps();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('borrower_credit_wellness', function (Blueprint $table) {
            $table->id();
            $table->foreignId('borrower_id')->unique();
            $table->unsignedSmallInteger('wellness_score')->default(0);
            $table->string('score_category', 32)->default('fair');
            $table->decimal('repayment_rate', 5, 2)->default(0);
            $table->unsignedInteger('delayed_payment_count')->default(0);
            $table->unsignedInteger('missed_payment_count')->default(0);
            $table->decimal('total_penalties', 12, 2)->default(0);
            $table->unsignedSmallInteger('active_loan_count')->default(0);
            $table->string('default_risk_level', 16)->default('low');
            $table->unsignedSmallInteger('payment_streak')->default(0);
            $table->decimal('delayed_payment_rate', 5, 2)->default(0);
            $table->unsignedSmallInteger('avg_delay_days')->default(0);
            $table->unsignedSmallInteger('longest_delay_days')->default(0);
            $table->decimal('current_overdue_amount', 12, 2)->default(0);
            $table->decimal('total_outstanding_balance', 12, 2)->default(0);
            $table->string('improvement_trend', 16)->default('stable');
            $table->json('risk_flags')->nullable();
            $table->json('recommendations')->nullable();
            $table->json('delay_metrics')->nullable();
            $table->json('eligibility_impact')->nullable();
            $table->timestamps();
        });

        Schema::create('loan_health_metrics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('loan_id')->unique();
            $table->string('health_status', 32)->default('healthy');
            $table->unsignedSmallInteger('overdue_days')->default(0);
            $table->unsignedInteger('missed_payments')->default(0);
            $table->unsignedInteger('delayed_payments')->default(0);
            $table->decimal('penalties', 12, 2)->default(0);
            $table->decimal('payment_consistency', 5, 2)->default(100);
            $table->unsignedSmallInteger('restructuring_count')->default(0);
            $table->decimal('current_overdue_amount', 12, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('wellness_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('borrower_id');
            $table->unsignedSmallInteger('score');
            $table->string('score_category', 32)->nullable();
            $table->json('snapshot')->nullable();
            $table->timestamp('recorded_at');
        });
    }

    private function service(): CreditWellnessService
    {
        $notifications = Mockery::mock(NotificationCenter::class);
        $notifications->shouldReceive('notifyBorrower')->andReturnNull();

        return new CreditWellnessService(
            new CreditScoreService,
            $notifications,
        );
    }

    private function createBorrower(): User
    {
        return User::query()->create([
            'name' => 'Test Borrower',
            'email' => 'borrower'.uniqid().'@test.local',
            'password' => bcrypt('secret'),
            'role' => 'borrower',
        ]);
    }

    private function seedLoan(User $borrower, array $payments): Loan
    {
        $loan = Loan::query()->create([
            'borrower_id' => $borrower->id,
            'principal' => 100000,
            'term_months' => 6,
            'annual_interest_rate' => 12,
            'status' => Loan::STATUS_ONGOING,
            'outstanding_balance' => 50000,
            'monthly_payment' => 18000,
        ]);

        foreach ($payments as $i => $spec) {
            Payment::query()->create([
                'loan_id' => $loan->id,
                'installment_no' => $i + 1,
                'due_date' => $spec['due_date'],
                'amount_due' => 18000,
                'principal_portion' => 15000,
                'interest_portion' => 3000,
                'amount_paid' => $spec['amount_paid'] ?? 0,
                'paid_at' => $spec['paid_at'] ?? null,
                'status' => $spec['status'] ?? Payment::STATUS_PENDING,
                'penalty_amount' => $spec['penalty_amount'] ?? 0,
            ]);
        }

        return $loan;
    }

    public function test_on_time_payments_improve_wellness_score(): void
    {
        $borrower = $this->createBorrower();
        $base = now()->subMonths(6);

        $this->seedLoan($borrower, collect(range(0, 5))->map(fn ($m) => [
            'due_date' => $base->copy()->addMonths($m),
            'amount_paid' => 18000,
            'paid_at' => $base->copy()->addMonths($m),
            'status' => Payment::STATUS_PAID,
        ])->all());

        $wellness = $this->service()->recalculateForUser($borrower, notify: false);

        $this->assertGreaterThanOrEqual(75, $wellness->wellness_score);
        $this->assertContains($wellness->score_category, [
            BorrowerCreditWellness::CATEGORY_EXCELLENT,
            BorrowerCreditWellness::CATEGORY_GOOD,
        ]);
        $this->assertGreaterThan(0, WellnessHistory::where('borrower_id', $borrower->id)->count());
    }

    public function test_missed_payments_decline_wellness_and_loan_health_becomes_risky(): void
    {
        $borrower = $this->createBorrower();
        $loan = $this->seedLoan($borrower, [
            ['due_date' => now()->subDays(60), 'amount_paid' => 0, 'status' => Payment::STATUS_OVERDUE],
            ['due_date' => now()->subDays(30), 'amount_paid' => 0, 'status' => Payment::STATUS_OVERDUE],
            ['due_date' => now()->subDays(5), 'amount_paid' => 0, 'status' => Payment::STATUS_OVERDUE],
        ]);

        $wellness = $this->service()->recalculateForUser($borrower, notify: false);
        $health = LoanHealthMetric::query()->where('loan_id', $loan->id)->first();

        $this->assertLessThan(60, $wellness->wellness_score);
        $this->assertGreaterThanOrEqual(2, $wellness->missed_payment_count);
        $this->assertContains($health?->health_status, [
            LoanHealthMetric::STATUS_HIGH_RISK,
            LoanHealthMetric::STATUS_DEFAULT_RISK,
            LoanHealthMetric::STATUS_DELAYED,
        ]);
    }

    public function test_repeated_delays_trigger_predictive_risk_flags(): void
    {
        $borrower = $this->createBorrower();
        $base = now()->subMonths(4);

        $this->seedLoan($borrower, [
            [
                'due_date' => $base->copy()->addMonth(),
                'amount_paid' => 18000,
                'paid_at' => $base->copy()->addMonth()->addDays(12),
                'status' => Payment::STATUS_PAID,
            ],
            [
                'due_date' => $base->copy()->addMonths(2),
                'amount_paid' => 18000,
                'paid_at' => $base->copy()->addMonths(2)->addDays(15),
                'status' => Payment::STATUS_PAID,
            ],
            ['due_date' => now()->subDays(10), 'amount_paid' => 0, 'status' => Payment::STATUS_OVERDUE],
        ]);

        $wellness = $this->service()->recalculateForUser($borrower, notify: false);
        $codes = collect($wellness->risk_flags ?? [])->pluck('code')->all();

        $this->assertNotEmpty($wellness->risk_flags);
        $this->assertTrue(
            count(array_intersect($codes, ['increasing_delays', 'possible_default', 'multiple_overdue', 'declining_consistency'])) > 0
        );
    }

    public function test_portfolio_segments_borrowers_by_health(): void
    {
        $good = $this->createBorrower();
        $risky = $this->createBorrower();

        BorrowerCreditWellness::query()->create([
            'borrower_id' => $good->id,
            'wellness_score' => 92,
            'score_category' => BorrowerCreditWellness::CATEGORY_EXCELLENT,
            'repayment_rate' => 98,
            'default_risk_level' => 'low',
            'improvement_trend' => 'improving',
        ]);

        BorrowerCreditWellness::query()->create([
            'borrower_id' => $risky->id,
            'wellness_score' => 35,
            'score_category' => BorrowerCreditWellness::CATEGORY_CRITICAL,
            'repayment_rate' => 40,
            'default_risk_level' => 'critical',
            'improvement_trend' => 'declining',
        ]);

        $portfolio = $this->service()->portfolioOverview();

        $this->assertSame(2, $portfolio['total_borrowers']);
        $this->assertSame(1, $portfolio['segments'][BorrowerCreditWellness::CATEGORY_EXCELLENT]);
        $this->assertSame(1, $portfolio['segments'][BorrowerCreditWellness::CATEGORY_CRITICAL]);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
