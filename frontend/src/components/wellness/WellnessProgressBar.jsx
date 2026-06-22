export default function WellnessProgressBar({ value = 0, max = 100, color = '#10b981', label, showValue = true }) {
  const pct = Math.min(100, Math.max(0, (Number(value) / Number(max)) * 100))
  return (
    <div className="space-y-1">
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs">
          {label ? <span className="font-medium text-gray-600 dark:text-gray-400">{label}</span> : <span />}
          {showValue ? <span className="tabular-nums font-semibold text-gray-900 dark:text-gray-100">{Math.round(pct)}%</span> : null}
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
