export default function TrendIndicator({ trend, className = '' }) {
  const t = String(trend || 'stable').toLowerCase()
  const config = {
    improving: { icon: '↑', label: 'Improving', color: 'text-emerald-600 dark:text-emerald-400' },
    declining: { icon: '↓', label: 'Declining', color: 'text-red-600 dark:text-red-400' },
    stable: { icon: '→', label: 'Stable', color: 'text-gray-500 dark:text-gray-400' },
  }
  const c = config[t] || config.stable
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${c.color} ${className}`}>
      <span aria-hidden>{c.icon}</span>
      {c.label}
    </span>
  )
}
