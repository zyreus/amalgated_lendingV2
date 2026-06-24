import { Users, Shield, Activity } from 'lucide-react'
import { admin } from '../../components/AdminUi.jsx'
import SettingsPageShell from '../components/SettingsPageShell.jsx'
import { SectionCard, SettingsLinkCard } from '../components/SettingsPrimitives.jsx'
import SettingsCategoryGate from '../components/SettingsCategoryGate.jsx'

export default function UserManagementHubPage() {
  return (
    <SettingsCategoryGate categoryId="users">
      <SettingsPageShell breadcrumb={[{ label: 'User Management' }]}>
        <SectionCard
          title="Users & Access"
          icon={Users}
          subtitle="User and role management is configured on separate pages for full CRUD support."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <SettingsLinkCard label="Users" description="Create, edit, and deactivate staff accounts." to="/admin/users" />
            <SettingsLinkCard label="Roles & Permissions" description="Define roles and assign granular permissions." to="/admin/roles" />
            <SettingsLinkCard label="Activity Logs" description="View audit trail, logins, and system events." to="/admin/activity" />
          </div>
        </SectionCard>

        <SectionCard title="Security policies" icon={Shield} subtitle="Password and login policies are configured under Security settings.">
          <SettingsLinkCard
            label="Login & Password Policies"
            description="Session timeout, login attempts, password rules, and 2FA."
            to="/admin/settings/security"
          />
        </SectionCard>

        <SectionCard title="Monitoring" icon={Activity} subtitle="Track who changed settings and when.">
          <p className={`text-sm ${admin.textMuted}`}>
            All settings changes are logged with the modifier and timestamp. View the full history in Activity Logs.
          </p>
        </SectionCard>
      </SettingsPageShell>
    </SettingsCategoryGate>
  )
}
