export const APPLICATION_STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending-documents', label: 'Pending Documents' },
  { value: 'for-evaluation', label: 'For Evaluation' },
  { value: 'under-review', label: 'Under Review' },
  { value: 'pending', label: 'Pending' },
  { value: 'partially-approved', label: 'Partially Approved' },
  { value: 'pre-approved', label: 'Partially Approved' },
  { value: 'approved', label: 'Approved' },
  { value: 'released', label: 'Released' },
  { value: 'ongoing', label: 'Released' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
]

const STATUS_ALIASES = {
  ongoing: 'released',
  'pre-approved': 'partially-approved',
  preapproved: 'partially-approved',
  for_evaluation: 'for-evaluation',
  under_review: 'under-review',
  pending_documents: 'pending-documents',
}

export function normalizeApplicationStatus(status) {
  const raw = String(status || 'all').toLowerCase().replace(/_/g, '-')
  const value = STATUS_ALIASES[raw] || raw
  if (value === 'ongoing') return 'released'
  return APPLICATION_STATUSES.some((s) => s.value === value) ? value : 'all'
}

export function applicationStatusLabel(status) {
  const normalized = normalizeApplicationStatus(status)
  const match = APPLICATION_STATUSES.find((s) => s.value === normalized)
  if (match) return match.label
  if (normalized === 'released') return 'Released'
  if (normalized === 'partially-approved') return 'Partially Approved'
  return String(status || 'All')
}

export function applicationStatusBadgeClass(status) {
  switch (normalizeApplicationStatus(status)) {
    case 'draft':
      return 'bg-slate-100 text-slate-800 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700'
    case 'pending-documents':
      return 'bg-orange-100 text-orange-900 ring-1 ring-orange-200 dark:bg-orange-900/35 dark:text-orange-100 dark:ring-orange-700/60'
    case 'for-evaluation':
    case 'under-review':
    case 'pending':
      return 'bg-amber-100 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-900/35 dark:text-amber-100 dark:ring-amber-700/60'
    case 'partially-approved':
      return 'bg-blue-100 text-blue-900 ring-1 ring-blue-200 dark:bg-blue-900/35 dark:text-blue-100 dark:ring-blue-700/60'
    case 'approved':
      return 'bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200 dark:bg-indigo-900/35 dark:text-indigo-100 dark:ring-indigo-700/60'
    case 'released':
      return 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-900/35 dark:text-emerald-100 dark:ring-emerald-700/60'
    case 'rejected':
      return 'bg-red-100 text-red-900 ring-1 ring-red-200 dark:bg-red-900/35 dark:text-red-100 dark:ring-red-700/60'
    case 'cancelled':
      return 'bg-gray-100 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700'
    case 'completed':
      return 'bg-gray-100 text-gray-800 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700'
    default:
      return 'bg-gray-100 text-gray-800 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700'
  }
}

export function formatCurrencyPhp(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}

export function computeApprovalPercentage(requested, approved) {
  const req = Number(requested)
  const app = Number(approved)
  if (!Number.isFinite(req) || req <= 0 || !Number.isFinite(app)) return null
  return Math.round((app / req) * 10000) / 100
}

export function computeLtv(marketValue, approvedAmount) {
  const mv = Number(marketValue)
  const ap = Number(approvedAmount)
  if (!Number.isFinite(mv) || mv <= 0 || !Number.isFinite(ap)) return null
  return Math.round((ap / mv) * 10000) / 100
}
