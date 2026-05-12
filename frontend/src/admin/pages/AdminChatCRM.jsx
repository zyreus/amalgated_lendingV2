import AdminChatDashboard from '../../pages/AdminChatDashboard.jsx'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'

/** Official Amalgated Lending Inc. — red & white enterprise CRM. */
const CRM_THEME = {
  '--admin-bg': '#fafafa',
  '--admin-sidebar': '#ffffff',
  '--admin-surface': '#ffffff',
  '--admin-surface-2': '#f4f4f5',
  '--admin-border': '#e4e4e7',
  '--admin-text': '#18181b',
  '--admin-muted': '#52525b',
  '--admin-muted-2': '#71717a',
  '--admin-warn-text': '#b45309',
  '--admin-success-text': '#047857',
  '--admin-danger-text': '#be123c',
  '--admin-neutral-text': '#52525b',
  '--admin-accent': '#DC2626',
  '--admin-accent-2': '#b91c1c',
  '--admin-ai-bg': '#fef2f2',
  '--admin-ai-text': '#7f1d1d',
  '--admin-ai-border': '#fecaca',
}

/**
 * Amalgated Lending Inc. — same Chat & CRM UI as Amalgated Holdings (AdminChatDashboard).
 * Requires Node chat API + Socket.IO (see VITE_CHAT_SERVER_URL).
 */
export default function AdminChatCRM() {
  const { can } = useAdminApiAuth()

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-bg)] shadow-[0_1px_3px_rgba(15,23,42,0.06),0_12px_40px_-12px_rgba(15,23,42,0.12)] transition-colors duration-300"
      style={CRM_THEME}
    >
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-[var(--admin-surface)] transition-colors duration-300">
        <AdminChatDashboard
          canViewAnalytics
          canManageLoans={can('loans.view')}
          canViewBorrowers={can('borrowers.view')}
          canAssignStaff={false}
        />
      </div>
    </div>
  )
}
