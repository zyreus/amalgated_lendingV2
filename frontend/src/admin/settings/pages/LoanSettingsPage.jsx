import { Landmark, Percent, AlertTriangle } from 'lucide-react'
import SettingsCategoryGate from '../components/SettingsCategoryGate.jsx'
import SettingsField from '../components/SettingsField.jsx'
import SettingsPageShell from '../components/SettingsPageShell.jsx'
import { SettingsAccordion, SettingsLinkCard, ToggleSwitch, settingsInputClass } from '../components/SettingsPrimitives.jsx'
import { useSettingsCategory } from '../context/SettingsCategoryContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { admin } from '../../components/AdminUi.jsx'
import PensionLoanRulesSettings from '../components/PensionLoanRulesSettings.jsx'
import PensionLoanDocumentRequirementsSettings from '../components/PensionLoanDocumentRequirementsSettings.jsx'
import TravelLoanDocumentRequirementsSettings from '../components/TravelLoanDocumentRequirementsSettings.jsx'

const KEYS = ['loan_defaults', 'loan_configuration', 'interest_settings']

export default function LoanSettingsPage() {
  return (
    <SettingsCategoryGate categoryId="loans">
      <LoanSettingsContent />
    </SettingsCategoryGate>
  )
}

function LoanSettingsContent() {
  const { readOnly } = useSettingsCategory()
  const { sections, patch, fieldError } = useSettings()

  return (
    <SettingsPageShell
      breadcrumb={[{ label: 'Loan Settings' }]}
      lead="Per-product fees and rates are managed in Loan Products."
      saveKeys={KEYS}
    >
      <SettingsLinkCard
        label="Loan Products"
        description="Service charges, insurance, notarial fees, and calculator config per product."
        to="/admin/loan-products"
      />

      <SettingsAccordion title="Loan Defaults" subtitle="Baseline amounts and rates for new applications." icon={Landmark} defaultOpen>
        <div className="grid min-w-0 gap-5 md:grid-cols-2">
          <SettingsField
            label="Default interest rate (%)"
            htmlFor="ld-ir"
            helper="Synced to backend as annual rate."
            error={fieldError('loan_defaults', 'interest_rate')}
          >
            <input
              id="ld-ir"
              className={`w-full ${settingsInputClass}`}
              value={sections.loan_defaults.interest_rate}
              onChange={(e) => patch('loan_defaults', { interest_rate: Number(e.target.value || 0) })}
              inputMode="decimal"
              disabled={readOnly}
            />
          </SettingsField>
          <SettingsField label="Max term (months)" htmlFor="ld-term" error={fieldError('loan_defaults', 'max_term_months')}>
            <input
              id="ld-term"
              className={`w-full ${settingsInputClass}`}
              value={sections.loan_defaults.max_term_months}
              onChange={(e) => patch('loan_defaults', { max_term_months: Number(e.target.value || 0) })}
              inputMode="numeric"
              disabled={readOnly}
            />
          </SettingsField>
          <SettingsField label="Minimum loan amount" htmlFor="ld-min" error={fieldError('loan_defaults', 'min_loan')}>
            <input
              id="ld-min"
              className={`w-full ${settingsInputClass}`}
              value={sections.loan_defaults.min_loan}
              onChange={(e) => patch('loan_defaults', { min_loan: Number(e.target.value || 0) })}
              inputMode="numeric"
              disabled={readOnly}
            />
          </SettingsField>
          <SettingsField label="Maximum loan amount" htmlFor="ld-max" error={fieldError('loan_defaults', 'max_loan')}>
            <input
              id="ld-max"
              className={`w-full ${settingsInputClass}`}
              value={sections.loan_defaults.max_loan}
              onChange={(e) => patch('loan_defaults', { max_loan: Number(e.target.value || 0) })}
              inputMode="numeric"
              disabled={readOnly}
            />
          </SettingsField>
        </div>
      </SettingsAccordion>

      <SettingsAccordion title="Loan Terms & Penalties" subtitle="Interest type, available terms, penalties, and grace period." icon={AlertTriangle}>
        <div className="grid min-w-0 gap-5 md:grid-cols-2">
          <SettingsField label="Interest type" htmlFor="lc-type" helper="Flat rate or diminishing balance." error={fieldError('loan_configuration', 'interest_type')}>
            <select
              id="lc-type"
              className={`w-full ${settingsInputClass}`}
              value={sections.loan_configuration.interest_type}
              onChange={(e) => patch('loan_configuration', { interest_type: e.target.value })}
              disabled={readOnly}
            >
              <option value="flat">Flat Rate</option>
              <option value="reducing_balance">Diminishing Balance</option>
            </select>
          </SettingsField>
          <SettingsField label="Loan terms (months)" htmlFor="lc-terms" helper="Comma-separated allowed terms." error={fieldError('loan_configuration', 'loan_terms_months')}>
            <input
              id="lc-terms"
              className={`w-full ${settingsInputClass}`}
              value={(sections.loan_configuration.loan_terms_months || []).join(', ')}
              onChange={(e) =>
                patch('loan_configuration', {
                  loan_terms_months: e.target.value
                    .split(',')
                    .map((x) => Number(x.trim()))
                    .filter((n) => Number.isFinite(n) && n > 0),
                })
              }
              placeholder="3, 6, 12"
              disabled={readOnly}
            />
          </SettingsField>
          <SettingsField label="Penalty rate (%)" htmlFor="lc-penalty" helper="Applied by overdue penalty job." error={fieldError('loan_configuration', 'penalty_rate')}>
            <input
              id="lc-penalty"
              className={`w-full ${settingsInputClass}`}
              value={sections.loan_configuration.penalty_rate}
              onChange={(e) => patch('loan_configuration', { penalty_rate: Number(e.target.value || 0) })}
              inputMode="decimal"
              disabled={readOnly}
            />
          </SettingsField>
          <SettingsField label="Grace period (days)" htmlFor="lc-grace" helper="Days after due date before penalties apply." error={fieldError('loan_configuration', 'grace_period_days')}>
            <input
              id="lc-grace"
              className={`w-full ${settingsInputClass}`}
              value={sections.loan_configuration.grace_period_days}
              onChange={(e) => patch('loan_configuration', { grace_period_days: Number(e.target.value || 0) })}
              inputMode="numeric"
              disabled={readOnly}
            />
          </SettingsField>
        </div>
      </SettingsAccordion>

      <PensionLoanRulesSettings readOnly={readOnly} />

      <PensionLoanDocumentRequirementsSettings readOnly={readOnly} />

      <TravelLoanDocumentRequirementsSettings readOnly={readOnly} />

      <SettingsAccordion title="Interest Computation" subtitle="Global interest calculation mode." icon={Percent}>
        <div className="grid min-w-0 gap-5 md:grid-cols-2">
          <SettingsField label="Mode" htmlFor="ir-mode" error={fieldError('interest_settings', 'mode')}>
            <select
              id="ir-mode"
              className={`w-full ${settingsInputClass}`}
              value={sections.interest_settings.mode}
              onChange={(e) => patch('interest_settings', { mode: e.target.value })}
              disabled={readOnly}
            >
              <option value="flat">Flat</option>
              <option value="reducing_balance">Reducing balance</option>
            </select>
          </SettingsField>
          <div className="md:col-span-2">
            <ToggleSwitch
              label="Compounding interest"
              value={!!sections.interest_settings.compounding}
              onChange={(v) => patch('interest_settings', { compounding: v })}
              helper="When enabled, interest accrues on unpaid interest balances."
              disabled={readOnly}
            />
          </div>
        </div>
        <p className={`text-xs ${admin.textMuted}`}>
          Per-product calculator config on Loan Products takes precedence for fee calculations.
        </p>
      </SettingsAccordion>
    </SettingsPageShell>
  )
}
