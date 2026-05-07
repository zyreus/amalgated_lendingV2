import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { borrowerApi } from '../api/client.js'
import SignaturePad from '../components/SignaturePad.jsx'
import { admin as ui } from '../../admin/components/AdminUi.jsx'
import PrivacyPolicyModal from '../../components/privacy/PrivacyPolicyModal.jsx'
import PrivacyConsentCheckbox from '../../components/privacy/PrivacyConsentCheckbox.jsx'
import { PRIVACY_POLICY_VERSION } from '../../components/privacy/PrivacyPolicyContent.jsx'

const STEPS = [
  { id: 1, title: 'Application form' },
  { id: 2, title: 'Documents' },
  { id: 3, title: 'Signatures' },
  { id: 4, title: 'Preview & submit' },
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

export default function BorrowerLoanWizardPage() {
  const { applicationId } = useParams()
  const navigate = useNavigate()
  const [schema, setSchema] = useState(null)
  const [app, setApp] = useState(null)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({})
  const [loanType, setLoanType] = useState('salary')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false)

  const sigApplicant = useRef(null)
  const sigSpouse = useRef(null)
  const sigComaker = useRef(null)

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
    setStep(Math.min(Math.max(d.draft_step || 1, 1), 4))
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
        if (!cancelled) setError(e.message || 'Failed to load.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applicationId, loadApp, loadSchema])

  const persist = useDebouncedCallback(async (nextForm, nextStep, nextLoanType) => {
    if (!applicationId || !app) return
    setSaving(true)
    try {
      await borrowerApi(`/borrower/loan-applications/${applicationId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          form_data: nextForm,
          draft_step: nextStep,
          loan_type: nextLoanType,
        }),
      })
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
      navigate(`/borrower/apply-loan/${res.data.id}`, { replace: true })
    } catch (e) {
      setError(e.message || 'Could not start application.')
    }
  }

  const loanFields = useMemo(() => {
    if (!schema || !loanType) return []
    return schema.loan_type_fields?.[loanType] || []
  }, [schema, loanType])

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
      const next = Math.min(step + 1, 4)
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

  const saveSignatureRole = async (role, dataUrl) => {
    if (!dataUrl || !applicationId) return
    setError('')
    try {
      const res = await borrowerApi(`/borrower/loan-applications/${applicationId}/signature`, {
        method: 'POST',
        body: JSON.stringify({ role, signature_base64: dataUrl }),
      })
      setApp(res.data)
      setToast('Signature saved.')
      setTimeout(() => setToast(''), 2500)
    } catch (e) {
      setError(e.message || 'Could not save signature.')
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
      setApp(res.data)
      setStep(4)
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
        <Link to="/borrower/dashboard" className="text-sm font-medium text-red-600 hover:underline dark:text-red-400">
          Dashboard
        </Link>
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
              {s.id}. {s.title}
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
          </section>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#1F2937] dark:bg-[#111827]">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Required documents</h3>
          <ul className="space-y-4">
            {Object.entries(docDefs).map(([key, meta]) => (
              <li key={key} className="rounded-lg border border-gray-100 p-3 dark:border-[#1F2937]">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{meta.label}</p>
                <p className={`text-xs ${ui.textMuted}`}>{meta.required ? 'Required' : 'Optional'}</p>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="mt-2 w-full text-sm"
                  onChange={(e) => uploadDoc(key, e.target.files?.[0])}
                />
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

      {step === 3 ? (
        <div className="grid gap-6 md:grid-cols-2">
          <SignaturePad
            label="Applicant signature *"
            onChange={(data) => {
              sigApplicant.current = data
            }}
          />
          <SignaturePad
            label="Spouse signature (optional)"
            onChange={(data) => {
              sigSpouse.current = data
            }}
          />
          {loanType === 'chattel' ? (
            <SignaturePad
              label="Co-maker signature *"
              onChange={(data) => {
                sigComaker.current = data
              }}
            />
          ) : null}
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={async () => {
                if (sigApplicant.current) await saveSignatureRole('applicant', sigApplicant.current)
                if (sigSpouse.current) await saveSignatureRole('spouse', sigSpouse.current)
                if (loanType === 'chattel' && sigComaker.current) await saveSignatureRole('comaker', sigComaker.current)
              }}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white dark:bg-gray-100 dark:text-gray-900"
            >
              Save signatures
            </button>
            <p className={`mt-2 text-xs ${ui.textMuted}`}>Draw above, then click Save signatures. Applicant is required before submit.</p>
          </div>
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
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Signatures</p>
            <div className="mt-2 flex flex-wrap gap-4">
              {app.signatures?.applicant ? (
                <img src={app.signatures.applicant} alt="Applicant" className="h-24 rounded border border-gray-200 bg-white" />
              ) : (
                <span className="text-sm text-amber-700">Applicant signature missing</span>
              )}
              {app.signatures?.spouse ? (
                <img src={app.signatures.spouse} alt="Spouse" className="h-24 rounded border border-gray-200 bg-white" />
              ) : null}
              {app.signatures?.comaker ? (
                <img src={app.signatures.comaker} alt="Co-maker" className="h-24 rounded border border-gray-200 bg-white" />
              ) : null}
            </div>
          </div>
          {app.print_url ? (
            <a
              href={app.print_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 dark:border-gray-600 dark:text-gray-200"
            >
              Open print view (A4)
            </a>
          ) : null}
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
              onClick={() => setStep((s) => Math.max(1, s - 1))}
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
            {step === 3 ? 'Continue to preview' : 'Next step'}
          </button>
        </div>
      ) : null}
      <PrivacyPolicyModal open={privacyModalOpen} onClose={() => setPrivacyModalOpen(false)} />
    </div>
  )
}
