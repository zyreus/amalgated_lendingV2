import { useState } from 'react'
import { LoanApplicationForm } from '../components/LoanApplicationForm'
import { StateOfAccountForm } from '../components/StateOfAccountForm'
import type { ComputeLoanResult } from '../types'

export function BorrowerLoanSystemExamplePage() {
  const [computed, setComputed] = useState<ComputeLoanResult | null>(null)

  return (
    <div className="space-y-6 p-6">
      <LoanApplicationForm
        mode="borrower"
        onSubmit={async (_payload, computation) => {
          setComputed(computation)
        }}
      />
      {computed ? (
        <StateOfAccountForm
          borrower={{ name: 'Borrower Sample', email: 'borrower@example.com', phone: '09170000000' }}
          computation={computed}
          totalPaid={computed.breakdown.monthly_amortization}
        />
      ) : null}
    </div>
  )
}
