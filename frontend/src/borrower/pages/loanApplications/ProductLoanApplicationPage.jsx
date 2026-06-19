import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { borrowerApi } from '../../api/client.js'
import { admin as ui } from '../../../admin/components/AdminUi.jsx'
import PrivacyPolicyModal from '../../../components/privacy/PrivacyPolicyModal.jsx'
import PrivacyConsentCheckbox from '../../../components/privacy/PrivacyConsentCheckbox.jsx'
import { PRIVACY_POLICY_VERSION } from '../../../components/privacy/PrivacyPolicyContent.jsx'
import { resolvePublicFileUrl } from '../../../utils/lendingLaravelApi.js'

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_UPLOAD_MB = 15
const TRAVEL_COST_KEYS = [
  'airfare_cost',
  'visa_cost',
  'medical_cost',
  'placement_fee',
  'processing_fee',
  'pocket_money_requirement',
  'other_expenses',
]

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

function formatValue(value) {
  if (value == null || value === '') return 'Not provided'
  if (typeof value === 'object') return value.agreed ? 'Agreed' : 'Not agreed'
  return String(value)
}

export default function ProductLoanApplicationPage({ loanType }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryApplicationId = searchParams.get('application_id')
  const creatingRef = useRef(false)
  const [schema, setSchema] = useState(null)
  const [app, setApp] = useState(null)
  const [applicationId, setApplicationId] = useState(queryApplicationId || '')
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false)
  const [draggingDocKey, setDraggingDocKey] = useState('')

  const loadSchema = useCallback(async () => {
    const res = await borrowerApi('/borrower/loan-applications/wizard/schema')
    setSchema(res.data)
    return res.data
  }, [])

  const loadApp = useCallback(async (id) => {
    const res = await borrowerApi(`/borrower/loan-applications/${id}`)
    const d = res.data
    setApp(d)
    setFormData(d.form_data || {})
    setStep(Math.max(1, Number(d.draft_step) || 1))
  }, [])

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
        if (!cancelled) setError(e.message || 'Failed to load application.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applicationId, loadApp, loadSchema])

  useEffect(() => {
    if (!schema || applicationId || creatingRef.current) return
    creatingRef.current = true
    ;(async () => {
      try {
        const res = await borrowerApi('/borrower/loan-applications', {
          method: 'POST',
          body: JSON.stringify({ loan_type: loanType }),
        })
        const id = String(res.data.id)
        setApplicationId(id)
        setApp(res.data)
        setFormData(res.data.form_data || {})
        navigate(`/borrower/loan-application/${schema.loan_application_routes?.[loanType] || loanType}?application_id=${id}`, { replace: true })
      } catch (e) {
        setError(e.message || 'Could not start application.')
      } finally {
        creatingRef.current = false
      }
    })()
  }, [applicationId, loanType, navigate, schema])

  const persist = useDebouncedCallback(async (nextForm, nextStep) => {
    if (!applicationId) return
    setSaving(true)
    try {
      const res = await borrowerApi(`/borrower/loan-applications/${applicationId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          loan_type: loanType,
          form_data: nextForm,
          draft_step: nextStep,
        }),
      })
      if (res?.data) setApp(res.data)
    } catch (e) {
      setError(e.message || 'Autosave failed.')
    } finally {
      setSaving(false)
    }
  }, 700)

  const onField = (key, value) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value }
      persist(next, step)
      return next
    })
  }

  const steps = schema?.product_application_steps?.[loanType] || []
  const fieldsBySection = schema?.product_application_fields?.[loanType] || {}
  const loanLabel = schema?.loan_types?.[loanType] || 'Loan Application'
  const productMap = schema?.loan_type_product_map || {}
  const products = schema?.loan_products || []
  const expectedSlug = productMap[loanType] || null
  const filteredProducts = useMemo(() => {
    if (!expectedSlug) return products
    const match = products.filter((p) => p.slug === expectedSlug)
    return match.length ? match : products
  }, [expectedSlug, products])
  const selectedProduct = useMemo(
    () => products.find((p) => Number(p.id) === Number(formData.loan_product_id || 0)) || null,
    [formData.loan_product_id, products],
  )
  const currentStep = steps.find((s) => Number(s.id) === Number(step)) || steps[0]
  const currentSection = currentStep?.section
  const currentFields = fieldsBySection[currentSection] || []
  const travelPurposeDocKeys = schema?.travel_assistance_documents_by_purpose?.[formData.travel_purpose]
    || schema?.travel_assistance_documents_by_purpose?.Other
    || []
  const docDefs = loanType === 'travel_assistance'
    ? Object.fromEntries(travelPurposeDocKeys.map((key) => [key, { ...(schema?.documents_by_type?.travel_assistance?.[key] || { label: key }), required: true }]))
    : schema?.documents_by_type?.[loanType] || {}
  const isDocumentsStep = currentSection === 'documents'
  const isReviewStep = currentSection === 'review'
  const maxStep = steps.length ? Math.max(...steps.map((s) => Number(s.id))) : 1
  const travelReference = loanType === 'travel_assistance' && applicationId
    ? `TAL-${new Date().getFullYear()}-${String(applicationId).padStart(6, '0')}`
    : ''

  useEffect(() => {
    if (loanType !== 'travel_assistance') return
    const total = TRAVEL_COST_KEYS.reduce((sum, key) => sum + (Number(formData[key]) || 0), 0)
    const normalizedTotal = total > 0 ? String(total) : ''
    if ((formData.travel_cost || '') === normalizedTotal) return
    setFormData((prev) => {
      const next = { ...prev, travel_cost: normalizedTotal }
      persist(next, step)
      return next
    })
  }, [
    formData.airfare_cost,
    formData.medical_cost,
    formData.other_expenses,
    formData.placement_fee,
    formData.pocket_money_requirement,
    formData.processing_fee,
    formData.travel_cost,
    formData.visa_cost,
    loanType,
    persist,
    step,
  ])

  useEffect(() => {
    if (!schema || !loanType || formData.loan_product_id) return
    const preferred = products.find((p) => p.slug === expectedSlug) || filteredProducts[0]
    if (preferred?.id) onField('loan_product_id', String(preferred.id))
  }, [expectedSlug, filteredProducts, formData.loan_product_id, loanType, products, schema])

  const shouldShowField = (field) => {
    if (!field.required_if) return true
    return Object.entries(field.required_if).every(([key, expected]) => formData[key] === expected)
  }

  const renderField = (field) => {
    if (!shouldShowField(field)) return null
    if (field.type === 'loan_product') {
      return (
        <label key={field.key} className="block text-sm md:col-span-2">
          <span className="text-gray-700 dark:text-gray-300">{field.label}</span>
          <select
            className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-[#0F172A] ${ui.input}`}
            value={formData[field.key] ?? ''}
            onChange={(e) => onField(field.key, e.target.value)}
          >
            <option value="">Select product</option>
            {filteredProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )
    }
    if (field.type === 'textarea') {
      return (
        <label key={field.key} className="block text-sm md:col-span-2">
          <span className="text-gray-700 dark:text-gray-300">{field.label}</span>
          <textarea
            className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-[#0F172A] ${ui.input}`}
            rows={3}
            value={formData[field.key] ?? ''}
            onChange={(e) => onField(field.key, e.target.value)}
          />
        </label>
      )
    }
    if (field.type === 'select') {
      return (
        <label key={field.key} className="block text-sm">
          <span className="text-gray-700 dark:text-gray-300">{field.label}</span>
          <select
            className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-[#0F172A] ${ui.input}`}
            value={formData[field.key] ?? ''}
            onChange={(e) => onField(field.key, e.target.value)}
          >
            <option value="">Select</option>
            {(field.options || []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      )
    }
    if (field.type === 'computed_sum') {
      return (
        <label key={field.key} className="block text-sm md:col-span-2">
          <span className="text-gray-700 dark:text-gray-300">{field.label}</span>
          <input
            type="number"
            readOnly
            className={`mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-[#0F172A] ${ui.input}`}
            value={formData[field.key] ?? ''}
          />
        </label>
      )
    }
    return (
      <label key={field.key} className="block text-sm">
        <span className="text-gray-700 dark:text-gray-300">{field.label}</span>
        <input
          type={field.type === 'numeric' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
          className={`mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-[#0F172A] ${ui.input}`}
          value={formData[field.key] ?? ''}
          onChange={(e) => onField(field.key, e.target.value)}
        />
      </label>
    )
  }

  const validateAndNext = async () => {
    if (!applicationId) return
    setError('')
    try {
      await borrowerApi(`/borrower/loan-applications/${applicationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ draft_step: step, form_data: formData, loan_type: loanType }),
      })
      const v = await borrowerApi(`/borrower/loan-applications/${applicationId}/validate-step`, {
        method: 'POST',
        body: JSON.stringify({ step }),
      })
      if (v.ok === false && Array.isArray(v.errors) && v.errors.length) {
        setError(v.errors.join(' '))
        return
      }
      const next = Math.min(maxStep, step + 1)
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
    if (!formData?.privacy_consent?.agreed) {
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
    onField('privacy_consent', {
      agreed,
      agreed_at: agreed ? new Date().toISOString() : null,
      policy_version: PRIVACY_POLICY_VERSION,
    })
    setError('')
  }

  if (loading) return <p className={`text-sm ${ui.textMuted}`}>Loading {loanLabel.toLowerCase()} form...</p>
  if (!schema || (!app && !applicationId)) return <p className={`text-sm ${ui.textMuted}`}>Preparing application...</p>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#DC2626]">Loan application</p>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {loanLabel} {applicationId ? `#${applicationId}` : ''}
          </h2>
          <p className={`text-sm ${ui.textMuted}`}>
            {app?.is_draft === false ? 'Submitted' : 'Draft - progress auto-saves.'} {saving ? ' Saving...' : ''}
          </p>
        </div>
        <Link to="/borrower/dashboard" className="text-sm font-medium text-red-600 hover:underline dark:text-red-400">
          Dashboard
        </Link>
      </div>

      <ol className="flex flex-wrap gap-2">
        {steps.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setStep(Number(s.id))}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                Number(step) === Number(s.id)
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 text-gray-800 dark:bg-[#1F2937] dark:text-gray-200'
              }`}
            >
              Step {s.id} - {s.title}
            </button>
          </li>
        ))}
      </ol>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p> : null}
      {toast ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-green-500/10 dark:text-green-300">{toast}</p> : null}

      {!isDocumentsStep && !isReviewStep ? (
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#1F2937] dark:bg-[#111827]">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{currentStep?.title}</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {currentFields.map(renderField)}
            {currentSection === 'loan' && selectedProduct ? (
              <div className={`rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs md:col-span-2 ${ui.textMuted}`}>
                Product rules: {selectedProduct.collateral_type || 'Collateral not set'} · Max term {selectedProduct.max_term || '-'} · Max loan{' '}
                {selectedProduct.max_amount ? `PHP ${Number(selectedProduct.max_amount).toLocaleString()}` : '-'}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {isDocumentsStep ? (
        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#1F2937] dark:bg-[#111827]">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{currentStep?.title}</h3>
          <p className={`text-xs ${ui.textMuted}`}>Upload clear PDF/JPG/PNG files, max {MAX_UPLOAD_MB}MB each.</p>
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
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => uploadDoc(key, e.target.files?.[0])} />
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100">Drag and drop file here</span>
                  <span className={`mt-1 text-xs ${ui.textMuted}`}>or click to browse</span>
                </label>
                {app?.documents?.[key]?.urls?.length ? (
                  <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                    Uploaded:{' '}
                    {app.documents[key].urls.map((u) => (
                      <a key={u} href={resolvePublicFileUrl(u)} target="_blank" rel="noreferrer" className="ml-1 underline">
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
        </section>
      ) : null}

      {isReviewStep ? (
        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#1F2937] dark:bg-[#111827]">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Review & Submit</h3>
          {travelReference ? (
            <div className="rounded-lg border border-red-100 bg-red-50/60 p-3 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
              <span className="font-semibold">Travel Assistance Loan Reference Number:</span> {travelReference}
            </div>
          ) : null}
          <dl className="grid gap-2 text-sm md:grid-cols-2">
            {Object.entries(fieldsBySection).flatMap(([, rows]) => rows).filter(shouldShowField).map((field) => (
              <div key={field.key} className="rounded-lg bg-gray-50 p-2 dark:bg-[#0F172A]/50">
                <dt className="text-xs uppercase text-gray-500">{field.label}</dt>
                <dd className="text-gray-900 dark:text-gray-100">{formatValue(formData[field.key])}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Uploaded Documents</h4>
            <ul className="mt-2 grid gap-2 text-sm md:grid-cols-2">
              {Object.entries(docDefs).map(([key, meta]) => (
                <li key={key} className="rounded-lg bg-gray-50 p-2 dark:bg-[#0F172A]/50">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{meta.label}</span>
                  <span className={`ml-2 text-xs ${app?.documents?.[key]?.urls?.length ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                    {app?.documents?.[key]?.urls?.length ? 'Uploaded' : 'Missing'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {app?.is_draft === false ? (
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Application submitted.</p>
          ) : (
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
          )}
        </section>
      ) : null}

      {!isReviewStep ? (
        <div className="flex flex-wrap gap-2">
          {step > 1 ? (
            <button type="button" onClick={() => setStep((s) => Math.max(1, s - 1))} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600">
              Back
            </button>
          ) : null}
          <button type="button" onClick={validateAndNext} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
            {step + 1 >= maxStep ? 'Continue to review' : 'Next step'}
          </button>
        </div>
      ) : null}

      <PrivacyPolicyModal open={privacyModalOpen} onClose={() => setPrivacyModalOpen(false)} />
    </div>
  )
}
