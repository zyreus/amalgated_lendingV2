import { getLoanRecommendation, LOAN_RECOMMENDATION } from './wellnessUtils.js'

export default function LoanRecommendationEngine({ data }) {
  const rec = getLoanRecommendation(data)
  const cfg = LOAN_RECOMMENDATION[rec]

  return (
    <div className={`rounded-xl border-2 px-4 py-3 ${cfg.className}`}>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/60 text-lg font-bold dark:bg-black/20" aria-hidden>
          {cfg.icon}
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Loan Recommendation</p>
          <p className="text-base font-bold">{cfg.label}</p>
        </div>
      </div>
    </div>
  )
}
