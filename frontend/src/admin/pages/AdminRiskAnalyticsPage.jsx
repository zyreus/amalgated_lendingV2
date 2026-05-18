import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { admin } from '../components/AdminUi.jsx'
import { fintechPalette } from '../../theme/designTokens.js'

export default function AdminRiskAnalyticsPage() {
  const { crimson, orange } = fintechPalette
  const data = useMemo(
    () =>
      ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((m, i) => ({
        month: m,
        defaultRate: 1.2 + i * 0.15 + (i % 2) * 0.08,
        approvalRate: 78 - i * 1.2,
      })),
    [],
  )

  return (
    <div className={`${admin.pageContainer} space-y-6`}>
      <div>
        <h1 className={admin.pageTitle}>Risk analytics</h1>
        <p className={admin.pageSubtitle}>Vintage-style view for portfolio committees — connect warehouse data in production.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${admin.cardNoHover}`}>
          <p className={`text-sm ${admin.textMuted}`}>Projected default rate</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">1.9%</p>
          <p className="mt-1 text-xs text-brand-accent dark:text-brand-accent">−0.2% vs prior month</p>
        </div>
        <div className={`${admin.cardNoHover}`}>
          <p className={`text-sm ${admin.textMuted}`}>Weighted avg. FICO band</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">685</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Across active book</p>
        </div>
        <div className={`${admin.cardNoHover}`}>
          <p className={`text-sm ${admin.textMuted}`}>Fraud catch rate</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">4.1%</p>
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Review flagged queue</p>
        </div>
      </div>

      <div className={admin.chartCard}>
        <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Default % vs approval % (sample)</h2>
        <div className="h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={orange.main} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={orange.main} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }}
                formatter={(value, name) => {
                  if (name === 'defaultRate') return [`${Number(value).toFixed(2)}%`, 'Default rate']
                  if (name === 'approvalRate') return [`${Number(value).toFixed(1)}%`, 'Approval rate']
                  return [value, name]
                }}
              />
              <Area type="monotone" dataKey="defaultRate" stroke={crimson.main} fill="url(#riskFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="approvalRate" stroke="#94a3b8" fillOpacity={0} strokeWidth={2} strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
