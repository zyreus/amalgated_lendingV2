import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { admin } from '../components/AdminUi.jsx'

const CHART_LINE = '#ef4444'
const CHART_GRID = '#d1d5db'
const CHART_AXIS = '#6b7280'

/**
 * Lazy-loaded chart bundle for the admin dashboard so the main dashboard chunk
 * stays smaller and TTFB to interactive improves.
 */
export default function DashboardCharts({ charts }) {
  const tooltipStyle = useMemo(
    () => ({
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      color: '#111827',
    }),
    [],
  )

  return (
    <>
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
    </>
  )
}
