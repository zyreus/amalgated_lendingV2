import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { admin } from '../components/AdminUi.jsx'
import { AdminPageSkeleton } from '../../components/AppSkeletons.jsx'

const DEFAULTS = {
  company: {
    company_name: 'Amalgated Lending Inc.',
    logo_url: '',
    address: '',
    contact_number: '',
    email_address: '',
    business_hours: 'Mon–Fri 9:00 AM – 5:00 PM',
    branches: ['Davao City'],
  },
  loan_defaults: { interest_rate: 12, min_loan: 5000, max_loan: 500000, max_term_months: 60 },
  loan_configuration: {
    interest_type: 'reducing_balance',
    loan_terms_months: [3, 6, 12],
    penalty_rate: 2,
    grace_period_days: 3,
  },
  payment_settings: { currency: 'PHP', methods: ['cash', 'bank_transfer'], require_proof: true },
  interest_settings: { mode: 'reducing_balance', compounding: false },
  notifications: { email_enabled: true, sms_enabled: false, auto_send: true },
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
  security: { two_factor_enabled: false, max_login_attempts: 5, session_timeout_minutes: 60, password_min_length: 8 },
  reports: { default_range: 'last_30_days', export_pdf: true, export_excel: true, show_metrics: true },
  integrations: { crm_enabled: false, chat_enabled: true, api_keys: '' },
  audit: { change_tracking_enabled: true, login_history_enabled: true, activity_logs_enabled: true },
  system: { maintenance_mode: false, backup_frequency: 'daily' },
}

const LABELS = {
  company: 'Company Settings',
  loan_defaults: 'Loan Defaults',
  loan_configuration: 'Loan Configuration',
  payment_settings: 'Payment Settings',
  interest_settings: 'Interest Rules',
  notifications: 'Notifications',
  email_settings: 'Email & Notifications',
  credit_scoring: 'Credit Scoring',
  security: 'Security',
  reports: 'Reports & Analytics',
  integrations: 'Integrations',
  audit: 'Audit Logs',
  system: 'System',
}

function SectionIcon({ name }) {
  const cls = 'h-4 w-4'
  if (name === 'company') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-8h6v8" />
      </svg>
    )
  }
  if (name === 'loan') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
  if (name === 'pay') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    )
  }
  if (name === 'email') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )
  }
  if (name === 'users') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  }
  if (name === 'security') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    )
  }
  if (name === 'report') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V9m6 10V5m-9 6h12" />
      </svg>
    )
  }
  if (name === 'plug') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18v-6a3 3 0 013-3h6M7 6h10M9 6V3m6 3V3M5 9h14v3a5 5 0 01-5 5H10a5 5 0 01-5-5V9z" />
      </svg>
    )
  }
  if (name === 'audit') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a4 4 0 118 0v2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 17h10v4H7v-4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v4" />
      </svg>
    )
  }
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
    </svg>
  )
}

