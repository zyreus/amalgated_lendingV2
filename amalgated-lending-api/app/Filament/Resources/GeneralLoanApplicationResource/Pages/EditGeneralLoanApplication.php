<?php

namespace App\Filament\Resources\GeneralLoanApplicationResource\Pages;

use App\Filament\Resources\GeneralLoanApplicationResource;
use App\Mail\GeneralLoanApplicationStatusMail;
use App\Models\LoanApplication;
use App\Services\TransactionalMailSender;
use Filament\Forms;
use Filament\Actions\Action;
use Filament\Resources\Pages\EditRecord;
class EditGeneralLoanApplication extends EditRecord
{
    protected static string $resource = GeneralLoanApplicationResource::class;

    protected function getHeaderActions(): array
    {
        return array_merge([
            Action::make('print')
                ->label('Print (A4)')
                ->icon('heroicon-o-printer')
                ->url(fn () => route('print.general-loan', $this->record))
                ->openUrlInNewTab(),
            Action::make('approve')
                ->label('Approve')
                ->color('success')
                ->requiresConfirmation()
                ->action(function (): void {
                    $this->record->update([
                        'status' => LoanApplication::STATUS_APPROVED,
                    ]);
                    $this->notifyBorrowerStatus(LoanApplication::STATUS_APPROVED);
                }),
            Action::make('verify')
                ->label('Mark verified')
                ->color('secondary')
                ->requiresConfirmation()
                ->action(fn () => $this->record->update([
                    'verified_at' => now(),
                ])),
            Action::make('reject')
                ->label('Reject')
                ->color('danger')
                ->form([
                    Forms\Components\Textarea::make('rejection_reason')
                        ->label('Reason')
                        ->required(),
                ])
                ->action(function (array $data): void {
                    $this->record->update([
                        'status' => LoanApplication::STATUS_REJECTED,
                        'rejection_reason' => $data['rejection_reason'],
                    ]);
                    $this->notifyBorrowerStatus(LoanApplication::STATUS_REJECTED);
                }),
        ], parent::getHeaderActions());
    }

    private function notifyBorrowerStatus(string $status): void
    {
        $application = $this->record->fresh(['borrower']);
        $borrower = $application?->borrower;
        if (! $borrower) {
            return;
        }

        $email = trim((string) $borrower->email);
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $mailable = new GeneralLoanApplicationStatusMail($application, (string) $borrower->name, $status);
        $subject = match ($status) {
            LoanApplication::STATUS_APPROVED => 'Loan application update: approved — Amalgated Lending Inc.',
            LoanApplication::STATUS_REJECTED => 'Loan application update: rejected — Amalgated Lending Inc.',
            default => 'Loan application submitted — Amalgated Lending Inc.',
        };

        app(TransactionalMailSender::class)->sendHtmlMailable(
            $mailable,
            $email,
            (string) $borrower->name,
            $subject,
            ['flow' => 'filament_general_loan_status', 'application_id' => $application->id],
        );
    }
}
