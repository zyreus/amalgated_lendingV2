/**
 * Borrower portal sidebar — grouped for accordion navigation.
 */
export const BORROWER_DASHBOARD_NAV = {
  to: '/borrower/dashboard',
  label: 'Dashboard',
  icon_key: 'dashboard',
  match_end: true,
}

export const BORROWER_NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { to: '/borrower/credit-health', label: 'Credit & Wellness', icon_key: 'wellness' },
    ],
  },
  {
    id: 'loans',
    label: 'Loans',
    items: [
      { to: '/borrower/applications', label: 'Applications', icon_key: 'applications' },
      { to: '/borrower/apply-loan', label: 'Apply', icon_key: 'apply' },
    ],
  },
  {
    id: 'money',
    label: 'Money',
    items: [
      { to: '/borrower/payments', label: 'Payments', icon_key: 'payments' },
      { to: '/borrower/statements', label: 'Statements', icon_key: 'statements' },
    ],
  },
  {
    id: 'support',
    label: 'Support',
    items: [
      { to: '/borrower/chat', label: 'Live Chat', icon_key: 'chat' },
      { to: '/borrower/help', label: 'Help Center', icon_key: 'help' },
      { to: '/borrower/tickets', label: 'Tickets', icon_key: 'tickets' },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      { to: '/borrower/profile', label: 'Profile', icon_key: 'profile' },
      { to: '/borrower/settings/privacy', label: 'Privacy', icon_key: 'privacy' },
      { to: '/borrower/security', label: 'Password', icon_key: 'password' },
    ],
  },
]
