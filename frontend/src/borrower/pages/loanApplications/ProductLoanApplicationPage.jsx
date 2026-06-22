import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { borrowerApi } from '../../api/client.js'
import PrivacyPolicyModal from '../../../components/privacy/PrivacyPolicyModal.jsx'
import PrivacyConsentCheckbox from '../../../components/privacy/PrivacyConsentCheckbox.jsx'
import { PRIVACY_POLICY_VERSION } from '../../../components/privacy/PrivacyPolicyContent.jsx'
import { resolvePublicFileUrl } from '../../../utils/lendingLaravelApi.js'
import {
  AlertBanner,
  ComputationCard,
  DocumentUploadZone,
  Field,
  ProductRulesCard,
  ReviewGrid,
  WizardFooter,
  WizardStepHeader,
  WizardStepSidebar,
  fieldPlaceholder,
  selectInputClass,
  slideVariants,
  textInputClass,
} from '../../components/LoanApplicationUi.jsx'
import { useToast } from '../../../admin/context/ToastContext.jsx'

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

const SECTION_HINTS = {
  personal: 'Provide accurate identity details as they appear on your valid ID.',
  borrower: 'Borrower information must match your government-issued ID.',
  pensioner: 'Pensioner details should match your SSS or GSIS records.',
  applicant: 'Applicant information is used for travel assistance verification.',
  employment: 'Employment details help us assess repayment capacity.',
  employment_financial: 'Income and employment details support your application review.',
  income: 'Declare salary and other income sources honestly.',
  loan: 'Choose your product, amount, and repayment term carefully.',
  vehicle: 'Vehicle details must match OR/CR documents.',
  property: 'Property information must match title and tax declaration records.',
  pension: 'Pension details must match your benefit records.',
  travel: 'Travel plans and cost estimates guide your assistance request.',
  documents: 'Upload clear, readable copies of each required document.',
  review: 'Review all entries before submitting your application.',
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

function formatValue(value) {
  if (value == null || value === '') return 'Not provided'
  if (typeof value === 'object') return value.agreed ? 'Agreed' : 'Not agreed'
  return String(value)
}

export default function ProductLoanApplicationPage({ loanType }) {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryApplicationId = searchParams.get('application_id')
  const creatingRef = useRef(false)
  const [schema, setSchema] = useState(null)
  const [app, setApp] = useState(null)
  const [applicationId, setApplicationId] = useState(queryApplicationId || '')
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [formData, setFormData] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
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
        if (applicationId) await loadApp(applicationId)
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
  const travelPurposeDocKeys =
    schema?.travel_assistance_documents_by_purpose?.[formData.travel_purpose] ||
    schema?.travel_assistance_documents_by_purpose?.Other ||
    []
  const docDefs =
    loanType === 'travel_assistance'
      ? Object.fromEntries(
          travelPurposeDocKeys.map((key) => [
            key,
            { ...(schema?.documents_by_type?.travel_assistance?.[key] || { label: key }), required: true },
          ]),
        )
      : schema?.documents_by_type?.[loanType] || {}
  const isDocumentsStep = currentSection === 'documents'
  const isReviewStep = currentSection === 'review'
  const maxStep = steps.length ? Math.max(...steps.map((s) => Number(s.id))) : 1
  const stepIndex = steps.findIndex((s) => Number(s.id) === Number(step))
  const travelReference =
    loanType === 'travel_assistance' && applicationId
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

  const goToStep = (nextStep) => {
    setDirection(nextStep > step ? 1 : -1)
    setStep(nextStep)
  }

  const renderField = (field) => {
    if (!shouldShowField(field)) return null
    const placeholder = fieldPlaceholder(field)
    const required = Boolean(field.required || field.required_if)
    const spanClass = field.type === 'textarea' || field.type === 'loan_product' || field.type === 'computed_sum' ? 'md:col-span-2' : ''

    if (field.type === 'loan_product') {
      return (
        <Field key={field.key} label={field.label} required={required} className={spanClass}>
          <select
            className={selectInputClass()}
            value={formData[field.key] ?? ''}
            onChange={(e) => onField(field.key, e.target.value)}
          >
            <option value="">Select loan product</option>
            {filteredProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      )
    }
    if (field.type === 'textarea') {
      return (
        <Field key={field.key} label={field.label} required={required} className={spanClass}>
          <textarea
            className={textInputClass()}
            rows={3}
            placeholder={placeholder}
            value={formData[field.key] ?? ''}
            onChange={(e) => onField(field.key, e.target.value)}
          />
        </Field>
      )
    }
    if (field.type === 'select') {
      return (
        <Field key={field.key} label={field.label} required={required} className={spanClass}>
          <select
            className={selectInputClass()}
            value={formData[field.key] ?? ''}
            onChange={(e) => onField(field.key, e.target.value)}
          >
            <option value="">Select an option</option>
            {(field.options || []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
      )
    }
    if (field.type === 'computed_sum') {
      return (
        <Field key={field.key} label={field.label} hint="Auto-calculated from travel cost fields" className={spanClass}>
          <input type="number" readOnly className={textInputClass(true)} value={formData[field.key] ?? ''} />
        </Field>
      )
    }
    return (
      <Field key={field.key} label={field.label} required={required} className={spanClass}>
        <input
          type={field.type === 'numeric' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
          className={textInputClass()}
          placeholder={placeholder}
          value={formData[field.key] ?? ''}
          onChange={(e) => onField(field.key, e.target.value)}
        />
      </Field>
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
      goToStep(next)
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
      showToast(res.message || 'Submitted.', 'success')
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

  const reviewItems = Object.entries(fieldsBySection)
    .flatMap(([, rows]) => rows)
    .filter(shouldShowField)
    .map((field) => ({
      key: field.key,
      label: field.label,
      value: formatValue(formData[field.key]),
    }))

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading {loanLabel.toLowerCase()} application…</p>
      </div>
    )
  }
  if (!schema || (!app && !applicationId)) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Preparing your application…</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-primary">Apply for a loan</p>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 sm:text-2xl">
            {loanLabel}
            {applicationId ? <span className="text-gray-400"> #{applicationId}</span> : null}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {app?.is_draft === false ? 'Application submitted' : 'Draft — auto-saves as you complete each step'}
            {saving ? ' · Saving…' : ''}
          </p>
        </div>
        <Link
          to="/borrower/dashboard"
          className="text-sm font-medium text-brand-primary transition hover:underline"
        >
          Back to dashboard
        </Link>
      </div>

      {error ? <AlertBanner type="error">{error}</AlertBanner> : null}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl dark:border-[#1F2937] dark:bg-[#111827]"
      >
        <div className="grid lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)]">
          <WizardStepSidebar
            steps={steps}
            step={step}
            loanLabel={loanLabel}
            onStepClick={goToStep}
            allowJump={app?.is_draft !== false}
          />

          <div className="flex min-h-[480px] flex-col">
            <WizardStepHeader
              title={currentStep?.title || 'Application'}
              description={SECTION_HINTS[currentSection] || 'Fill in the required details below.'}
              stepNumber={stepIndex + 1}
              totalSteps={steps.length}
            />

            <div className="flex flex-1 flex-col overflow-hidden">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={`${step}-${currentSection}`}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-1 flex-col overflow-y-auto px-5 py-5 sm:px-6 sm:py-6"
                >
                  {!isDocumentsStep && !isReviewStep ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {currentFields.map(renderField)}
                      {currentSection === 'loan' && selectedProduct ? <ProductRulesCard product={selectedProduct} /> : null}
                      {currentSection === 'loan' && app?.computation_breakdown ? (
                        <ComputationCard breakdown={app.computation_breakdown} />
                      ) : null}
                    </div>
                  ) : null}

                  {isDocumentsStep ? (
                    <ul className="space-y-4">
                      {Object.entries(docDefs).map(([key, meta]) => (
                        <DocumentUploadZone
                          key={key}
                          docKey={key}
                          meta={meta}
                          dragging={draggingDocKey === key}
                          onDragState={setDraggingDocKey}
                          onUpload={uploadDoc}
                          uploadedUrls={app?.documents?.[key]?.urls}
                          resolveUrl={resolvePublicFileUrl}
                        />
                      ))}
                    </ul>
                  ) : null}

                  {isReviewStep ? (
                    <div className="space-y-5">
                      {travelReference ? (
                        <AlertBanner type="warning">
                          <span className="font-semibold">Travel reference:</span> {travelReference}
                        </AlertBanner>
                      ) : null}
                      <ReviewGrid items={reviewItems} />
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Uploaded documents</h4>
                        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                          {Object.entries(docDefs).map(([key, meta]) => (
                            <li
                              key={key}
                              className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-sm dark:border-[#1F2937] dark:bg-[#0F172A]/40"
                            >
                              <span className="font-medium text-gray-800 dark:text-gray-200">{meta.label}</span>
                              <span
                                className={`ml-2 text-xs ${
                                  app?.documents?.[key]?.urls?.length
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-amber-700 dark:text-amber-400'
                                }`}
                              >
                                {app?.documents?.[key]?.urls?.length ? 'Uploaded' : 'Missing'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {app?.is_draft === false ? (
                        <AlertBanner type="success">Application submitted successfully.</AlertBanner>
                      ) : (
                        <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-4 dark:border-[#1F2937] dark:bg-[#0F172A]/30">
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
                            className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-8"
                          >
                            Submit application
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </div>

            {!isReviewStep ? (
              <WizardFooter
                showBack={step > 1}
                onBack={() => goToStep(Math.max(1, step - 1))}
                onNext={validateAndNext}
                nextLabel={step + 1 >= maxStep ? 'Continue to review' : 'Continue'}
              />
            ) : null}
          </div>
        </div>
      </motion.div>

      <PrivacyPolicyModal open={privacyModalOpen} onClose={() => setPrivacyModalOpen(false)} />
    </div>
  )
}
