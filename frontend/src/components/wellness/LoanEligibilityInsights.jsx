import { computeMilestones, getBorrowerTier } from './wellnessUtils.js'
import WellnessProgressBar from './WellnessProgressBar.jsx'

export default function LoanEligibilityInsights({ data }) {
  if (!data?.eligibility_impact) return null
  const impact = data.eligibility_impact
  const tier = getBorrowerTier(data.wellness_score)

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary">
          Current tier: {tier.label}
        </span>
        {impact.fast_track_eligible ? (
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            Fast-track eligible
          </span>
        ) : null}
        {impact.requires_manual_approval ? (
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
            Manual review required
          </span>
        ) : null}
      </div>
      {impact.loan_limit_multiplier != null && impact.loan_limit_multiplier !== 1 ? (
        <p className="text-gray-600 dark:text-gray-400">
          Estimated loan limit multiplier: <strong className="text-brand-text dark:text-white">{Number(impact.loan_limit_multiplier).toFixed(2)}×</strong>
        </p>
      ) : null}
      <p className="text-gray-600 dark:text-gray-400">
        Trust score boost: <strong className="text-brand-text dark:text-white">{impact.trust_score_boost ?? 0}</strong>
      </p>
    </div>
  )
}

export function UpcomingMilestones({ data }) {
  const milestones = computeMilestones(data)
  if (!milestones.length) return null

  return (
    <ul className="space-y-3">
      {milestones.map((m, i) => (
        <li key={i} className="rounded-xl border border-black/[0.06] bg-brand-background-alt/60 px-3 py-2.5 dark:border-white/10">
          <p className="text-sm text-gray-800 dark:text-gray-200">{m.label}</p>
          <div className="mt-2">
            <WellnessProgressBar value={m.progress} showValue={false} color="#6366f1" />
          </div>
        </li>
      ))}
    </ul>
  )
}
