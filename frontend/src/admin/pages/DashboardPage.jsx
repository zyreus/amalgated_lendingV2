import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from 'recharts'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { DashboardStatSkeleton, admin } from '../components/AdminUi.jsx'

const CHART_LINE = '#ef4444'
const CHART_GRID = '#d1d5db'
const CHART_AXIS = '#6b7280'

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

export default function DashboardPage() {
  const { showToast } = useToast()
  const [summary, setSummary] = useState(null)
  const [charts, setCharts] = useState(null)
  const [loading, setLoading] = useState(true)

  const tooltipStyle = useMemo(
    () => ({
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      color: '#111827',
    }),
    [],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [s, c] = await Promise.all([api('/dashboard/summary'), api('/dashboard/charts')])
        if (!cancelled) {
          setSummary(s.summary)
          setCharts({
            loan_growth: c.loan_growth,
            repayments: c.repayments,
            revenue_trend: c.revenue_trend || c.repayments,
          })
        }
      } catch (e) {
        showToast(e.message, 'error')
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
        <DashboardStatSkeleton />
        <div className="grid gap-6 lg:grid-cols-2">
          {[1, 2].map((k) => (
            <div key={k} className={`${admin.chartCard} animate-pulse`}>
              <div className="mb-4 h-4 w-48 rounded bg-gray-200 dark:bg-[#1F2937]" />
              <div className="h-64 rounded-lg bg-gray-100 dark:bg-[#1F2937]/80" />
            </div>
          ))}
        </div>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`${admin.chartCard} min-w-0`}>
          <p className="mb-4 text-sm font-semibold text-gray-900 transition-colors duration-300 dark:text-gray-100">
            Loan Applications (Last 6 Months)
          </p>
          <div className="h-64 w-full min-w-0 overflow-x-auto">
            <ResponsiveContainer width="100%" height={256}>
              <AreaChart data={charts?.loan_growth || []}>
                <defs>
                  <linearGradient id="dashG1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_LINE} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={CHART_LINE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="month" stroke={CHART_AXIS} fontSize={11} tickLine={false} />
                <YAxis stroke={CHART_AXIS} fontSize={11} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={CHART_LINE}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#dashG1)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${admin.chartCard} min-w-0`}>
          <p className="mb-4 text-sm font-semibold text-gray-900 transition-colors duration-300 dark:text-gray-100">
            Monthly Repayments
          </p>
          <div className="h-64 w-full min-w-0 overflow-x-auto">
            <ResponsiveContainer width="100%" height={256}>
              <BarChart data={charts?.repayments || []}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="month" stroke={CHART_AXIS} fontSize={11} tickLine={false} />
                <YAxis stroke={CHART_AXIS} fontSize={11} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="amount" fill="#DC2626" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={`${admin.chartCard} min-w-0`}>
        <p className="mb-4 text-sm font-semibold text-gray-900 transition-colors duration-300 dark:text-gray-100">
          Monthly Revenue Trend
        </p>
        <div className="h-64 w-full min-w-0 overflow-x-auto">
          <ResponsiveContainer width="100%" height={256}>
            <AreaChart data={charts?.revenue_trend || []}>
              <defs>
                <linearGradient id="dashRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_LINE} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={CHART_LINE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis dataKey="month" stroke={CHART_AXIS} fontSize={11} tickLine={false} />
              <YAxis stroke={CHART_AXIS} fontSize={11} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={CHART_LINE}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#dashRev)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
