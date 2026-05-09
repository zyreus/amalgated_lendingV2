import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  patchDocumentLoanWizard,
  uploadEmbeddedDocument,
} from '../utils/documentLoanApi.js'
import { getLaravelStorageFileUrl } from '../utils/lendingLaravelApi.js'

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white'
const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50'
const gridClass = 'grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-4'

function StepIcon({ children }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20">
      {children}
    </span>
  )
}

function Stepper({ step, highestPassed, onSelect }) {
  const items = [
    { n: 1, label: 'Personal' },
    { n: 2, label: 'Loan' },
    { n: 3, label: 'Employment' },
    { n: 4, label: 'Documents' },
  ]
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {items.map(({ n, label }) => {
        const current = step === n
        const showCheck = highestPassed >= n && !current
        return (
          <button
            key={n}
            type="button"
            onClick={() => onSelect(n)}
            className={`flex min-w-[7rem] flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition sm:text-sm ${
              current
                ? 'border-brand-primary bg-brand-primary/10 text-brand-primary ring-2 ring-brand-primary/25'
                : 'border-slate-200 bg-white text-brand-text hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white'
            }`}
          >
            {showCheck ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white" aria-hidden>
                ✓
              </span>
            ) : (
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  current ? 'bg-brand-primary text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-100'
                }`}
              >
                {n}
              </span>
            )}
            <span className="truncate">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function DocumentLoanWizardSection({ application, product, onApplicationRefresh }) {
  const af = application?.application_form || {}
  const highest = application?.wizard?.highest_passed_step ?? 0
  const emb = application?.embedded_documents || {}

  const [step, setStep] = useState(1)
  const [collapsed, setCollapsed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')

  const [personal, setPersonal] = useState({
    full_name: '',
    address: '',
    phone: '',
    email: '',
    date_of_birth: '',
    civil_status: '',
  })
  const [loan, setLoan] = useState({
    loan_type: '',
    loan_amount: '',
    purpose: '',
    terms: '',
  })
  const [employment, setEmployment] = useState({
    employment_status: '',
    monthly_income: '',
    employer_name: '',
    other_income: '',
  })

  useEffect(() => {
    const p = af.personal || {}
    const l = af.loan || {}
    const e = af.employment || {}
    setPersonal((s) => ({
      ...s,
      full_name: p.full_name ?? s.full_name,
      address: p.address ?? s.address,
      phone: p.phone ?? s.phone,
      email: p.email ?? s.email,
      date_of_birth: p.date_of_birth ? String(p.date_of_birth).slice(0, 10) : s.date_of_birth,
      civil_status: p.civil_status ?? s.civil_status,
    }))
    setLoan((s) => ({
      ...s,
      loan_type: l.loan_type ?? s.loan_type,
      loan_amount: l.loan_amount != null ? String(l.loan_amount) : s.loan_amount,
      purpose: l.purpose ?? s.purpose,
      terms: l.terms ?? s.terms,
    }))
    setEmployment((s) => ({
      ...s,
      employment_status: e.employment_status ?? s.employment_status,
      monthly_income: e.monthly_income != null ? String(e.monthly_income) : s.monthly_income,
      employer_name: e.employer_name ?? s.employer_name,
      other_income: e.other_income != null && e.other_income !== '' ? String(e.other_income) : s.other_income,
    }))
  }, [application?.id, af])

  useEffect(() => {
    if (product?.name && !loan.loan_type) {
      setLoan((l) => ({ ...l, loan_type: product.name }))
    }
  }, [product?.name, loan.loan_type])

  const refresh = useCallback(async () => {
    if (onApplicationRefresh) await onApplicationRefresh()
  }, [onApplicationRefresh])

  const saveStep = async (stepNum, advance) => {
    setLocalError('')
    setBusy(true)
    try {
      const data =
        stepNum === 1
          ? {
              full_name: personal.full_name.trim(),
              address: personal.address.trim(),
              phone: personal.phone.trim(),
              email: personal.email.trim(),
              date_of_birth: personal.date_of_birth,
              civil_status: personal.civil_status.trim(),
            }
          : stepNum === 2
            ? {
                loan_type: loan.loan_type.trim(),
                loan_amount: loan.loan_amount === '' ? '' : Number(loan.loan_amount),
                purpose: loan.purpose.trim(),
                terms: loan.terms.trim(),
              }
            : stepNum === 3
              ? {
                  employment_status: employment.employment_status.trim(),
                  monthly_income: employment.monthly_income === '' ? '' : Number(employment.monthly_income),
                  employer_name: employment.employer_name.trim(),
                  other_income:
                    employment.other_income === '' || employment.other_income == null
                      ? null
                      : Number(employment.other_income),
                }
              : {}

      await patchDocumentLoanWizard(application.id, {
        step: stepNum,
        data,
        advance,
      })
      await refresh()
      if (advance && stepNum < 4) {
        setStep(stepNum + 1)
      }
    } catch (e) {
      const msg = e?.body?.message || e?.message || 'Validation failed.'
      setLocalError(typeof msg === 'string' ? msg : 'Could not save this step.')
    } finally {
      setBusy(false)
    }
  }

  const savePreviewStep = async () => {
    setLocalError('')
    setBusy(true)
    try {
      await patchDocumentLoanWizard(application.id, { step: 4, data: {}, advance: true })
      await refresh()
      setCollapsed(true)
    } catch (e) {
      setLocalError(e?.message || 'Could not continue.')
    } finally {
      setBusy(false)
    }
  }

  const handleEmbedded = async (slot, file, replaceIndex) => {
    if (!file) return
    setLocalError('')
    setBusy(true)
    try {
      await uploadEmbeddedDocument({
        documentLoanApplicationId: application.id,
        slot,
        file,
        replaceIndex,
      })
      await refresh()
    } catch (e) {
      setLocalError(e?.message || 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  const goStep = (n) => {
    if (n >= 1 && n <= 4) setStep(n)
  }

  const summary = useMemo(() => {
    return {
      personal,
      loan,
      employment,
      valid: Boolean(emb.valid_id_url),
      proof: Boolean(emb.proof_income_url),
      extra: Array.isArray(emb.additional_urls) ? emb.additional_urls.length : 0,
    }
  }, [personal, loan, employment, emb])

  if (collapsed) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-brand-text dark:text-white">Application details</h3>
            <p className="mt-1 text-sm text-brand-text/70 dark:text-white/60">
              {summary.personal.full_name || 'Borrower'} · Wizard highest completed step: {highest} / 4
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-brand-text dark:border-slate-600 dark:text-white"
          >
            Edit application
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/60">
      <div className="flex flex-wrap items-start gap-3">
        <StepIcon>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </StepIcon>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-brand-text dark:text-white">Loan application wizard</h3>
          <p className="mt-1 text-sm text-brand-text/70 dark:text-white/60">
            Complete each section. A check appears only after you continue past that step. Optional fields can stay empty where allowed.
          </p>
        </div>
      </div>

      <Stepper step={step} highestPassed={highest} onSelect={goStep} />

      {localError ? (
        <div role="alert" className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-200">
          {localError}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-text/50 dark:text-white/45">Step 1 — Personal</p>
          <div className={gridClass}>
            <div className="md:col-span-2">
              <label className={labelClass}>Full name</label>
              <input className={inputClass} value={personal.full_name} onChange={(e) => setPersonal((s) => ({ ...s, full_name: e.target.value }))} />
              <p className="mt-1 text-xs text-brand-text/55 dark:text-white/45">As shown on your valid ID.</p>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Address</label>
              <input className={inputClass} value={personal.address} onChange={(e) => setPersonal((s) => ({ ...s, address: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Contact number</label>
              <input className={inputClass} value={personal.phone} onChange={(e) => setPersonal((s) => ({ ...s, phone: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" className={inputClass} value={personal.email} onChange={(e) => setPersonal((s) => ({ ...s, email: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Date of birth</label>
              <input type="date" className={inputClass} value={personal.date_of_birth} onChange={(e) => setPersonal((s) => ({ ...s, date_of_birth: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Civil status</label>
              <select
                className={inputClass}
                value={personal.civil_status}
                onChange={(e) => setPersonal((s) => ({ ...s, civil_status: e.target.value }))}
              >
                <option value="">Select…</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Widowed">Widowed</option>
                <option value="Separated">Separated</option>
                <option value="Divorced">Divorced</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => saveStep(1, true)}
              className="rounded-xl bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-primary-hover disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Continue'}
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-text/50 dark:text-white/45">Step 2 — Loan details</p>
          <div className={gridClass}>
            <div className="md:col-span-2">
              <label className={labelClass}>Loan type</label>
              <select className={inputClass} value={loan.loan_type} onChange={(e) => setLoan((l) => ({ ...l, loan_type: e.target.value }))}>
                <option value="">Select…</option>
                {product?.name ? <option value={product.name}>{product.name}</option> : null}
                <option value="Salary Loan">Salary Loan</option>
                <option value="Chattel Mortgage">Chattel Mortgage</option>
                <option value="Real Estate Mortgage">Real Estate Mortgage</option>
                <option value="Other">Other</option>
              </select>
              <p className="mt-1 text-xs text-brand-text/55 dark:text-white/45">Defaults to this product; you may change if needed.</p>
            </div>
            <div>
              <label className={labelClass}>Loan amount (PHP)</label>
              <input type="number" min="0" step="0.01" className={inputClass} value={loan.loan_amount} onChange={(e) => setLoan((l) => ({ ...l, loan_amount: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Terms</label>
              <select className={inputClass} value={loan.terms} onChange={(e) => setLoan((l) => ({ ...l, terms: e.target.value }))}>
                <option value="">Select…</option>
                <option value="6 months">6 months</option>
                <option value="12 months">12 months</option>
                <option value="24 months">24 months</option>
                <option value="36 months">36 months</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Purpose</label>
              <textarea rows={3} className={inputClass} value={loan.purpose} onChange={(e) => setLoan((l) => ({ ...l, purpose: e.target.value }))} />
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <button type="button" onClick={() => setStep(1)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600">
              Back
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => saveStep(2, true)}
              className="rounded-xl bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-primary-hover disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Continue'}
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-text/50 dark:text-white/45">Step 3 — Employment &amp; financial</p>
          <div className={gridClass}>
            <div>
              <label className={labelClass}>Employment status</label>
              <select
                className={inputClass}
                value={employment.employment_status}
                onChange={(e) => setEmployment((x) => ({ ...x, employment_status: e.target.value }))}
              >
                <option value="">Select…</option>
                <option value="Employed">Employed</option>
                <option value="Self-employed">Self-employed</option>
                <option value="Contract">Contract</option>
                <option value="Unemployed">Unemployed</option>
                <option value="Retired">Retired</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Monthly income (PHP)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={employment.monthly_income}
                onChange={(e) => setEmployment((x) => ({ ...x, monthly_income: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Employer name</label>
              <input className={inputClass} value={employment.employer_name} onChange={(e) => setEmployment((x) => ({ ...x, employer_name: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Other income (optional)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={employment.other_income}
                onChange={(e) => setEmployment((x) => ({ ...x, other_income: e.target.value }))}
              />
              <p className="mt-1 text-xs text-brand-text/55 dark:text-white/45">Leave blank if none.</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <button type="button" onClick={() => setStep(2)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600">
              Back
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => saveStep(3, true)}
              className="rounded-xl bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-primary-hover disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Continue'}
            </button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-text/50 dark:text-white/45">Step 4 — Documents &amp; preview</p>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-600">
              <p className="text-sm font-medium text-brand-text dark:text-white">Valid ID</p>
              <p className="mt-1 text-xs text-brand-text/60 dark:text-white/50">PDF or image · max 10 MB · replaces previous file</p>
              <label className="mt-3 inline-flex cursor-pointer rounded-lg bg-brand-primary px-3 py-2 text-xs font-semibold text-white">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) handleEmbedded('valid_id', f)
                  }}
                />
                {emb.valid_id_url ? 'Replace file' : 'Upload'}
              </label>
              {emb.valid_id_url ? (
                <a href={getLaravelStorageFileUrl(emb.valid_id_url)} target="_blank" rel="noreferrer" className="ml-3 text-xs font-semibold text-brand-primary hover:underline">
                  Open / preview
                </a>
              ) : null}
            </div>
            <div className="rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-600">
              <p className="text-sm font-medium text-brand-text dark:text-white">Proof of income</p>
              <p className="mt-1 text-xs text-brand-text/60 dark:text-white/50">Payslip, COE, or ITR</p>
              <label className="mt-3 inline-flex cursor-pointer rounded-lg bg-brand-primary px-3 py-2 text-xs font-semibold text-white">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) handleEmbedded('proof_income', f)
                  }}
                />
                {emb.proof_income_url ? 'Replace file' : 'Upload'}
              </label>
              {emb.proof_income_url ? (
                <a href={getLaravelStorageFileUrl(emb.proof_income_url)} target="_blank" rel="noreferrer" className="ml-3 text-xs font-semibold text-brand-primary hover:underline">
                  Open / preview
                </a>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-600">
            <p className="text-sm font-medium text-brand-text dark:text-white">Additional documents</p>
            <p className="mt-1 text-xs text-brand-text/60 dark:text-white/50">Upload multiple files one at a time.</p>
            <label className="mt-3 inline-flex cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-600">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) handleEmbedded('additional', f)
                }}
              />
              Add file
            </label>
            <ul className="mt-3 space-y-2 text-sm">
              {(emb.additional_urls || []).map((url, idx) => (
                <li key={url} className="flex flex-wrap items-center gap-2">
                  <a href={getLaravelStorageFileUrl(url)} target="_blank" rel="noreferrer" className="font-semibold text-brand-primary hover:underline">
                    File {idx + 1}
                  </a>
                  <label className="cursor-pointer text-xs text-slate-600 underline dark:text-slate-300">
                    Replace
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="sr-only"
                      disabled={busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ''
                        if (f) handleEmbedded('additional', f, idx)
                      }}
                    />
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <p className="text-sm font-semibold text-brand-text dark:text-white">Preview summary</p>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-brand-text/55 dark:text-white/45">Name</dt>
                <dd>{personal.full_name || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-brand-text/55 dark:text-white/45">Loan</dt>
                <dd>
                  {loan.loan_type || '—'} · ₱{loan.loan_amount || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-brand-text/55 dark:text-white/45">Employer</dt>
                <dd>{employment.employer_name || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-brand-text/55 dark:text-white/45">Embedded docs</dt>
                <dd>
                  ID: {summary.valid ? '✓' : '—'} · Income: {summary.proof ? '✓' : '—'} · Extra: {summary.extra}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-wrap justify-between gap-3">
            <button type="button" onClick={() => setStep(3)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600">
              Back
            </button>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !summary.valid || !summary.proof}
                onClick={savePreviewStep}
                className="rounded-xl bg-brand-dark px-6 py-2.5 text-sm font-semibold text-white shadow transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? 'Saving…' : 'Continue to product checklist'}
              </button>
            </div>
          </div>
          {!summary.valid || !summary.proof ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">Upload valid ID and proof of income to continue to the product checklist.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
