/**
 * Compact KPI tile for borrower + marketing-style dashboards.
 */
export default function KpiStat({ label, value, hint, trend, className = '' }) {
  const trendUp = trend > 0
  const trendDown = trend < 0
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-black/[0.06] bg-gradient-to-br from-white to-brand-background-alt/90 p-5 shadow-sm dark:border-white/10 dark:from-[#111827] dark:to-[#0F172A] ${className}`}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand-primary/10 blur-2xl" aria-hidden />
      <p className="font-accent text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-primary">{label}</p>
      <p className="heading-display mt-2 text-2xl font-bold tracking-tight text-brand-text dark:text-white sm:text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p> : null}
      {trend != null && trend !== 0 ? (
        <p
          className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
            trendUp ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : trendDown ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'
          }`}
        >
          {trendUp ? '↑' : trendDown ? '↓' : '—'} {Math.abs(trend)}%
        </p>
      ) : null}
    </div>
  )
}
