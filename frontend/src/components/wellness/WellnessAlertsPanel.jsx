import { computeWellnessAlerts } from './wellnessUtils.js'

const ALERT_STYLES = {
  positive: 'border-emerald-500/25 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300',
  warning: 'border-amber-500/25 bg-amber-500/5 text-amber-800 dark:text-amber-300',
  urgent: 'border-red-500/25 bg-red-500/5 text-red-800 dark:text-red-300',
}

export default function WellnessAlertsPanel({ data, prevScore, title = 'Wellness alerts' }) {
  const alerts = computeWellnessAlerts(data, prevScore)
  if (!alerts.length) return null

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <ul className="space-y-2">
        {alerts.map((a, i) => (
          <li key={i} className={`rounded-lg border px-3 py-2 text-sm ${ALERT_STYLES[a.type] || ALERT_STYLES.warning}`}>
            {a.message}
          </li>
        ))}
      </ul>
    </section>
  )
}
