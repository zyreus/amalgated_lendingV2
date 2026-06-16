import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { loanTypeFromProductSlug } from '../../utils/borrowerAuthApplyPath.js'
import { borrowerApi } from '../api/client.js'
import { admin as ui } from '../../admin/components/AdminUi.jsx'
import PrivacyPolicyModal from '../../components/privacy/PrivacyPolicyModal.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import PrivacyConsentCheckbox from '../../components/privacy/PrivacyConsentCheckbox.jsx'
import { PRIVACY_POLICY_VERSION } from '../../components/privacy/PrivacyPolicyContent.jsx'

const STEPS = [
  { id: 1, title: 'Personal, employment, and loan details' },
  { id: 2, title: 'Document upload center' },
  { id: 4, title: 'Review and submit' },
]
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_UPLOAD_MB = 15

function shouldRedirectToApplications(appRecord) {
  if (!appRecord || appRecord.is_draft) return false
  const status = String(appRecord.status || '').toLowerCase()
  return ['submitted', 'under_review', 'for_review', 'approved', 'passed', 'rejected'].includes(status) || status !== 'draft'
}

function normalizeWizardStep(value) {
  const step = Math.min(Math.max(Number(value) || 1, 1), 4)
  return step >= 3 ? 4 : step
}

function useDebouncedCallback(fn, delay) {
  const t = useRef(null)
  return useCallback(
    (...args) => {
      if (t.current) clearTimeout(t.current)
      t.current = setTimeout(() => fn(...args), delay)
    },
    [fn, delay],
  )
}

function resolveInitialLoanType(searchParams) {
  const fromQuery = searchParams.get('loan_type')
  if (fromQuery) return fromQuery
  const fromProduct = loanTypeFromProductSlug(searchParams.get('product'))
  return fromProduct || 'salary'
}

