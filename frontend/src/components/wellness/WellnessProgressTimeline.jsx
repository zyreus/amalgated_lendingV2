import { CATEGORY_COLORS, formatCategory } from './wellnessUtils.js'

export default function WellnessProgressTimeline({ history = [] }) {
  if (!history.length) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Timeline will populate as your score is tracked over time.</p>
  }

  const sorted = [...history].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))

  return (
    <ol className="relative border-l border-gray-200 pl-6 dark:border-gray-700">
      {sorted.slice(-8).map((entry, i) => {
        const color = CATEGORY_COLORS[entry.category || entry.score_category] || CATEGORY_COLORS.fair
        const date = entry.recorded_at
          ? new Date(entry.recorded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
          : '—'
        return (
          <li key={`${entry.recorded_at}-${i}`} className="mb-5 ml-0 last:mb-0">
            <span
              className="absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-white dark:ring-[#0F172A]"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Score {entry.score}</span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${color}22`, color }}>
                {formatCategory(entry.category || entry.score_category)}
              </span>
            </div>
            <time className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{date}</time>
          </li>
        )
      })}
    </ol>
  )
}
