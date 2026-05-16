export function BorrowerPageHeader({ eyebrow = 'Borrower', title, description, actions = null }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="font-accent text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-primary">{eyebrow}</p>
        <h1 className="heading-display mt-1 text-2xl font-bold tracking-tight text-brand-text dark:text-white sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}
