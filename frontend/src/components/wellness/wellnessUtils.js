/** Shared wellness display helpers — values come from the credit wellness API. */

export const CATEGORY_LABELS = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  at_risk: 'Poor',
  critical: 'Very Poor',
  insufficient: 'Insufficient data',
}

export const CATEGORY_COLORS = {
  excellent: '#10b981',
  good: '#34d399',
  fair: '#fbbf24',
  at_risk: '#f97316',
  critical: '#ef4444',
  insufficient: '#94a3b8',
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
  perfect_payer: { label: 'Perfect Payer', desc: '100% repayment rate with no late payments', icon: '★' },
  trusted_borrower: { label: 'Trusted Borrower', desc: 'At least 2 completed loans with no defaults', icon: '◆' },
  '12_month_streak': { label: '12-Month Streak', desc: '12+ consecutive on-time payments', icon: '▲' },
  zero_penalties: { label: 'Zero Penalties', desc: 'No penalty charges on record', icon: '○' },
  premium_member: { label: 'Premium Member', desc: 'Credit score 90+ with no delinquent loans', icon: '♦' },
  fast_approval: { label: 'Fast Approval Eligible', desc: 'Excellent score, complete documents, no collection issues', icon: '⚡' },
}

export function formatCategory(cat) {
  return CATEGORY_LABELS[cat] || (cat ? String(cat).replace(/_/g, ' ') : '—')
}

export function hasWellnessData(data) {
  return data && !data.insufficient_data && data.wellness_score != null
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
  if (!data || data.insufficient_data) return 'requires_review'
  const risk = data.default_risk_level || data.risk_level
  if (risk === 'critical' || risk === 'high') return 'not_recommended'
  if (data.eligibility_impact?.requires_manual_approval) return 'requires_review'
  if (data.eligibility_impact?.fast_track_eligible || (data.wellness_score ?? 0) >= 75) return 'recommended'
  if ((data.wellness_score ?? 0) < 40) return 'not_recommended'
  return 'requires_review'
}

export function computeAchievements(data) {
  const ids = data?.achievements ?? data?.eligibility_impact?.achievements ?? []
  if (!Array.isArray(ids) || !ids.length) return []
  return ids.map((id) => ({ id, ...ACHIEVEMENT_DEFS[id], earned: true })).filter((a) => a.label)
}

export function computeScoreBreakdown(data) {
  const items = data?.score_breakdown ?? data?.eligibility_impact?.score_breakdown ?? []
  return Array.isArray(items) ? items : []
}

export function computeWellnessAlerts(data, prevScore) {
  const alerts = data?.wellness_alerts ?? data?.eligibility_impact?.wellness_alerts ?? []
  if (Array.isArray(alerts) && alerts.length) return alerts

  if (!data || data.insufficient_data) {
    return [{ type: 'warning', message: 'Insufficient data available' }]
  }

  const fallback = []
  const score = data.wellness_score ?? 0
  if (prevScore != null && score < prevScore - 5) {
    fallback.push({ type: 'warning', message: `Wellness score dropped by ${prevScore - score} points recently.` })
  }
  return fallback
}

export function computeLoanDecisionSupport(data) {
  if (!data || data.insufficient_data) {
    return {
      insufficient: true,
      recommended_loan_limit: null,
      approval_confidence: null,
      approval_confidence_label: null,
      risk_assessment: 'Insufficient data available',
      stability_score: null,
    }
  }

  const support = data.decision_support ?? data.eligibility_impact?.decision_support
  if (support) {
    return {
      insufficient: false,
      recommended_loan_limit: support.recommended_loan_limit ?? null,
      approval_confidence: support.approval_confidence ?? null,
      approval_confidence_label: support.approval_confidence_label ?? null,
      risk_assessment: support.risk_assessment ?? formatCategory(data.score_category),
      stability_score: support.stability_score ?? null,
      recommended_loan_limit_basis: support.recommended_loan_limit_basis ?? null,
    }
  }

  return null
}

export function computeMilestones(data) {
  if (!hasWellnessData(data)) return []
  const milestones = []
  const streak = data.payment_streak ?? 0
  const score = data.wellness_score ?? 0
  const tier = getBorrowerTier(score)

  if (tier.tier !== 'platinum') {
    const nextTierScore = tier.tier === 'bronze' ? 60 : tier.tier === 'silver' ? 75 : 85
    milestones.push({ label: `${Math.max(0, nextTierScore - score)} points to reach ${getBorrowerTier(nextTierScore).label} tier`, progress: (score / nextTierScore) * 100 })
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
  if (!data || data.insufficient_data) {
    tips.push('Complete your borrower profile and submit a loan application to unlock personalized wellness insights.')
    return tips
  }
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

export function formatRepaymentHint(data) {
  const paid = data?.paid_installments
  const due = data?.total_due_installments
  if (paid != null && due != null && due > 0) {
    return `${paid} paid / ${due} due installments`
  }
  return 'Paid installments vs total due'
}

export function formatPaymentStreak(streak) {
  const n = Number(streak) || 0
  return n === 1 ? '1 month' : `${n} months`
}
