import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PortalCard from '../../components/portal/PortalCard.jsx'
import KpiStat from '../../components/portal/KpiStat.jsx'
import { BorrowerPageHeader } from '../../components/portal/BorrowerPageHeader.jsx'
import { borrowerApi } from '../api/client.js'
import { useBorrowerAuth } from '../context/useBorrowerAuth.js'
import WellnessScoreGauge from '../../components/wellness/WellnessScoreGauge.jsx'
import RiskBadge from '../../components/wellness/RiskBadge.jsx'
import BorrowerTierBadge from '../../components/wellness/BorrowerTierBadge.jsx'
import TrendIndicator from '../../components/wellness/TrendIndicator.jsx'
import AchievementBadges from '../../components/wellness/AchievementBadges.jsx'
import ScoreBreakdown from '../../components/wellness/ScoreBreakdown.jsx'
import WellnessProgressTimeline from '../../components/wellness/WellnessProgressTimeline.jsx'
import FinancialTips from '../../components/wellness/FinancialTips.jsx'
import LoanEligibilityInsights, { UpcomingMilestones } from '../../components/wellness/LoanEligibilityInsights.jsx'
import WellnessAlertsPanel from '../../components/wellness/WellnessAlertsPanel.jsx'
import { getCreditRating, computeWellnessAlerts, formatCategory, formatRepaymentHint, formatPaymentStreak } from '../../components/wellness/wellnessUtils.js'
const CreditWellnessChart = lazy(() => import('../components/CreditWellnessChart.jsx'))

const CATEGORY_LABELS = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  at_risk: 'Poor',
  critical: 'Very Poor',
  insufficient: 'Insufficient data',
}

const HEALTH_LABELS = {
  healthy: 'Healthy',
  watchlist: 'Watchlist',
  delayed: 'Delayed',
  high_risk: 'High Risk',
  default_risk: 'Default Risk',
}

function formatHealth(status) {
  return HEALTH_LABELS[status] || status || '—'
}

function healthBadgeClass(status) {
  if (status === 'healthy') return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
  if (status === 'watchlist') return 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
  if (status === 'delayed') return 'bg-orange-500/15 text-orange-800 dark:text-orange-300'
  return 'bg-red-500/15 text-red-800 dark:text-red-300'
}

function recommendationStyle(type) {
  if (type === 'positive') return 'border-emerald-500/20 bg-emerald-500/5'
  if (type === 'urgent') return 'border-red-500/25 bg-red-500/5'
  if (type === 'warning') return 'border-amber-500/25 bg-amber-500/5'
  return 'border-black/[0.06] bg-brand-background-alt/60 dark:border-white/10'
}

