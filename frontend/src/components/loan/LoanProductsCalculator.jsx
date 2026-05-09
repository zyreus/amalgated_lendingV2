import { useEffect, useMemo, useState } from 'react'
import { postLoanCalculator } from '../../utils/loanProductsPublicApi.js'
import {
  estimateSssPrincipal,
  monthlyAmortization,
  straightLineMonthlyTotal,
  travelRenewalMonthlyInterest,
} from '../../utils/sssLoanCalculator.js'

function isPensionProduct(product) {
  const c = product?.calculator_config
  return c != null && typeof c === 'object' && Object.prototype.hasOwnProperty.call(c, 'pension_multiplier')
}

function isTravelProduct(product) {
  const c = product?.calculator_config
  return product?.slug === 'travel-assistance-loan' || c?.fee_profile === 'travel'
}

function isSalaryProduct(product) {
  return product?.slug === 'salary-loan'
}

function maxTermMonths(product) {
  const m = product?.max_term
  if (m != null && Number(m) > 0) return Number(m)
  return 60
}

export default function LoanProductsCalculator({ products = [] }) {
  const [selectedSlug, setSelectedSlug] = useState('')
  const product = products.find((p) => p.slug === selectedSlug) || products[0]

  const pensionMode = product ? isPensionProduct(product) : false
  const travelMode = product ? isTravelProduct(product) : false
  const salaryMode = product ? isSalaryProduct(product) : false
  const termMax = product ? maxTermMonths(product) : 60

  const [pension, setPension] = useState('4000')
  const [pensionType, setPensionType] = useState('SSS')
  const [pensionNature, setPensionNature] = useState('new')
  const [principal, setPrincipal] = useState('500000')
  const [term, setTerm] = useState('36')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [server, setServer] = useState(null)

  useEffect(() => {
    if (!products.length) return
    if (!selectedSlug || !products.some((p) => p.slug === selectedSlug)) {
      setSelectedSlug(products[0].slug)
    }
  }, [products, selectedSlug])

  useEffect(() => {
    if (!product) return
    if (travelMode) {
      setPrincipal('1000000')
      setTerm('1')
    } else if (pensionMode) {
      setPension(
        product.sample_monthly_pension != null ? String(product.sample_monthly_pension) : '4000',
      )
      setPensionType('SSS')
      setPensionNature('new')
      setTerm(String(Math.min(termMax, 36)))
    } else {
      setPrincipal('5000000')
      setTerm(String(Math.min(termMax, 36)))
    }
    setServer(null)
    setErr('')
  }, [product?.slug, pensionMode, travelMode, termMax])

  const cfg = product?.calculator_config || {}

  const localEst = useMemo(() => {
    if (!product) return { principal: 0, monthly: 0 }
    const t = travelMode ? 1 : Math.min(termMax, Math.max(1, parseInt(term, 10) || 1))
    const rate = Number(product.interest_rate || 0)
    const cap = Number(cfg.max_principal) > 0 ? Number(cfg.max_principal) : travelMode ? 2_000_000 : Infinity

    if (travelMode) {
      const raw = Number(principal) || 0
      const pr = Math.min(raw, cap)
      const mo = travelRenewalMonthlyInterest(pr, rate)
      return { principal: pr, monthly: mo, term: 1 }
    }
    if (pensionMode) {
      const p = Number(pension) || 0
      const pr = Math.min(estimateSssPrincipal(p, cfg), cap)
      const mo =
        cfg.computation_style === 'straight_line'
          ? straightLineMonthlyTotal(pr, rate, t)
          : monthlyAmortization(pr, rate, t)
      return { principal: pr, monthly: mo, term: t }
    }
    const raw = Number(principal) || 0
    const pr = Math.min(raw, cap)
    const mo =
      cfg.computation_style === 'straight_line'
        ? straightLineMonthlyTotal(pr, rate, t)
        : monthlyAmortization(pr, rate, t)
    return { principal: pr, monthly: mo, term: t }
  }, [product, pensionMode, travelMode, pension, principal, term, cfg, termMax])

  const runServer = async () => {
    if (!product?.slug) return
    setLoading(true)
    setErr('')
    setServer(null)
    const t = travelMode ? 1 : Math.min(termMax, Math.max(1, parseInt(term, 10) || 1))
    try {
      const payload = {
        slug: product.slug,
        term_months: t,
        include_fees: salaryMode || pensionMode,
      }
      if (pensionMode) {
        payload.monthly_pension = Number(pension)
        payload.pension_type = pensionType
        payload.application_nature = pensionNature
      } else {
        payload.principal = Number(principal)
      }
      const res = await postLoanCalculator(payload)
      setServer(res)
    } catch (e) {
      setErr(e.message || 'Could not calculate.')
    } finally {
      setLoading(false)
    }
  }

  const amort = server?.monthly_amortization ?? localEst.monthly
  const salarySemiMonthly = Number(server?.fee_breakdown?.semi_monthly_payment || 0)
  const salaryNetProceeds = Number(server?.fee_breakdown?.net_proceeds_after_misc || 0)
  const salaryTotalDeductions = Number(server?.fee_breakdown?.total_deductions || 0)
  const pensionPrincipal = Number(server?.fee_breakdown?.monthly_principal || 0)
  const pensionInterest = Number(server?.fee_breakdown?.monthly_interest_on_full_principal || 0)
  const pensionSemiMonthly = Number(server?.fee_breakdown?.semi_monthly_payment || 0)
  const pensionNetProceeds = Number(server?.fee_breakdown?.net_proceeds_after_misc || 0)
  const pensionRemaining = Number(server?.fee_breakdown?.remaining_pension || 0)
  const pensionThreshold = Number(server?.fee_breakdown?.pension_retention_threshold || 0)
  const pensionCompliant = Boolean(server?.fee_breakdown?.pension_compliance_ok)

  if (!products.length || !product) {
    return null
  }

  const helpText = travelMode
    ? `Maximum loan ₱2,000,000. Monthly renewal (1 month). Figures are illustrative; fees are typically one-time (not deducted from loan).`
    : pensionMode
      ? `Enter your monthly pension and term (max ${termMax} months). Straight-line style per policy (principal ÷ term + monthly interest on full principal).`
      : cfg.computation_style === 'straight_line'
        ? `Straight-line amortization: monthly principal = loan ÷ term; monthly interest = loan × monthly rate. Max term ${termMax} months.`
        : `Enter loan amount and term (max ${termMax} months). Illustrative figures — final terms may vary.`

  return (
    <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white p-5 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-[#0f172a] sm:p-8">
      <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
        {pensionMode ? 'SSS / GSIS loan calculator' : 'Loan amortization calculator'}
      </h3>
      <p className="mt-1 text-sm font-medium text-emerald-800 dark:text-emerald-200/90">{product.name}</p>
      <p className="mt-1 text-sm text-emerald-800/90 dark:text-emerald-200/80">{helpText}</p>

      <div className="mt-6">
        <label htmlFor="loan-calc-product" className="text-xs font-medium text-emerald-900/80 dark:text-emerald-200/90">
          Loan type
        </label>
        <select
          id="loan-calc-product"
          value={selectedSlug || products[0]?.slug || ''}
          onChange={(e) => setSelectedSlug(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-emerald-800 dark:bg-slate-900 dark:text-white"
        >
          {products.map((p) => (
            <option key={p.id} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {pensionMode ? (
          <>
            <div>
              <label className="text-xs font-medium text-emerald-900/80 dark:text-emerald-200/90" htmlFor="pen-input">
                Monthly pension (PHP)
              </label>
              <input
                id="pen-input"
                inputMode="decimal"
                value={pension}
                onChange={(e) => setPension(e.target.value)}
                className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-emerald-500/20 focus:ring-2 dark:border-emerald-800 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-emerald-900/80 dark:text-emerald-200/90" htmlFor="pension-type">
                Pension type
              </label>
              <select
                id="pension-type"
                value={pensionType}
                onChange={(e) => setPensionType(e.target.value)}
                className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-emerald-800 dark:bg-slate-900 dark:text-white"
              >
                <option value="SSS">SSS</option>
                <option value="GSIS">GSIS</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-emerald-900/80 dark:text-emerald-200/90" htmlFor="pension-nature">
                Charge profile
              </label>
              <select
                id="pension-nature"
                value={pensionNature}
                onChange={(e) => setPensionNature(e.target.value)}
                className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-emerald-800 dark:bg-slate-900 dark:text-white"
              >
                <option value="new">NW (new loan)</option>
                <option value="reloan">RL (reloan)</option>
              </select>
            </div>
          </>
        ) : (
          <div>
            <label className="text-xs font-medium text-emerald-900/80 dark:text-emerald-200/90" htmlFor="principal-input">
              Loan amount (PHP){travelMode ? ' · max 2,000,000' : ''}
            </label>
            <input
              id="principal-input"
              inputMode="decimal"
              max={travelMode ? 2000000 : undefined}
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-emerald-800 dark:bg-slate-900 dark:text-white"
            />
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-emerald-900/80 dark:text-emerald-200/90" htmlFor="term-input">
            Term (months)
          </label>
          {travelMode ? (
            <input
              id="term-input"
              type="text"
              readOnly
              value="1 (monthly renewal)"
              className="mt-1 w-full cursor-not-allowed rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-slate-700 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-100"
            />
          ) : (
            <input
              id="term-input"
              type="number"
              min={1}
              max={termMax}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-emerald-800 dark:bg-slate-900 dark:text-white"
            />
          )}
        </div>
      </div>
      {err ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {err}
        </p>
      ) : null}
      <button
        type="button"
        onClick={runServer}
        disabled={loading || !product?.slug}
        className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
      >
        {loading ? 'Calculating…' : 'Calculate (confirm with server)'}
      </button>
      <dl className="mt-8 border-t border-emerald-200/60 pt-6 dark:border-emerald-800/50">
        <div className="rounded-xl bg-white/80 p-5 dark:bg-slate-900/60">
          <dt className="text-xs font-medium uppercase tracking-wide text-emerald-800/70 dark:text-emerald-300/80">
            {travelMode ? 'Monthly payment (renewal)' : 'Monthly amortization'}
          </dt>
          <dd className="mt-2 text-3xl font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
            PHP{' '}
            {Number(amort || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </dd>
        </div>
        {salaryMode && server ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/80 p-4 dark:bg-slate-900/60">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-emerald-800/70 dark:text-emerald-300/80">
                Semi-monthly
              </dt>
              <dd className="mt-1 text-lg font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
                PHP {salarySemiMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </dd>
            </div>
            <div className="rounded-xl bg-white/80 p-4 dark:bg-slate-900/60">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-emerald-800/70 dark:text-emerald-300/80">
                Total deductions
              </dt>
              <dd className="mt-1 text-lg font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
                PHP {salaryTotalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </dd>
            </div>
            <div className="rounded-xl bg-white/80 p-4 dark:bg-slate-900/60">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-emerald-800/70 dark:text-emerald-300/80">
                Net proceeds
              </dt>
              <dd className="mt-1 text-lg font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
                PHP {salaryNetProceeds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </dd>
            </div>
          </div>
        ) : null}
        {pensionMode && server ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/80 p-4 dark:bg-slate-900/60">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-emerald-800/70 dark:text-emerald-300/80">Monthly principal</dt>
              <dd className="mt-1 text-base font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
                PHP {pensionPrincipal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </dd>
            </div>
            <div className="rounded-xl bg-white/80 p-4 dark:bg-slate-900/60">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-emerald-800/70 dark:text-emerald-300/80">Monthly interest</dt>
              <dd className="mt-1 text-base font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
                PHP {pensionInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </dd>
            </div>
            <div className="rounded-xl bg-white/80 p-4 dark:bg-slate-900/60">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-emerald-800/70 dark:text-emerald-300/80">Semi-monthly</dt>
              <dd className="mt-1 text-base font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
                PHP {pensionSemiMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </dd>
            </div>
            <div className="rounded-xl bg-white/80 p-4 dark:bg-slate-900/60">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-emerald-800/70 dark:text-emerald-300/80">Net proceeds</dt>
              <dd className="mt-1 text-base font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
                PHP {pensionNetProceeds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </dd>
            </div>
            <div className="rounded-xl bg-white/80 p-4 dark:bg-slate-900/60 sm:col-span-2">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-emerald-800/70 dark:text-emerald-300/80">Remaining pension</dt>
              <dd className="mt-1 text-base font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
                PHP {pensionRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (minimum {pensionThreshold.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
              </dd>
              <p className={`mt-1 text-xs ${pensionCompliant ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                {pensionCompliant ? 'Pension retention policy: compliant' : 'Pension retention policy: not compliant'}
              </p>
            </div>
          </div>
        ) : null}
      </dl>
    </div>
  )
}
