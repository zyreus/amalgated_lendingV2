import { useState } from 'react'
import { quickComputeLoan } from '../api'
import type { ComputeLoanResult, LoanNature } from '../types'

interface Props {
  productId: number
}

export function BorrowerLoanApplicationForm({ productId }: Props) {
  const [loanAmount, setLoanAmount] = useState(100000)
  const [termMonths, setTermMonths] = useState(12)
  const [applicationNature, setApplicationNature] = useState<LoanNature>('new')
  const [preview, setPreview] = useState<ComputeLoanResult | null>(null)
  const [error, setError] = useState('')

  const previewCompute = async () => {
    try {
      setError('')
      const data = await quickComputeLoan({
        product_id: productId,
        loan_amount: loanAmount,
        term_months: termMonths,
        application_nature: applicationNature,
      })
      setPreview(data)
    } catch (e) {
      setError((e as Error).message)
      setPreview(null)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <h3 className="text-base font-semibold">Borrower Loan Application (Computation Preview)</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <input type="number" value={loanAmount} onChange={(e) => setLoanAmount(Number(e.target.value || 0))} />
        <input type="number" value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value || 1))} />
        <select value={applicationNature} onChange={(e) => setApplicationNature(e.target.value as LoanNature)}>
          <option value="new">New</option>
          <option value="reloan">Re-loan</option>
        </select>
      </div>
      <button type="button" className="rounded bg-black px-3 py-2 text-white" onClick={previewCompute}>
        Compute Breakdown
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {preview ? <pre className="overflow-auto rounded bg-gray-100 p-3 text-xs">{JSON.stringify(preview.breakdown, null, 2)}</pre> : null}
    </div>
  )
}
