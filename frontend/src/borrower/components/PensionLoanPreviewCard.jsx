import { useEffect, useMemo, useState } from 'react'
import { laravelApiUrl } from '../../utils/lendingLaravelApi.js'
import { straightLineMonthlyTotal } from '../../utils/sssLoanCalculator.js'

function formatPeso(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function resolveMinRemaining(product, applicationNature = 'new', pensionType = 'SSS') {
  const rules = product?.rules || {}
  const natureKey = applicationNature === 'reloan' ? 'rl' : 'nw'
  const system = String(pensionType || 'SSS').toUpperCase() === 'GSIS' ? 'gsis' : 'sss'
  return Number(
    rules[`pension_retention_threshold_${natureKey}_${system}`]
      ?? rules[`pension_retention_threshold_${system}`]
      ?? rules.pension_retention_threshold
      ?? 1000,
  )
}

function pensionCapacitySummary({ monthlyPension, product, applicationNature = 'new', pensionType = 'SSS' }) {
  const pension = Number(monthlyPension) || 0
  if (pension <= 0 || !product) return null

  const minRemaining = resolveMinRemaining(product, applicationNature, pensionType)
  const maxDeduction = Math.max(0, pension - minRemaining)

  return {
    minimum_remaining_pension: minRemaining,
    maximum_deduction_allowed: maxDeduction,
    monthly_pension: pension,
    eligible: maxDeduction > 0,
  }
}

function localPensionEstimate({ monthlyPension, termMonths, product, applicationNature = 'new', pensionType = 'SSS' }) {
  const pension = Number(monthlyPension) || 0
  const term = Math.max(1, parseInt(termMonths, 10) || 1)
  if (pension <= 0 || !product) return null

  const cfg = product.calculator_config || {}
  const minRemaining = resolveMinRemaining(product, applicationNature, pensionType)
  const maxDeduction = Math.max(0, pension - minRemaining)
  const rate = Number(product.interest_rate) || 2.24
  const factor = 1 / term + rate / 100
  const capacity = factor > 0 ? maxDeduction / factor : 0
  const multiplierCap = pension * Number(cfg.pension_multiplier ?? 18.75)
  const caps = [capacity, multiplierCap, Number(cfg.max_principal) || Infinity, Number(product.max_amount) || Infinity].filter(
    Number.isFinite,
  )
  const principal = Math.max(0, Math.min(...caps))
  const monthly = straightLineMonthlyTotal(principal, rate, term)
  const monthlyPrincipal = principal / term
  const monthlyInterest = principal * (rate / 100)
  const remaining = pension - monthly

  return {
    estimated_loanable_amount: Math.floor(principal * 100) / 100,
    monthly_principal: monthlyPrincipal,
    monthly_interest: monthlyInterest,
    monthly_deduction: monthly,
    remaining_pension: remaining,
    minimum_remaining_pension: minRemaining,
    maximum_deduction_allowed: maxDeduction,
    eligible: remaining >= minRemaining && principal > 0,
  }
}

export default function PensionLoanPreviewCard({ formData, product, breakdown, mode = 'full' }) {
  const [serverPreview, setServerPreview] = useState(null)
  const [loading, setLoading] = useState(false)

  const monthlyPension = formData?.monthly_pension
  const termMonths = formData?.term_months
  const applicationNature = formData?.application_nature || 'new'
  const pensionType = formData?.pension_type || 'SSS'

  const capacityOnly = useMemo(
    () => pensionCapacitySummary({ monthlyPension, product, applicationNature, pensionType }),
    [monthlyPension, product, applicationNature, pensionType],
  )

  const localPreview = useMemo(
    () => localPensionEstimate({ monthlyPension, termMonths, product, applicationNature, pensionType }),
    [monthlyPension, termMonths, product, applicationNature, pensionType],
  )

  useEffect(() => {
    if (!product?.slug || !monthlyPension || !termMonths) {
      setServerPreview(null)
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(laravelApiUrl('/public/loan-products/calculate'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            slug: product.slug,
            monthly_pension: Number(monthlyPension),
            term_months: Number(termMonths),
            application_nature: applicationNature,
            pension_type: pensionType,
          }),
        })
        const data = await res.json()
        if (!cancelled && data?.ok) setServerPreview(data)
      } catch {
        if (!cancelled) setServerPreview(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 450)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [product?.slug, monthlyPension, termMonths, applicationNature, pensionType])

  const fromBreakdown = breakdown?.breakdown
  const hasTerm = Boolean(termMonths)
  const preview = hasTerm
    ? serverPreview
      || (fromBreakdown
        ? {
            estimated_loanable_amount: breakdown?.summary?.loan_amount ?? breakdown?.inputs?.loan_amount,
            monthly_principal_component: fromBreakdown.monthly_principal,
            monthly_interest_component: fromBreakdown.monthly_interest,
            monthly_deduction: fromBreakdown.monthly_amortization,
            remaining_pension: fromBreakdown.remaining_pension,
            minimum_remaining_pension: fromBreakdown.pension_retention_threshold,
            maximum_deduction_allowed: capacityOnly?.maximum_deduction_allowed,
            eligible: fromBreakdown.pension_compliance_ok,
          }
        : localPreview)
    : capacityOnly

  if (!monthlyPension) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-4 text-sm text-gray-600 dark:border-[#374151] dark:bg-[#0F172A]/40 dark:text-gray-400 md:col-span-2">
        Enter your monthly pension to see your pension capacity and estimated maximum loanable amount.
      </div>
    )
  }

  if (!hasTerm && mode !== 'capacity') {
    const eligible = capacityOnly?.eligible !== false && Number(capacityOnly?.maximum_deduction_allowed) > 0

    return (
      <div className="rounded-xl border border-sky-200/80 bg-sky-50/50 p-4 text-sm text-sky-950 dark:border-sky-800/40 dark:bg-sky-900/15 dark:text-sky-100 md:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Pension capacity preview</p>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              eligible
                ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100'
                : 'bg-amber-200 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100'
            }`}
          >
            {eligible ? 'Within rules' : 'Insufficient'}
          </span>
        </div>
        <p className="mt-1 text-xs opacity-80">
          Based on your monthly pension and the company minimum excess requirement. Choose a loan term on the next step for your full loan estimate.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Monthly pension</dt>
            <dd className="mt-0.5 font-medium">{formatPeso(monthlyPension)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Minimum excess required</dt>
            <dd className="mt-0.5 font-medium">{formatPeso(capacityOnly?.minimum_remaining_pension)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Maximum deduction allowed</dt>
            <dd className="mt-0.5 font-medium">{formatPeso(capacityOnly?.maximum_deduction_allowed)}</dd>
          </div>
        </dl>
      </div>
    )
  }

  const eligible = preview?.eligible !== false && Number(preview?.estimated_loanable_amount ?? preview?.maximum_deduction_allowed) > 0

  return (
    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 text-sm text-emerald-950 dark:border-emerald-800/40 dark:bg-emerald-900/15 dark:text-emerald-100 md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Pension loan estimate {loading ? '· updating…' : ''}</p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            eligible
              ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100'
              : 'bg-amber-200 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100'
          }`}
        >
          {eligible ? '✓ Eligible' : 'Not eligible'}
        </span>
      </div>
      <p className="mt-1 text-xs opacity-80">
        Auto-computed from your pension, term, interest rate, and minimum remaining pension buffer. Final amount is confirmed after staff evaluation.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Monthly pension</dt>
          <dd className="mt-0.5 font-medium">{formatPeso(monthlyPension)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Loan term</dt>
          <dd className="mt-0.5 font-medium">{termMonths} months</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Estimated loanable amount</dt>
          <dd className="mt-0.5 text-base font-semibold">{formatPeso(preview?.estimated_loanable_amount)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Monthly principal</dt>
          <dd className="mt-0.5 font-medium">{formatPeso(preview?.monthly_principal_component ?? preview?.monthly_principal)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Monthly interest</dt>
          <dd className="mt-0.5 font-medium">{formatPeso(preview?.monthly_interest_component ?? preview?.monthly_interest)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Monthly deduction</dt>
          <dd className="mt-0.5 font-medium">{formatPeso(preview?.monthly_deduction ?? preview?.monthly_amortization)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Remaining pension</dt>
          <dd className="mt-0.5 font-medium">{formatPeso(preview?.remaining_pension)}</dd>
        </div>
        {preview?.minimum_remaining_pension != null ? (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Minimum excess required</dt>
            <dd className="mt-0.5 font-medium">{formatPeso(preview.minimum_remaining_pension)}</dd>
          </div>
        ) : null}
        {preview?.maximum_deduction_allowed != null ? (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Maximum deduction allowed</dt>
            <dd className="mt-0.5 font-medium">{formatPeso(preview.maximum_deduction_allowed)}</dd>
          </div>
        ) : null}
      </dl>
      {!eligible && preview?.message ? <p className="mt-3 text-xs text-amber-800 dark:text-amber-200">{preview.message}</p> : null}
    </div>
  )
}
