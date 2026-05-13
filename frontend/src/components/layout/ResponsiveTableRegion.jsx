/**
 * Accessible horizontal scroll wrapper for wide data tables.
 * Use inside cards: put <table className={admin.tableBase admin.tableMin720}> as child.
 */
export default function ResponsiveTableRegion({
  children,
  label = 'Scrollable table',
  className = '',
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={`table-scroll-region rounded-xl border border-gray-200/90 bg-white/80 shadow-sm dark:border-[#1F2937] dark:bg-[#111827]/80 ${className}`}
    >
      {children}
    </div>
  )
}
