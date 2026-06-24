import { computeLoanDecisionSupport } from './wellnessUtils.js'

export default function LoanDecisionSupport({ data }) {
  const support = computeLoanDecisionSupport(data)
  if (!support) return null

  if (support.insufficient) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
        Insufficient data available to compute loan decision support metrics.
      </div>
    )
  }

  const items = [
    {
      label: 'Recommended loan limit',
      value: support.recommended_loan_limit != null ? `₱${Number(support.recommended_loan_limit).toLocaleString()}` : '—',
    },
    {
      label: 'Approval confidence',
      value: support.approval_confidence != null
        ? `${support.approval_confidence}% (${support.approval_confidence_label || '—'})`
        : '—',
    },
    { label: 'Risk assessment', value: support.risk_assessment || '—' },
    {
      label: 'Borrower stability score',
      value: support.stability_score != null ? `${support.stability_score}/100` : '—',
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-gray-200/80 bg-gray-50/50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900/30">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{item.label}</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{item.value}</p>
        </div>
      ))}
    </div>
  )
}
