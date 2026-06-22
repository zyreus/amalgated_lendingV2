/** Known calculator_config keys managed by the admin form. */
export const CALCULATOR_CONFIG_KEYS = new Set([
  'fee_profile',
  'computation_style',
  'pension_multiplier',
  'max_principal',
  'min_principal',
  'salary_principal_multiplier',
  'opening_account_fee',
  'fixed_term_months',
  'insurance_per_1000',
  'notarial_new_loan',
  'service_charge_new_loan',
])

/** Known rules keys managed by the admin form. */
export const RULES_KEYS = new Set([
  'service_charge_mode',
  'service_charge_rate',
  'service_charge_fixed_new',
  'service_charge_fixed_reloan',
  'service_charge_fixed_nw_sss',
  'service_charge_fixed_nw_gsis',
  'service_charge_fixed_rl_sss',
  'service_charge_fixed_rl_gsis',
  'insurance_mode',
  'insurance_rate',
  'insurance_per_1000',
  'insurance_fixed',
  'doc_stamp_per_200',
  'doc_stamp_rate_decimal',
  'notarial_fee_new',
  'notarial_fee_reloan',
  'notarial_fee_nw_sss',
  'notarial_fee_nw_gsis',
  'notarial_fee_rl_sss',
  'notarial_fee_rl_gsis',
  'mortgage_fee_rate',
  'mortgage_fee_threshold',
  're_loan_fee',
  'opening_account_fee',
  'pension_retention_threshold',
  'pension_retention_threshold_sss',
  'pension_retention_threshold_gsis',
  'default_pension_system',
  'outside_office_downpayment_rate',
  'in_office_downpayment_rate',
  'default_purchase_channel',
  'miscellaneous_deducted_from_proceeds',
])

export const FEE_PROFILE_OPTIONS = [
  { value: '', label: 'General / not set' },
  { value: 'mortgage', label: 'Mortgage (REM / CHM)' },
  { value: 'salary', label: 'Salary loan' },
  { value: 'travel', label: 'Travel assistance' },
  { value: 'pension', label: 'SSS / GSIS pension' },
  { value: 'appliance', label: 'Appliance / retail' },
]

export const COMPUTATION_STYLE_OPTIONS = [
  { value: 'straight_line', label: 'Straight line (principal ÷ term + interest)' },
  { value: 'standard', label: 'Standard amortization' },
]

export function splitKnownExtra(obj, knownKeys) {
  const known = {}
  const extra = {}
  if (!obj || typeof obj !== 'object') return { known, extra }
  for (const [key, value] of Object.entries(obj)) {
    if (knownKeys.has(key)) known[key] = value
    else extra[key] = value
  }
  return { known, extra }
}

export function mergeKnownExtra(known, extra) {
  const out = { ...known }
  for (const [key, value] of Object.entries(extra || {})) {
    if (value !== '' && value != null) out[key] = value
  }
  return out
}

export function emptyCalculatorConfig() {
  return {
    fee_profile: '',
    computation_style: 'straight_line',
    pension_multiplier: '',
    max_principal: '',
    min_principal: '',
    salary_principal_multiplier: '',
    opening_account_fee: '',
    fixed_term_months: '',
    insurance_per_1000: '',
    notarial_new_loan: '',
    service_charge_new_loan: '',
  }
}

export function emptyRulesConfig() {
  return {
    service_charge_mode: 'percent',
    service_charge_rate: '',
    service_charge_fixed_new: '',
    service_charge_fixed_reloan: '',
    service_charge_fixed_nw_sss: '',
    service_charge_fixed_nw_gsis: '',
    service_charge_fixed_rl_sss: '',
    service_charge_fixed_rl_gsis: '',
    insurance_mode: 'per_1000_plus_fixed',
    insurance_rate: '',
    insurance_per_1000: '',
    insurance_fixed: '',
    doc_stamp_per_200: '',
    doc_stamp_rate_decimal: '',
    notarial_fee_new: '',
    notarial_fee_reloan: '',
    notarial_fee_nw_sss: '',
    notarial_fee_nw_gsis: '',
    notarial_fee_rl_sss: '',
    notarial_fee_rl_gsis: '',
    mortgage_fee_rate: '',
    mortgage_fee_threshold: '',
    re_loan_fee: '',
    opening_account_fee: '',
    pension_retention_threshold: '',
    pension_retention_threshold_sss: '',
    pension_retention_threshold_gsis: '',
    default_pension_system: 'sss',
    outside_office_downpayment_rate: '',
    in_office_downpayment_rate: '',
    default_purchase_channel: 'outside_office',
    miscellaneous_deducted_from_proceeds: '',
  }
}

function toFormString(value) {
  if (value === null || value === undefined) return ''
  return String(value)
}

function toFormPercent(value) {
  if (value === '' || value == null) return ''
  const n = Number(value)
  if (Number.isNaN(n)) return ''
  return String(Number((n * 100).toFixed(6)).toString())
}

