import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { admin } from '../components/AdminUi.jsx'

const BUCKET_STYLES = {
  current_0_29: 'from-emerald-500/90 to-emerald-600',
  early_30_59: 'from-amber-500/90 to-amber-600',
  serious_60_plus: 'from-[#E63946] to-red-700',
  legal_recovery: 'from-slate-700 to-slate-900',
}

const DEFAULT_BUCKETS = [
  { id: 'current_0_29', name: 'Current (0–29 DPD)', count: 0, color: BUCKET_STYLES.current_0_29 },
  { id: 'early_30_59', name: 'Early delinquency (30–59)', count: 0, color: BUCKET_STYLES.early_30_59 },
  { id: 'serious_60_plus', name: 'Serious (60+)', count: 0, color: BUCKET_STYLES.serious_60_plus },
  { id: 'legal_recovery', name: 'Legal / recovery', count: 0, color: BUCKET_STYLES.legal_recovery },
]

function bucketHref(id) {
  if (id === 'early_30_59') return '/admin/payments?installment_dpd_min=30&installment_dpd_max=59'
  if (id === 'serious_60_plus') return '/admin/payments?installment_dpd_min=60'
  if (id === 'legal_recovery') return '/admin/credit-wellness'
  return '/admin/payments'
}

export default function AdminCollectionsPipelinePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payload, setPayload] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api('/collections/pipeline-summary')
      if (!res?.ok) {
        setError(res?.message || 'Could not load collections summary.')
        setPayload(null)
      } else {
        setPayload(res)
      }
    } catch (e) {
      setError(e?.message || 'Could not load collections summary.')
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const buckets = useMemo(() => {
    const raw = Array.isArray(payload?.buckets) ? payload.buckets : []
    if (!raw.length) return DEFAULT_BUCKETS
    return raw.map((b) => ({
      id: b.id,
      name: b.name,
      count: typeof b.count === 'number' ? b.count : Number(b.count) || 0,
      color: BUCKET_STYLES[b.id] || 'from-gray-600 to-gray-800',
      description: b.description,
    }))
  }, [payload])

  const metrics = payload?.metrics || {}
  const overdueBal = metrics.overdue_scheduled_balance_php
  const overdueInst = metrics.overdue_installments
  const largeAdj = metrics.large_settlement_adjustments_180d

  return (
    <div className={`${admin.pageContainer} space-y-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={admin.pageTitle}>Collections pipeline</h1>
          <p className={admin.pageSubtitle}>
            Borrower accounts on active loans, bucketed by worst installment delinquency (DPD) and wellness default_risk. Data
            refreshes when you reload this page.
          </p>
          {payload?.as_of ? (
            <p className={`mt-2 text-xs ${admin.textMuted}`}>As of {payload.as_of} (server date).</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/payments" className={`${admin.btnPrimary}`}>
            Payment console
          </Link>
          <Link to="/admin/borrowers" className={`${admin.btnSecondary}`}>
            Borrower accounts
          </Link>
          <Link to="/admin/risk-analytics" className={`${admin.btnSecondary}`}>
            Risk analytics
          </Link>
        </div>
      </div>

      {error ? (
        <div className={`${admin.cardNoHover} border border-red-200 bg-red-50 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200`}>
          {error}
          <button type="button" className="ml-3 font-semibold underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {buckets.map((b) => (
          <Link
            key={b.id}
            to={bucketHref(b.id)}
            className={`${admin.cardNoHover} block overflow-hidden bg-gradient-to-br p-0 text-white transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${b.color} ${loading ? 'pointer-events-none opacity-70' : ''}`}
            title={b.description || undefined}
          >
            <div className="p-5">
              <p className="text-sm font-medium text-white/90">{b.name}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight">{loading ? '—' : b.count}</p>
              <p className="mt-1 text-xs text-white/80">borrower accounts</p>
            </div>
          </Link>
        ))}
      </div>

      <div className={`${admin.cardNoHover} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Next actions</h2>
          <Link to="/admin/payments?overdue=1" className={`${admin.btnPrimary}`}>
            Overdue installments
          </Link>
        </div>
        {!loading && payload ? (
          <p className={`text-sm ${admin.textMuted}`}>
            Open overdue volume: <span className="font-medium text-gray-800 dark:text-gray-200">₱{Number(overdueBal || 0).toLocaleString()}</span>{' '}
            across <span className="font-medium text-gray-800 dark:text-gray-200">{overdueInst ?? 0}</span> unpaid installment(s) on active loans.
          </p>
        ) : null}
        <ul className="list-inside list-disc space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li>
            <Link className="font-medium text-brand-primary hover:underline" to="/admin/payments?installment_dpd_min=30&installment_dpd_max=59">
              SMS / call cadence — review 30–59 DPD installments in the payment console
            </Link>{' '}
            ({buckets.find((x) => x.id === 'early_30_59')?.count ?? 0} borrower accounts in this bucket).
          </li>
          <li>
            Settlement & large adjustments —{' '}
            <Link className="font-medium text-brand-primary hover:underline" to="/admin/payments">
              payment console
            </Link>{' '}
            shows schedule changes; <span className="font-medium text-gray-800 dark:text-gray-200">{largeAdj ?? 0}</span> final-installment adjustments
            ≥ ₱100k in the last 180 days (supervisor review).
          </li>
          <li>
            Portfolio risk & wellness —{' '}
            <Link className="font-medium text-brand-primary hover:underline" to="/admin/credit-wellness">
              credit & wellness
            </Link>{' '}
            (default_risk / legal bucket) and{' '}
            <Link className="font-medium text-brand-primary hover:underline" to="/admin/risk-analytics">
              risk analytics
            </Link>
            .
          </li>
        </ul>
      </div>
    </div>
  )
}
