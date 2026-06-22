import { computeFinancialTips } from './wellnessUtils.js'

export default function FinancialTips({ data }) {
  const tips = computeFinancialTips(data)
  return (
    <ul className="space-y-2">
      {tips.map((tip, i) => (
        <li
          key={i}
          className="flex gap-2 rounded-xl border border-brand-primary/15 bg-brand-primary/5 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300"
        >
          <span className="shrink-0 text-brand-primary" aria-hidden>💡</span>
          {tip}
        </li>
      ))}
    </ul>
  )
}
