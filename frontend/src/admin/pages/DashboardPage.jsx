import { lazy, Suspense, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { DashboardStatSkeleton, admin } from '../components/AdminUi.jsx'
import AdminCrmModuleStrip from '../components/AdminCrmModuleStrip.jsx'

const DashboardCharts = lazy(() => import('./DashboardCharts.jsx'))

function StatCard({ label, value, sub }) {
  return (
    <div className={`${admin.card} min-w-0 p-5 sm:p-6`}>
      <p className={`text-sm font-medium leading-snug break-words ${admin.textMuted}`}>{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 transition-colors duration-300 dark:text-gray-100 sm:text-3xl">
        {value}
      </p>
      {sub && <p className={`mt-1 text-xs ${admin.textMuted}`}>{sub}</p>}
    </div>
  )
}

function ChartsFallback() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {[1, 2].map((k) => (
        <div key={k} className={`${admin.chartCard} animate-pulse`}>
          <div className="mb-4 h-4 w-48 rounded bg-gray-200 dark:bg-[#1F2937]" />
          <div className="h-64 rounded-lg bg-gray-100 dark:bg-[#1F2937]/80" />
        </div>
      ))}
      <div className={`${admin.chartCard} animate-pulse lg:col-span-2`}>
        <div className="mb-4 h-4 w-48 rounded bg-gray-200 dark:bg-[#1F2937]" />
        <div className="h-64 rounded-lg bg-gray-100 dark:bg-[#1F2937]/80" />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { showToast } = useToast()
  const [summary, setSummary] = useState(null)
  const [charts, setCharts] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api('/dashboard/overview')
        if (cancelled) return
        setSummary(res.summary)
        setCharts({
          loan_growth: res.loan_growth,
          repayments: res.repayments,
          revenue_trend: res.revenue_trend || res.repayments,
        })
      } catch (e) {
        if (!cancelled) {
          try {
            const [s, c] = await Promise.all([api('/dashboard/summary'), api('/dashboard/charts')])
            if (cancelled) return
            setSummary(s.summary)
            setCharts({
              loan_growth: c.loan_growth,
              repayments: c.repayments,
              revenue_trend: c.revenue_trend || c.repayments,
            })
          } catch (e2) {
            showToast(e2.message || e.message, 'error')
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showToast])

  const fmt = (n) =>
    typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className={admin.pageTitle}>Dashboard</h1>
          <p className={admin.pageSubtitle}>
            Portfolio overview — principal released, loan health, and collections.
          </p>
        </div>
        <AdminCrmModuleStrip />
        <DashboardStatSkeleton />
        <ChartsFallback />
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 space-y-8">
      <div>
        <h1 className={admin.pageTitle}>Dashboard</h1>
        <p className={admin.pageSubtitle}>
          Portfolio overview — principal released, loan health, and collections.
        </p>
      </div>

      <AdminCrmModuleStrip />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Principal Released"
          value={summary?.total_principal_released != null ? `₱${fmt(summary.total_principal_released)}` : '—'}
        />
        <StatCard label="Active Loans" value={fmt(summary?.active_loans)} sub="Ongoing" />
        <StatCard label="Pending Applications" value={fmt(summary?.pending_applications)} />
        <StatCard label="Overdue Loans" sub="Requires follow-up" value={fmt(summary?.overdue_loans)} />
        <StatCard label="Completed Loans" value={fmt(summary?.completed_loans)} />
        <StatCard
          label="Total Collections"
          sub="All time"
          value={summary?.total_revenue != null ? `₱${fmt(summary.total_revenue)}` : '—'}
        />
      </div>

      <Suspense fallback={<ChartsFallback />}>
        <DashboardCharts charts={charts} />
      </Suspense>
    </div>
  )
}
