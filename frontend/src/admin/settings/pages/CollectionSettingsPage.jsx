import { Calendar, Users } from 'lucide-react'
import SettingsCategoryGate from '../components/SettingsCategoryGate.jsx'
import SettingsField from '../components/SettingsField.jsx'
import SettingsPageShell from '../components/SettingsPageShell.jsx'
import { SectionCard, SettingsLinkCard, ToggleSwitch, settingsInputClass } from '../components/SettingsPrimitives.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { useSettingsCategory } from '../context/SettingsCategoryContext.jsx'

const KEYS = ['collection_settings']

export default function CollectionSettingsPage() {
  return (
    <SettingsCategoryGate categoryId="collections">
      <CollectionSettingsContent />
    </SettingsCategoryGate>
  )
}

function CollectionSettingsContent() {
  const { readOnly } = useSettingsCategory()
  const { sections, patch } = useSettings()

  return (
    <SettingsPageShell breadcrumb={[{ label: 'Collection Settings' }]} saveKeys={KEYS}>
      <div className="grid gap-3 md:grid-cols-2">
        <SettingsLinkCard label="SOA Management" description="Generate, preview, and email statements of account." to="/admin/soa" />
        <SettingsLinkCard label="Collections Pipeline" description="Manage overdue accounts and collection workflow." to="/admin/collections" />
      </div>

      <SectionCard title="Due Date Configuration" icon={Calendar} subtitle="When payments are due each billing cycle.">
        <div className="grid min-w-0 gap-5 md:grid-cols-2">
          <SettingsField label="Due day of month" htmlFor="col-due" helper="Day of month when installments are due (1–28).">
            <input
              id="col-due"
              className={`w-full ${settingsInputClass}`}
              value={sections.collection_settings.due_day_of_month}
              onChange={(e) => patch('collection_settings', { due_day_of_month: Number(e.target.value || 1) })}
              inputMode="numeric"
              min={1}
              max={28}
              disabled={readOnly}
            />
          </SettingsField>
          <SettingsField label="Escalation days" htmlFor="col-esc" helper="Days overdue before escalation to senior collector.">
            <input
              id="col-esc"
              className={`w-full ${settingsInputClass}`}
              value={sections.collection_settings.escalation_days}
              onChange={(e) => patch('collection_settings', { escalation_days: Number(e.target.value || 0) })}
              inputMode="numeric"
              disabled={readOnly}
            />
          </SettingsField>
        </div>
      </SectionCard>

      <SectionCard title="Collector Assignment" icon={Users} subtitle="Rules for assigning accounts to collectors.">
        <ToggleSwitch
          label="Auto-assign collector"
          value={!!sections.collection_settings.auto_assign_collector}
          onChange={(v) => patch('collection_settings', { auto_assign_collector: v })}
          helper="Automatically assign new overdue accounts based on workload."
          disabled={readOnly}
        />
      </SectionCard>

      <SectionCard title="SOA Settings" icon={Calendar} subtitle="Statement of account automation.">
        <ToggleSwitch
          label="Auto-email SOA on generation"
          value={!!sections.collection_settings.soa_auto_email}
          onChange={(v) => patch('collection_settings', { soa_auto_email: v })}
          helper="Send SOA PDF to borrower when generated from SOA Management."
          disabled={readOnly}
        />
      </SectionCard>
    </SettingsPageShell>
  )
}
