export const APPLICATION_STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'pre-approved', label: 'Pre-Approved' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'completed', label: 'Completed' },
]

export function normalizeApplicationStatus(status) {
  const value = String(status || 'all').toLowerCase().replace(/_/g, '-')
  if (value === 'ongoing') return 'approved'
  return APPLICATION_STATUSES.some((s) => s.value === value) ? value : 'all'
}

export function applicationStatusLabel(status) {
  const normalized = normalizeApplicationStatus(status)
  return APPLICATION_STATUSES.find((s) => s.value === normalized)?.label || 'All'
}

export function applicationStatusBadgeClass(status) {
  switch (normalizeApplicationStatus(status)) {
    case 'pending':
      return 'bg-amber-100 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-900/35 dark:text-amber-100 dark:ring-amber-700/60'
    case 'pre-approved':
      return 'bg-blue-100 text-blue-900 ring-1 ring-blue-200 dark:bg-blue-900/35 dark:text-blue-100 dark:ring-blue-700/60'
    case 'approved':
      return 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-900/35 dark:text-emerald-100 dark:ring-emerald-700/60'
    case 'rejected':
      return 'bg-red-100 text-red-900 ring-1 ring-red-200 dark:bg-red-900/35 dark:text-red-100 dark:ring-red-700/60'
    case 'completed':
      return 'bg-gray-100 text-gray-800 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700'
    default:
      return 'bg-gray-100 text-gray-800 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700'
  }
}
