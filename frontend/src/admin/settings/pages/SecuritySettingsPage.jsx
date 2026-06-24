import { useState } from 'react'
import { Shield, FileSearch } from 'lucide-react'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import SettingsCategoryGate from '../components/SettingsCategoryGate.jsx'
import SettingsField from '../components/SettingsField.jsx'
import SettingsPageShell from '../components/SettingsPageShell.jsx'
import { SectionCard, SettingsLinkCard, ToggleSwitch, settingsInputClass } from '../components/SettingsPrimitives.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { useSettingsCategory } from '../context/SettingsCategoryContext.jsx'

const KEYS = ['security', 'audit']

export default function SecuritySettingsPage() {
  return (
    <SettingsCategoryGate categoryId="security">
      <SecuritySettingsContent />
    </SettingsCategoryGate>
  )
}

function SecuritySettingsContent() {
  const { readOnly } = useSettingsCategory()
  const { sections, patch, fieldError } = useSettings()
  const [confirm2fa, setConfirm2fa] = useState(false)
  const [pending2fa, setPending2fa] = useState(null)

  const request2faChange = (value) => {
    if (readOnly) return
    if (value) {
      setPending2fa(true)
      setConfirm2fa(true)
    } else {
      patch('security', { two_factor_enabled: false })
    }
  }

  return (
    <SettingsPageShell breadcrumb={[{ label: 'Security' }]} saveKeys={KEYS}>
      <SettingsLinkCard label="Activity Logs" description="View full audit trail and login history." to="/admin/activity" />

      <SectionCard title="Login & Password Policies" icon={Shield} subtitle="Enforced on admin login, session timeout, and staff password creation.">
        <div className="grid min-w-0 gap-5 md:grid-cols-2">
          <SettingsField label="Password minimum length" htmlFor="sec-passlen" error={fieldError('security', 'password_min_length')}>
            <input
              id="sec-passlen"
              className={`w-full ${settingsInputClass}`}
              value={sections.security.password_min_length}
              onChange={(e) => patch('security', { password_min_length: Number(e.target.value || 0) })}
              inputMode="numeric"
              min={8}
              disabled={readOnly}
            />
          </SettingsField>
          <SettingsField label="Max login attempts" htmlFor="sec-attempts" helper="Before account lockout." error={fieldError('security', 'max_login_attempts')}>
            <input
              id="sec-attempts"
              className={`w-full ${settingsInputClass}`}
              value={sections.security.max_login_attempts}
              onChange={(e) => patch('security', { max_login_attempts: Number(e.target.value || 0) })}
              inputMode="numeric"
              disabled={readOnly}
            />
          </SettingsField>
          <SettingsField label="Session timeout (minutes)" htmlFor="sec-timeout" error={fieldError('security', 'session_timeout_minutes')}>
            <input
              id="sec-timeout"
              className={`w-full ${settingsInputClass}`}
              value={sections.security.session_timeout_minutes}
              onChange={(e) => patch('security', { session_timeout_minutes: Number(e.target.value || 0) })}
              inputMode="numeric"
              disabled={readOnly}
            />
          </SettingsField>
          <div className="md:col-span-2">
            <ToggleSwitch
              label="Two-factor authentication (2FA)"
              value={!!sections.security.two_factor_enabled}
              onChange={request2faChange}
              helper="Requires 2FA for all admin accounts when enabled."
              disabled={readOnly}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Audit & Activity Monitoring" icon={FileSearch} subtitle="Control what is recorded in activity logs.">
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <ToggleSwitch
            label="Settings change tracking"
            value={!!sections.audit.change_tracking_enabled}
            onChange={(v) => patch('audit', { change_tracking_enabled: v })}
            helper="Record who changed settings and when."
            disabled={readOnly}
          />
          <ToggleSwitch
            label="Login history"
            value={!!sections.audit.login_history_enabled}
            onChange={(v) => patch('audit', { login_history_enabled: v })}
            disabled={readOnly}
          />
          <div className="md:col-span-2">
            <ToggleSwitch
              label="User activity logs"
              value={!!sections.audit.activity_logs_enabled}
              onChange={(v) => patch('audit', { activity_logs_enabled: v })}
              disabled={readOnly}
            />
          </div>
        </div>
      </SectionCard>

      <ConfirmModal
        open={confirm2fa}
        onClose={() => {
          setConfirm2fa(false)
          setPending2fa(null)
        }}
        title="Enable two-factor authentication?"
        description="All admin users will be required to set up 2FA on next login. Ensure your team is prepared before enabling."
        confirmLabel="Enable 2FA"
        tone="danger"
        onConfirm={() => patch('security', { two_factor_enabled: pending2fa })}
      />
    </SettingsPageShell>
  )
}
