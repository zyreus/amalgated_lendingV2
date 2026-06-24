/**
 * Admin sidebar structure — grouped for accordion navigation.
 * Items filtered by permission in AdminLayout.
 */
export const ADMIN_DASHBOARD_NAV = {
  to: '/admin/dashboard',
  label: 'Dashboard',
  perm: 'dashboard.view',
  icon_key: 'dash',
  match_end: true,
}

export const ADMIN_NAV_GROUPS = [
  {
    id: 'lending',
    label: 'Lending',
    items: [
      { to: '/admin/borrowers', label: 'Borrowers', perm: 'borrowers.view', icon_key: 'borrowers' },
      { to: '/admin/loan-products', label: 'Loan Products', perm: 'loans.view', icon_key: 'products' },
      { to: '/admin/printable-forms', label: 'Printable PDF Forms', perm: 'forms.printable.manage', icon_key: 'forms' },
      { to: '/admin/applications', end: true, label: 'Applications', perm: 'loans.view', icon_key: 'loans' },
      { to: '/admin/payments', label: 'Payments', perm: 'payments.manage', icon_key: 'pay' },
      { to: '/admin/collections', label: 'Collections', perm: 'payments.manage', icon_key: 'collections' },
      { to: '/admin/collector-wellness', label: 'Collector Wellness', perm: 'payments.manage', icon_key: 'wellness' },
      { to: '/admin/soa', label: 'SOA Management', perm: 'soa.view', icon_key: 'soa' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { to: '/admin/reports', label: 'Reports', perm: 'reports.view', icon_key: 'reports' },
      { to: '/admin/credit-wellness', label: 'Credit & Wellness', perm: 'reports.view', icon_key: 'wellness' },
      { to: '/admin/chat-crm', label: 'CRM & Chat', perm: null, icon_key: 'chat' },
      { to: '/admin/feedback', label: 'Feedback', perm: null, icon_key: 'feedback' },
      { to: '/admin/newsletter', label: 'News & Announcements', perm: 'cms.manage', icon_key: 'news' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { to: '/admin/users', label: 'Users', perm: 'users.view', icon_key: 'users' },
      { to: '/admin/roles', label: 'Roles & Permissions', perm: 'roles.manage', icon_key: 'roles' },
      { to: '/admin/settings', label: 'Settings', perm: 'settings.view', icon_key: 'settings' },
      { to: '/admin/activity', label: 'Activity Logs', perm: 'activity.view', icon_key: 'activity' },
    ],
  },
  {
    id: 'archive',
    label: 'Archive',
    items: [
      { to: '/admin/borrowers/archived', label: 'Archived Borrowers', perm: 'borrowers.view', icon_key: 'archive' },
      { to: '/admin/applications/archived', label: 'Archived Applications', perm: 'loans.view', icon_key: 'archiveApps' },
    ],
  },
]
