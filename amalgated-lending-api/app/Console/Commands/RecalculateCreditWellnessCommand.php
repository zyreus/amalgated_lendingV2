<?php

namespace App\Console\Commands;

use App\Models\Loan;
use App\Models\User;
use App\Services\CreditWellnessService;
use Illuminate\Console\Command;

class RecalculateCreditWellnessCommand extends Command
{
    protected $signature = 'credit-wellness:recalculate {--borrower= : Optional borrower user id}';

    protected $description = 'Recalculate borrower credit wellness and loan health metrics';

    public function handle(CreditWellnessService $service): int
    {
        $borrowerId = $this->option('borrower');

        if ($borrowerId) {
            $user = User::query()->find($borrowerId);
            if (! $user) {
                $this->error('Borrower not found.');

                return self::FAILURE;
            }
            $service->recalculateForUser($user, notify: false);
            $this->info("Recalculated wellness for borrower #{$user->id}.");

            return self::SUCCESS;
        }

        $borrowerIds = Loan::query()
            ->distinct()
            ->pluck('borrower_id')
            ->filter();

        $bar = $this->output->createProgressBar($borrowerIds->count());
        $bar->start();

        foreach ($borrowerIds as $id) {
            $user = User::query()->find($id);
            if ($user) {
                $service->recalculateForUser($user, notify: false);
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info('Credit wellness recalculation complete.');

        return self::SUCCESS;
    }
}
