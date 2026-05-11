/**
 * Pill styles for RBAC roles — keep in sync across Users table and sidebar.
 * Slugs match Laravel `roles.slug` (e.g. super-admin, loan-officer).
 */
export const ADMIN_ROLE_BADGE = {
  'super-admin': 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-500/35',
  'loan-officer': 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-500/35',
  collector:
    'bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200 dark:bg-fuchsia-950/35 dark:text-fuchsia-200 dark:ring-fuchsia-500/35',
  borrower:
    'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-500/35',
  accountant:
    'bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-500/35',
}

export const ADMIN_ROLE_BADGE_FALLBACK =
  'bg-gray-50 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-600'

const SORT_RANK = {
  'super-admin': 0,
  'loan-officer': 2,
  accountant: 3,
  collector: 4,
  borrower: 10,
}

/** @param {{ id?: number, slug?: string, name?: string }[]} roles */
export function sortRolesForDisplay(roles) {
  if (!Array.isArray(roles)) return []
  return [...roles].sort((a, b) => {
    const sa = String(a?.slug || '')
    const sb = String(b?.slug || '')
    const ra = SORT_RANK[sa] ?? 5
    const rb = SORT_RANK[sb] ?? 5
    if (ra !== rb) return ra - rb
    return String(a?.name || '').localeCompare(String(b?.name || ''))
  })
}
