import { useMemo, useState } from 'react'
import { LoanCalculatorComponent } from './LoanCalculatorComponent'
import { formatPeso } from '../utils'
import type { ComputeLoanInput, ComputeLoanResult, LoanApplicationPayload, LoanNature } from '../types'

interface Props {
  mode?: 'admin' | 'borrower'
  onSubmit?: (payload: LoanApplicationPayload, computation: ComputeLoanResult | null) => Promise<void> | void
}

export function LoanApplicationForm({ mode = 'borrower', onSubmit }: Props) {
  const [borrowerName, setBorrowerName] = useState('')
  const [borrowerEmail, setBorrowerEmail] = useState('')
  const [borrowerPhone, setBorrowerPhone] = useState('')
  const [coMakerName, setCoMakerName] = useState('')
  const [coMakerEmail, setCoMakerEmail] = useState('')
  const [coMakerPhone, setCoMakerPhone] = useState('')
  const [loanType, setLoanType] = useState('general')
  const [lastInput, setLastInput] = useState<ComputeLoanInput | null>(null)
  const [lastComputation, setLastComputation] = useState<ComputeLoanResult | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const previewSummary = useMemo(() => {
    if (!lastComputation) return null
    return {
      monthly: formatPeso(lastComputation.breakdown.monthly_amortization),
      net: formatPeso(lastComputation.breakdown.net_proceeds),
    }
  }, [lastComputation])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!lastInput) return

    const payload: LoanApplicationPayload = {
      loan_product_id: Number(lastInput.product_id),
      loan_amount: lastInput.loan_amount,
      term_months: lastInput.term_months,
      loan_type: loanType,
      application_nature: lastInput.application_nature as LoanNature,
      co_maker_name: coMakerName || undefined,
      co_maker_email: coMakerEmail || undefined,
      co_maker_phone: coMakerPhone || undefined,
      age: lastInput.age,
      monthly_pension: lastInput.monthly_pension,
      form_data: {
        borrower_name: borrowerName,
        borrower_email: borrowerEmail,
        borrower_phone: borrowerPhone,
      },
    }

    setSubmitting(true)
    try {
      await onSubmit?.(payload, lastComputation)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          {mode === 'admin' ? 'Admin Loan Application Form' : 'Borrower Loan Application Form'}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Complete borrower details, review the calculator, then submit the application with the computed breakdown.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <input
          value={borrowerName}
          onChange={(e) => setBorrowerName(e.target.value)}
          placeholder="Borrower name"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          value={borrowerEmail}
          onChange={(e) => setBorrowerEmail(e.target.value)}
          placeholder="Borrower email"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          value={borrowerPhone}
          onChange={(e) => setBorrowerPhone(e.target.value)}
          placeholder="Borrower phone"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          value={loanType}
          onChange={(e) => setLoanType(e.target.value)}
          placeholder="Loan type label"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <input
          value={coMakerName}
          onChange={(e) => setCoMakerName(e.target.value)}
          placeholder="Co-maker name"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          value={coMakerEmail}
          onChange={(e) => setCoMakerEmail(e.target.value)}
          placeholder="Co-maker email"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          value={coMakerPhone}
          onChange={(e) => setCoMakerPhone(e.target.value)}
          placeholder="Co-maker phone"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <LoanCalculatorComponent
        variant={mode}
        onComputed={(result, input) => {
          setLastComputation(result)
          setLastInput(input)
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="text-sm text-gray-700">
          <p>
            Estimated Monthly Amortization:{' '}
            <span className="font-semibold text-gray-900">{previewSummary?.monthly ?? '—'}</span>
          </p>
          <p>
            Net Proceeds: <span className="font-semibold text-gray-900">{previewSummary?.net ?? '—'}</span>
          </p>
        </div>
        <button
          type="submit"
          disabled={submitting || !lastInput}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Submitting...' : 'Submit Application'}
        </button>
      </div>
    </form>
  )
}
