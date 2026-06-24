import { Building2, Globe } from 'lucide-react'
import { admin } from '../../components/AdminUi.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import SettingsField from '../components/SettingsField.jsx'
import SettingsPageShell from '../components/SettingsPageShell.jsx'
import { SectionCard, settingsInputClass } from '../components/SettingsPrimitives.jsx'
import SettingsCategoryGate from '../components/SettingsCategoryGate.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { useSettingsCategory } from '../context/SettingsCategoryContext.jsx'

const KEYS = ['company', 'locale']

function GeneralSettingsContent() {
  const { showToast } = useToast()
  const { readOnly } = useSettingsCategory()
  const { sections, patch, fieldError } = useSettings()

  return (
    <SettingsPageShell breadcrumb={[{ label: 'General' }]} saveKeys={KEYS}>
      <SectionCard
        id="company"
        title="Company Information"
        icon={Building2}
        subtitle="Brand identity and contact details shown on documents and emails."
        right={
          <button
            type="button"
            onClick={() => showToast('Logo upload UI only (wire storage endpoint next).', 'success')}
            className={admin.btnSecondary}
            disabled={readOnly}
          >
            Upload logo
          </button>
        }
      >
        <div className="grid min-w-0 gap-5 md:grid-cols-2">
          <SettingsField label="Company name" htmlFor="company-name" helper="Legal or trade name on official documents." required error={fieldError('company', 'company_name')}>
            <input
              id="company-name"
              className={`w-full ${settingsInputClass}`}
              value={sections.company.company_name}
              onChange={(e) => patch('company', { company_name: e.target.value })}
              disabled={readOnly}
            />
          </SettingsField>
          <SettingsField label="Email address" htmlFor="company-email" error={fieldError('company', 'email_address')}>
            <input
              id="company-email"
              type="email"
              className={`w-full ${settingsInputClass}`}
              value={sections.company.email_address}
              onChange={(e) => patch('company', { email_address: e.target.value })}
              placeholder="support@yourdomain.com"
              disabled={readOnly}
            />
          </SettingsField>
          <SettingsField label="Address" htmlFor="company-address" className="md:col-span-2" error={fieldError('company', 'address')}>
            <input
              id="company-address"
              className={`w-full ${settingsInputClass}`}
              value={sections.company.address}
              onChange={(e) => patch('company', { address: e.target.value })}
              placeholder="Street, City, Province"
              disabled={readOnly}
            />
          </SettingsField>
          <SettingsField label="Contact number" htmlFor="company-contact" error={fieldError('company', 'contact_number')}>
            <input
              id="company-contact"
              className={`w-full ${settingsInputClass}`}
              value={sections.company.contact_number}
              onChange={(e) => patch('company', { contact_number: e.target.value })}
              placeholder="+63 9XX XXX XXXX"
              disabled={readOnly}
            />
          </SettingsField>
          <SettingsField label="Business hours" htmlFor="company-hours" helper="Shown on borrower portal and contact pages." error={fieldError('company', 'business_hours')}>
            <input
              id="company-hours"
              className={`w-full ${settingsInputClass}`}
              value={sections.company.business_hours}
              onChange={(e) => patch('company', { business_hours: e.target.value })}
              disabled={readOnly}
            />
          </SettingsField>
          <SettingsField
            label="Branches"
            helper="Comma-separated branch names for multi-branch assignment."
            htmlFor="company-branches"
            className="md:col-span-2"
          >
            <input
              id="company-branches"
              className={`w-full ${settingsInputClass}`}
              value={(sections.company.branches || []).join(', ')}
              onChange={(e) =>
                patch('company', { branches: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })
              }
              placeholder="Davao City, Tagum, General Santos"
              disabled={readOnly}
            />
          </SettingsField>
        </div>
      </SectionCard>

      <SectionCard id="locale" title="Timezone & Locale" icon={Globe} subtitle="Regional formatting for dates, currency, and language.">
        <div className="grid min-w-0 gap-5 md:grid-cols-2">
          <SettingsField label="Timezone" htmlFor="locale-tz" required error={fieldError('locale', 'timezone')}>
            <select
              id="locale-tz"
              className={`w-full ${settingsInputClass}`}
              value={sections.locale.timezone}
              onChange={(e) => patch('locale', { timezone: e.target.value })}
              disabled={readOnly}
            >
              <option value="Asia/Manila">Asia/Manila (PHT)</option>
              <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
              <option value="UTC">UTC</option>
            </select>
          </SettingsField>
          <SettingsField label="Date format" htmlFor="locale-date" required error={fieldError('locale', 'date_format')}>
            <select
              id="locale-date"
              className={`w-full ${settingsInputClass}`}
              value={sections.locale.date_format}
              onChange={(e) => patch('locale', { date_format: e.target.value })}
              disabled={readOnly}
            >
              <option value="MMM d, yyyy">Jan 1, 2026</option>
              <option value="dd/MM/yyyy">01/01/2026</option>
              <option value="yyyy-MM-dd">2026-01-01</option>
            </select>
          </SettingsField>
          <SettingsField label="Currency display" htmlFor="locale-currency" required error={fieldError('locale', 'currency_display')}>
            <input
              id="locale-currency"
              className={`w-full ${settingsInputClass}`}
              value={sections.locale.currency_display}
              onChange={(e) => patch('locale', { currency_display: e.target.value })}
              disabled={readOnly}
            />
          </SettingsField>
          <SettingsField label="Language" htmlFor="locale-lang" required error={fieldError('locale', 'language')}>
            <select
              id="locale-lang"
              className={`w-full ${settingsInputClass}`}
              value={sections.locale.language}
              onChange={(e) => patch('locale', { language: e.target.value })}
              disabled={readOnly}
            >
              <option value="en">English</option>
              <option value="fil">Filipino</option>
            </select>
          </SettingsField>
        </div>
      </SectionCard>
    </SettingsPageShell>
  )
}

export default function GeneralSettingsPage() {
  return (
    <SettingsCategoryGate categoryId="general">
      <GeneralSettingsContent />
    </SettingsCategoryGate>
  )
}
