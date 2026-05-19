import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { getLoanProducts } from '../../utils/loanProductsPublicApi.js'
import { laravelRequest } from '../../utils/lendingLaravelApi.js'
import { loanCalculatorAmountInputClass, loanCalculatorSelectClass } from '../loan/loanCalculatorTermInputClass.js'

function peso(v) {
  return Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function isTravelProduct(product) {
  const cfg = product?.calculator_config || {}
  return product?.slug === 'travel-assistance-loan' || cfg?.fee_profile === 'travel'
}

function isPensionProduct(product) {
  return product?.slug === 'sss-pension-loan'
}

export default function HomeLoanCalculator() {
  const reduceMotion = useReducedMotion()
  const [products, setProducts] = useState([])
  const [productId, setProductId] = useState('')
  const [loanAmount, setLoanAmount] = useState('100000')
  const [termMonths, setTermMonths] = useState('12')
  const [nature, setNature] = useState('new')
  const [age, setAge] = useState('')
  const [monthlyPension, setMonthlyPension] = useState('')
  const [pensionType, setPensionType] = useState('SSS')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await getLoanProducts()
        if (cancelled) return
        setProducts(Array.isArray(rows) ? rows : [])
        if (rows?.[0]?.id) setProductId(String(rows[0].id))
      } catch {
        if (!cancelled) setProducts([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selected = useMemo(() => products.find((p) => String(p.id) === String(productId)) || null, [productId, products])
  const travelMode = isTravelProduct(selected)
  const pensionMode = isPensionProduct(selected)
  const maxTerm = selected?.max_term || 360
  const effectiveTerm = travelMode ? 1 : Number(termMonths || 0)

  const termMonthOptions = useMemo(() => {
    const max = Math.max(1, Math.floor(Number(maxTerm) || 1))
    return Array.from({ length: max }, (_, i) => i + 1)
  }, [maxTerm])

  const compute = async () => {
    if (!productId) return
    setLoading(true)
    setError('')
    try {
      const { res } = await laravelRequest('/public/loan-computations/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          product_id: Number(productId),
          loan_amount: Number(loanAmount || 0),
          term_months: effectiveTerm,
          application_nature: nature,
          ...(pensionMode && monthlyPension ? { monthly_pension: Number(monthlyPension || 0) } : {}),
          ...(pensionMode && pensionType ? { pension_type: pensionType } : {}),
          ...(pensionMode && age ? { age: Number(age || 0) } : {}),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.message || `Calculation failed (HTTP ${res.status})`)
      setData(body?.data || null)
    } catch (e) {
      setError(e.message || 'Unable to compute right now.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (productId) compute()
  }, [productId])

  useEffect(() => {
    if (!selected) return
    if (travelMode) {
      setTermMonths('1')
      if (!loanAmount || Number(loanAmount) <= 0) setLoanAmount('100000')
      return
    }
    if (Number(termMonths || 0) < 1) setTermMonths('1')
    if (Number(termMonths || 0) > maxTerm) setTermMonths(String(maxTerm))
  }, [selected, travelMode, maxTerm, loanAmount, termMonths])

  return (
    <motion.section
      id="calculator"
      className="landing-panel h-full"
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.45 }}
    >
      <h3 className="text-lg font-semibold text-brand-text">Loan Calculator</h3>
      <p className="mt-3 text-sm leading-relaxed text-brand-text/70">
        Estimate indicative monthly amortization. Final terms and deductions are confirmed during application.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <select
          className={loanCalculatorSelectClass}
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          aria-label="Loan type"
        >
          <option value="">Select loan product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          className={loanCalculatorAmountInputClass}
          type="number"
          min="1000"
          max={travelMode ? 2000000 : undefined}
          value={loanAmount}
          onChange={(e) => setLoanAmount(e.target.value)}
          placeholder={travelMode ? 'Loan amount (max 2,000,000)' : 'Loan amount'}
          aria-label="Loan amount"
        />
        {travelMode ? (
          <select
            className={`${loanCalculatorSelectClass} cursor-not-allowed opacity-80`}
            disabled
            value="1"
            aria-label="Loan term in months"
          >
            <option value="1">1</option>
          </select>
        ) : (
          <select
            className={loanCalculatorSelectClass}
            value={termMonths}
            onChange={(e) => setTermMonths(e.target.value)}
            aria-label="Loan term in months"
          >
            {termMonthOptions.map((m) => (
              <option key={m} value={String(m)}>
                {m}
              </option>
            ))}
          </select>
        )}
        <select
          className={loanCalculatorSelectClass}
          value={nature}
          onChange={(e) => setNature(e.target.value)}
          aria-label="New loan or re-loan"
        >
          <option value="new">New loan</option>
          <option value="reloan">Re-loan</option>
        </select>
        {pensionMode ? (
          <>
            <input
              className={loanCalculatorAmountInputClass}
              type="number"
              min="0"
              value={monthlyPension}
              onChange={(e) => setMonthlyPension(e.target.value)}
              placeholder="Monthly pension"
            />
            <select
              className={loanCalculatorSelectClass}
              value={pensionType}
              onChange={(e) => setPensionType(e.target.value)}
              aria-label="Pension type"
            >
              <option value="SSS">SSS</option>
              <option value="GSIS">GSIS</option>
            </select>
            <input
              className={loanCalculatorAmountInputClass}
              type="number"
              min="18"
              max="100"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Borrower age"
            />
          </>
        ) : null}
      </div>

      <button
        onClick={compute}
        disabled={loading || !productId}
        className="landing-btn-primary mt-8 gap-2 disabled:opacity-60"
      >
        {loading ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Calculating...
          </>
        ) : (
          'Recalculate'
        )}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {selected ? (
        <p className="mt-2 text-xs text-brand-text/60">
          {travelMode
            ? 'Travel Assistance: monthly renewal (1 month); opening account fee is shouldered separately and misc fees are not deducted from proceeds.'
            : `Max term: ${maxTerm} month(s).`}
        </p>
      ) : null}

      {data?.breakdown?.monthly_amortization != null ? (
        <dl className="mt-8 rounded-xl border border-red-100/45 bg-white p-6 text-sm sm:p-8">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-brand-text/70">Monthly amortization</dt>
            <dd className="text-xl font-semibold tabular-nums text-brand-text">
              PHP {peso(data.breakdown.monthly_amortization)}
            </dd>
          </div>
        </dl>
      ) : null}
    </motion.section>
  )
}