function ToggleSwitch({ label, value, onChange, helper }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        {helper ? <p className={`mt-0.5 text-xs ${admin.textMuted}`}>{helper}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          value ? 'bg-red-600' : 'bg-gray-300 dark:bg-white/15'
        }`}
        aria-pressed={value}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            value ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

function FieldLabel({ label, helper, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</span>
      {helper ? <span className={`mt-0.5 block text-xs ${admin.textMuted}`}>{helper}</span> : null}
    </label>
  )
}

function SectionCard({ id, title, icon, subtitle, children, right }) {
  return (
    <section id={id} className={`${admin.cardNoHover} scroll-mt-24`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-800 dark:border-[#1F2937] dark:bg-[#0F172A]/50 dark:text-gray-100">
              <SectionIcon name={icon} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
              {subtitle ? <p className={`mt-0.5 text-xs ${admin.textMuted}`}>{subtitle}</p> : null}
            </div>
          </div>
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  )
}

export default function SettingsPage() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [saveAllBusy, setSaveAllBusy] = useState(false)
  const [sections, setSections] = useState(DEFAULTS)
  const [initialSections, setInitialSections] = useState(DEFAULTS)
  const [jsonByKey, setJsonByKey] = useState(Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, JSON.stringify(v, null, 2)])))
  const [query, setQuery] = useState('')
  const [activeKey, setActiveKey] = useState('company')
  const sectionRefs = useRef({})
  const [smtpStatus, setSmtpStatus] = useState(null)
  const [smtpHealth, setSmtpHealth] = useState(null)
  const [testEmailTo, setTestEmailTo] = useState('')
  const [emailOpsLoading, setEmailOpsLoading] = useState(false)
  const [emailLogs, setEmailLogs] = useState([])
  const [emailAnalytics, setEmailAnalytics] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await api('/settings')
        const settings = res.settings || {}
        const merged = { ...DEFAULTS }
        Object.keys(merged).forEach((k) => {
          merged[k] = settings[k]?.value ? { ...merged[k], ...settings[k].value } : merged[k]
        })
        setSections(merged)
        setInitialSections(merged)
        setJsonByKey(Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, JSON.stringify(v, null, 2)])))
      } catch (e) {
        showToast(e.message || 'Failed loading settings', 'error')
      } finally {
        setLoading(false)
      }
    })()
  }, [showToast])

  const refreshSmtpDiagnostics = async () => {
    setEmailOpsLoading(true)
    try {
      const [statusRes, healthRes, logsRes, analyticsRes] = await Promise.all([
        api('/admin/email/status'),
        api('/admin/email/health').catch(() => ({ health: { ok: false, message: 'Health check unavailable' } })),
        api('/admin/email/logs?limit=25').catch(() => ({ email_logs: [] })),
        api('/admin/email/analytics').catch(() => ({ analytics: null })),
      ])
      setSmtpStatus(statusRes.smtp || null)
      setSmtpHealth(healthRes.health || null)
      setEmailLogs(logsRes.email_logs || [])
      setEmailAnalytics(analyticsRes.analytics || null)
    } catch (e) {
      showToast(e.message || 'Could not load SMTP status', 'error')
    } finally {
      setEmailOpsLoading(false)
    }
  }

  useEffect(() => {
    refreshSmtpDiagnostics()
  }, [])

  const sendTestEmail = async () => {
    const to = testEmailTo.trim()
    if (!to) {
      showToast('Enter a recipient email for the test.', 'error')
      return
    }
    setEmailOpsLoading(true)
    try {
      const res = await api('/admin/email/test', { method: 'POST', body: JSON.stringify({ to }) })
      showToast(res.message || 'Test email sent', 'success')
    } catch (e) {
      showToast(e.message || 'Test email failed', 'error')
    } finally {
      setEmailOpsLoading(false)
    }
  }

  const patch = (key, partial) => {
    setSections((prev) => {
      const next = { ...prev, [key]: { ...prev[key], ...partial } }
      setJsonByKey((j) => ({ ...j, [key]: JSON.stringify(next[key], null, 2) }))
      return next
    })
  }

  const save = async (key) => {
    setSaving(key)
    try {
      const value = JSON.parse(jsonByKey[key] || '{}')
      await api(`/settings/${key}`, { method: 'POST', body: JSON.stringify({ value }) })
      setJsonByKey((prev) => ({ ...prev, [key]: JSON.stringify(value, null, 2) }))
      showToast(`${LABELS[key]} saved`, 'success')
    } catch (e) {
      showToast(e.message || `Invalid JSON for ${LABELS[key]}`, 'error')
    } finally {
      setSaving('')
    }
  }

  const WIRED_KEYS = useMemo(
    () => [
      'company',
      'loan_defaults',
      'loan_configuration',
      'payment_settings',
      'interest_settings',
      'notifications',
      'email_settings',
      'credit_scoring',
      'security',
      'reports',
      'integrations',
      'audit',
      'system',
    ],
    [],
  )

  const sectionsMeta = useMemo(
    () => [
      {
        key: 'company',
        title: 'Company Settings',
        icon: 'company',
        subtitle: 'Brand identity, branch support, and contact info.',
      },
      {
        key: 'loan_defaults',
        title: 'Loan Defaults',
        icon: 'loan',
        subtitle: 'Minimums, maximums, and baseline interest rate.',
      },
      {
        key: 'loan_configuration',
        title: 'Loan Configuration',
        icon: 'loan',
        subtitle: 'Interest type, terms, penalties, and grace period.',
      },
      {
        key: 'payment_settings',
        title: 'Payment Settings',
        icon: 'pay',
        subtitle: 'Methods, proof requirements, and due-date rules.',
      },
      {
        key: 'interest_settings',
        title: 'Interest Rules',
        icon: 'loan',
        subtitle: 'Flat vs diminishing balance and compounding.',
      },
      {
        key: 'notifications',
        title: 'Notifications',
        icon: 'email',
        subtitle: 'Channel toggles and automatic sending.',
      },
      {
        key: 'email_settings',
        title: 'Email & Notification Settings',
        icon: 'email',
        subtitle: 'Google Workspace SMTP status, templates, and delivery tools.',
      },
      {
        key: 'credit_scoring',
        title: 'Reports & Analytics',
        icon: 'report',
        subtitle: 'Scoring + reporting defaults for dashboards.',
      },
      {
        key: 'security',
        title: 'Security Settings',
        icon: 'security',
        subtitle: 'Password rules, session timeout, login limits.',
      },
      {
        key: 'integrations',
        title: 'Integrations',
        icon: 'plug',
        subtitle: 'CRM / chat / API keys (UI-ready).',
      },
      {
        key: 'audit',
        title: 'Audit Logs',
        icon: 'audit',
        subtitle: 'Activity tracking and change history toggles.',
      },
      {
        key: 'system',
        title: 'System',
        icon: 'audit',
        subtitle: 'Maintenance mode and backups.',
      },
    ],
    [],
  )

  const filteredSections = useMemo(() => {
    const q = (query || '').trim().toLowerCase()
    if (!q) return sectionsMeta
    return sectionsMeta.filter((s) => {
      const hay = `${s.title} ${s.subtitle || ''} ${s.key}`.toLowerCase()
      return hay.includes(q)
    })
  }, [query, sectionsMeta])

  const scrollToSection = (key) => {
    setActiveKey(key)
    const el = sectionRefs.current[key] || document.getElementById(key)
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const cancelChanges = () => {
    setSections(initialSections)
    setJsonByKey(Object.fromEntries(Object.entries(initialSections).map(([k, v]) => [k, JSON.stringify(v, null, 2)])))
    showToast('Changes reverted.', 'success')
  }

  const saveAll = async () => {
    setSaveAllBusy(true)
    try {
      for (const key of WIRED_KEYS) {
        // If a section isn't visible due to search, still save it (Save Changes is global).
        // Save uses JSON as the source of truth.
        await save(key)
      }
      showToast('All settings saved.', 'success')
      setInitialSections(sections)
    } catch (e) {
      showToast(e?.message || 'Failed saving settings.', 'error')
    } finally {
      setSaveAllBusy(false)
    }
  }

  if (loading) return <AdminPageSkeleton />

  return (
    <div className="w-full min-w-0">
      {/* Header (page-level) */}
      <div className="sticky top-0 z-10 w-full border-b border-gray-200 bg-gray-100/80 py-3 backdrop-blur dark:border-[#1F2937] dark:bg-[#0F172A]/75">
        <div className="px-3 sm:px-4 lg:px-6">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className={admin.pageTitle}>Admin settings</h1>
              <p className={admin.pageSubtitle}>Manage defaults, security, and notifications — responsive on all devices.</p>
            </div>
            <div className="w-full min-w-0 lg:max-w-md">
              <label className="sr-only" htmlFor="settings-search">
                Search settings
              </label>
              <input
                id="settings-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search settings…"
                className={`w-full ${admin.input}`}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* In-page sidebar nav */}
        <aside className="min-w-0">
          <div className={`${admin.cardNoHover} p-4 lg:sticky lg:top-20`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Sections</p>
            <div className="mt-3 flex max-w-full flex-nowrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:overflow-visible lg:pb-0">
              {filteredSections.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => scrollToSection(s.key)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition lg:w-full ${
                    activeKey === s.key
                      ? 'border-red-500/30 bg-red-600/10 text-red-700 dark:text-red-200'
                      : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-100 dark:hover:bg-[#1F2937]'
                  }`}
                >
                  <SectionIcon name={s.icon} />
                  <span className="truncate">{s.title}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-[#1F2937] dark:bg-[#0F172A]/50 dark:text-gray-300">
              Tip: Use <span className="font-semibold">Save Changes</span> at the bottom to apply updates across all sections.
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="min-w-0 space-y-6 pb-24">
          <SectionCard
            id="company"
            title="Company Settings"
            icon="company"
            subtitle="Company profile and multi-branch support."
            right={
              <button
                type="button"
                onClick={() => {
                  showToast('Logo upload UI only (wire storage endpoint next).', 'success')
                }}
                className={admin.btnSecondary}
              >
                Upload logo
              </button>
            }
          >
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <div className="min-w-0">
                <FieldLabel label="Company name" htmlFor="company-name" />
                <input
                  id="company-name"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.company.company_name}
                  onChange={(e) => patch('company', { company_name: e.target.value })}
                />
              </div>
              <div className="min-w-0">
                <FieldLabel label="Email address" htmlFor="company-email" />
                <input
                  id="company-email"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.company.email_address}
                  onChange={(e) => patch('company', { email_address: e.target.value })}
                  placeholder="support@yourdomain.com"
                />
              </div>
              <div className="min-w-0 md:col-span-2">
                <FieldLabel label="Address" htmlFor="company-address" />
                <input
                  id="company-address"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.company.address}
                  onChange={(e) => patch('company', { address: e.target.value })}
                  placeholder="Street, City, Province"
                />
              </div>
              <div className="min-w-0">
                <FieldLabel label="Contact number" htmlFor="company-contact" />
                <input
                  id="company-contact"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.company.contact_number}
                  onChange={(e) => patch('company', { contact_number: e.target.value })}
                  placeholder="+63 ..."
                />
              </div>
              <div className="min-w-0">
                <FieldLabel label="Business hours" htmlFor="company-hours" />
                <input
                  id="company-hours"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.company.business_hours}
                  onChange={(e) => patch('company', { business_hours: e.target.value })}
                />
              </div>
              <div className="min-w-0 md:col-span-2">
                <FieldLabel label="Branch selection" helper="Comma-separated branch names (multi-branch support)." htmlFor="company-branches" />
                <input
                  id="company-branches"
                  className={`mt-1 w-full ${admin.input}`}
                  value={(sections.company.branches || []).join(', ')}
                  onChange={(e) =>
                    patch('company', { branches: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })
                  }
                  placeholder="Davao City, Tagum, ..."
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard id="loan_defaults" title="Loan Defaults" icon="loan" subtitle="Defaults used when creating loan applications.">
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <div className="min-w-0">
                <FieldLabel label="Default interest rate (%)" htmlFor="ld-ir" />
                <input
                  id="ld-ir"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.loan_defaults.interest_rate}
                  onChange={(e) => patch('loan_defaults', { interest_rate: Number(e.target.value || 0) })}
                  inputMode="decimal"
                />
              </div>
              <div className="min-w-0">
                <FieldLabel label="Max term (months)" htmlFor="ld-term" />
                <input
                  id="ld-term"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.loan_defaults.max_term_months}
                  onChange={(e) => patch('loan_defaults', { max_term_months: Number(e.target.value || 0) })}
                  inputMode="numeric"
                />
              </div>
              <div className="min-w-0">
                <FieldLabel label="Minimum loan amount" htmlFor="ld-min" />
                <input
                  id="ld-min"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.loan_defaults.min_loan}
                  onChange={(e) => patch('loan_defaults', { min_loan: Number(e.target.value || 0) })}
                  inputMode="numeric"
                />
              </div>
              <div className="min-w-0">
                <FieldLabel label="Maximum loan amount" htmlFor="ld-max" />
                <input
                  id="ld-max"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.loan_defaults.max_loan}
                  onChange={(e) => patch('loan_defaults', { max_loan: Number(e.target.value || 0) })}
                  inputMode="numeric"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard id="loan_configuration" title="Loan Configuration" icon="loan" subtitle="Rules for terms, penalties, and interest type.">
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <div className="min-w-0">
                <FieldLabel label="Interest type" htmlFor="lc-type" helper="Flat Rate or Diminishing Balance." />
                <select
                  id="lc-type"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.loan_configuration.interest_type}
                  onChange={(e) => patch('loan_configuration', { interest_type: e.target.value })}
                >
                  <option value="flat">Flat Rate</option>
                  <option value="reducing_balance">Diminishing Balance</option>
                </select>
              </div>
              <div className="min-w-0">
                <FieldLabel label="Loan terms (months)" htmlFor="lc-terms" helper="Comma-separated (e.g. 3, 6, 12)." />
                <input
                  id="lc-terms"
                  className={`mt-1 w-full ${admin.input}`}
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
                />
              </div>
              <div className="min-w-0">
                <FieldLabel label="Penalty rate (%)" htmlFor="lc-penalty" />
                <input
                  id="lc-penalty"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.loan_configuration.penalty_rate}
                  onChange={(e) => patch('loan_configuration', { penalty_rate: Number(e.target.value || 0) })}
                  inputMode="decimal"
                />
              </div>
              <div className="min-w-0">
                <FieldLabel label="Grace period (days)" htmlFor="lc-grace" />
                <input
                  id="lc-grace"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.loan_configuration.grace_period_days}
                  onChange={(e) => patch('loan_configuration', { grace_period_days: Number(e.target.value || 0) })}
                  inputMode="numeric"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard id="payment_settings" title="Payment Settings" icon="pay" subtitle="Payment methods and receipt rules.">
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <div className="min-w-0">
                <FieldLabel label="Currency" htmlFor="pay-cur" />
                <input
                  id="pay-cur"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.payment_settings.currency}
                  onChange={(e) => patch('payment_settings', { currency: e.target.value })}
                />
              </div>
              <div className="min-w-0">
                <FieldLabel label="Payment methods" htmlFor="pay-methods" helper="Comma-separated: cash, bank_transfer, gcash, maya." />
                <input
                  id="pay-methods"
                  className={`mt-1 w-full ${admin.input}`}
                  value={(sections.payment_settings.methods || []).join(', ')}
                  onChange={(e) =>
                    patch('payment_settings', {
                      methods: e.target.value.split(',').map((x) => x.trim()).filter(Boolean),
                    })
                  }
                  placeholder="cash, bank_transfer, gcash"
                />
              </div>
              <div className="min-w-0 md:col-span-2">
                <ToggleSwitch
                  label="Require proof of payment"
                  value={!!sections.payment_settings.require_proof}
                  onChange={(v) => patch('payment_settings', { require_proof: v })}
                  helper="If enabled, borrowers must upload a receipt/proof for non-cash methods."
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard id="interest_settings" title="Interest Rules" icon="loan" subtitle="How interest is computed for loans.">
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <div className="min-w-0">
                <FieldLabel label="Mode" htmlFor="ir-mode" />
                <select
                  id="ir-mode"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.interest_settings.mode}
                  onChange={(e) => patch('interest_settings', { mode: e.target.value })}
                >
                  <option value="flat">Flat</option>
                  <option value="reducing_balance">Reducing balance</option>
                </select>
              </div>
              <div className="min-w-0 md:col-span-2">
                <ToggleSwitch
                  label="Compounding"
                  value={!!sections.interest_settings.compounding}
                  onChange={(v) => patch('interest_settings', { compounding: v })}
                  helper="If enabled, interest is compounded per period (use carefully)."
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard id="notifications" title="Email & Notification Settings" icon="email" subtitle="Channel toggles and automation.">
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <ToggleSwitch
                label="Email notifications"
                value={!!sections.notifications.email_enabled}
                onChange={(v) => patch('notifications', { email_enabled: v })}
                helper="Send emails for application events and reminders."
              />
              <ToggleSwitch
                label="SMS notifications"
                value={!!sections.notifications.sms_enabled}
                onChange={(v) => patch('notifications', { sms_enabled: v })}
                helper="Optional SMS channel (requires provider integration)."
              />
              <div className="md:col-span-2">
                <ToggleSwitch
                  label="Auto-send"
                  value={!!sections.notifications.auto_send}
                  onChange={(v) => patch('notifications', { auto_send: v })}
                  helper="When enabled, templates are sent automatically without manual approval."
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard id="email_settings" title="Google Workspace SMTP" icon="email" subtitle="Production mail via smtp.gmail.com (configure MAIL_* in the API .env).">
            <div className="mb-6 rounded-2xl border border-[#2F6FA3]/25 bg-gradient-to-br from-[#2F6FA3]/10 via-transparent to-[#ff0000]/5 p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#2F6FA3]">Mail provider</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">Google Workspace</h3>
                  <p className="mt-1 max-w-xl text-sm text-zinc-400">
                    Transactional email uses support@amalgatedlending.com with a Google App Password. Credentials stay in server .env only.
                  </p>
                </div>
                <button type="button" onClick={refreshSmtpDiagnostics} disabled={emailOpsLoading} className={`${admin.btnSecondary} shrink-0`}>
                  {emailOpsLoading ? 'Checking…' : 'Refresh status'}
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">Configured</p>
                  <p className={`mt-0.5 text-sm font-medium ${smtpStatus?.configured ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {smtpStatus?.configured ? 'Yes' : 'No — set MAIL_* in .env'}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">SMTP health</p>
                  <p className={`mt-0.5 text-sm font-medium ${smtpHealth?.ok ? 'text-emerald-400' : 'text-zinc-300'}`}>
                    {smtpHealth?.ok ? `OK (${smtpHealth.latency_ms ?? '—'} ms)` : String(smtpHealth?.message || '—').slice(0, 48)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">From</p>
                  <p className="mt-0.5 truncate text-sm font-medium text-zinc-200">
                    {smtpStatus?.from_name || sections.email_settings.smtp_from_name} &lt;{smtpStatus?.from_address || sections.email_settings.smtp_from_email}&gt;
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">Host</p>
                  <p className="mt-0.5 text-sm font-medium text-zinc-200">
                    {smtpStatus?.host || sections.email_settings.smtp_host}:{smtpStatus?.port || sections.email_settings.smtp_port}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <FieldLabel label="Send test email" htmlFor="smtp-test-to" helper="Verifies live SMTP from the API server." />
                  <input
                    id="smtp-test-to"
                    type="email"
                    className={`mt-1 w-full ${admin.input}`}
                    value={testEmailTo}
                    onChange={(e) => setTestEmailTo(e.target.value)}
                    placeholder="you@company.com"
                  />
                </div>
                <button type="button" onClick={sendTestEmail} disabled={emailOpsLoading} className={`${admin.btnPrimary} sm:mb-0.5`}>
                  Send test
                </button>
              </div>
              <p className="mt-3 text-xs text-zinc-500">DNS: configure SPF, DKIM, and DMARC — see deploy/GOOGLE_WORKSPACE_SMTP.md.</p>
            </div>
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <div className="min-w-0">
                <FieldLabel label="SMTP host" htmlFor="smtp-host" />
                <input
                  id="smtp-host"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.email_settings.smtp_host}
                  onChange={(e) => patch('email_settings', { smtp_host: e.target.value })}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div className="min-w-0">
                <FieldLabel label="SMTP port" htmlFor="smtp-port" />
                <input
                  id="smtp-port"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.email_settings.smtp_port}
                  onChange={(e) => patch('email_settings', { smtp_port: Number(e.target.value || 0) })}
                  inputMode="numeric"
                />
              </div>
              <div className="min-w-0">
                <FieldLabel label="SMTP user" htmlFor="smtp-user" />
                <input
                  id="smtp-user"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.email_settings.smtp_user}
                  onChange={(e) => patch('email_settings', { smtp_user: e.target.value })}
                />
              </div>
              <div className="min-w-0">
                <FieldLabel label="From name" htmlFor="smtp-fromname" />
                <input
                  id="smtp-fromname"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.email_settings.smtp_from_name}
                  onChange={(e) => patch('email_settings', { smtp_from_name: e.target.value })}
                />
              </div>
              <div className="min-w-0 md:col-span-2">
                <FieldLabel label="From email" htmlFor="smtp-fromemail" />
                <input
                  id="smtp-fromemail"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.email_settings.smtp_from_email}
                  onChange={(e) => patch('email_settings', { smtp_from_email: e.target.value })}
                  placeholder="support@amalgatedlending.com"
                />
              </div>
              <div className="min-w-0 md:col-span-2">
                <FieldLabel label="Email templates (subjects)" helper="Default subjects used by template emails." htmlFor="tmpl-submitted" />
                <div className="mt-2 grid gap-3 md:grid-cols-3">
                  <input
                    id="tmpl-submitted"
                    className={admin.input}
                    value={sections.email_settings.template_loan_submitted_subject}
                    onChange={(e) => patch('email_settings', { template_loan_submitted_subject: e.target.value })}
                    placeholder="Loan Application Submitted"
                  />
                  <input
                    className={admin.input}
                    value={sections.email_settings.template_loan_approved_subject}
                    onChange={(e) => patch('email_settings', { template_loan_approved_subject: e.target.value })}
                    placeholder="Loan Approved"
                  />
                  <input
                    className={admin.input}
                    value={sections.email_settings.template_loan_rejected_subject}
                    onChange={(e) => patch('email_settings', { template_loan_rejected_subject: e.target.value })}
                    placeholder="Loan Rejected"
                  />
                </div>
              </div>
            </div>
            {emailAnalytics ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">Sent (24h)</p>
                  <p className="mt-0.5 text-sm font-medium text-emerald-400">{emailAnalytics.sent_last_24_hours ?? 0}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">Failed (7d)</p>
                  <p className="mt-0.5 text-sm font-medium text-amber-400">{emailAnalytics.failed_last_7_days ?? 0}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">Queue depth</p>
                  <p className="mt-0.5 text-sm font-medium text-zinc-200">{emailAnalytics.notifications_queue_depth ?? 0}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">Period</p>
                  <p className="mt-0.5 text-sm font-medium text-zinc-200">{emailAnalytics.period_days ?? 30} days</p>
                </div>
              </div>
            ) : null}
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-zinc-200">Recent delivery log</p>
              <p className="mt-0.5 text-xs text-zinc-500">Failed, queued, and recent sent messages.</p>
              {emailLogs.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">No delivery records yet.</p>
              ) : (
                <div className="mt-3 max-h-64 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#0a0a0a] text-zinc-500">
                      <tr>
                        <th className="py-2 pr-2">Status</th>
                        <th className="py-2 pr-2">Type</th>
                        <th className="py-2 pr-2">Recipient</th>
                        <th className="py-2">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emailLogs.map((row) => (
                        <tr key={row.id} className="border-t border-white/5 text-zinc-300">
                          <td className="py-2 pr-2">
                            <span
                              className={
                                row.status === 'sent'
                                  ? 'text-emerald-400'
                                  : row.status === 'failed'
                                    ? 'text-red-400'
                                    : 'text-amber-400'
                              }
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="py-2 pr-2">{row.notification_type}</td>
                          <td className="py-2 pr-2 truncate max-w-[140px]">{row.recipient_email}</td>
                          <td className="py-2 text-zinc-500">{row.sent_at || row.updated_at || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard id="credit_scoring" title="Reports & Analytics" icon="report" subtitle="Default reporting range and dashboard toggles.">
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <ToggleSwitch
                label="Enable credit scoring"
                value={!!sections.credit_scoring.enabled}
                onChange={(v) => patch('credit_scoring', { enabled: v })}
                helper="Use credit score to label risk level automatically."
              />
              <div className="min-w-0">
                <FieldLabel label="Base score" htmlFor="score-base" />
                <input
                  id="score-base"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.credit_scoring.base_score}
                  onChange={(e) => patch('credit_scoring', { base_score: Number(e.target.value || 0) })}
                  inputMode="numeric"
                />
              </div>
              <div className="min-w-0 md:col-span-2">
                <FieldLabel label="Default report range" htmlFor="rep-range" />
                <select
                  id="rep-range"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.reports.default_range}
                  onChange={(e) => patch('reports', { default_range: e.target.value })}
                >
                  <option value="today">Today</option>
                  <option value="last_7_days">Last 7 days</option>
                  <option value="last_30_days">Last 30 days</option>
                  <option value="this_month">This month</option>
                  <option value="this_year">This year</option>
                </select>
              </div>
              <div className="md:col-span-2 grid gap-3 sm:grid-cols-3">
                <ToggleSwitch
                  label="Export PDF"
                  value={!!sections.reports.export_pdf}
                  onChange={(v) => patch('reports', { export_pdf: v })}
                  helper="Allow PDF exports."
                />
                <ToggleSwitch
                  label="Export Excel"
                  value={!!sections.reports.export_excel}
                  onChange={(v) => patch('reports', { export_excel: v })}
                  helper="Allow Excel exports."
                />
                <ToggleSwitch
                  label="Dashboard metrics"
                  value={!!sections.reports.show_metrics}
                  onChange={(v) => patch('reports', { show_metrics: v })}
                  helper="Show KPI tiles on dashboard."
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard id="security" title="Security Settings" icon="security" subtitle="Auth rules that protect admin and staff accounts.">
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <div className="min-w-0">
                <FieldLabel label="Password minimum length" htmlFor="sec-passlen" />
                <input
                  id="sec-passlen"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.security.password_min_length}
                  onChange={(e) => patch('security', { password_min_length: Number(e.target.value || 0) })}
                  inputMode="numeric"
                />
              </div>
              <div className="min-w-0">
                <FieldLabel label="Login attempt limits" htmlFor="sec-attempts" />
                <input
                  id="sec-attempts"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.security.max_login_attempts}
                  onChange={(e) => patch('security', { max_login_attempts: Number(e.target.value || 0) })}
                  inputMode="numeric"
                />
              </div>
              <div className="min-w-0">
                <FieldLabel label="Session timeout (minutes)" htmlFor="sec-timeout" />
                <input
                  id="sec-timeout"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.security.session_timeout_minutes}
                  onChange={(e) => patch('security', { session_timeout_minutes: Number(e.target.value || 0) })}
                  inputMode="numeric"
                />
              </div>
              <div className="md:col-span-2">
                <ToggleSwitch
                  label="Two-factor authentication (2FA)"
                  value={!!sections.security.two_factor_enabled}
                  onChange={(v) => patch('security', { two_factor_enabled: v })}
                  helper="Adds an extra layer of security for admins (UI-ready)."
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard id="integrations" title="Integrations" icon="plug" subtitle="Connect CRM, chat, and external services.">
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <ToggleSwitch
                label="CRM integration"
                value={!!sections.integrations.crm_enabled}
                onChange={(v) => patch('integrations', { crm_enabled: v })}
                helper="Enable CRM integration hooks (UI-ready)."
              />
              <ToggleSwitch
                label="Chat system"
                value={!!sections.integrations.chat_enabled}
                onChange={(v) => patch('integrations', { chat_enabled: v })}
                helper="Enable chat modules and routing."
              />
              <div className="min-w-0 md:col-span-2">
                <FieldLabel label="API keys" helper="Store third-party keys here (UI-ready). Do not paste secrets into Vite env." htmlFor="int-keys" />
                <textarea
                  id="int-keys"
                  rows={4}
                  className={`mt-1 w-full font-mono text-xs ${admin.input}`}
                  value={sections.integrations.api_keys}
                  onChange={(e) => patch('integrations', { api_keys: e.target.value })}
                  placeholder="CRM_TOKEN=...\nCHAT_INTERNAL_BROADCAST_SECRET=..."
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard id="audit" title="Audit Logs" icon="audit" subtitle="Track activity, changes, and logins.">
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <ToggleSwitch
                label="System change tracking"
                value={!!sections.audit.change_tracking_enabled}
                onChange={(v) => patch('audit', { change_tracking_enabled: v })}
                helper="Record who changed settings and when."
              />
              <ToggleSwitch
                label="Login history"
                value={!!sections.audit.login_history_enabled}
                onChange={(v) => patch('audit', { login_history_enabled: v })}
                helper="Keep history of admin logins."
              />
              <div className="md:col-span-2">
                <ToggleSwitch
                  label="User activity logs"
                  value={!!sections.audit.activity_logs_enabled}
                  onChange={(v) => patch('audit', { activity_logs_enabled: v })}
                  helper="Enable activity log tracking across admin actions."
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard id="system" title="System" icon="audit" subtitle="Maintenance mode and backups.">
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <ToggleSwitch
                  label="Maintenance mode"
                  value={!!sections.system.maintenance_mode}
                  onChange={(v) => patch('system', { maintenance_mode: v })}
                  helper="Temporarily disable user actions while you deploy changes."
                />
              </div>
              <div className="min-w-0">
                <FieldLabel label="Backup frequency" htmlFor="sys-backup" />
                <select
                  id="sys-backup"
                  className={`mt-1 w-full ${admin.input}`}
                  value={sections.system.backup_frequency || 'daily'}
                  onChange={(e) => patch('system', { backup_frequency: e.target.value })}
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/85 px-3 py-3 backdrop-blur dark:border-[#1F2937] dark:bg-[#0F172A]/85 lg:left-64">
        <div className="mx-auto flex max-w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {saveAllBusy ? 'Saving changes…' : saving ? `Saving ${LABELS[saving] || saving}…` : 'Ready to save.'}
          </p>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={cancelChanges} className={`${admin.btnSecondary} w-full sm:w-auto`} disabled={saveAllBusy}>
              Cancel
            </button>
            <button
              type="button"
              onClick={saveAll}
              disabled={saveAllBusy}
              className={`${admin.btnPrimary} w-full sm:w-auto disabled:opacity-60`}
            >
              {saveAllBusy ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
