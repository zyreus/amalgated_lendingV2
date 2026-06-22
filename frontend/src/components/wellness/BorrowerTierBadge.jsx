import { getBorrowerTier } from './wellnessUtils.js'

export default function BorrowerTierBadge({ score, showLabel = true }) {
  const tier = getBorrowerTier(score)
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tier.bg}`}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tier.color }} aria-hidden />
      {showLabel ? tier.label : tier.tier}
    </span>
  )
}