export function calculatorConfigToForm(obj) {
  const { known, extra } = splitKnownExtra(obj, CALCULATOR_CONFIG_KEYS)
  return {
    form: {
      fee_profile: known.fee_profile ?? '',
      computation_style: known.computation_style ?? 'straight_line',
      pension_multiplier: toFormString(known.pension_multiplier),
      max_principal: toFormString(known.max_principal),
      min_principal: toFormString(known.min_principal),
      salary_principal_multiplier: toFormString(known.salary_principal_multiplier),
      opening_account_fee: toFormString(known.opening_account_fee),
      fixed_term_months: toFormString(known.fixed_term_months),
      insurance_per_1000: toFormString(known.insurance_per_1000),
      notarial_new_loan: toFormString(known.notarial_new_loan),
      service_charge_new_loan: toFormString(known.service_charge_new_loan),
    },
    extra,
  }
}

export function rulesConfigToForm(obj) {
  const { known, extra } = splitKnownExtra(obj, RULES_KEYS)
  return {
    form: {
      service_charge_mode: known.service_charge_mode ?? 'percent',
      service_charge_rate: toFormPercent(known.service_charge_rate),
      service_charge_fixed_new: toFormString(known.service_charge_fixed_new),
      service_charge_fixed_reloan: toFormString(known.service_charge_fixed_reloan),
      service_charge_fixed_nw_sss: toFormString(known.service_charge_fixed_nw_sss),
      service_charge_fixed_nw_gsis: toFormString(known.service_charge_fixed_nw_gsis),
      service_charge_fixed_rl_sss: toFormString(known.service_charge_fixed_rl_sss),
      service_charge_fixed_rl_gsis: toFormString(known.service_charge_fixed_rl_gsis),
      insurance_mode: known.insurance_mode ?? 'per_1000_plus_fixed',
      insurance_rate: toFormPercent(known.insurance_rate),
      insurance_per_1000: toFormString(known.insurance_per_1000),
      insurance_fixed: toFormString(known.insurance_fixed),
      doc_stamp_per_200: toFormString(known.doc_stamp_per_200),
      doc_stamp_rate_decimal: toFormPercent(known.doc_stamp_rate_decimal),
      notarial_fee_new: toFormString(known.notarial_fee_new),
      notarial_fee_reloan: toFormString(known.notarial_fee_reloan),
      notarial_fee_nw_sss: toFormString(known.notarial_fee_nw_sss),
      notarial_fee_nw_gsis: toFormString(known.notarial_fee_nw_gsis),
      notarial_fee_rl_sss: toFormString(known.notarial_fee_rl_sss),
      notarial_fee_rl_gsis: toFormString(known.notarial_fee_rl_gsis),
      mortgage_fee_rate: toFormPercent(known.mortgage_fee_rate),
      mortgage_fee_threshold: toFormString(known.mortgage_fee_threshold),
      re_loan_fee: toFormString(known.re_loan_fee),
      opening_account_fee: toFormString(known.opening_account_fee),
      pension_retention_threshold: toFormString(known.pension_retention_threshold),
      pension_retention_threshold_sss: toFormString(known.pension_retention_threshold_sss),
      pension_retention_threshold_gsis: toFormString(known.pension_retention_threshold_gsis),
      default_pension_system: known.default_pension_system ?? 'sss',
      outside_office_downpayment_rate: toFormPercent(known.outside_office_downpayment_rate),
      in_office_downpayment_rate: toFormPercent(known.in_office_downpayment_rate),
      default_purchase_channel: known.default_purchase_channel ?? 'outside_office',
      miscellaneous_deducted_from_proceeds:
        known.miscellaneous_deducted_from_proceeds === true
          ? 'yes'
          : known.miscellaneous_deducted_from_proceeds === false
            ? 'no'
            : '',
    },
    extra,
  }
}

function parseNumber(raw) {
  if (raw === '' || raw == null) return null
  const n = Number(raw)
  return Number.isNaN(n) ? null : n
}

function parsePercentToDecimal(raw) {
  if (raw === '' || raw == null) return null
  const n = Number(raw)
  if (Number.isNaN(n)) return null
  return n / 100
}

function assignIfPresent(target, key, value) {
  if (value !== null && value !== '') target[key] = value
}

export function formToCalculatorConfig(form, extra = {}) {
  const out = {}
  if (form.fee_profile) out.fee_profile = form.fee_profile
  if (form.computation_style && form.computation_style !== 'standard') {
    out.computation_style = form.computation_style
  } else if (form.computation_style === 'standard') {
    out.computation_style = 'standard'
  }
  assignIfPresent(out, 'pension_multiplier', parseNumber(form.pension_multiplier))
  assignIfPresent(out, 'max_principal', parseNumber(form.max_principal))
  assignIfPresent(out, 'min_principal', parseNumber(form.min_principal))
  assignIfPresent(out, 'salary_principal_multiplier', parseNumber(form.salary_principal_multiplier))
  assignIfPresent(out, 'opening_account_fee', parseNumber(form.opening_account_fee))
  assignIfPresent(out, 'fixed_term_months', parseNumber(form.fixed_term_months))
  assignIfPresent(out, 'insurance_per_1000', parseNumber(form.insurance_per_1000))
  assignIfPresent(out, 'notarial_new_loan', parseNumber(form.notarial_new_loan))
  assignIfPresent(out, 'service_charge_new_loan', parseNumber(form.service_charge_new_loan))
  return mergeKnownExtra(out, extra)
}