export default function BorrowerLoanWizardPage() {
  const { applicationId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [schema, setSchema] = useState(null)
  const [app, setApp] = useState(null)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({})
  const [loanType, setLoanType] = useState(() => resolveInitialLoanType(searchParams))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false)
  const [draggingDocKey, setDraggingDocKey] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const loadSchema = useCallback(async () => {
    const res = await borrowerApi('/borrower/loan-applications/wizard/schema')
    setSchema(res.data)
  }, [])

  const loadApp = useCallback(async (id) => {
    const res = await borrowerApi(`/borrower/loan-applications/${id}`)
    const d = res.data
    setApp(d)
    setFormData(d.form_data || {})
    setLoanType(d.loan_type || 'salary')
    setStep(normalizeWizardStep(d.draft_step))
  }, [])

  const openDeleteConfirm = useCallback(() => {
    if (!applicationId || !app?.is_draft) return
    setConfirmDeleteOpen(true)
  }, [applicationId, app?.is_draft])

  const performDeleteApplication = useCallback(async () => {
    if (!applicationId || !app?.is_draft) return
    setDeleteBusy(true)
    setError('')
    try {
      await borrowerApi(`/borrower/loan-applications/${applicationId}`, { method: 'DELETE' })
      setConfirmDeleteOpen(false)
      navigate('/borrower/applications', { replace: true })
    } catch (e) {
      setError(e.message || 'Could not delete application.')
    } finally {
      setDeleteBusy(false)
    }
  }, [applicationId, app?.is_draft, navigate])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        await loadSchema()
        if (applicationId) {
          await loadApp(applicationId)
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applicationId, loadApp, loadSchema])

  useEffect(() => {
    if (!applicationId) return
    if (!shouldRedirectToApplications(app)) return
    navigate('/borrower/applications', { replace: true })
  }, [applicationId, app, navigate])

  useEffect(() => {
    if (!applicationId || !app?.loan_type || !schema?.loan_application_routes) return
    const slug = schema.loan_application_routes[app.loan_type]
    if (slug) navigate(`/borrower/loan-application/${slug}?application_id=${applicationId}`, { replace: true })
  }, [applicationId, app?.loan_type, navigate, schema])

  const persist = useDebouncedCallback(async (nextForm, nextStep, nextLoanType) => {
    if (!applicationId || !app) return
    setSaving(true)
    try {
      const res = await borrowerApi(`/borrower/loan-applications/${applicationId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          form_data: nextForm,
          draft_step: nextStep,
          loan_type: nextLoanType,
        }),
      })
      if (res?.data) setApp(res.data)
    } catch (e) {
      setError(e.message || 'Autosave failed.')
    } finally {
      setSaving(false)
    }
  }, 800)

  const onField = (key, value) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value }
      persist(next, step, loanType)
      return next
    })
  }

  const changeLoanType = async (v) => {
    setLoanType(v)
    if (!applicationId || !app) return
    setSaving(true)
    setError('')
    try {
      await borrowerApi(`/borrower/loan-applications/${applicationId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          loan_type: v,
          form_data: formData,
          draft_step: step,
        }),
      })
      const res = await borrowerApi(`/borrower/loan-applications/${applicationId}`)
      setApp(res.data)
    } catch (e) {
      setError(e.message || 'Could not update loan type.')
    } finally {
      setSaving(false)
    }
  }

  const startApplication = async () => {
    setError('')
    try {
      const res = await borrowerApi('/borrower/loan-applications', {
        method: 'POST',
        body: JSON.stringify({ loan_type: loanType }),
      })
      const slug = schema?.loan_application_routes?.[loanType] || loanType
      navigate(`/borrower/loan-application/${slug}?application_id=${res.data.id}`, { replace: true })
    } catch (e) {
      setError(e.message || 'Could not start application.')
    }
  }

  const loanFields = useMemo(() => {
    if (!schema || !loanType) return []
    return schema.loan_type_fields?.[loanType] || []
  }, [schema, loanType])

  const productMap = schema?.loan_type_product_map || {}
  const products = schema?.loan_products || []
  const selectedProductId = Number(formData.loan_product_id || 0)
  const selectedProduct = useMemo(
    () => products.find((p) => Number(p.id) === selectedProductId) || null,
    [products, selectedProductId],
  )
  const expectedSlug = productMap[loanType] || null
  const filteredProducts = useMemo(() => {
    if (!expectedSlug) return products
    const match = products.filter((p) => p.slug === expectedSlug)
    return match.length ? match : products
  }, [products, expectedSlug])

  const docDefs = useMemo(() => {
    if (!schema || !loanType) return {}
    return schema.documents_by_type?.[loanType] || {}
  }, [schema, loanType])

  const groupedCommon = useMemo(() => {
    if (!schema?.wizard_common) return {}
    const g = {}
    for (const row of schema.wizard_common) {
      const grp = row.group || 'other'
      if (!g[grp]) g[grp] = []
      g[grp].push(row)
    }
    return g
  }, [schema])

  const validateAndNext = async () => {
    setError('')
    try {
      const v = await borrowerApi(`/borrower/loan-applications/${applicationId}/validate-step`, {
        method: 'POST',
        body: JSON.stringify({ step }),
      })
      if (v.ok === false && Array.isArray(v.errors) && v.errors.length) {
        setError(v.errors.join(' '))
        return
      }
      const next = step >= 2 ? 4 : 2
      setStep(next)
      await borrowerApi(`/borrower/loan-applications/${applicationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ draft_step: next, form_data: formData, loan_type: loanType }),
      })
    } catch (e) {
      setError(e.message || 'Validation failed.')
    }
  }

  const uploadDoc = async (docKey, file) => {
    if (!file || !applicationId) return
    setError('')
    const maxBytes = MAX_UPLOAD_MB * 1024 * 1024
    if (!ALLOWED_MIME.includes(file.type)) {
      setError('Only PDF, JPG, and PNG files are allowed.')
      return
    }
    if (file.size > maxBytes) {
      setError(`File is too large. Maximum size is ${MAX_UPLOAD_MB} MB.`)
      return
    }
    const body = new FormData()
    body.append('file', file)
    try {
      const res = await borrowerApi(`/borrower/loan-applications/${applicationId}/documents/${docKey}`, {
        method: 'POST',
        body,
      })
      setApp(res.data)
    } catch (e) {
      setError(e.message || 'Upload failed.')
    }
  }

  const submitFinal = async () => {
    setError('')
    const consent = formData?.privacy_consent
    if (!consent?.agreed) {
      setError('You must agree to the Privacy Policy to proceed with your loan application.')
      return
    }
    try {
      const res = await borrowerApi(`/borrower/loan-applications/${applicationId}/submit`, {
        method: 'POST',
        body: '{}',
      })
      setToast(res.message || 'Submitted.')
      navigate('/borrower/applications', { replace: true })
    } catch (e) {
      const body = e.body || {}
      const msg = Array.isArray(body.errors) ? body.errors.join(' ') : body.message || e.message || 'Submit failed.'
      setError(msg)
    }
  }

  const onPrivacyConsentChange = (agreed) => {
    const nextConsent = {
      agreed,
      agreed_at: agreed ? new Date().toISOString() : null,
      policy_version: PRIVACY_POLICY_VERSION,
    }
    onField('privacy_consent', nextConsent)
    setError('')
  }

  useEffect(() => {
    if (!schema || !loanType || formData.loan_product_id) return
    const preferredSlug = productMap[loanType]
    const preferred = products.find((p) => p.slug === preferredSlug) || filteredProducts[0]
    if (preferred?.id) onField('loan_product_id', String(preferred.id))
  }, [schema, loanType, formData.loan_product_id, productMap, products, filteredProducts])

  if (loading) {
    return <p className={`text-sm ${ui.textMuted}`}>Loading wizard…</p>
  }

  if (!applicationId) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-[#1F2937] dark:bg-[#111827]">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New loan application</h2>
          <p className={`mt-1 text-sm ${ui.textMuted}`}>Choose a loan type, then continue to the multi-step form.</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Loan type
              <select
                value={loanType}
                onChange={(e) => setLoanType(e.target.value)}
                className={`mt-1 block w-full min-w-[220px] rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-[#0F172A] ${ui.input}`}
              >
                {schema
                  ? Object.entries(schema.loan_types).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))
                  : null}
              </select>
            </label>
            <button
              type="button"
              onClick={startApplication}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Start application
            </button>
          </div>
          {error ? (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>
          ) : null}
        </div>
        <Link to="/borrower/dashboard" className="text-sm font-medium text-red-600 hover:underline dark:text-red-400">
          ← Back to dashboard
        </Link>
      </div>
    )
  }

  if (!schema || !app) {
    return <p className={`text-sm ${ui.textMuted}`}>Loading…</p>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#DC2626]">Loan application wizard</p>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {schema.loan_types[loanType]} #{applicationId}
          </h2>
          <p className={`text-sm ${ui.textMuted}`}>
            {app.is_draft ? 'Draft — progress auto-saves.' : 'Submitted'} {saving ? ' · Saving…' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {app.is_draft ? (
            <button
              type="button"
              disabled={deleteBusy}
              onClick={openDeleteConfirm}
              className="text-sm font-medium text-gray-600 hover:text-red-800 disabled:opacity-50 dark:text-gray-400 dark:hover:text-red-300"
            >
              {deleteBusy ? 'Deleting…' : 'Delete draft'}
            </button>
          ) : null}
          <Link to="/borrower/dashboard" className="text-sm font-medium text-red-600 hover:underline dark:text-red-400">
            Dashboard
          </Link>
        </div>
      </div>

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              disabled={s.id > step && app.is_draft === false}
              onClick={() => setStep(s.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                step === s.id
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 text-gray-800 dark:bg-[#1F2937] dark:text-gray-200'
              }`}
            >
              {STEPS.findIndex((stepItem) => stepItem.id === s.id) + 1}. {s.title}
            </button>
          </li>
        ))}
      </ol>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>
      ) : null}
      {toast ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-green-500/10 dark:text-green-300">{toast}</p>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="md:col-span-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#1F2937] dark:bg-[#111827]">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Loan type
              <select
                value={loanType}
                onChange={(e) => changeLoanType(e.target.value)}
                className={`mt-1 block max-w-md rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-[#0F172A] ${ui.input}`}
              >
                {Object.entries(schema.loan_types).map(([k, lab]) => (
                  <option key={k} value={k}>
                    {lab}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {Object.entries(groupedCommon).map(([grp, rows]) => (
            <section
              key={grp}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#1F2937] dark:bg-[#111827]"
            >
              <h3 className="text-sm font-semibold capitalize text-gray-900 dark:text-gray-100">{grp}</h3>
              <div className="mt-3 space-y-3">
                {rows.map((row) => (
                  <label key={row.key} className="block text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{row.label}</span>
                    {row.type === 'textarea' ? (
                      <textarea
                        className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-[#0F172A] ${ui.input}`}
                        rows={3}
                        value={formData[row.key] ?? ''}
                        onChange={(e) => onField(row.key, e.target.value)}
                      />
                    ) : row.type === 'numeric' ? (
                      <input
                        type="number"
                        className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-[#0F172A] ${ui.input}`}
                        value={formData[row.key] ?? ''}
                        onChange={(e) => onField(row.key, e.target.value)}
                      />
                    ) : (
                      <input
                        type={row.type === 'email' ? 'email' : row.type === 'date' ? 'date' : 'text'}
                        className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-[#0F172A] ${ui.input}`}
                        value={formData[row.key] ?? ''}
                        onChange={(e) => onField(row.key, e.target.value)}
                      />
                    )}
                  </label>
                ))}
              </div>
            </section>
          ))}
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:col-span-2 dark:border-[#1F2937] dark:bg-[#111827]">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Loan-specific details</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block text-sm md:col-span-2">
                <span className="text-gray-700 dark:text-gray-300">Loan product</span>
                <select
                  className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-[#0F172A] ${ui.input}`}
                  value={formData.loan_product_id ?? ''}
                  onChange={(e) => onField('loan_product_id', e.target.value)}
                >
                  <option value="">Select product</option>
                  {filteredProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-gray-700 dark:text-gray-300">Loan amount</span>
                <input
                  type="number"
                  min="0"
                  max={selectedProduct?.max_amount || undefined}
                  className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-[#0F172A] ${ui.input}`}
                  value={formData.loan_amount ?? ''}
                  onChange={(e) => onField('loan_amount', e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700 dark:text-gray-300">Term (months)</span>
                <input
                  type="number"
                  min="1"
                  max={selectedProduct?.max_term || 360}
                  className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-[#0F172A] ${ui.input}`}
                  value={formData.term_months ?? ''}
                  onChange={(e) => onField('term_months', e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700 dark:text-gray-300">Application nature</span>
                <select
                  className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-[#0F172A] ${ui.input}`}
                  value={formData.application_nature ?? 'new'}
                  onChange={(e) => onField('application_nature', e.target.value)}
                >
                  <option value="new">New loan</option>
                  <option value="reloan">Re-loan</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-gray-700 dark:text-gray-300">Age</span>
                <input
                  type="number"
                  min="18"
                  max="100"
                  className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-[#0F172A] ${ui.input}`}
                  value={formData.age ?? ''}
                  onChange={(e) => onField('age', e.target.value)}
                />
              </label>
              {selectedProduct?.slug === 'sss-pension-loan' ? (
                <label className="block text-sm md:col-span-2">
                  <span className="text-gray-700 dark:text-gray-300">Monthly pension</span>
                  <input
                    type="number"
                    min="0"
                    className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-[#0F172A] ${ui.input}`}
                    value={formData.monthly_pension ?? ''}
                    onChange={(e) => onField('monthly_pension', e.target.value)}
                  />
                </label>
              ) : null}
              {selectedProduct ? (
                <div className={`rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs md:col-span-2 ${ui.textMuted}`}>
                  Product rules: {selectedProduct.collateral_type || 'Collateral not set'} · Max term {selectedProduct.max_term || '—'} · Max loan{' '}
                  {selectedProduct.max_amount ? `₱${Number(selectedProduct.max_amount).toLocaleString()}` : '—'}
                </div>
              ) : null}
              {loanFields.map((row) => (
                <label key={row.key} className="block text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{row.label}</span>
                  {row.type === 'textarea' ? (
                    <textarea
                      className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-[#0F172A] ${ui.input}`}
                      rows={3}
                      value={formData[row.key] ?? ''}
                      onChange={(e) => onField(row.key, e.target.value)}
                    />
                  ) : (
                    <input
                      type={row.type === 'numeric' ? 'number' : 'text'}
                      className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-[#0F172A] ${ui.input}`}
                      value={formData[row.key] ?? ''}
                      onChange={(e) => onField(row.key, e.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
            {app?.computation_breakdown?.breakdown ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 text-sm dark:border-emerald-800/50 dark:bg-emerald-900/10">
                <p className="font-semibold text-emerald-900 dark:text-emerald-200">Live product computation</p>
                <div className="mt-2 grid gap-1 text-xs text-emerald-900 dark:text-emerald-200/90 md:grid-cols-2">
                  <p>Monthly amortization: ₱{Number(app.computation_breakdown.breakdown.monthly_amortization || 0).toLocaleString()}</p>
                  <p>Monthly interest: ₱{Number(app.computation_breakdown.breakdown.monthly_interest || 0).toLocaleString()}</p>
                  <p>Total miscellaneous: ₱{Number(app.computation_breakdown.breakdown.total_miscellaneous_fees || 0).toLocaleString()}</p>
                  <p>Net proceeds: ₱{Number(app.computation_breakdown.breakdown.net_proceeds || 0).toLocaleString()}</p>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#1F2937] dark:bg-[#111827]">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Required documents</h3>
          <p className={`text-xs ${ui.textMuted}`}>
            Upload clear files via drag-and-drop or file picker. Allowed: PDF/JPG/PNG, max {MAX_UPLOAD_MB}MB each.
          </p>
          <ul className="space-y-4">
            {Object.entries(docDefs).map(([key, meta]) => (
              <li key={key} className="rounded-lg border border-gray-100 p-3 dark:border-[#1F2937]">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{meta.label}</p>
                <p className={`text-xs ${ui.textMuted}`}>{meta.required ? 'Required' : 'Optional'}</p>
                <label
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDraggingDocKey(key)
                  }}
                  onDragLeave={() => setDraggingDocKey((prev) => (prev === key ? '' : prev))}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDraggingDocKey('')
                    const dropped = e.dataTransfer?.files?.[0]
                    if (dropped) uploadDoc(key, dropped)
                  }}
                  className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-5 text-center transition ${
                    draggingDocKey === key
                      ? 'border-red-400 bg-red-50/60 dark:border-red-500 dark:bg-red-900/20'
                      : 'border-gray-300 bg-gray-50/60 hover:border-red-300 hover:bg-red-50/30 dark:border-gray-600 dark:bg-[#0F172A]/50'
                  }`}
                >
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => uploadDoc(key, e.target.files?.[0])}
                  />
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100">Drag and drop file here</span>
                  <span className={`mt-1 text-xs ${ui.textMuted}`}>or click to browse</span>
                </label>
                {app.documents?.[key]?.urls?.length ? (
                  <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                    ✔ Uploaded:{' '}
                    {app.documents[key].urls.map((u) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer" className="ml-1 underline">
                        view
                      </a>
                    ))}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Not uploaded yet</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#1F2937] dark:bg-[#111827]">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Preview</h3>
          <dl className="grid gap-2 text-sm md:grid-cols-2">
            {Object.entries(formData).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-gray-50 p-2 dark:bg-[#0F172A]/50">
                <dt className="text-xs uppercase text-gray-500">{k.replace(/_/g, ' ')}</dt>
                <dd className="text-gray-900 dark:text-gray-100">{String(v)}</dd>
              </div>
            ))}
          </dl>
          {app.is_draft ? (
            <div className="space-y-3">
              <PrivacyConsentCheckbox
                checked={Boolean(formData?.privacy_consent?.agreed)}
                onChange={onPrivacyConsentChange}
                onOpenPolicy={() => setPrivacyModalOpen(true)}
                error={error.includes('Privacy Policy') ? error : ''}
              />
              <button
                type="button"
                onClick={submitFinal}
                disabled={!formData?.privacy_consent?.agreed}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Submit application
              </button>
            </div>
          ) : (
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Application submitted.</p>
          )}
        </div>
      ) : null}

      {step < 4 ? (
        <div className="flex flex-wrap gap-2">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s === 4 ? 2 : Math.max(1, s - 1)))}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={validateAndNext}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            {step === 2 ? 'Continue to preview' : 'Next step'}
          </button>
        </div>
      ) : null}
      <PrivacyPolicyModal open={privacyModalOpen} onClose={() => setPrivacyModalOpen(false)} />
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Confirm deletion"
        message="Delete this application draft? All progress, uploads, and signatures will be removed. This cannot be undone."
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={performDeleteApplication}
        busy={deleteBusy}
      />
    </div>
  )
}
