import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../admin/api/client.js'
import { admin } from '../../admin/components/AdminUi.jsx'
import RiskBadge from './RiskBadge.jsx'
import TrendIndicator from './TrendIndicator.jsx'
import { COLLECTOR_PRIORITY, computeCollectorPriority } from './wellnessUtils.js'

/**
 * Collector-focused wellness view using existing APIs:
 * - /collections/pipeline-summary (payments.manage)
 * - /payments with overdue filter
 * - /credit-wellness/portfolio when reports.view is available
 */
export default function CollectorWellnessView({ canViewPortfolio = false }) {
  const [pipeline, setPipeline] = useState(null)
  const [portfolio, setPortfolio] = useState(null)
  const [overduePayments, setOverduePayments] = useState([])
  const [upcomingPayments, setUpcomingPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const tasks = [
        api('/collections/pipeline-summary'),
        api('/payments?per_page=20&status=overdue'),
        api('/payments?per_page=15&status=pending'),
      ]
      if (canViewPortfolio) tasks.push(api('/credit-wellness/portfolio'))

      const [pipeRes, overdueRes, upcomingRes, portRes] = await Promise.all(tasks)

      if (pipeRes?.ok) setPipeline(pipeRes)
      if (overdueRes?.ok) setOverduePayments(overdueRes?.data?.data ?? [])
      if (upcomingRes?.ok) setUpcomingPayments(upcomingRes?.data?.data ?? [])
      if (canViewPortfolio && portRes?.ok) setPortfolio(portRes.data)
    } finally {
      setLoading(false)
    }
  }, [canViewPortfolio])

  useEffect(() => {
    load()
  }, [load])

  const priorityList = useMemo(() => {
    const fromPortfolio = (portfolio?.high_risk_borrowers ?? []).map((b) => ({
      ...b,
      priority: computeCollectorPriority(b),
      source: 'wellness',
    }))
    const fromOverdue = overduePayments.map((p) => ({
      borrower_id: p.loan?.borrower?.id || p.loan?.borrower_id,
      name: p.loan?.borrower?.name || 'Unknown',
      wellness_score: null,
      default_risk_level: (p.overdue_days ?? 0) >= 60 ? 'critical' : (p.overdue_days ?? 0) >= 30 ? 'high' : 'medium',
      overdue_days: p.overdue_days,
      outstanding: p.amount_due - (p.amount_paid || 0),
      last_payment: p.paid_at,
      missed_count: null,
      loan_id: p.loan_id,
      due_date: p.due_date,
      priority: computeCollectorPriority({ default_risk_level: (p.overdue_days ?? 0) >= 60 ? 'critical' : 'medium', overdue_days: p.overdue_days }),
      source: 'payment',
    }))

    const merged = [...fromPortfolio]
    for (const o of fromOverdue) {
      if (!merged.some((m) => m.borrower_id === o.borrower_id)) merged.push(o)
    }

    const order = { critical: 0, high: 1, medium: 2, low: 3 }
    return merged.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9))
  }, [portfolio, overduePayments])

  const declining = useMemo(
    () => (portfolio?.high_risk_borrowers ?? []).filter((b) => b.improvement_trend === 'declining'),
    [portfolio],
  )

  if (loading) {
    return <div className={`${admin.cardNoHover} h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800`} />
  }

  const metrics = pipeline?.metrics || {}

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Overdue installments" value={metrics.overdue_installments ?? '—'} accent="text-red-600 dark:text-red-400" />
        <KpiCard label="Overdue balance" value={metrics.overdue_scheduled_balance_php != null ? `₱${Number(metrics.overdue_scheduled_balance_php).toLocaleString()}` : '—'} accent="text-amber-600 dark:text-amber-400" />
        <KpiCard label="High-risk accounts" value={priorityList.filter((p) => p.priority === 'critical' || p.priority === 'high').length} accent="text-orange-600 dark:text-orange-400" />
        <KpiCard label="Upcoming due (15d)" value={upcomingPayments.length} accent="text-blue-600 dark:text-blue-400" />
      </div>

      {declining.length > 0 ? (
        <section className={admin.cardNoHover}>
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Declining wellness scores</h2>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {declining.slice(0, 8).map((b) => (
              <li key={b.borrower_id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <Link to={`/admin/borrowers/${b.borrower_id}`} className="font-medium text-brand-primary hover:underline">
                  {b.name}
                </Link>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums">{b.wellness_score}/100</span>
                  <TrendIndicator trend="declining" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={admin.cardNoHover}>
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Collection priority list</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={`border-b border-gray-200 dark:border-gray-700 ${admin.textMuted}`}>
                <th className="py-2 pr-3 font-medium">Priority</th>
                <th className="py-2 pr-3 font-medium">Borrower</th>
                <th className="py-2 pr-3 font-medium">Risk</th>
                <th className="py-2 pr-3 font-medium">Score</th>
                <th className="py-2 pr-3 font-medium">Outstanding</th>
                <th className="py-2 pr-3 font-medium">Due / overdue</th>
                <th className="py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {priorityList.slice(0, 20).map((row, i) => {
                const pri = COLLECTOR_PRIORITY[row.priority] || COLLECTOR_PRIORITY.low
                return (
                  <tr key={`${row.borrower_id}-${i}`} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${pri.className}`}>{pri.label}</span>
                    </td>
                    <td className="py-2 pr-3">
                      {row.borrower_id ? (
                        <Link to={`/admin/borrowers/${row.borrower_id}`} className="font-medium text-brand-primary hover:underline">
                          {row.name}
                        </Link>
                      ) : row.name}
                    </td>
                    <td className="py-2 pr-3"><RiskBadge level={row.default_risk_level} /></td>
                    <td className="py-2 pr-3 tabular-nums">{row.wellness_score != null ? `${row.wellness_score}/100` : '—'}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {row.outstanding != null ? `₱${Number(row.outstanding).toLocaleString()}` : '—'}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {row.due_date || (row.overdue_days != null ? `${row.overdue_days}d overdue` : '—')}
                    </td>
                    <td className="py-2">
                      <Link to="/admin/payments" className="text-xs font-semibold text-brand-primary hover:underline">Payments →</Link>
                    </td>
                  </tr>
                )
              })}
              {priorityList.length === 0 ? (
                <tr><td colSpan={7} className={`py-4 ${admin.textMuted}`}>No collection priorities at this time</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className={admin.cardNoHover}>
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Upcoming due dates</h2>
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {upcomingPayments.slice(0, 10).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>Loan #{p.loan_id} · {p.loan?.borrower?.name || '—'}</span>
              <span className="text-xs text-gray-500">Due {p.due_date} · ₱{Number(p.amount_due || 0).toLocaleString()}</span>
            </li>
          ))}
          {upcomingPayments.length === 0 ? (
            <li className={`py-4 text-sm ${admin.textMuted}`}>No upcoming payments in queue</li>
          ) : null}
        </ul>
      </section>
    </div>
  )
}

function KpiCard({ label, value, accent }) {
  return (
    <div className={admin.cardNoHover}>
      <p className={`text-sm ${admin.textMuted}`}>{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  )
}
