/** Default values and labels for system_settings keys. */
export const SETTINGS_DEFAULTS = {
  company: {
    company_name: 'Amalgated Lending Inc.',
    logo_url: '',
    address: '',
    contact_number: '',
    email_address: '',
    business_hours: 'Mon–Fri 9:00 AM – 5:00 PM',
    branches: ['Davao City'],
  },
  locale: {
    timezone: 'Asia/Manila',
    date_format: 'MMM d, yyyy',
    currency_display: 'PHP',
    language: 'en',
  },
  loan_defaults: {
    interest_rate: 12,
    default_annual_rate: 12,
    min_loan: 5000,
    max_loan: 500000,
    max_term_months: 60,
    penalty_percent: 2,
  },
  loan_configuration: {
    interest_type: 'reducing_balance',
    loan_terms_months: [3, 6, 12],
    penalty_rate: 2,
    grace_period_days: 3,
  },
  payment_settings: {
    currency: 'PHP',
    methods: ['cash', 'bank_transfer'],
    require_proof: true,
  },
  interest_settings: { mode: 'reducing_balance', compounding: false },
  collection_settings: {
    due_day_of_month: 15,
    auto_assign_collector: true,
    escalation_days: 7,
    soa_auto_email: false,
  },
  notifications: {
    email_enabled: true,
    sms_enabled: false,
    auto_send: true,
    reminder_days: [1, 3, 7],
  },
  email_settings: {
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_user: 'support@amalgatedlending.com',
    smtp_from_name: 'Amalgated Lending',
    smtp_from_email: 'support@amalgatedlending.com',
    template_loan_submitted_subject: 'Loan application submitted',
    template_loan_approved_subject: 'Your loan was approved',
    template_loan_rejected_subject: 'Your loan was rejected',
  },
  credit_scoring: { enabled: true, base_score: 650 },
  security: {
    two_factor_enabled: false,
    max_login_attempts: 5,
    session_timeout_minutes: 60,
    password_min_length: 8,
  },
  reports: {
    default_range: 'last_30_days',
    export_pdf: true,
    export_excel: true,
    show_metrics: true,
  },
  integrations: { crm_enabled: false, chat_enabled: true, api_keys: '' },
  audit: {
    change_tracking_enabled: true,
    login_history_enabled: true,
    activity_logs_enabled: true,
  },
  system: { maintenance_mode: false, backup_frequency: 'daily' },
  log_cleanup: {
    enabled: true,
    retention_days: 30,
    frequency: 'weekly',
    optimize_tables: false,
  },
  branding: {
    primary_color: '#ff0000',
    background_color: '#000000',
    surface_color: '#0a0a0a',
    logo_url: null,
  },
}

export const SETTINGS_LABELS = {
  company: 'Company Information',
  locale: 'Timezone & Locale',
  loan_defaults: 'Loan Defaults',
  loan_configuration: 'Loan Configuration',
  payment_settings: 'Payment Settings',
  interest_settings: 'Interest Rules',
  collection_settings: 'Collection Rules',
  notifications: 'Notification Channels',
  email_settings: 'SMTP & Email Templates',
  credit_scoring: 'Credit Scoring',
  security: 'Security',
  reports: 'Reports & Analytics',
  integrations: 'Integrations',
  audit: 'Audit Logs',
  system: 'System',
  log_cleanup: 'Data Retention',
  branding: 'PDF Branding',
}

/** Keys persisted via the settings API from the admin UI. */
export const WIRED_SETTINGS_KEYS = [
  'company',
  'locale',
  'loan_defaults',
  'loan_configuration',
  'payment_settings',
  'interest_settings',
  'collection_settings',
  'notifications',
  'email_settings',
  'credit_scoring',
  'security',
  'reports',
  'integrations',
  'audit',
  'system',
  'log_cleanup',
  'branding',
]

export function mergeSettingsFromApi(apiSettings = {}) {
  const merged = { ...SETTINGS_DEFAULTS }
  Object.keys(merged).forEach((k) => {
    merged[k] = apiSettings[k]?.value ? { ...merged[k], ...apiSettings[k].value } : merged[k]
  })
  // Keep loan rate fields in sync for backend compatibility.
  if (merged.loan_defaults.interest_rate && !merged.loan_defaults.default_annual_rate) {
    merged.loan_defaults.default_annual_rate = merged.loan_defaults.interest_rate
  }
  if (merged.loan_defaults.default_annual_rate && !merged.loan_defaults.interest_rate) {
    merged.loan_defaults.interest_rate = merged.loan_defaults.default_annual_rate
  }
  if (merged.loan_configuration.penalty_rate != null && merged.loan_defaults.penalty_percent == null) {
    merged.loan_defaults.penalty_percent = merged.loan_configuration.penalty_rate
  }
  return merged
}
