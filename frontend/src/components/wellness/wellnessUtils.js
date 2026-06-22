/** Shared wellness display helpers — derived from existing API fields, no business logic changes. */

export const CATEGORY_LABELS = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  at_risk: 'At Risk',
  critical: 'Critical',
}

export const CATEGORY_COLORS = {
  excellent: '#10b981',
  good: '#34d399',
  fair: '#fbbf24',
  at_risk: '#f97316',
  critical: '#ef4444',
}

export const TIER_CONFIG = {
  bronze: { label: 'Bronze', color: '#b45309', bg: 'bg-amber-500/15 text-amber-900 dark:text-amber-200' },
  silver: { label: 'Silver', color: '#94a3b8', bg: 'bg-slate-400/15 text-slate-800 dark:text-slate-200' },
  gold: { label: 'Gold', color: '#eab308', bg: 'bg-yellow-500/15 text-yellow-900 dark:text-yellow-200' },
  platinum: { label: 'Platinum', color: '#a78bfa', bg: 'bg-violet-500/15 text-violet-900 dark:text-violet-200' },
}

export const RISK_CONFIG = {
  low: { label: 'Low', color: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300', dot: 'bg-emerald-500' },
  medium: { label: 'Medium', color: 'bg-amber-500/15 text-amber-800 dark:text-amber-300', dot: 'bg-amber-500' },
  high: { label: 'High', color: 'bg-orange-500/15 text-orange-800 dark:text-orange-300', dot: 'bg-orange-500' },
  critical: { label: 'Critical', color: 'bg-red-500/15 text-red-800 dark:text-red-300', dot: 'bg-red-500' },
}

export const COLLECTOR_PRIORITY = {
  critical: { label: 'Critical', className: 'bg-red-600 text-white' },
  high: { label: 'High', className: 'bg-orange-500/90 text-white' },
  medium: { label: 'Medium', className: 'bg-amber-500/90 text-amber-950' },
  low: { label: 'Low', className: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' },
}

export const LOAN_RECOMMENDATION = {
  recommended: { label: 'Recommended', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300', icon: '✓' },
  requires_review: { label: 'Requires Review', className: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300', icon: '!' },
  not_recommended: { label: 'Not Recommended', className: 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300', icon: '✕' },
}

export const ACHIEVEMENT_DEFS = {
  perfect_payer: { label: 'Perfect Payer', desc: '100% repayment success rate', icon: '★' },
  trusted_borrower: { label: 'Trusted Borrower', desc: 'Wellness score 75+', icon: '◆' },
  '12_month_streak': { label: '12-Month Streak', desc: '12+ consecutive on-time payments', icon: '▲' },
  zero_penalties: { label: 'Zero Penalties', desc: 'No penalty charges on record', icon: '○' },
  premium_member: { label: 'Premium Member', desc: 'Platinum-tier wellness score', icon: '♦' },
  fast_approval: { label: 'Fast Approval Eligible', desc: 'Qualifies for expedited review', icon: '⚡' },
}

export function formatCategory(cat) {
  return CATEGORY_LABELS[cat] || (cat ? String(cat).replace(/_/g, ' ') : '—')
}

export function getBorrowerTier(score) {
  const s = Number(score) || 0
  if (s >= 90) return { tier: 'platinum', ...TIER_CONFIG.platinum }
  if (s >= 75) return { tier: 'gold', ...TIER_CONFIG.gold }
  if (s >= 60) return { tier: 'silver', ...TIER_CONFIG.silver }
  return { tier: 'bronze', ...TIER_CONFIG.bronze }
}

export function getCreditRating(creditScore) {
  const s = Number(creditScore) || 0
  if (s >= 750) return 'Excellent'
  if (s >= 700) return 'Good'
  if (s >= 650) return 'Fair'
  if (s >= 600) return 'Poor'
  return 'Very Poor'
}

export function getLoanRecommendation(data) {
  if (!data) return 'requires_review'
  const risk = data.default_risk_level || data.risk_level
  if (risk === 'critical' || risk === 'high') return 'not_recommended'
  if (data.eligibility_impact?.requires_manual_approval) return 'requires_review'
  if (data.eligibility_impact?.fast_track_eligible || (data.wellness_score ?? 0) >= 75) return 'recommended'
  if ((data.wellness_score ?? 0) < 40) return 'not_recommended'
  return 'requires_review'
}

export function computeAchievements(data) {
  if (!data) return []
  const earned = []
  if (Number(data.repayment_rate) >= 100) earned.push('perfect_payer')
  if ((data.wellness_score ?? 0) >= 75) earned.push('trusted_borrower')
  if ((data.payment_streak ?? 0) >= 12) earned.push('12_month_streak')
  if (Number(data.total_penalties ?? 0) === 0 && (data.active_loan_count ?? 0) > 0) earned.push('zero_penalties')
  if ((data.wellness_score ?? 0) >= 90) earned.push('premium_member')
  if (data.eligibility_impact?.fast_track_eligible) earned.push('fast_approval')
  return earned.map((id) => ({ id, ...ACHIEVEMENT_DEFS[id], earned: true }))
}

export function computeScoreBreakdown(data) {
  if (!data) return []
  return [
    { label: 'Repayment success', value: Number(data.repayment_rate) || 0, weight: 35 },
    { label: 'Payment consistency', value: Math.max(0, 100 - (Number(data.delayed_payment_rate) || 0)), weight: 25 },
    { label: 'Payment streak', value: Math.min(100, ((data.payment_streak ?? 0) / 12) * 100), weight: 20 },
    { label: 'Penalty-free record', value: Number(data.total_penalties) === 0 ? 100 : Math.max(0, 100 - Number(data.total_penalties) / 10), weight: 10 },
    { label: 'Active loan health', value: computeLoanHealthAvg(data.loan_health), weight: 10 },
  ]
}

function computeLoanHealthAvg(loanHealth) {
  if (!Array.isArray(loanHealth) || loanHealth.length === 0) return 50
  const total = loanHealth.reduce((sum, l) => sum + (Number(l.payment_consistency) || 0), 0)
  return total / loanHealth.length
}

export function computeWellnessAlerts(data, prevScore) {
  if (!data) return []
  const alerts = []
  const score = data.wellness_score ?? 0
  if (prevScore != null && score < prevScore - 5) {
    alerts.push({ type: 'warning', message: `Wellness score dropped by ${prevScore - score} points recently.` })
  }
  if ((data.missed_payment_count ?? 0) > 0 || Number(data.current_overdue_amount) > 0) {
    alerts.push({ type: 'urgent', message: 'Missed or overdue payment detected — review account immediately.' })
  }
  if (data.improvement_trend === 'declining') {
    alerts.push({ type: 'warning', message: 'Payment consistency is declining.' })
  }
  const tier = getBorrowerTier(score)
  if (tier.tier === 'platinum') {
    alerts.push({ type: 'positive', message: 'Borrower reached Platinum tier — eligible for premium products.' })
  }
  if (data.default_risk_level === 'high' || data.default_risk_level === 'critical') {
    alerts.push({ type: 'urgent', message: 'Borrower flagged as high risk.' })
  }
  if (data.eligibility_impact?.fast_track_eligible) {
    alerts.push({ type: 'positive', message: 'Borrower eligible for fast-track approval.' })
  }
  return alerts
}

export function computeLoanDecisionSupport(data) {
  if (!data) return null
  const score = data.wellness_score ?? 0
  const multiplier = data.eligibility_impact?.loan_limit_multiplier ?? 1
  const baseLimit = 500000
  return {
    recommended_loan_limit: Math.round(baseLimit * multiplier),
    approval_confidence: Math.min(99, Math.max(10, score)),
    risk_assessment: formatCategory(data.score_category),
    stability_score: Math.round((Number(data.repayment_rate) || 0) * 0.6 + score * 0.4),
  }
}

export function computeMilestones(data) {
  if (!data) return []
  const milestones = []
  const streak = data.payment_streak ?? 0
  const score = data.wellness_score ?? 0
  const tier = getBorrowerTier(score)

  if (tier.tier !== 'platinum') {
    const nextTierScore = tier.tier === 'bronze' ? 60 : tier.tier === 'silver' ? 75 : 90
    milestones.push({ label: `${nextTierScore - score} points to reach ${getBorrowerTier(nextTierScore).label} tier`, progress: (score / nextTierScore) * 100 })
  }
  if (streak < 12) {
    milestones.push({ label: `${12 - streak} more on-time payments for 12-Month Streak badge`, progress: (streak / 12) * 100 })
  }
  if (score >= 75) {
    milestones.push({ label: 'Maintain your current score to qualify for higher loan limits.', progress: score })
  }
  if (data.eligibility_impact?.fast_track_eligible) {
    milestones.push({ label: 'Fast-track approval unlocked — apply today!', progress: 100 })
  }
  return milestones
}

export function computeFinancialTips(data) {
  const tips = []
  if (!data) return tips
  if (Number(data.delayed_payment_rate) > 10) {
    tips.push('Set up payment reminders to reduce delayed payments and improve your wellness score.')
  }
  if (Number(data.current_overdue_amount) > 0) {
    tips.push('Clear overdue balances promptly to avoid penalties and protect your credit rating.')
  }
  if ((data.payment_streak ?? 0) >= 6) {
    tips.push('Great streak! Keep it going — consistent payments unlock better loan terms.')
  }
  if ((data.wellness_score ?? 0) < 75) {
    tips.push('Focus on on-time payments for the next 3 months to reach Gold tier eligibility.')
  }
  if (tips.length === 0) {
    tips.push('Maintain your payment schedule and monitor your wellness dashboard for personalized insights.')
  }
  return tips
}

export function computeCollectorPriority(row) {
  const risk = row.default_risk_level || row.risk_level || 'low'
  if (risk === 'critical') return 'critical'
  if (risk === 'high') return 'high'
  if (risk === 'medium' || (row.overdue_days ?? 0) >= 30) return 'medium'
  return 'low'
}

export function buildBorrowerRanking(portfolio) {
  const all = [
    ...(portfolio?.top_performers ?? []),
    ...(portfolio?.improving_borrowers ?? []),
    ...(portfolio?.high_risk_borrowers ?? []),
  ]
  const seen = new Set()
  const unique = []
  for (const b of all) {
    if (!seen.has(b.borrower_id)) {
      seen.add(b.borrower_id)
      unique.push(b)
    }
  }
  return unique.sort((a, b) => (b.wellness_score ?? 0) - (a.wellness_score ?? 0))
}
