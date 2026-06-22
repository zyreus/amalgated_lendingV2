import { ACHIEVEMENT_DEFS, computeAchievements } from './wellnessUtils.js'

export default function AchievementBadges({ data, compact = false }) {
  const earned = computeAchievements(data)
  const allIds = Object.keys(ACHIEVEMENT_DEFS)

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {earned.map((a) => (
          <span
            key={a.id}
            title={a.desc}
            className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-semibold text-brand-primary"
          >
            <span aria-hidden>{a.icon}</span>
            {a.label}
          </span>
        ))}
        {earned.length === 0 ? (
          <span className="text-xs text-gray-500 dark:text-gray-400">No badges earned yet</span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {allIds.map((id) => {
        const def = ACHIEVEMENT_DEFS[id]
        const isEarned = earned.some((e) => e.id === id)
        return (
          <div
            key={id}
            className={`rounded-xl border p-3 transition ${
              isEarned
                ? 'border-brand-primary/25 bg-brand-primary/5 dark:border-brand-primary/30'
                : 'border-gray-200/80 bg-gray-50/50 opacity-50 dark:border-gray-700 dark:bg-gray-900/30'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className={`text-lg ${isEarned ? 'text-brand-primary' : 'text-gray-400'}`} aria-hidden>
                {def.icon}
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{def.label}</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{def.desc}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
