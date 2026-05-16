import { useMemo, useState } from 'react'
import PortalCard from '../../components/portal/PortalCard.jsx'
import { BorrowerPageHeader } from '../../components/portal/BorrowerPageHeader.jsx'

function peso(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(v)
  } catch {
    return `₱${Math.round(v).toLocaleString()}`
  }
}

/** Monthly payment (fixed rate, monthly compounding approximation). */
function monthlyPayment(principal, annualRatePct, months) {
  const P = Number(principal)
  const annual = Number(annualRatePct) / 100
  const n = Math.max(1, Math.floor(Number(months)))
  if (!Number.isFinite(P) || P <= 0) return 0
  if (!Number.isFinite(annual) || annual <= 0) return P / n
  const r = annual / 12
  const pow = (1 + r) ** n
  return (P * r * pow) / (pow - 1)
}

export default function BorrowerLoanToolsPage() {
  const [principal, setPrincipal] = useState('150000')
  const [apr, setApr] = useState('14')
  const [months, setMonths] = useState('24')

  const pay = useMemo(() => monthlyPayment(Number(principal.replace(/,/g, '')), Number(apr), Number(months)), [principal, apr, months])
  const total = pay * (Number(months) || 0)

  return (
    <div className="space-y-8">
      <BorrowerPageHeader
        eyebrow="Tools"
        title="Loan payoff & payment estimator"
        description="Quick math for planning — not a binding offer. Your contract APR, fees, and rounding may differ."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <PortalCard title="Inputs">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Principal (PHP)</label>
              <input
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">APR %</label>
              <input
                value={apr}
                onChange={(e) => setApr(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Term (months)</label>
              <input
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
              />
            </div>
          </div>
        </PortalCard>

        <PortalCard title="Estimate">
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary">Monthly payment</p>
              <p className="heading-display mt-1 text-3xl font-bold text-brand-text dark:text-white">{peso(pay)}</p>
            </div>
            <div className="rounded-xl bg-brand-background-alt/90 p-4 dark:bg-[#0F172A]/80">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total repaid (excl. fees)</p>
              <p className="mt-1 text-xl font-semibold text-brand-text dark:text-white">{peso(total)}</p>
            </div>
            <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              Paying extra principal each month reduces interest. Ask support for an official payoff quote before sending a final payment.
            </p>
          </div>
        </PortalCard>
      </div>
    </div>
  )
}
