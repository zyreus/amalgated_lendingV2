import { starFillLevels, clampRating } from '../utils/feedbackRating.js'

const SIZE_CLASS = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-2xl sm:text-3xl',
}

function PartialStar({ fill, sizeClass, filledClass, emptyClass }) {
  const pct = `${Math.min(100, Math.max(0, fill * 100))}%`
  return (
    <span className={`relative inline-block leading-none ${sizeClass}`} aria-hidden>
      <span className={emptyClass}>★</span>
      <span className={`absolute left-0 top-0 overflow-hidden whitespace-nowrap ${filledClass}`} style={{ width: pct }}>
        ★
      </span>
    </span>
  )
}

/**
 * Renders 1–5 stars from any numeric rating (integer or decimal average).
 */
export default function StarRating({
  value,
  size = 'sm',
  filledClass = 'text-amber-400',
  emptyClass = 'text-gray-200',
  className = '',
  showValue = false,
  valueClassName = 'font-semibold tabular-nums text-amber-500',
}) {
  const rating = clampRating(value)
  const fills = starFillLevels(rating)
  const sizeClass = SIZE_CLASS[size] || SIZE_CLASS.sm
  const label = rating > 0 ? `${rating.toFixed(1)} out of 5 stars` : 'No rating'

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} aria-label={label}>
      {showValue && rating > 0 ? <span className={valueClassName}>{rating.toFixed(1)}</span> : null}
      <span className="inline-flex items-center gap-0.5">
        {fills.map((fill, index) => (
          <PartialStar
            key={index}
            fill={fill}
            sizeClass={sizeClass}
            filledClass={filledClass}
            emptyClass={emptyClass}
          />
        ))}
      </span>
    </span>
  )
}
