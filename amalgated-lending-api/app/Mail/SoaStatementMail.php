<?php

namespace App\Mail;

use App\Mail\Concerns\EmbedsMailLogo;
use App\Models\SoaStatement;
use App\Support\SoaStatementUrl;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class SoaStatementMail extends Mailable
{
    use EmbedsMailLogo;
    use Queueable;
    use SerializesModels;

    public function __construct(public SoaStatement $statement)
    {
        $this->statement->loadMissing(['borrower', 'loan']);
    }

    public function build(): static
    {
        return $this
            ->subject('Monthly Statement of Account - '.$this->statement->statement_month?->format('F Y'))
            ->view('mail.soa-statement', $this->mailViewData([
                'borrowerName' => $this->statement->borrower?->name ?? 'Borrower',
                'statementNumber' => $this->statement->statement_number,
                'statementMonth' => $this->statement->statement_month?->format('F Y') ?? 'Statement',
                'loanNumber' => $this->statement->loan?->loan_number ?? ('LN-'.str_pad((string) $this->statement->loan_id, 6, '0', STR_PAD_LEFT)),
                'dueDate' => $this->statement->due_date?->format('F j, Y') ?? '—',
                'monthlyDue' => number_format((float) $this->statement->monthly_due, 2),
                'penalties' => number_format((float) $this->statement->penalties, 2),
                'remainingBalance' => number_format((float) $this->statement->remaining_balance, 2),
                'totalDue' => number_format((float) $this->statement->total_due, 2),
                'statementUrl' => SoaStatementUrl::signedPdfDownloadUrl($this->statement),
                'portalUrl' => SoaStatementUrl::portalStatementsUrl($this->statement->id),
            ]));
    }
}
