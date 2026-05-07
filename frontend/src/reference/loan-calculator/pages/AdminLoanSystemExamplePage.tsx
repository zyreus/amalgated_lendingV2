import { useState } from 'react'
import { LoanCalculatorComponent } from '../components/LoanCalculatorComponent'
import { LoanApplicationForm } from '../components/LoanApplicationForm'
import { PrintableLoanApplicationForm } from '../components/PrintableLoanApplicationForm'
import { StateOfAccountForm } from '../components/StateOfAccountForm'
import type { ComputeLoanResult } from '../types'

export function AdminLoanSystemExamplePage() {
  const [computed, setComputed] = useState<ComputeLoanResult | null>(null)

  return (
    <div className="space-y-6 p-6">
      <LoanCalculatorComponent variant="admin" onComputed={(result) => setComputed(result)} />
      <LoanApplicationForm mode="admin" />
      {computed ? (
        <>
          <PrintableLoanApplicationForm
            borrower={{ name: 'Juan Dela Cruz', email: 'juan@example.com', phone: '09171234567' }}
            application={{ productName: computed.product.name, applicationNature: computed.inputs.application_nature }}
            computation={computed}
          />
          <StateOfAccountForm
            borrower={{ name: 'Juan Dela Cruz', email: 'juan@example.com', phone: '09171234567' }}
            computation={computed}
            totalPaid={computed.breakdown.monthly_amortization * 2}
          />
        </>
      ) : null}
    </div>
  )
}
