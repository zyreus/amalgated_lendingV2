/**
 * Re-exports skeleton primitives used across admin/borrower tables and pages.
 */
export {
  SkeletonLine,
  BorrowerDashboardSkeleton,
  AdminPageSkeleton,
  DarkCardsSkeleton,
  DarkTableSkeleton,
} from '../AppSkeletons.jsx'

export { TableSkeletonRows, DashboardStatSkeleton, EmptyTableRow } from '../../admin/components/AdminUi.jsx'

/** Friendly empty state for data tables and lists. */
export function EmptyState({
  title = 'No records found',
  description = 'There is nothing to show yet.',
  action = null,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/80 px-6 py-12 text-center dark:border-[#374151] dark:bg-[#111827]/40 ${className}`}
    >
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
