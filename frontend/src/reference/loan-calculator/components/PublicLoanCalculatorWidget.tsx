import { useEffect, useMemo, useState } from 'react'
import { fetchPublicLoanProducts, quickComputeLoan } from '../api'
import type { ComputeLoanResult, LoanNature, LoanProductLite } from '../types'

export function PublicLoanCalculatorWidget() {
  const [products, setProducts] = useState<LoanProductLite[]>([])
  const [productId, setProductId] = useState<number | ''>('')
  const [loanAmount, setLoanAmount] = useState<number>(100000)
  const [termMonths, setTermMonths] = useState<number>(12)
  const [nature, setNature] = useState<LoanNature>('new')
  const [result, setResult] = useState<ComputeLoanResult | null>(null)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    fetchPublicLoanProducts().then(setProducts).catch(() => setProducts([]))
  }, [])

  const selected = useMemo(() => products.find((p) => p.id === productId) || null, [products, productId])

  const onCompute = async () => {
    if (!productId) return
    try {
      setError('')
      const data = await quickComputeLoan({
        product_id: productId,
        loan_amount: loanAmount,
        term_months: termMonths,
        application_nature: nature,
      })
      setResult(data)
    } catch (e) {
      setError((e as Error).message)
      setResult(null)
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-base font-semibold">Loan Calculator</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <select value={productId} onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : '')}>
          <option value="">Select product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input type="number" value={loanAmount} onChange={(e) => setLoanAmount(Number(e.target.value || 0))} />
        <input type="number" value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value || 1))} />
        <select value={nature} onChange={(e) => setNature(e.target.value as LoanNature)}>
          <option value="new">New Loan</option>
          <option value="reloan">Re-loan</option>
        </select>
      </div>
      <button type="button" onClick={onCompute} className="rounded bg-red-600 px-3 py-2 text-white">
        Compute
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {result ? (
        <div className="text-sm">
          <p>
            <strong>{selected?.name}</strong> @ {result.product.monthly_rate_percent_effective}% / month
          </p>
          <p>Monthly amortization: PHP {result.breakdown.monthly_amortization.toLocaleString()}</p>
          <p>Net proceeds: PHP {result.breakdown.net_proceeds.toLocaleString()}</p>
        </div>
      ) : null}
    </section>
  )
}
