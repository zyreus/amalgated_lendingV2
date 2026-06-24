import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../admin/api/client.js'
import { admin } from '../../admin/components/AdminUi.jsx'
import WellnessScoreGauge from './WellnessScoreGauge.jsx'
import RiskBadge from './RiskBadge.jsx'
import BorrowerTierBadge from './BorrowerTierBadge.jsx'
import TrendIndicator from './TrendIndicator.jsx'
import AchievementBadges from './AchievementBadges.jsx'
import LoanRecommendationEngine from './LoanRecommendationEngine.jsx'
import LoanDecisionSupport from './LoanDecisionSupport.jsx'
import WellnessAlertsPanel from './WellnessAlertsPanel.jsx'
import { formatCategory, getCreditRating } from './wellnessUtils.js'

/**
 * Unified wellness profile panel — fetches existing per-borrower API.
 * Used in Admin, Loan Officer (loan review), and Borrower detail views.
 */
export default function CreditWellnessSummaryPanel({
  borrowerId,
  variant = 'full',
  className = '',
  linkToDetail = true,
}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!borrowerId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api(`/borrowers/${borrowerId}/credit-wellness`)
      if (res?.ok) setData(res.data)
      else setError(res?.message || 'Could not load wellness profile.')
    } catch (e) {
      setError(e?.message || 'Could not load wellness profile.')
    } finally {
      setLoading(false)
    }
  }, [borrowerId])

  useEffect(() => {
    load()
  }, [load])

  if (!borrowerId) return null

  if (loading) {
    return (
      <div className={`${admin.cardNoHover} animate-pulse ${className}`}>
        <div className="h-32 rounded-lg bg-gray-100 dark:bg-gray-800" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200 ${className}`}>
        {error}
        <button type="button" onClick={load} className="ml-2 font-semibold underline">Retry</button>
      </div>
    )
  }

  const dash = data?.dashboard ?? data?.wellness ?? {}
  const prevScore = data?.history?.[1]?.score
  const insufficient = dash.insufficient_data || dash.score_category === 'insufficient'

  if (variant === 'compact') {
    return (
      <div className={`flex flex-wrap items-center gap-3 ${className}`}>
        <WellnessScoreGauge score={dash.wellness_score} category={dash.score_category} size="sm" animated={false} insufficient={insufficient} />
        <div className="space-y-1">
          <div className="flex flex-wrap gap-2">
            <RiskBadge level={dash.default_risk_level || dash.risk_level} />
            <BorrowerTierBadge score={dash.wellness_score} />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Repayment {Number(dash.repayment_rate || 0).toFixed(0)}% · Streak {dash.payment_streak ?? 0}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${admin.cardNoHover} space-y-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Credit wellness summary</h2>
          <p className={`mt-0.5 text-xs ${admin.textMuted}`}>Unified borrower health profile for lending decisions</p>
        </div>
        {linkToDetail ? (
          <Link to="/admin/credit-wellness" className="text-xs font-semibold text-brand-primary hover:underline">
            Portfolio view →
          </Link>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <WellnessScoreGauge score={dash.wellness_score} category={dash.score_category} size="md" insufficient={insufficient} />
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap gap-2">
            <RiskBadge level={dash.default_risk_level || dash.risk_level} size="lg" />
            <BorrowerTierBadge score={dash.wellness_score} />
            <TrendIndicator trend={dash.improvement_trend} />
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <Stat label="Credit rating" value={getCreditRating(dash.credit_score)} />
            <Stat label="Repayment rate" value={`${Number(dash.repayment_rate || 0).toFixed(0)}%`} />
            <Stat label="Payment streak" value={dash.payment_streak ?? 0} />
            <Stat label="Outstanding" value={`₱${Number(dash.total_outstanding_balance || 0).toLocaleString()}`} />
            <Stat label="Active loans" value={dash.active_loan_count ?? 0} />
            <Stat label="Category" value={formatCategory(dash.score_category)} />
          </div>
        </div>
      </div>

      <AchievementBadges data={dash} compact />

      {variant === 'full' ? (
        <>
          <LoanRecommendationEngine data={dash} />
          <LoanDecisionSupport data={dash} />
          <WellnessAlertsPanel data={dash} prevScore={prevScore} />

          {(dash.loan_health?.length ?? 0) > 0 ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Existing obligations</h3>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {dash.loan_health.map((loan) => (
                  <li key={loan.loan_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>Loan #{loan.loan_id}</span>
                    <span className="capitalize text-gray-500">{String(loan.health_status || '').replace(/_/g, ' ')}</span>
                    <span className="text-xs text-gray-500">₱{Number(loan.outstanding_balance || 0).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      <p className="font-semibold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  )
}