export default function BorrowerCreditHealthPage() {
  const { user } = useBorrowerAuth()
  const displayName = user?.name?.split(' ')[0] || 'there'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (signal) => {
    setLoading(true)
    setError(null)
    try {
      const res = await borrowerApi('/borrower/credit-wellness', { signal })
      if (res?.ok) setData(res.data)
      else setError(res?.message || 'Unable to load credit wellness.')
    } catch (e) {
      if (e?.name !== 'AbortError') setError(e?.message || 'Unable to load credit wellness.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    load(ac.signal)
    return () => ac.abort()
  }, [load])

  const chartData = useMemo(() => {
    const hist = data?.history ?? []
    return hist.map((h) => ({
      date: h.recorded_at ? new Date(h.recorded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '',
      score: h.score,
    }))
  }, [data])

  const score = data?.wellness_score ?? 0
  const prevScore = data?.history?.[1]?.score
  const insufficient = data?.insufficient_data || data?.score_category === 'insufficient'

  if (loading && !data) {
    return (
      <Box className="space-y-8">
        <BorrowerPageHeader eyebrow="Credit & wellness" title="Loading your financial snapshot…" />
        <div className="h-48 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5" />
      </Box>
    )
  }

  return (
    <Box className="space-y-8">
      <BorrowerPageHeader
        eyebrow="Credit & wellness"
        title={`Hey ${displayName}, your financial snapshot`}
        description={
          <>
            Track loan health, payment consistency, and personalized recommendations to improve your profile.
            {user?.email ? (
              <span className="mt-2 block font-medium text-gray-700 dark:text-gray-300">
                Profile email: <span className="text-brand-primary">{user.email}</span>
              </span>
            ) : null}
          </>
        }
        actions={
          <Link
            to="/borrower/apply-loan"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-white shadow-brand-primary transition hover:brightness-105"
          >
            Apply for a loan
          </Link>
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {error}
          <button type="button" onClick={() => load()} className="ml-3 font-semibold underline">
            Retry
          </button>
        </div>
      ) : null}

      <Box className="flex flex-wrap items-center gap-3">
        <RiskBadge level={data?.default_risk_level || data?.risk_level} size="lg" />
        <BorrowerTierBadge score={insufficient ? 0 : score} />
        {data?.improvement_trend ? <TrendIndicator trend={data.improvement_trend} /> : null}
        {data?.credit_score != null ? (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            Credit rating: {getCreditRating(data.credit_score)}
          </span>
        ) : null}
      </Box>

      <Box className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiStat
          label="Credit wellness score"
          value={insufficient ? 'Insufficient data' : data ? `${data.wellness_score}/100` : '—'}
          hint={formatCategory(data?.score_category)}
        />
        <KpiStat
          label="Repayment rate"
          value={data && !insufficient ? `${Number(data.repayment_rate).toFixed(0)}%` : '—'}
          hint={formatRepaymentHint(data)}
        />
        <KpiStat
          label="Payment streak"
          value={insufficient ? '—' : formatPaymentStreak(data?.payment_streak ?? 0)}
          hint="Consecutive on-time payments"
        />
        <KpiStat
          label="Delayed payment rate"
          value={data ? `${Number(data.delayed_payment_rate).toFixed(0)}%` : '—'}
          hint={`${data?.active_loan_count ?? 0} active loan(s)`}
        />
      </Box>

      <Box className="grid gap-6 lg:grid-cols-2">
        <PortalCard title="Wellness overview" subtitle={data?.improvement_trend ? `Trend: ${data.improvement_trend}` : undefined}>
          <div className="flex flex-col items-center justify-center gap-4 py-6 text-center sm:flex-row sm:text-left">
            <WellnessScoreGauge score={score} category={data?.score_category} insufficient={insufficient} />
            <div className="max-w-sm space-y-2 text-sm text-gray-600 dark:text-gray-400">
              {user?.email ? (
                <p>
                  Account email: <strong className="text-brand-text dark:text-white">{user.email}</strong>
                </p>
              ) : null}
              {data?.credit_score != null ? (
                <p>
                  Credit score: <strong className="text-brand-text dark:text-white">{Number(data.credit_score).toFixed(0)}</strong>
                  {data.risk_level ? ` · Risk: ${data.risk_level}` : null}
                </p>
              ) : null}
              <p>
                {data?.next_due_date
                  ? `Next due date: ${new Date(data.next_due_date).toLocaleDateString()}`
                  : 'No upcoming due dates on active loans.'}
              </p>
              <p>
                Total penalties: <strong>₱{Number(data?.total_penalties ?? 0).toLocaleString()}</strong>
                {Number(data?.current_overdue_amount) > 0 ? (
                  <>
                    {' '}
                    · Overdue: <strong className="text-red-600 dark:text-red-400">₱{Number(data.current_overdue_amount).toLocaleString()}</strong>
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </PortalCard>

        <PortalCard title="Score history" subtitle="Wellness over time">
          <Suspense
            fallback={<div className="h-48 animate-pulse rounded-xl bg-black/5 dark:bg-white/5" aria-hidden />}
          >
            <CreditWellnessChart chartData={chartData} />
          </Suspense>
        </PortalCard>
      </Box>

      <PortalCard title="Score breakdown" subtitle="How your wellness score is composed">
        <ScoreBreakdown data={data} />
      </PortalCard>

      <PortalCard title="Achievement badges" subtitle="Earn badges by maintaining excellent payment behavior">
        <AchievementBadges data={data} />
      </PortalCard>

      <Box className="grid gap-6 lg:grid-cols-2">
        <PortalCard title="Wellness progress timeline" subtitle="Your score journey">
          <WellnessProgressTimeline history={data?.history ?? []} />
        </PortalCard>

        <PortalCard title="Financial tips" subtitle="Personalized guidance">
          <FinancialTips data={data} />
        </PortalCard>
      </Box>

      <Box className="grid gap-6 lg:grid-cols-2">
        <PortalCard title="Loan eligibility insights" subtitle="How your profile affects borrowing">
          <LoanEligibilityInsights data={data} />
        </PortalCard>

        <PortalCard title="Upcoming milestones" subtitle="Goals to unlock next">
          <UpcomingMilestones data={data} />
        </PortalCard>
      </Box>

      <PortalCard title="Wellness alerts" subtitle="Important updates about your profile">
        {computeWellnessAlerts(data, prevScore).length > 0 ? (
          <WellnessAlertsPanel data={data} prevScore={prevScore} title="" />
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No alerts — keep up the great work!</p>
        )}
      </PortalCard>

      {(data?.risk_flags?.length ?? 0) > 0 ? (
        <PortalCard title="Risk alerts" subtitle="Predictive flags based on your payment behavior">
          <ul className="flex flex-wrap gap-2">
            {data.risk_flags.map((f) => (
              <li
                key={f.code}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  f.severity === 'high' ? 'bg-red-500/15 text-red-800 dark:text-red-300' : 'bg-amber-500/15 text-amber-900 dark:text-amber-200'
                }`}
              >
                {f.label}
              </li>
            ))}
          </ul>
        </PortalCard>
      ) : null}

      <PortalCard title="Loan health" subtitle="Status per active account">
        {(data?.loan_health?.length ?? 0) === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No loans to display yet.</p>
        ) : (
          <ul className="divide-y divide-black/[0.06] dark:divide-white/10">
            {data.loan_health.map((loan) => (
              <li key={loan.loan_id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="font-medium text-brand-text dark:text-white">Loan #{loan.loan_id}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${healthBadgeClass(loan.health_status)}`}>
                  {formatHealth(loan.health_status)}
                </span>
                <span className="w-full text-xs text-gray-500 dark:text-gray-400 sm:w-auto">
                  Outstanding ₱{Number(loan.outstanding_balance).toLocaleString()} · Consistency {Number(loan.payment_consistency).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </PortalCard>

      <PortalCard title="Recommendations" subtitle="Personalized wellness insights">
        {(data?.recommendations?.length ?? 0) === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Keep making on-time payments to unlock insights.</p>
        ) : (
          <ul className="space-y-3">
            {data.recommendations.map((r, i) => (
              <li key={`${r.type}-${i}`} className={`rounded-xl border px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 ${recommendationStyle(r.type)}`}>
                {r.message}
              </li>
            ))}
          </ul>
        )}
      </PortalCard>

      {(data?.eligibility_impact?.requires_manual_approval || data?.eligibility_impact?.fast_track_eligible) && (
        <PortalCard title="Application impact" subtitle="How wellness affects your next loan">
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            {data.eligibility_impact.fast_track_eligible ? (
              <li className="text-brand-success dark:text-emerald-300">✓ You may qualify for faster approval.</li>
            ) : null}
            {data.eligibility_impact.requires_manual_approval ? (
              <li className="text-amber-700 dark:text-amber-300">Additional manual review may be required.</li>
            ) : null}
            {data.eligibility_impact.loan_limit_multiplier != null && data.eligibility_impact.loan_limit_multiplier !== 1 ? (
              <li>Estimated limit multiplier: {Number(data.eligibility_impact.loan_limit_multiplier).toFixed(2)}×</li>
            ) : null}
          </ul>
          <Link to="/borrower/applications" className="mt-3 inline-block text-sm font-semibold text-brand-primary hover:underline">
            Continue an application →
          </Link>
        </PortalCard>
      )}
    </Box>
  )
}

function Box({ className, children, style }) {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  )
}
