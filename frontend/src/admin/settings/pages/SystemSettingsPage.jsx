import { useState } from 'react'
import { Server, Database } from 'lucide-react'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import SettingsCategoryGate from '../components/SettingsCategoryGate.jsx'
import SettingsField from '../components/SettingsField.jsx'
import SettingsPageShell from '../components/SettingsPageShell.jsx'
import { SectionCard, ToggleSwitch, settingsInputClass } from '../components/SettingsPrimitives.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { useSettingsCategory } from '../context/SettingsCategoryContext.jsx'

const KEYS = ['system', 'log_cleanup']

export default function SystemSettingsPage() {
  return (
    <SettingsCategoryGate categoryId="system">
      <SystemSettingsContent />
    </SettingsCategoryGate>
  )
}

function SystemSettingsContent() {
  const { readOnly } = useSettingsCategory()
  const { sections, patch } = useSettings()
  const [confirmMaintenance, setConfirmMaintenance] = useState(false)

  const requestMaintenance = (value) => {
    if (readOnly) return
    if (value) setConfirmMaintenance(true)
    else patch('system', { maintenance_mode: false })
  }

  return (
    <SettingsPageShell breadcrumb={[{ label: 'System' }]} saveKeys={KEYS}>
      <SectionCard title="Maintenance Mode" icon={Server} subtitle="Temporarily restrict access during deployments.">
        <div className="space-y-5">
          <ToggleSwitch
            label="Maintenance mode"
            value={!!sections.system.maintenance_mode}
            onChange={requestMaintenance}
            helper="Non–super-admin users will be unable to use the platform when enabled."
            disabled={readOnly}
          />
          <SettingsField label="Backup frequency" htmlFor="sys-backup" helper="Schedule for automated database backups." className="max-w-xs">
            <select
              id="sys-backup"
              className={`w-full ${settingsInputClass}`}
              value={sections.system.backup_frequency || 'daily'}
              onChange={(e) => patch('system', { backup_frequency: e.target.value })}
              disabled={readOnly}
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </SettingsField>
        </div>
      </SectionCard>

      <SectionCard title="Data Retention" icon={Database} subtitle="Log cleanup schedule — consumed by the CleanupAdminLogs command.">
        <div className="grid min-w-0 gap-5 md:grid-cols-2">
          <ToggleSwitch
            label="Enable log cleanup"
            value={!!sections.log_cleanup.enabled}
            onChange={(v) => patch('log_cleanup', { enabled: v })}
            disabled={readOnly}
          />
          <SettingsField label="Retention (days)" htmlFor="log-retention">
            <input
              id="log-retention"
              className={`w-full ${settingsInputClass}`}
              value={sections.log_cleanup.retention_days}
              onChange={(e) => patch('log_cleanup', { retention_days: Number(e.target.value || 0) })}
              inputMode="numeric"
              disabled={readOnly}
            />
          </SettingsField>
          <SettingsField label="Cleanup frequency" htmlFor="log-freq">
            <select
              id="log-freq"
              className={`w-full ${settingsInputClass}`}
              value={sections.log_cleanup.frequency}
              onChange={(e) => patch('log_cleanup', { frequency: e.target.value })}
              disabled={readOnly}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </SettingsField>
          <ToggleSwitch
            label="Optimize tables after cleanup"
            value={!!sections.log_cleanup.optimize_tables}
            onChange={(v) => patch('log_cleanup', { optimize_tables: v })}
            disabled={readOnly}
          />
        </div>
      </SectionCard>

      <ConfirmModal
        open={confirmMaintenance}
        onClose={() => setConfirmMaintenance(false)}
        title="Enable maintenance mode?"
        description="Borrowers and staff (except super admins) will be unable to use the platform until maintenance mode is disabled."
        confirmLabel="Enable maintenance"
        tone="danger"
        onConfirm={() => patch('system', { maintenance_mode: true })}
      />
    </SettingsPageShell>
  )
}
