import { Link } from 'react-router-dom'
import LoanProductIcon from './LoanProductIcon.jsx'
import { tierAccentClass, tierCardClass, tierIconWrapClass } from './loanProductStyles.js'
import { loanProductApplyPath } from '../../utils/loanProductApplyPath.js'

function shortDesc(text, max = 120) {
  if (!text) return ''
  const t = String(text).trim()
  return t.length <= max ? t : `${t.slice(0, max).trim()}…`
}

export default function LoanProductCard({
  product,
  compact = false,
  showApply = true,
}) {
  const tier = product.tier || 'blue'
  const rateLabel =
    product.rate_type === 'fixed'
      ? `${Number(product.interest_rate).toFixed(2)}% (fixed)`
      : `${Number(product.interest_rate).toFixed(2)}% / month`
  const applySlug = product.apply_slug || product.slug
  const detailsSlug = product.display_slug || product.slug

  return (
    <article
      id={detailsSlug}
      className={`group flex h-full flex-col rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1 sm:p-6 ${tierCardClass(tier)}`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105 ${tierIconWrapClass(tier)}`}
        >
          <LoanProductIcon iconKey={product.icon_key} className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold tracking-tight text-brand-text dark:text-white">{product.name}</h3>
          <p className={`mt-1 text-sm font-semibold ${tierAccentClass(tier)}`}>{rateLabel}</p>
        </div>
      </div>
      <p className="mt-4 flex-1 text-sm leading-relaxed text-brand-text/80 dark:text-white/80">
        {compact ? shortDesc(product.description) : product.description}
      </p>
      {Array.isArray(product.features) && product.features.length ? (
        <ul className="mt-4 grid gap-2 text-xs font-semibold text-brand-text/75 dark:text-white/75">
          {product.features.slice(0, 4).map((feature) => (
            <li key={feature} className="rounded-full bg-white/65 px-3 py-1.5 ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10">
              {feature}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          to={`/loan-products/${detailsSlug}`}
          className="inline-flex flex-1 min-w-[8rem] items-center justify-center rounded-xl border border-brand-primary/30 bg-white/80 px-4 py-2.5 text-sm font-semibold text-brand-primary shadow-sm transition hover:bg-brand-primary hover:text-white dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:bg-brand-primary"
        >
          View Details
        </Link>
        {showApply ? (
          <Link
            to={loanProductApplyPath(applySlug)}
            className="inline-flex flex-1 min-w-[8rem] items-center justify-center gap-1 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-brand-primary transition hover:bg-brand-primary-hover"
          >
            Apply Now
            <span className="transition group-hover:translate-x-1">-&gt;</span>
          </Link>
        ) : null}
      </div>
    </article>
  )
}
