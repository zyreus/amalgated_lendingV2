import { BarChart3, Plug } from 'lucide-react'
import SettingsCategoryGate from '../components/SettingsCategoryGate.jsx'
import SettingsField from '../components/SettingsField.jsx'
import SettingsPageShell from '../components/SettingsPageShell.jsx'
import { SettingsAccordion, ToggleSwitch, settingsInputClass } from '../components/SettingsPrimitives.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { useSettingsCategory } from '../context/SettingsCategoryContext.jsx'

const KEYS = ['credit_scoring', 'reports', 'integrations']

export default function OperationsSettingsPage() {
  return (
    <SettingsCategoryGate categoryId="operations">
      <OperationsSettingsContent />
    </SettingsCategoryGate>
  )
}

function OperationsSettingsContent() {
  const { readOnly } = useSettingsCategory()
  const { sections, patch } = useSettings()

  return (
    <SettingsPageShell breadcrumb={[{ label: 'Reports & Integrations' }]} saveKeys={KEYS}>
      <SettingsAccordion title="Credit Scoring" subtitle="Automated risk labeling based on credit score." icon={BarChart3} defaultOpen>
        <div className="grid min-w-0 gap-5 md:grid-cols-2">
          <ToggleSwitch
            label="Enable credit scoring"
            value={!!sections.credit_scoring.enabled}
            onChange={(v) => patch('credit_scoring', { enabled: v })}
            helper="Use credit score to label risk level automatically."
            disabled={readOnly}
          />
          <SettingsField label="Base score" htmlFor="score-base">
            <input
              id="score-base"
              className={`w-full ${settingsInputClass}`}
              value={sections.credit_scoring.base_score}
              onChange={(e) => patch('credit_scoring', { base_score: Number(e.target.value || 0) })}
              inputMode="numeric"
              disabled={readOnly}
            />
          </SettingsField>
        </div>
      </SettingsAccordion>

      <SettingsAccordion title="Reports & Analytics" subtitle="Default date range and export options for dashboards." icon={BarChart3}>
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <SettingsField label="Default report range" htmlFor="rep-range" className="md:col-span-2">
            <select
              id="rep-range"
              className={`w-full ${settingsInputClass}`}
              value={sections.reports.default_range}
              onChange={(e) => patch('reports', { default_range: e.target.value })}
              disabled={readOnly}
            >
              <option value="today">Today</option>
              <option value="last_7_days">Last 7 days</option>
              <option value="last_30_days">Last 30 days</option>
              <option value="this_month">This month</option>
              <option value="this_year">This year</option>
            </select>
          </SettingsField>
          <ToggleSwitch label="Export PDF" value={!!sections.reports.export_pdf} onChange={(v) => patch('reports', { export_pdf: v })} disabled={readOnly} />
          <ToggleSwitch label="Export Excel" value={!!sections.reports.export_excel} onChange={(v) => patch('reports', { export_excel: v })} disabled={readOnly} />
          <ToggleSwitch
            label="Dashboard metrics"
            value={!!sections.reports.show_metrics}
            onChange={(v) => patch('reports', { show_metrics: v })}
            helper="Show KPI tiles on dashboard."
            disabled={readOnly}
          />
        </div>
      </SettingsAccordion>

      <SettingsAccordion title="Integrations" subtitle="CRM, chat, and external API keys." icon={Plug}>
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <ToggleSwitch
            label="CRM integration"
            value={!!sections.integrations.crm_enabled}
            onChange={(v) => patch('integrations', { crm_enabled: v })}
            disabled={readOnly}
          />
          <ToggleSwitch
            label="Chat system"
            value={!!sections.integrations.chat_enabled}
            onChange={(v) => patch('integrations', { chat_enabled: v })}
            helper="Enable chat modules and routing."
            disabled={readOnly}
          />
          <SettingsField
            label="API keys"
            helper="Stored encrypted in a future release. Avoid pasting secrets in production."
            htmlFor="int-keys"
            className="md:col-span-2"
          >
            <textarea
              id="int-keys"
              rows={4}
              className={`w-full font-mono text-xs ${settingsInputClass}`}
              value={sections.integrations.api_keys}
              onChange={(e) => patch('integrations', { api_keys: e.target.value })}
              placeholder="CRM_TOKEN=..."
              disabled={readOnly}
            />
          </SettingsField>
        </div>
      </SettingsAccordion>
    </SettingsPageShell>
  )
}
