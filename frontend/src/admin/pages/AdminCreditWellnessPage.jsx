import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api/client.js'
import { admin } from '../components/AdminUi.jsx'

const SEGMENT_LABELS = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  at_risk: 'At Risk',
  critical: 'Critical',
}

export default function AdminCreditWellnessPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api('/credit-wellness/portfolio')
      if (res?.ok) setData(res.data)
      else setError(res?.message || 'Failed to load portfolio wellness.')
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

  return (
    <div className={`${admin.pageContainer} space-y-6`}>
      <div>
        <h1 className={admin.pageTitle}>Credit & Wellness</h1>
        <p className={admin.pageSubtitle}>
          Portfolio health, risk segments, and borrower wellness intelligence for responsible lending.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {error}
          <button type="button" onClick={load} className="ml-2 font-semibold underline">
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <div className={admin.cardNoHover}>
          <p className={`text-sm ${admin.textMuted}`}>Borrowers tracked</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{loading ? '…' : data?.total_borrowers ?? 0}</p>
        </div>
        <div className={admin.cardNoHover}>
          <p className={`text-sm ${admin.textMuted}`}>Avg. wellness score</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{loading ? '…' : data?.avg_wellness_score ?? '—'}</p>
        </div>
        <div className={admin.cardNoHover}>
          <p className={`text-sm ${admin.textMuted}`}>High-risk borrowers</p>
          <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
            {loading ? '…' : (data?.high_risk_borrowers?.length ?? 0)}
          </p>
        </div>
        <div className={admin.cardNoHover}>
          <p className={`text-sm ${admin.textMuted}`}>Delayed accounts</p>
          <p className="mt-2 text-3xl font-bold text-amber-600 dark:text-amber-400">
            {loading ? '…' : (data?.delayed_accounts?.length ?? 0)}
          </p>
        </div>
      </div>

      <div className={admin.chartCard}>
        <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Risk segments</h2>
        {segmentChart.length > 0 ? (
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={segmentChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis dataKey="segment" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#E63946" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className={`text-sm ${admin.textMuted}`}>No wellness data yet — scores populate after payments are recorded.</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={admin.cardNoHover}>
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">High-risk borrowers</h2>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {(data?.high_risk_borrowers ?? []).slice(0, 10).map((b) => (
              <li key={b.borrower_id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <Link to={`/admin/borrowers/${b.borrower_id}`} className="font-medium text-brand-primary hover:underline">
                  {b.name || `Borrower #${b.borrower_id}`}
                </Link>
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-800 dark:text-red-300">
                  {b.wellness_score}/100
                </span>
              </li>
            ))}
            {!loading && (data?.high_risk_borrowers?.length ?? 0) === 0 ? (
              <li className={`py-4 text-sm ${admin.textMuted}`}>None flagged</li>
            ) : null}
          </ul>
        </section>

        <section className={admin.cardNoHover}>
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Top performers</h2>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {(data?.top_performers ?? []).slice(0, 10).map((b) => (
              <li key={b.borrower_id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <Link to={`/admin/borrowers/${b.borrower_id}`} className="font-medium text-brand-primary hover:underline">
                  {b.name || `Borrower #${b.borrower_id}`}
                </Link>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  {b.wellness_score}/100
                </span>
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
                    ) : (
                      '—'
                    )}
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
    </div>
  )
}
