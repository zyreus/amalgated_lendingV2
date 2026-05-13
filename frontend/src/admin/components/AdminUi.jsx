/**
 * Shared admin surfaces — use Tailwind `dark:` (class on `html` from AdminMuiProvider).
 * transition-colors duration-300 on interactive surfaces.
 */
export const admin = {
  /** Use full available content width; min-w-0 prevents flex/grid children from forcing horizontal overflow. */
  pageContainer: 'w-full min-w-0 max-w-full',
  shell:
    'bg-gray-100 text-gray-900 transition-colors duration-300 dark:bg-[#0F172A] dark:text-gray-100',
  textMuted: 'text-gray-500 transition-colors duration-300 dark:text-gray-400',
  card:
    'rounded-xl border border-gray-200 bg-white p-5 shadow-md transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-lg dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg dark:hover:shadow-xl',
  cardNoHover:
    'rounded-xl border border-gray-200 bg-white p-5 shadow-md transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg',
  chartCard:
    'rounded-xl border border-gray-200 bg-white p-4 shadow-md transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827] dark:p-4 dark:shadow-lg sm:p-6',
  btnPrimary:
    'touch-manipulation rounded-xl bg-[#DC2626] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition duration-200 hover:bg-red-700 hover:shadow-lg',
  btnSecondary:
    'touch-manipulation rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition duration-200 hover:bg-gray-100 dark:border-[#1F2937] dark:bg-[#1F2937] dark:text-gray-100 dark:hover:bg-gray-800',
  input:
    'rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition duration-300 placeholder:text-gray-500 focus:border-[#DC2626]/40 focus:ring-2 focus:ring-[#DC2626]/15 dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-100 dark:placeholder:text-gray-400',
  tableWrap:
    'w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] rounded-xl border border-gray-200 bg-white shadow-md transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg',
  /** Scroll strip only (e.g. inside an existing card). Always pair <table> with tableMin* — never min-w-full alone or columns squash on small screens. */
  tableScroll:
    'w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]',
  /** Apply to <table> — keep columns content-sized (avoid huge gaps on wide screens). */
  tableBase: 'w-full table-auto border-collapse text-left text-xs sm:text-sm',
  tableMin560: 'min-w-[560px]',
  tableMin640: 'min-w-[640px]',
  tableMin720: 'min-w-[720px]',
  tableMin800: 'min-w-[800px]',
  tableMin900: 'min-w-[900px]',
  /** th / td — tighter on xs phones */
  tableCell: 'px-2 py-2 sm:px-4 sm:py-3',
  thead:
    'border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wider text-gray-500 transition-colors duration-300 dark:border-[#1F2937] dark:text-gray-400',
  tbodyRow:
    'border-b border-gray-100 transition duration-150 even:bg-gray-50/80 hover:bg-gray-100 dark:border-[#1F2937]/50 dark:even:bg-[#0F172A]/35 dark:hover:bg-gray-800',
  pageTitle: 'text-2xl font-semibold tracking-tight text-gray-900 transition-colors duration-300 dark:text-gray-100',
  pageSubtitle: 'mt-1 text-sm text-gray-500 transition-colors duration-300 dark:text-gray-400',
  /** Primary cell text in data tables */
  tableText: 'text-gray-900 transition-colors duration-300 dark:text-gray-100',
  tableMuted: 'text-gray-500 transition-colors duration-300 dark:text-gray-400',
  /** Sub-panels inside cards (e.g. role picker) */
  insetPanel:
    'rounded-xl border border-gray-200 bg-gray-50 p-4 transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#0F172A]/50',
  modalOverlay:
    'fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/60 p-4 backdrop-blur-sm transition-colors duration-300 sm:items-center',
  modalCard:
    'w-full max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-2xl transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827]',
  paginationBtn:
    'rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 transition-colors duration-300 hover:bg-gray-100 disabled:opacity-40 dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-100 dark:hover:bg-[#1F2937]',
  filterInactive:
    'border border-gray-200 bg-white text-gray-600 transition-colors duration-300 hover:bg-gray-100 dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-100',
  filterActive: 'bg-[#DC2626] text-white shadow-md ring-1 ring-red-500/30',
}

export function TableSkeletonRows({ cols = 4, rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-gray-100 dark:border-[#1F2937]/40">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className={admin.tableCell}>
              <div className="h-4 w-full max-w-[12rem] animate-pulse rounded bg-gray-200 dark:bg-[#1F2937]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function EmptyTableRow({ colSpan, message = 'No data available.' }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className={`${admin.tableCell} py-10 text-center text-xs text-gray-500 transition-colors duration-300 dark:text-gray-400 sm:py-12 sm:text-sm`}
      >
        {message}
      </td>
    </tr>
  )
}

export function DashboardStatSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 shadow-md transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg"
        >
          <div className="h-3 w-24 rounded bg-gray-200 dark:bg-[#1F2937]" />
          <div className="mt-4 h-8 w-32 rounded bg-gray-200 dark:bg-[#1F2937]" />
          <div className="mt-2 h-3 w-20 rounded bg-gray-100 dark:bg-[#1F2937]/80" />
        </div>
      ))}
    </div>
  )
}
