import { CreditCard } from 'lucide-react'
import { admin } from '../../components/AdminUi.jsx'
import SettingsCategoryGate from '../components/SettingsCategoryGate.jsx'
import SettingsField from '../components/SettingsField.jsx'
import SettingsPageShell from '../components/SettingsPageShell.jsx'
import { SectionCard, ToggleSwitch, settingsInputClass } from '../components/SettingsPrimitives.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { useSettingsCategory } from '../context/SettingsCategoryContext.jsx'

const KEYS = ['payment_settings']

export default function FinancialSettingsPage() {
  return (
    <SettingsCategoryGate categoryId="financial">
      <FinancialSettingsContent />
    </SettingsCategoryGate>
  )
}

function FinancialSettingsContent() {
  const { readOnly } = useSettingsCategory()
  const { sections, patch } = useSettings()

  return (
    <SettingsPageShell breadcrumb={[{ label: 'Financial Settings' }]} saveKeys={KEYS}>
      <SectionCard title="Payment Methods" icon={CreditCard} subtitle="Accepted payment channels for borrower repayments.">
        <div className="grid min-w-0 gap-5 md:grid-cols-2">
          <SettingsField label="Currency" htmlFor="pay-cur" helper="ISO currency code for display and reports.">
            <input
              id="pay-cur"
              className={`w-full ${settingsInputClass}`}
              value={sections.payment_settings.currency}
              onChange={(e) => patch('payment_settings', { currency: e.target.value })}
              disabled={readOnly}
            />
          </SettingsField>
          <SettingsField label="Payment methods" htmlFor="pay-methods" helper="Comma-separated: cash, bank_transfer, gcash, maya.">
            <input
              id="pay-methods"
              className={`w-full ${settingsInputClass}`}
              value={(sections.payment_settings.methods || []).join(', ')}
              onChange={(e) =>
                patch('payment_settings', {
                  methods: e.target.value.split(',').map((x) => x.trim()).filter(Boolean),
                })
              }
              placeholder="cash, bank_transfer, gcash"
              disabled={readOnly}
            />
          </SettingsField>
          <div className="min-w-0 md:col-span-2">
            <ToggleSwitch
              label="Require proof of payment"
              value={!!sections.payment_settings.require_proof}
              onChange={(v) => patch('payment_settings', { require_proof: v })}
              helper="Borrowers must upload a receipt for non-cash methods."
              disabled={readOnly}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Official Receipt Settings" icon={CreditCard} subtitle="OR numbering is configured per payment on the Payments page.">
        <p className={`text-sm ${admin.textMuted}`}>
          Transaction number formats and official receipt sequences will be configurable here in a future release.
          For now, OR numbers are assigned when recording payments under Payments.
        </p>
      </SectionCard>
    </SettingsPageShell>
  )
}
