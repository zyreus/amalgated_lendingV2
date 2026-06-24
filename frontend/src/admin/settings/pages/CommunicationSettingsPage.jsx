import { Bell, Mail, MessageCircle } from 'lucide-react'
import { admin } from '../../components/AdminUi.jsx'
import WebsiteChatNotificationSettings from '../../components/WebsiteChatNotificationSettings.jsx'
import WebsiteChatVisitorLimitSettings from '../../components/WebsiteChatVisitorLimitSettings.jsx'
import EmailDiagnosticsPanel from '../components/EmailDiagnosticsPanel.jsx'
import SettingsCategoryGate from '../components/SettingsCategoryGate.jsx'
import SettingsField from '../components/SettingsField.jsx'
import SettingsPageShell from '../components/SettingsPageShell.jsx'
import { SectionCard, SettingsAccordion, ToggleSwitch, settingsInputClass } from '../components/SettingsPrimitives.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { useSettingsCategory } from '../context/SettingsCategoryContext.jsx'

const KEYS = ['notifications', 'email_settings']

export default function CommunicationSettingsPage() {
  return (
    <SettingsCategoryGate categoryId="communication">
      <CommunicationSettingsContent />
    </SettingsCategoryGate>
  )
}

function CommunicationSettingsContent() {
  const { readOnly } = useSettingsCategory()
  const { sections, patch, fieldError } = useSettings()

  return (
    <SettingsPageShell breadcrumb={[{ label: 'Communication' }]} saveKeys={KEYS}>
      <SettingsAccordion title="Notification Channels" subtitle="Enable or disable outbound communication channels." icon={Bell} defaultOpen>
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <ToggleSwitch
            label="Email notifications"
            value={!!sections.notifications.email_enabled}
            onChange={(v) => patch('notifications', { email_enabled: v })}
            helper="Send emails for application events and reminders."
            disabled={readOnly}
          />
          <ToggleSwitch
            label="SMS notifications"
            value={!!sections.notifications.sms_enabled}
            onChange={(v) => patch('notifications', { sms_enabled: v })}
            helper="Requires SMS gateway integration."
            disabled={readOnly}
          />
          <div className="md:col-span-2">
            <ToggleSwitch
              label="Auto-send"
              value={!!sections.notifications.auto_send}
              onChange={(v) => patch('notifications', { auto_send: v })}
              helper="Send templates automatically without manual approval."
              disabled={readOnly}
            />
          </div>
          <div className="min-w-0 md:col-span-2">
            <SettingsField
              label="Payment reminder days"
              htmlFor="reminder-days"
              helper="Days before due date to send reminders (comma-separated)."
              error={fieldError('notifications', 'reminder_days')}
            >
              <input
                id="reminder-days"
                className={`w-full ${settingsInputClass}`}
                value={(sections.notifications.reminder_days || []).join(', ')}
                onChange={(e) =>
                  patch('notifications', {
                    reminder_days: e.target.value
                      .split(',')
                      .map((x) => Number(x.trim()))
                      .filter((n) => Number.isFinite(n) && n > 0),
                  })
                }
                placeholder="1, 3, 7"
                disabled={readOnly}
              />
            </SettingsField>
          </div>
        </div>
      </SettingsAccordion>

      <SettingsAccordion title="Email SMTP & Templates" subtitle="SMTP status, delivery tools, and template subjects." icon={Mail}>
        <EmailDiagnosticsPanel
          emailSettings={sections.email_settings}
          onPatchEmailSettings={(partial) => patch('email_settings', partial)}
          readOnly={readOnly}
        />
      </SettingsAccordion>

      <SectionCard title="Website Chat Notifications" icon={MessageCircle} subtitle="In-app, sound, and browser alerts for visitor messages.">
        <WebsiteChatNotificationSettings />
        <div className="mt-6 border-t border-gray-200 pt-6 dark:border-[#1F2937]">
          <WebsiteChatVisitorLimitSettings />
        </div>
        <p className={`mt-4 text-xs ${admin.textMuted}`}>
          Chat notification preferences auto-save separately and are stored per admin user.
        </p>
      </SectionCard>
    </SettingsPageShell>
  )
}