export function formToRulesConfig(form, extra = {}) {
  const out = {}
  if (form.service_charge_mode) out.service_charge_mode = form.service_charge_mode
  assignIfPresent(out, 'service_charge_rate', parsePercentToDecimal(form.service_charge_rate))
  assignIfPresent(out, 'service_charge_fixed_new', parseNumber(form.service_charge_fixed_new))
  assignIfPresent(out, 'service_charge_fixed_reloan', parseNumber(form.service_charge_fixed_reloan))
  assignIfPresent(out, 'service_charge_fixed_nw_sss', parseNumber(form.service_charge_fixed_nw_sss))
  assignIfPresent(out, 'service_charge_fixed_nw_gsis', parseNumber(form.service_charge_fixed_nw_gsis))
  assignIfPresent(out, 'service_charge_fixed_rl_sss', parseNumber(form.service_charge_fixed_rl_sss))
  assignIfPresent(out, 'service_charge_fixed_rl_gsis', parseNumber(form.service_charge_fixed_rl_gsis))
  if (form.insurance_mode) out.insurance_mode = form.insurance_mode
  assignIfPresent(out, 'insurance_rate', parsePercentToDecimal(form.insurance_rate))
  assignIfPresent(out, 'insurance_per_1000', parseNumber(form.insurance_per_1000))
  assignIfPresent(out, 'insurance_fixed', parseNumber(form.insurance_fixed))
  assignIfPresent(out, 'doc_stamp_per_200', parseNumber(form.doc_stamp_per_200))
  assignIfPresent(out, 'doc_stamp_rate_decimal', parsePercentToDecimal(form.doc_stamp_rate_decimal))
  assignIfPresent(out, 'notarial_fee_new', parseNumber(form.notarial_fee_new))
  assignIfPresent(out, 'notarial_fee_reloan', parseNumber(form.notarial_fee_reloan))
  assignIfPresent(out, 'notarial_fee_nw_sss', parseNumber(form.notarial_fee_nw_sss))
  assignIfPresent(out, 'notarial_fee_nw_gsis', parseNumber(form.notarial_fee_nw_gsis))
  assignIfPresent(out, 'notarial_fee_rl_sss', parseNumber(form.notarial_fee_rl_sss))
  assignIfPresent(out, 'notarial_fee_rl_gsis', parseNumber(form.notarial_fee_rl_gsis))
  assignIfPresent(out, 'mortgage_fee_rate', parsePercentToDecimal(form.mortgage_fee_rate))
  assignIfPresent(out, 'mortgage_fee_threshold', parseNumber(form.mortgage_fee_threshold))
  assignIfPresent(out, 're_loan_fee', parseNumber(form.re_loan_fee))
  assignIfPresent(out, 'opening_account_fee', parseNumber(form.opening_account_fee))
  assignIfPresent(out, 'pension_retention_threshold', parseNumber(form.pension_retention_threshold))
  assignIfPresent(out, 'pension_retention_threshold_sss', parseNumber(form.pension_retention_threshold_sss))
  assignIfPresent(out, 'pension_retention_threshold_gsis', parseNumber(form.pension_retention_threshold_gsis))
  if (form.default_pension_system) out.default_pension_system = form.default_pension_system
  assignIfPresent(out, 'outside_office_downpayment_rate', parsePercentToDecimal(form.outside_office_downpayment_rate))
  assignIfPresent(out, 'in_office_downpayment_rate', parsePercentToDecimal(form.in_office_downpayment_rate))
  if (form.default_purchase_channel) out.default_purchase_channel = form.default_purchase_channel
  if (form.miscellaneous_deducted_from_proceeds === 'yes') out.miscellaneous_deducted_from_proceeds = true
  if (form.miscellaneous_deducted_from_proceeds === 'no') out.miscellaneous_deducted_from_proceeds = false
  return mergeKnownExtra(out, extra)
}

export function inferFeeProfile(calcForm, slug = '') {
  if (calcForm.fee_profile) return calcForm.fee_profile
  if (calcForm.pension_multiplier) return 'pension'
  if (calcForm.salary_principal_multiplier) return 'salary'
  const s = String(slug || '').toLowerCase()
  if (s.includes('travel')) return 'travel'
  if (s.includes('pension') || s.includes('sss')) return 'pension'
  if (s.includes('salary')) return 'salary'
  if (s.includes('appliance')) return 'appliance'
  if (s.includes('mortgage') || s.includes('chattel') || s.includes('real-estate')) return 'mortgage'
  return ''
}
