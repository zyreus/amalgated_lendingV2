/**
 * Admin sidebar structure — grouped for clarity. Items filtered by permission in AdminLayout.
 */
export const ADMIN_NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { to: '/admin', end: true, label: 'Dashboard', perm: 'dashboard.view', icon_key: 'dash' },
    ],
  },
  {
    id: 'lending',
    label: 'Lending',
    items: [
      { to: '/admin/borrowers', label: 'Borrowers', perm: 'borrowers.view', icon_key: 'borrowers' },
      { to: '/admin/loan-products', label: 'Loan products', perm: 'loans.view', icon_key: 'products' },
      { to: '/admin/printable-forms', label: 'Printable PDF forms', perm: 'forms.printable.manage', icon_key: 'forms' },
      { to: '/admin/underwriting-queue', label: 'Underwriting queue', perm: 'loans.view', icon_key: 'loans' },
      { to: '/admin/document-verification', label: 'Document verification', perm: 'loans.view', icon_key: 'forms' },
      { to: '/admin/loans', label: 'Applications', perm: 'loans.view', icon_key: 'loans' },
      { to: '/admin/payments', label: 'Payments', perm: 'payments.manage', icon_key: 'pay' },
      { to: '/admin/collections', label: 'Collections', perm: 'payments.manage', icon_key: 'pay' },
    ],
  },
  {
    id: 'risk',
    label: 'Risk & analytics',
    items: [
      { to: '/admin/risk-analytics', label: 'Risk analytics', perm: 'reports.view', icon_key: 'report' },
      { to: '/admin/credit-wellness', label: 'Credit & wellness', perm: 'reports.view', icon_key: 'report' },
      { to: '/admin/compliance', label: 'Compliance', perm: 'activity.view', icon_key: 'activity' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { to: '/admin/reports', label: 'Reports', perm: 'reports.view', icon_key: 'report' },
      { to: '/admin/chat-crm', label: 'CRM & Chat', perm: null, icon_key: 'chat' },
      { to: '/admin/feedback', label: 'Feedback', perm: null, icon_key: 'bell' },
      { to: '/admin/newsletter', label: 'News & announcements', perm: 'cms.manage', icon_key: 'bell' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { to: '/admin/users', label: 'Users', perm: 'users.view', icon_key: 'users' },
      { to: '/admin/roles', label: 'Roles & permissions', perm: 'roles.manage', icon_key: 'roles' },
      { to: '/admin/settings', label: 'Settings', perm: 'settings.manage', icon_key: 'settings' },
      { to: '/admin/activity', label: 'Activity logs', perm: 'activity.view', icon_key: 'activity' },
    ],
  },
]
