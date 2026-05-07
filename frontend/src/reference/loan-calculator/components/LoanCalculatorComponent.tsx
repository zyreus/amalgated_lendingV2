import { useEffect, useMemo, useState } from 'react'
import { useLoanProductsQuery, useQuickComputeMutation } from '../hooks'
import { formatPercent, formatPeso } from '../utils'
import type { ComputeLoanInput, ComputeLoanResult, LoanNature, LoanProductLite } from '../types'

type Variant = 'admin' | 'borrower' | 'public'

interface Props {
  variant?: Variant
  initialProductId?: number | null
  initialAmount?: number
  initialTermMonths?: number
  initialNature?: LoanNature
  initialAge?: number | null
  initialMonthlyPension?: number | null
  onComputed?: (result: ComputeLoanResult, values: ComputeLoanInput) => void
}

function BreakdownRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`grid grid-cols-2 gap-3 border-b border-dashed border-gray-200 py-2 text-sm ${strong ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
}

export function LoanCalculatorComponent({
  variant = 'public',
  initialProductId = null,
  initialAmount = 100000,
  initialTermMonths = 12,
  initialNature = 'new',
  initialAge = null,
  initialMonthlyPension = null,
  onComputed,
}: Props) {
  const { data: products = [], isLoading: productsLoading } = useLoanProductsQuery()
  const computeMutation = useQuickComputeMutation()

  const [productId, setProductId] = useState<number | ''>(initialProductId ?? '')
  const [loanAmount, setLoanAmount] = useState<number>(initialAmount)
  const [termMonths, setTermMonths] = useState<number>(initialTermMonths)
  const [nature, setNature] = useState<LoanNature>(initialNature)
  const [age, setAge] = useState<number | ''>(initialAge ?? '')
  const [monthlyPension, setMonthlyPension] = useState<number | ''>(initialMonthlyPension ?? '')

  const selectedProduct = useMemo(
    () => products.find((row) => row.id === productId) || null,
    [productId, products]
  )

  useEffect(() => {
    if (selectedProduct?.max_term && termMonths > selectedProduct.max_term) {
      setTermMonths(selectedProduct.max_term)
    }
  }, [selectedProduct?.max_term, termMonths])

  useEffect(() => {
    if (!productId) return
    const payload: ComputeLoanInput = {
      product_id: Number(productId),
      loan_amount: Number(loanAmount || 0),
      term_months: Number(termMonths || 0),
      application_nature: nature,
      age: age === '' ? undefined : Number(age),
      monthly_pension: monthlyPension === '' ? undefined : Number(monthlyPension),
    }

    if (payload.loan_amount <= 0 || payload.term_months <= 0) return

    const timer = window.setTimeout(() => {
      computeMutation.mutate(payload, {
        onSuccess: (result) => onComputed?.(result, payload),
      })
    }, 220)

    return () => window.clearTimeout(timer)
  }, [age, computeMutation, loanAmount, monthlyPension, nature, onComputed, productId, termMonths])

  const result = computeMutation.data ?? null
  const variantAccent =
    variant === 'admin'
      ? 'border-blue-200 bg-blue-50/40'
      : variant === 'borrower'
        ? 'border-emerald-200 bg-emerald-50/40'
        : 'border-red-200 bg-red-50/40'

  return (
    <section className={`rounded-2xl border bg-white p-5 shadow-sm ${variantAccent}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Loan Calculator</h3>
          <p className="mt-1 text-sm text-gray-600">
            Real-time product-aware computation for admin, borrower, and public loan inquiry screens.
          </p>
        </div>
        {selectedProduct ? (
          <div className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
            {selectedProduct.code || selectedProduct.slug} · {formatPercent(selectedProduct.interest_rate, 2)}{' '}
            {selectedProduct.rate_type}
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Loan Product</span>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select product</option>
              {products.map((product: LoanProductLite) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Application Nature</span>
            <select
              value={nature}
              onChange={(e) => setNature(e.target.value as LoanNature)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="new">New Loan</option>
              <option value="reloan">Re-loan</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Loan Amount</span>
            <input
              type="number"
              min={1000}
              value={loanAmount}
              onChange={(e) => setLoanAmount(Number(e.target.value || 0))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Term (Months)</span>
            <input
              type="number"
              min={1}
              max={selectedProduct?.max_term ?? 360}
              value={termMonths}
              onChange={(e) => setTermMonths(Number(e.target.value || 0))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          {selectedProduct?.slug === 'sss-pension-loan' ? (
            <>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Monthly Pension</span>
                <input
                  type="number"
                  min={0}
                  value={monthlyPension}
                  onChange={(e) => setMonthlyPension(e.target.value ? Number(e.target.value) : '')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Age</span>
                <input
                  type="number"
                  min={18}
                  max={100}
                  value={age}
                  onChange={(e) => setAge(e.target.value ? Number(e.target.value) : '')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </>
          ) : null}

          <div className="sm:col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            {productsLoading ? 'Loading loan products...' : null}
            {!productsLoading && selectedProduct?.max_amount ? `Maximum amount: ${formatPeso(selectedProduct.max_amount)}.` : null}{' '}
            {!productsLoading && selectedProduct?.max_term ? `Maximum term: ${selectedProduct.max_term} months.` : null}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Computation Breakdown</p>
          {computeMutation.isPending ? <p className="mt-4 text-sm text-gray-500">Computing...</p> : null}
          {computeMutation.isError ? (
            <p className="mt-4 text-sm text-red-600">{(computeMutation.error as Error)?.message || 'Unable to compute.'}</p>
          ) : null}
          {result ? (
            <div className="mt-4">
              <BreakdownRow label="Loan Amount" value={formatPeso(result.inputs.loan_amount)} strong />
              <BreakdownRow label="Service Charge" value={formatPeso(result.breakdown.service_charge)} />
              <BreakdownRow label="Insurance" value={formatPeso(result.breakdown.insurance)} />
              <BreakdownRow label="Doc. Stamp" value={formatPeso(result.breakdown.documentary_stamp)} />
              <BreakdownRow label="Notarial Fee" value={formatPeso(result.breakdown.notarial_fee)} />
              <BreakdownRow label="Mortgage Fee" value={formatPeso(result.breakdown.mortgage_fee)} />
              <BreakdownRow label="Monthly Principal" value={formatPeso(result.breakdown.monthly_principal)} />
              <BreakdownRow label="Monthly Interest" value={formatPeso(result.breakdown.monthly_interest)} />
              <BreakdownRow label="Monthly Amortization" value={formatPeso(result.breakdown.monthly_amortization)} strong />
              <BreakdownRow label="Total Misc. Fees" value={formatPeso(result.breakdown.total_miscellaneous_fees)} />
              <BreakdownRow label="Net Proceeds" value={formatPeso(result.breakdown.net_proceeds)} strong />
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">Enter loan inputs to see the exact breakdown.</p>
          )}
        </div>
      </div>

      {result?.notes?.length ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          {result.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      ) : null}
    </section>
  )
}
