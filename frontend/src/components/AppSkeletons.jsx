export function SkeletonLine({ className = '' }) {
  return <div className={`animate-pulse rounded bg-gray-200 dark:bg-[#1F2937] ${className}`} />
}

/** Lighter skeleton for borrower dashboard (fewer cards than admin). */
export function BorrowerDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonLine className="h-4 w-32" />
        <SkeletonLine className="h-8 w-56 max-w-full" />
        <SkeletonLine className="h-4 w-full max-w-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-[#1F2937] dark:bg-[#111827]">
            <SkeletonLine className="h-3 w-24" />
            <SkeletonLine className="mt-3 h-7 w-28" />
          </div>
        ))}
      </div>
      <SkeletonLine className="h-64 w-full rounded-2xl" />
    </div>
  )
}

export function AdminPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonLine className="h-7 w-48" />
        <SkeletonLine className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 shadow-md dark:border-[#1F2937] dark:bg-[#111827]">
            <SkeletonLine className="h-3 w-20" />
            <SkeletonLine className="mt-3 h-7 w-28" />
            <SkeletonLine className="mt-3 h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function DarkCardsSkeleton({ cards = 3 }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4">
          <SkeletonLine className="h-3 w-24 bg-white/10" />
          <SkeletonLine className="mt-3 h-7 w-28 bg-white/10" />
        </div>
      ))}
    </div>
  )
}

export function DarkTableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[720px] text-left">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-b border-white/5">
              {Array.from({ length: cols }).map((__, j) => (
                <td key={j} className="px-3 py-3">
                  <div className="h-3 w-full max-w-[8rem] animate-pulse rounded bg-white/10" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
