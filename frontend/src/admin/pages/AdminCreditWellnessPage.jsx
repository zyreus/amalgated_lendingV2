import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { admin } from '../components/AdminUi.jsx'
import WellnessBorrowerRanking from '../../components/wellness/WellnessBorrowerRanking.jsx'
import WellnessReportsPanel from '../../components/wellness/WellnessReportsPanel.jsx'
import TrendIndicator from '../../components/wellness/TrendIndicator.jsx'
import RiskBadge from '../../components/wellness/RiskBadge.jsx'
import BorrowerTierBadge from '../../components/wellness/BorrowerTierBadge.jsx'
import { buildBorrowerRanking, formatCategory } from '../../components/wellness/wellnessUtils.js'

const CreditWellnessSegmentsChart = lazy(() => import('../components/CreditWellnessSegmentsChart.jsx'))
const CreditWellnessChart = lazy(() => import('../../borrower/components/CreditWellnessChart.jsx'))

const SEGMENT_LABELS = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  at_risk: 'At Risk',
  critical: 'Critical',
}

function KpiCard({ label, value, accent = 'text-gray-900 dark:text-gray-100', sub }) {
  return (
    <div className={admin.cardNoHover}>
      <p className={`text-sm ${admin.textMuted}`}>{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${accent}`}>{value}</p>
      {sub ? <p className={`mt-1 text-xs ${admin.textMuted}`}>{sub}</p> : null}
    </div>
  )
}

export default function AdminCreditWellnessPage() {
  const [data, setData] = useState(null)
  const [trendData, setTrendData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [portRes, trendRes] = await Promise.all([
        api('/credit-wellness/portfolio'),
        api('/credit-wellness/reports/risk-trends'),
      ])
      if (portRes?.ok) setData(portRes.data)
      else setError(portRes?.message || 'Failed to load portfolio wellness.')
      if (trendRes?.ok) setTrendData(trendRes.data)
    } catch (e) {
      setError(e?.message || 'Failed to load portfolio wellness.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const segmentChart = useMemo(() => {
    const segs = data?.segments ?? {}
    return Object.entries(segs).map(([key, count]) => ({
      segment: SEGMENT_LABELS[key] || key,
      count: Number(count) || 0,
    }))
  }, [data])

  const ranking = useMemo(() => buildBorrowerRanking(data), [data])

  const requiringAttention = useMemo(() => {
    return (data?.high_risk_borrowers ?? []).filter(
      (b) => b.improvement_trend === 'declining' || b.default_risk_level === 'critical',
    )
  }, [data])

  const segmentPerformance = useMemo(() => {
    const segs = data?.segments ?? {}
    const total = data?.total_borrowers || 1
    return Object.entries(segs).map(([key, count]) => ({
      segment: formatCategory(key),
      count: Number(count) || 0,
      pct: Math.round(((Number(count) || 0) / total) * 100),
    }))
  }, [data])

  const trendChart = useMemo(() => {
    const improving = data?.improving_borrowers?.length ?? 0
    const highRisk = data?.high_risk_borrowers?.length ?? 0
    const avg = data?.avg_wellness_score ?? 0
    return [
      { date: 'Prior', score: Math.max(0, avg - 2) },
      { date: 'Current', score: avg },
      { date: 'Improving', score: avg + (improving > highRisk ? 1 : 0) },
    ]
  }, [data])

  const segs = data?.segments ?? {}

  return (
    <div className={`${admin.pageContainer} space-y-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={admin.pageTitle}>Credit & Wellness Overview</h1>
          <p className={admin.pageSubtitle}>
            Centralized borrower health monitoring — portfolio intelligence for responsible lending decisions.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {loading ? 'Refreshing…' : 'Refresh data'}
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {error}
          <button type="button" onClick={load} className="ml-2 font-semibold underline">Retry</button>
        </div>
      ) : null}

      {/* Primary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total borrowers" value={loading ? '…' : data?.total_borrowers ?? 0} />
        <KpiCard label="Excellent" value={loading ? '…' : segs.excellent ?? 0} accent="text-emerald-600 dark:text-emerald-400" sub="Score 90+" />
        <KpiCard label="Good" value={loading ? '…' : segs.good ?? 0} accent="text-green-600 dark:text-green-400" sub="Score 75–89" />
        <KpiCard label="High-risk" value={loading ? '…' : data?.high_risk_borrowers?.length ?? 0} accent="text-red-600 dark:text-red-400" sub="At risk + critical" />
        <KpiCard label="Avg. wellness score" value={loading ? '…' : data?.avg_wellness_score ?? '—'} accent="text-brand-primary" />
        <KpiCard label="Delayed accounts" value={loading ? '…' : data?.delayed_accounts?.length ?? 0} accent="text-amber-600 dark:text-amber-400" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={admin.chartCard}>
          <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Risk distribution</h2>
          {segmentChart.length > 0 ? (
            <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-gray-100 dark:bg-[#1F2937]/80" />}>
              <CreditWellnessSegmentsChart data={segmentChart} />
            </Suspense>
          ) : (
            <p className={`text-sm ${admin.textMuted}`}>No wellness data yet — scores populate after payments are recorded.</p>
          )}
        </div>

        <div className={admin.chartCard}>
          <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Wellness trend snapshot</h2>
          <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />}>
            <CreditWellnessChart chartData={trendChart} />
          </Suspense>
          {trendData?.improving?.length ? (
            <p className={`mt-2 text-xs ${admin.textMuted}`}>{trendData.improving.length} borrowers improving this period</p>
          ) : null}
        </div>
      </div>

      <WellnessBorrowerRanking borrowers={ranking} title="Borrower ranking" />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={admin.cardNoHover}>
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Top performing borrowers</h2>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {(data?.top_performers ?? []).slice(0, 8).map((b) => (
              <li key={b.borrower_id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <Link to={`/admin/borrowers/${b.borrower_id}`} className="font-medium text-brand-primary hover:underline">
                  {b.name || `Borrower #${b.borrower_id}`}
                </Link>
                <div className="flex items-center gap-2">
                  <BorrowerTierBadge score={b.wellness_score} />
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    {b.wellness_score}/100
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={admin.cardNoHover}>
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Borrowers requiring attention</h2>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {(requiringAttention.length ? requiringAttention : data?.high_risk_borrowers ?? []).slice(0, 8).map((b) => (
              <li key={b.borrower_id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <Link to={`/admin/borrowers/${b.borrower_id}`} className="font-medium text-brand-primary hover:underline">
                  {b.name || `Borrower #${b.borrower_id}`}
                </Link>
                <div className="flex items-center gap-2">
                  <RiskBadge level={b.default_risk_level} />
                  <TrendIndicator trend={b.improvement_trend} />
                </div>
              </li>
            ))}
            {!loading && (data?.high_risk_borrowers?.length ?? 0) === 0 ? (
              <li className={`py-4 text-sm ${admin.textMuted}`}>None flagged</li>
            ) : null}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={admin.cardNoHover}>
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Score growth — improving borrowers</h2>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {(data?.improving_borrowers ?? []).slice(0, 8).map((b) => (
              <li key={b.borrower_id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <Link to={`/admin/borrowers/${b.borrower_id}`} className="font-medium text-brand-primary hover:underline">
                  {b.name}
                </Link>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums">{b.wellness_score}/100</span>
                  <TrendIndicator trend="improving" />
                </div>
              </li>
            ))}
            {!loading && (data?.improving_borrowers?.length ?? 0) === 0 ? (
              <li className={`py-4 text-sm ${admin.textMuted}`}>No improving borrowers tracked yet</li>
            ) : null}
          </ul>
        </section>

        <section className={admin.cardNoHover}>
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Segment performance comparison</h2>
          <ul className="space-y-3">
            {segmentPerformance.map((s) => (
              <li key={s.segment}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{s.segment}</span>
                  <span className="text-xs text-gray-500">{s.count} borrowers ({s.pct}%)</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className="h-full rounded-full bg-brand-primary transition-all" style={{ width: `${s.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={admin.cardNoHover}>
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Delayed accounts</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={`border-b border-gray-200 dark:border-gray-700 ${admin.textMuted}`}>
                <th className="py-2 pr-4 font-medium">Borrower</th>
                <th className="py-2 pr-4 font-medium">Loan</th>
                <th className="py-2 pr-4 font-medium">Health</th>
                <th className="py-2 font-medium">Days overdue</th>
              </tr>
            </thead>
            <tbody>
              {(data?.delayed_accounts ?? []).map((row) => (
                <tr key={row.loan_id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-4">
                    {row.borrower?.id ? (
                      <Link to={`/admin/borrowers/${row.borrower.id}`} className="text-brand-primary hover:underline">
                        {row.borrower.name || row.borrower.email}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="py-2 pr-4">#{row.loan_id}</td>
                  <td className="py-2 pr-4 capitalize">{String(row.health_status || '').replace(/_/g, ' ')}</td>
                  <td className="py-2">{row.overdue_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <WellnessReportsPanel roleLabel="Admin" />
    </div>
  )
}
