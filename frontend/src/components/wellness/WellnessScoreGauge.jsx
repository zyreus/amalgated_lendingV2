import { CATEGORY_COLORS, formatCategory } from './wellnessUtils.js'

export default function WellnessScoreGauge({ score = 0, category, size = 'md', animated = true }) {
  const s = Math.min(100, Math.max(0, Number(score) || 0))
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.fair
  const pct = Math.min(100, Math.max(8, s))
  const dim = size === 'sm' ? 'h-24 w-24' : size === 'lg' ? 'h-44 w-44' : 'h-36 w-36'
  const textSize = size === 'sm' ? 'text-xl' : size === 'lg' ? 'text-4xl' : 'text-3xl'

  return (
    <div
      className={`relative flex ${dim} items-center justify-center rounded-full p-1 shadow-inner transition-all duration-700 ${animated ? 'animate-[pulse_3s_ease-in-out_infinite]' : ''}`}
      style={{
        background: `conic-gradient(from 210deg, ${color} 0%, ${color} ${pct}%, #f1f5f9 ${pct}%, #f1f5f9 100%)`,
      }}
      role="img"
      aria-label={`Wellness score ${s} out of 100, ${formatCategory(category)}`}
    >
      <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white dark:bg-[#0F172A]">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Score</span>
        <span className={`heading-display font-bold text-brand-text dark:text-white ${textSize}`}>{Math.round(s)}</span>
        <span className="mt-0.5 text-[10px] font-medium text-brand-primary">{formatCategory(category)}</span>
      </div>
    </div>
  )
}
