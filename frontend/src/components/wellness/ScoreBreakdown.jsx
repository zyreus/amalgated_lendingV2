import { CATEGORY_COLORS, computeScoreBreakdown } from './wellnessUtils.js'
import WellnessProgressBar from './WellnessProgressBar.jsx'

export default function ScoreBreakdown({ data }) {
  const items = computeScoreBreakdown(data)
  if (!items.length) return null

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <WellnessProgressBar
          key={item.label}
          label={`${item.label} (${item.weight}% weight)`}
          value={item.value}
          color={CATEGORY_COLORS.excellent}
        />
      ))}
    </div>
  )
}
