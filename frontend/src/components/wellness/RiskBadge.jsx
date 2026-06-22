import { RISK_CONFIG } from './wellnessUtils.js'

export default function RiskBadge({ level, size = 'sm' }) {
  const key = String(level || 'low').toLowerCase()
  const cfg = RISK_CONFIG[key] || RISK_CONFIG.low
  const pad = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${pad} ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden />
      {cfg.label} Risk
    </span>
  )
}
