import AdminChatDashboard from '../../pages/AdminChatDashboard.jsx'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'

/** Amalgated Lending — restrained neutrals; accent for primary actions only. */
const CRM_THEME = {
  '--admin-bg': '#f1f5f9',
  '--admin-sidebar': '#f8fafc',
  '--admin-surface': '#ffffff',
  '--admin-surface-2': '#f1f5f9',
  '--admin-border': '#e2e8f0',
  '--admin-text': '#0f172a',
  '--admin-muted': '#475569',
  '--admin-muted-2': '#64748b',
  '--admin-warn-text': '#b45309',
  '--admin-success-text': '#047857',
  '--admin-danger-text': '#be123c',
  '--admin-neutral-text': '#475569',
  '--admin-accent': '#b91c1c',
  '--admin-accent-2': '#991b1b',
}

/**
 * Amalgated Lending — same Chat & CRM UI as Amalgated Holdings (AdminChatDashboard).
 * Requires Node chat API + Socket.IO (see VITE_CHAT_SERVER_URL).
 */
export default function AdminChatCRM() {
  const { logout, can } = useAdminApiAuth()

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-bg)] shadow-[0_1px_3px_rgba(15,23,42,0.06),0_12px_40px_-12px_rgba(15,23,42,0.12)] transition-colors duration-300"
      style={CRM_THEME}
    >
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-[var(--admin-surface)] transition-colors duration-300">
        <AdminChatDashboard
          onLogout={logout}
          canViewAnalytics
          canManageLoans={can('loans.view')}
          canViewBorrowers={can('borrowers.view')}
          canAssignStaff={can('users.view')}
        />
      </div>
    </div>
  )
}
