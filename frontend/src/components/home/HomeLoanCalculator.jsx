import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { getLoanProducts } from '../../utils/loanProductsPublicApi.js'
import { laravelRequest } from '../../utils/lendingLaravelApi.js'

function peso(v) {
  return Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function HomeLoanCalculator() {
  const reduceMotion = useReducedMotion()
  const [products, setProducts] = useState([])
  const [productId, setProductId] = useState('')
  const [loanAmount, setLoanAmount] = useState('100000')
  const [termMonths, setTermMonths] = useState('12')
  const [nature, setNature] = useState('new')
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
          term_months: Number(termMonths || 0),
          application_nature: nature,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  return (
    <motion.section
      id="calculator"
      className="surface-card-light p-5 sm:p-6"
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.45 }}
    >
      <h3 className="text-lg font-semibold text-brand-text">Loan Calculator</h3>
      <p className="mt-1 text-sm text-brand-text/70">Estimate monthly amortization and net proceeds before you apply.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <select className="rounded-xl border border-black/15 px-4 py-3 text-sm" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Select loan product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input className="rounded-xl border border-black/15 px-4 py-3 text-sm" type="number" min="1000" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} placeholder="Loan amount" />
        <input className="rounded-xl border border-black/15 px-4 py-3 text-sm" type="number" min="1" max={selected?.max_term || 360} value={termMonths} onChange={(e) => setTermMonths(e.target.value)} placeholder="Term in months" />
        <select className="rounded-xl border border-black/15 px-4 py-3 text-sm" value={nature} onChange={(e) => setNature(e.target.value)}>
          <option value="new">New loan</option>
          <option value="reloan">Re-loan</option>
        </select>
      </div>

      <button
        onClick={compute}
        disabled={loading || !productId}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-white transition disabled:opacity-60"
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

      {data?.breakdown ? (
        <dl className="mt-5 grid gap-2 rounded-xl border border-black/10 bg-white p-4 text-sm">
          <div className="flex justify-between"><dt>Monthly amortization</dt><dd className="font-semibold">PHP {peso(data.breakdown.monthly_amortization)}</dd></div>
          <div className="flex justify-between"><dt>Total miscellaneous fees</dt><dd>PHP {peso(data.breakdown.total_miscellaneous_fees)}</dd></div>
          <div className="flex justify-between"><dt>Net proceeds</dt><dd className="font-semibold text-brand-primary">PHP {peso(data.breakdown.net_proceeds)}</dd></div>
          <div className="flex justify-between"><dt>Interest rate</dt><dd>{Number(data.product?.monthly_rate_percent_effective || 0).toFixed(2)}% per month</dd></div>
        </dl>
      ) : null}
    </motion.section>
  )
}
