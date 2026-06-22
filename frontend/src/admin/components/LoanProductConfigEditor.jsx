import { useMemo, useState } from 'react'
import { admin } from './AdminUi.jsx'
import {
  COMPUTATION_STYLE_OPTIONS,
  FEE_PROFILE_OPTIONS,
  formToCalculatorConfig,
  formToRulesConfig,
  inferFeeProfile,
} from '../utils/loanProductConfigSchema.js'

function Section({ title, hint, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={admin.insetPanel}>
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
          {hint ? <p className={`mt-0.5 text-xs ${admin.textMuted}`}>{hint}</p> : null}
        </div>
        <span className={`shrink-0 text-xs font-semibold text-brand-primary ${open ? '' : ''}`}>
          {open ? 'Hide' : 'Show'}
        </span>
      </button>
      {open ? <div className="mt-4 space-y-3">{children}</div> : null}
    </div>
  )
}

function Field({ label, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label className={`block text-xs font-medium ${admin.textMuted}`}>{label}</label>
      {children}
      {hint ? <p className={`mt-1 text-[11px] leading-relaxed ${admin.textMuted}`}>{hint}</p> : null}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, inputClass }) {
  return (
    <input
      className={`mt-1 w-full ${inputClass}`}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}

function SelectInput({ value, onChange, options, inputClass }) {
  return (
    <select className={`mt-1 w-full ${inputClass}`} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

function ExtraKeysPanel({ extra, onChangeExtra }) {
  const keys = Object.keys(extra || {})
  if (!keys.length) return null
  return (
    <Section title="Additional settings (preserved)" hint="These values were saved previously and are kept when you save." defaultOpen={false}>
      <p className={`text-xs ${admin.textMuted}`}>
        Contact IT if you need to change fields not listed above. Values below are kept as-is.
      </p>
      <pre className="mt-2 max-h-40 overflow-auto rounded-xl border border-gray-200 bg-white p-3 text-[11px] text-gray-700 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-300">
        {JSON.stringify(extra, null, 2)}
      </pre>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-semibold text-brand-primary">Edit additional JSON</summary>
        <textarea
          className={`mt-2 w-full font-mono text-xs ${admin.input}`}
          rows={5}
          defaultValue={JSON.stringify(extra, null, 2)}
          onBlur={(e) => {
            try {
              const parsed = JSON.parse(e.target.value || '{}')
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) onChangeExtra(parsed)
            } catch {
              // keep previous extra on invalid JSON
            }
          }}
        />
      </details>
    </Section>
  )
}

/**
 * User-friendly editor for loan product calculator_config and rules objects.
 */
export default function LoanProductConfigEditor({
  embedded = false,
  slug = '',
  calculatorConfig,
  rulesConfig,
  calcExtra,
  rulesExtra,
  onCalculatorChange,
  onRulesChange,
  onCalcExtraChange,
  onRulesExtraChange,
}) {
  const [showExpert, setShowExpert] = useState(false)
  const profile = useMemo(() => inferFeeProfile(calculatorConfig, slug), [calculatorConfig, slug])

  const setCalc = (key, value) => onCalculatorChange({ ...calculatorConfig, [key]: value })
  const setRule = (key, value) => onRulesChange({ ...rulesConfig, [key]: value })

  const showPension = profile === 'pension' || Boolean(calculatorConfig.pension_multiplier)
  const showTravel = profile === 'travel'
  const showSalary = profile === 'salary' || Boolean(calculatorConfig.salary_principal_multiplier)
  const showAppliance = profile === 'appliance'
  const showMortgage = profile === 'mortgage'
  const serviceFixed = rulesConfig.service_charge_mode === 'fixed'

  const previewCalc = useMemo(
    () => formToCalculatorConfig(calculatorConfig, calcExtra),
    [calculatorConfig, calcExtra],
  )
  const previewRules = useMemo(
    () => formToRulesConfig(rulesConfig, rulesExtra),
    [rulesConfig, rulesExtra],
  )

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-4 border-t border-gray-200 pt-4 dark:border-[#1F2937]'}>
      {!embedded ? (
        <div>
          <p className={admin.modalEyebrow}>Calculator & fees</p>
          <p className={`mt-1 text-sm ${admin.textMuted}`}>
            Configure how the public calculator and loan approval engine compute fees. Amounts are in PHP unless noted as a percentage.
          </p>
        </div>
      ) : (
        <p className={`text-sm ${admin.textMuted}`}>
          Set calculator behavior and fee formulas. Percentages are entered as whole numbers (e.g. 3.5 for 3.5%).
        </p>
      )}

      <Section title="Calculator behavior" hint="How loan amounts and monthly payments are estimated on the website.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Product type (fee profile)" hint="Helps show the right fields and presets.">
            <SelectInput
              value={calculatorConfig.fee_profile}
              onChange={(v) => setCalc('fee_profile', v)}
              options={FEE_PROFILE_OPTIONS}
              inputClass={admin.input}
            />
          </Field>
          <Field label="Monthly payment style">
            <SelectInput
              value={calculatorConfig.computation_style || 'straight_line'}
              onChange={(v) => setCalc('computation_style', v)}
              options={COMPUTATION_STYLE_OPTIONS}
              inputClass={admin.input}
            />
          </Field>
        </div>

        {showPension ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Pension multiplier" hint="Max loan ≈ monthly pension × this number (e.g. 18.75).">
              <TextInput
                value={calculatorConfig.pension_multiplier}
                onChange={(v) => setCalc('pension_multiplier', v)}
                inputClass={admin.input}
              />
            </Field>
            <Field label="Max principal cap (PHP)">
              <TextInput
                value={calculatorConfig.max_principal}
                onChange={(v) => setCalc('max_principal', v)}
                inputClass={admin.input}
              />
            </Field>
          </div>
        ) : null}

        {showSalary ? (
          <Field label="Salary multiplier" hint="Max loan ≈ monthly salary × this number (e.g. 6).">
            <TextInput
              value={calculatorConfig.salary_principal_multiplier}
              onChange={(v) => setCalc('salary_principal_multiplier', v)}
              inputClass={admin.input}
            />
          </Field>
        ) : null}

        {showTravel ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Min loan amount (PHP)">
              <TextInput value={calculatorConfig.min_principal} onChange={(v) => setCalc('min_principal', v)} inputClass={admin.input} />
            </Field>
            <Field label="Max loan amount (PHP)">
              <TextInput value={calculatorConfig.max_principal} onChange={(v) => setCalc('max_principal', v)} inputClass={admin.input} />
            </Field>
            <Field label="Fixed term (months)" hint="Travel loans often use 1 (monthly renewal).">
              <TextInput value={calculatorConfig.fixed_term_months} onChange={(v) => setCalc('fixed_term_months', v)} inputClass={admin.input} />
            </Field>
          </div>
        ) : null}

        {!showPension && !showTravel ? (
          <Field label="Max principal cap (PHP)" hint="Optional ceiling used by the public calculator.">
            <TextInput value={calculatorConfig.max_principal} onChange={(v) => setCalc('max_principal', v)} inputClass={admin.input} />
          </Field>
        ) : null}
      </Section>

      <Section title="Service charge" hint="Processing / service fee applied to the loan.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Charge type">
            <SelectInput
              value={rulesConfig.service_charge_mode || 'percent'}
              onChange={(v) => setRule('service_charge_mode', v)}
              options={[
                { value: 'percent', label: 'Percentage of loan amount' },
                { value: 'fixed', label: 'Fixed amount (PHP)' },
              ]}
              inputClass={admin.input}
            />
          </Field>
          {!serviceFixed ? (
            <Field label="Service charge rate (%)" hint="Example: enter 3.5 for 3.5% of the loan amount.">
              <TextInput
                value={rulesConfig.service_charge_rate}
                onChange={(v) => setRule('service_charge_rate', v)}
                placeholder="3.5"
                inputClass={admin.input}
              />
            </Field>
          ) : (
            <Field label="Fixed service charge — new loan (PHP)">
              <TextInput
                value={rulesConfig.service_charge_fixed_new}
                onChange={(v) => setRule('service_charge_fixed_new', v)}
                inputClass={admin.input}
              />
            </Field>
          )}
        </div>
        {serviceFixed ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fixed service charge — reloan (PHP)">
              <TextInput
                value={rulesConfig.service_charge_fixed_reloan}
                onChange={(v) => setRule('service_charge_fixed_reloan', v)}
                inputClass={admin.input}
              />
            </Field>
          </div>
        ) : null}
      </Section>

      <Section title="Insurance & doc stamp" defaultOpen={!showPension}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Insurance calculation">
            <SelectInput
              value={rulesConfig.insurance_mode || 'per_1000_plus_fixed'}
              onChange={(v) => setRule('insurance_mode', v)}
              options={[
                { value: 'per_1000_plus_fixed', label: 'Per ₱1,000 + fixed amount' },
                { value: 'percent', label: 'Percentage of loan amount' },
                { value: 'fixed', label: 'Fixed amount only' },
              ]}
              inputClass={admin.input}
            />
          </Field>
          {rulesConfig.insurance_mode === 'percent' ? (
            <Field label="Insurance rate (%)" hint="Example: 3.5 for 3.5%.">
              <TextInput value={rulesConfig.insurance_rate} onChange={(v) => setRule('insurance_rate', v)} inputClass={admin.input} />
            </Field>
          ) : (
            <>
              <Field label="Insurance per ₱1,000" hint="Usually 35 for mortgage products.">
                <TextInput value={rulesConfig.insurance_per_1000} onChange={(v) => setRule('insurance_per_1000', v)} inputClass={admin.input} />
              </Field>
              <Field label="Insurance fixed amount (PHP)">
                <TextInput value={rulesConfig.insurance_fixed} onChange={(v) => setRule('insurance_fixed', v)} inputClass={admin.input} />
              </Field>
            </>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Doc stamp — per ₱200 multiplier" hint="Common: 1.5 (loan ÷ 200 × 1.5). Leave blank if using rate below.">
            <TextInput value={rulesConfig.doc_stamp_per_200} onChange={(v) => setRule('doc_stamp_per_200', v)} inputClass={admin.input} />
          </Field>
          <Field label="Doc stamp — decimal rate (%)" hint="Alternative: 0.75 for 0.75% of loan. Used when per-₱200 is not set.">
            <TextInput value={rulesConfig.doc_stamp_rate_decimal} onChange={(v) => setRule('doc_stamp_rate_decimal', v)} inputClass={admin.input} />
          </Field>
        </div>
      </Section>

      <Section title="Notarial & other fees">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Notarial fee — new loan (PHP)">
            <TextInput value={rulesConfig.notarial_fee_new} onChange={(v) => setRule('notarial_fee_new', v)} inputClass={admin.input} />
          </Field>
          <Field label="Notarial fee — reloan (PHP)">
            <TextInput value={rulesConfig.notarial_fee_reloan} onChange={(v) => setRule('notarial_fee_reloan', v)} inputClass={admin.input} />
          </Field>
        </div>

        {(showMortgage || showTravel) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {showMortgage ? (
              <>
                <Field label="Mortgage fee rate (%)" hint="Example: 2 for 2% of loan amount.">
                  <TextInput value={rulesConfig.mortgage_fee_rate} onChange={(v) => setRule('mortgage_fee_rate', v)} inputClass={admin.input} />
                </Field>
                <Field label="Mortgage fee threshold (PHP)" hint="Fee applies when loan amount is at least this value. Use 0 to always apply.">
                  <TextInput value={rulesConfig.mortgage_fee_threshold} onChange={(v) => setRule('mortgage_fee_threshold', v)} inputClass={admin.input} />
                </Field>
                <Field label="Re-loan fee (PHP)" hint="Extra fee for mortgage reloans. Usually 0.">
                  <TextInput value={rulesConfig.re_loan_fee} onChange={(v) => setRule('re_loan_fee', v)} inputClass={admin.input} />
                </Field>
              </>
            ) : null}
            {showTravel ? (
              <Field label="Opening account fee (PHP)" hint="Client-shouldered Landbank account opening (e.g. 10000).">
                <TextInput value={rulesConfig.opening_account_fee} onChange={(v) => setRule('opening_account_fee', v)} inputClass={admin.input} />
              </Field>
            ) : null}
          </div>
        )}

        <Field label="Miscellaneous fees deducted from loan proceeds?">
          <SelectInput
            value={rulesConfig.miscellaneous_deducted_from_proceeds || ''}
            onChange={(v) => setRule('miscellaneous_deducted_from_proceeds', v)}
            options={[
              { value: '', label: 'Use product default' },
              { value: 'yes', label: 'Yes — deducted from proceeds' },
              { value: 'no', label: 'No — one-time / client-shouldered' },
            ]}
            inputClass={admin.input}
          />
        </Field>
      </Section>

      {showPension ? (
        <Section title="Pension loan specifics" defaultOpen={false}>
          <p className={`text-xs ${admin.textMuted}`}>
            Fixed service charges and notarial amounts can differ for SSS vs GSIS and new vs reloan applications.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Service charge — new SSS (PHP)">
              <TextInput value={rulesConfig.service_charge_fixed_nw_sss} onChange={(v) => setRule('service_charge_fixed_nw_sss', v)} inputClass={admin.input} />
            </Field>
            <Field label="Service charge — new GSIS (PHP)">
              <TextInput value={rulesConfig.service_charge_fixed_nw_gsis} onChange={(v) => setRule('service_charge_fixed_nw_gsis', v)} inputClass={admin.input} />
            </Field>
            <Field label="Service charge — reloan SSS (PHP)">
              <TextInput value={rulesConfig.service_charge_fixed_rl_sss} onChange={(v) => setRule('service_charge_fixed_rl_sss', v)} inputClass={admin.input} />
            </Field>
            <Field label="Service charge — reloan GSIS (PHP)">
              <TextInput value={rulesConfig.service_charge_fixed_rl_gsis} onChange={(v) => setRule('service_charge_fixed_rl_gsis', v)} inputClass={admin.input} />
            </Field>
            <Field label="Notarial — new SSS (PHP)">
              <TextInput value={rulesConfig.notarial_fee_nw_sss} onChange={(v) => setRule('notarial_fee_nw_sss', v)} inputClass={admin.input} />
            </Field>
            <Field label="Notarial — new GSIS (PHP)">
              <TextInput value={rulesConfig.notarial_fee_nw_gsis} onChange={(v) => setRule('notarial_fee_nw_gsis', v)} inputClass={admin.input} />
            </Field>
            <Field label="Notarial — reloan SSS (PHP)">
              <TextInput value={rulesConfig.notarial_fee_rl_sss} onChange={(v) => setRule('notarial_fee_rl_sss', v)} inputClass={admin.input} />
            </Field>
            <Field label="Notarial — reloan GSIS (PHP)">
              <TextInput value={rulesConfig.notarial_fee_rl_gsis} onChange={(v) => setRule('notarial_fee_rl_gsis', v)} inputClass={admin.input} />
            </Field>
            <Field label="Pension retention threshold (PHP)">
              <TextInput value={rulesConfig.pension_retention_threshold} onChange={(v) => setRule('pension_retention_threshold', v)} inputClass={admin.input} />
            </Field>
            <Field label="Default pension system">
              <SelectInput
                value={rulesConfig.default_pension_system || 'sss'}
                onChange={(v) => setRule('default_pension_system', v)}
                options={[
                  { value: 'sss', label: 'SSS' },
                  { value: 'gsis', label: 'GSIS' },
                ]}
                inputClass={admin.input}
              />
            </Field>
          </div>
        </Section>
      ) : null}

      {showAppliance ? (
        <Section title="Appliance / retail downpayment" defaultOpen={false}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Outside office downpayment (%)" hint="Example: 15 for 15% of SRP.">
              <TextInput value={rulesConfig.outside_office_downpayment_rate} onChange={(v) => setRule('outside_office_downpayment_rate', v)} inputClass={admin.input} />
            </Field>
            <Field label="In-office downpayment (%)">
              <TextInput value={rulesConfig.in_office_downpayment_rate} onChange={(v) => setRule('in_office_downpayment_rate', v)} inputClass={admin.input} />
            </Field>
            <Field label="Default purchase channel">
              <SelectInput
                value={rulesConfig.default_purchase_channel || 'outside_office'}
                onChange={(v) => setRule('default_purchase_channel', v)}
                options={[
                  { value: 'outside_office', label: 'Outside office (with downpayment)' },
                  { value: 'in_office', label: 'In office' },
                ]}
                inputClass={admin.input}
              />
            </Field>
          </div>
        </Section>
      ) : null}

      <ExtraKeysPanel extra={calcExtra} onChangeExtra={onCalcExtraChange} />
      <ExtraKeysPanel extra={rulesExtra} onChangeExtra={onRulesExtraChange} />

      <div>
        <button
          type="button"
          className={`text-xs font-semibold text-brand-primary underline-offset-2 hover:underline`}
          onClick={() => setShowExpert((v) => !v)}
        >
          {showExpert ? 'Hide technical JSON preview' : 'Show technical JSON preview'}
        </button>
        {showExpert ? (
          <div className="mt-2 grid gap-3 lg:grid-cols-2">
            <div>
              <p className={`mb-1 text-[11px] font-semibold uppercase ${admin.textMuted}`}>Calculator config</p>
              <pre className="max-h-48 overflow-auto rounded-xl border border-gray-200 bg-white p-3 text-[11px] dark:border-[#1F2937] dark:bg-[#0F172A]">
                {JSON.stringify(previewCalc, null, 2)}
              </pre>
            </div>
            <div>
              <p className={`mb-1 text-[11px] font-semibold uppercase ${admin.textMuted}`}>Rules</p>
              <pre className="max-h-48 overflow-auto rounded-xl border border-gray-200 bg-white p-3 text-[11px] dark:border-[#1F2937] dark:bg-[#0F172A]">
                {JSON.stringify(previewRules, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
