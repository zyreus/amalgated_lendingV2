/**
 * Borrower portal glass card — matches `surface-glass` / brand system in index.css.
 */
export default function PortalCard({
  title,
  subtitle,
  children,
  className = '',
  footer = null,
  padding = true,
  as: Comp = 'section',
}) {
  return (
    <Comp
      className={`surface-glass overflow-hidden rounded-2xl border border-black/[0.06] bg-white/90 shadow-soft backdrop-blur-xl transition-shadow duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[#111827]/80 dark:hover:shadow-[0_20px_50px_rgba(0,0,0,0.35)] ${className}`}
    >
      {title || subtitle ? (
        <header className="border-b border-black/[0.06] px-5 py-4 dark:border-white/10 sm:px-6">
          {title ? (
            <h2 className="heading-display text-lg font-semibold tracking-tight text-brand-text dark:text-gray-100">{title}</h2>
          ) : null}
          {subtitle ? <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
        </header>
      ) : null}
      <div className={padding ? 'p-5 sm:p-6' : ''}>{children}</div>
      {footer ? <footer className="border-t border-black/[0.06] bg-brand-background-alt/80 px-5 py-3 dark:border-white/10 dark:bg-[#0F172A]/50 sm:px-6">{footer}</footer> : null}
    </Comp>
  )
}
