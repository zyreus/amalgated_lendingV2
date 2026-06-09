<?php

namespace App\Console\Commands;

use App\Services\SOAService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class GenerateMonthlySoaCommand extends Command
{
    protected $signature = 'soa:generate-monthly {--month=} {--borrower_id=} {--send}';

    protected $description = 'Generate monthly Statements of Account for active borrower loans.';

    public function handle(SOAService $soa): int
    {
        $month = $this->option('month') ? Carbon::parse((string) $this->option('month'))->startOfMonth() : now()->startOfMonth();
        $borrowerId = $this->option('borrower_id') ? (int) $this->option('borrower_id') : null;
        $result = $soa->generateBatch($borrowerId, $month, null, (bool) $this->option('send'));

        $this->info("Generated {$result['generated']} SOA record(s); queued {$result['queued']} email(s).");

        return self::SUCCESS;
    }
}
