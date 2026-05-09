import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SubPageHeader from '../components/SubPageHeader.jsx'
import Footer from '../components/Footer.jsx'
import LoanProductIcon from '../components/loan/LoanProductIcon.jsx'
import { tierAccentClass, tierCardClass, tierIconWrapClass } from '../components/loan/loanProductStyles.js'
import AmalgatedLoanApplicationForm from '../components/loan/AmalgatedLoanApplicationForm.jsx'
import AmalgatedApplicationPrintBundle from '../components/loan/AmalgatedApplicationPrintBundle.jsx'
import CoMakerStatementForm from '../components/loan/CoMakerStatementForm.jsx'
import LoanProductDocumentsChecklist from '../components/loan/LoanProductDocumentsChecklist.jsx'
import LoanProductExtraSection from '../components/loan/LoanProductExtraSection.jsx'
import {
  createEmptyCoMakerStatement,
  createEmptyExtendedApplication,
} from '../components/loan/amalgatedApplicationFormState.js'
import { LOAN_PRODUCT_KEYS } from '../components/loan/loanProductDocuments.js'
import { deriveApplicantFromExtended, normalizeCoMakerStatementPayload, normalizeExtendedApplicationPayload } from '../components/loan/amalgatedPayloadMerge.js'
import { postSssPensionLoanApplication } from '../utils/lendingApi.js'
import { openModal } from '../utils/systemModal.js'
import { buildMissingFieldsSummary, collectMissingFields, focusFirstInvalidField } from '../utils/applicationFormValidation.js'
import { isFullApplicationPrintable } from '../components/loan/amalgatedApplicationCompleteness.js'
import { getLoanProducts, postLoanCalculator } from '../utils/loanProductsPublicApi.js'

const MAX_AGE = 70
const TERM_OPTIONS = [6, 12, 18, 24, 30, 36]

export default function SssPensionLoanPage() {
  const [showEligibility, setShowEligibility] = useState(false)
  const [addCoMaker, setAddCoMaker] = useState(false)
  const [coMakerByUserId, setCoMakerByUserId] = useState(false)
  const [form, setForm] = useState({
    borrowerPassword: '',
    borrowerPasswordConfirm: '',
    coMakerId: '',
  })
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [extendedApplication, setExtendedApplication] = useState(() =>
    createEmptyExtendedApplication(null, { otherSpecify: 'SSS/GSIS Pensioner Loan', loanTermMonthsDefault: '24' }),
  )
  const [coMakerStatement, setCoMakerStatement] = useState(() => createEmptyCoMakerStatement())
  const [documents, setDocuments] = useState({
    docApplicationForm: null,
    docBirthCertificatePsa: null,
    docPensionVerification: null,
    docProofOfBilling: null,
    docBankStatements: [],
    docGovernmentIds: [],
  })
  const [rateLabel, setRateLabel] = useState('2.24% per month')
  const [liveQuote, setLiveQuote] = useState(null)
  const [quoteError, setQuoteError] = useState('')

  useEffect(() => {
    if (errorMsg) {
      openModal({ message: errorMsg, tone: 'error' })
    }
  }, [errorMsg])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await getLoanProducts()
        const p = (rows || []).find((x) => String(x.slug || '').toLowerCase() === 'sss-pension-loan')
        if (!p || cancelled) return
        const rate = Number(p.interest_rate)
        const label = Number.isFinite(rate) ? `${rate.toFixed(2)}% ${p.rate_type === 'fixed' ? 'fixed' : 'per month'}` : null
        if (label) setRateLabel(label)
      } catch {
        // keep fallback label
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const principal = Number(extendedApplication?.loan_principal_php || 0)
    const term = Number(extendedApplication?.loan_term_months || 0)
    const px = extendedApplication?.product_extra || {}
    const monthlyPension = Number(px?.monthly_pension || 0)
    const pensionType = String(px?.pension_type || 'SSS').toUpperCase()
    const applicationNature = String(extendedApplication?.application_nature || 'new').toLowerCase() === 'reloan' ? 'reloan' : 'new'
    if (!(principal > 0 && term > 0 && monthlyPension > 0)) {
      setLiveQuote(null)
      setQuoteError('')
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await postLoanCalculator({
          slug: 'sss-pension-loan',
          term_months: term,
          principal,
          monthly_pension: monthlyPension,
          pension_type: pensionType,
          application_nature: applicationNature,
          include_fees: true,
        })
        if (cancelled) return
        setLiveQuote(res)
        setQuoteError('')
      } catch (e) {
        if (cancelled) return
        setLiveQuote(null)
        setQuoteError(e?.message || 'Could not compute pension quote.')
      }
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [extendedApplication])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setFieldErrors({})
    const derived = deriveApplicantFromExtended(extendedApplication, form)
    const px = extendedApplication.product_extra || {}
    const missingFields = collectMissingFields([
      ['branch_name', extendedApplication.branch_name],
      ['application_nature', extendedApplication.application_nature],
      ['loan_principal_php', extendedApplication.loan_principal_php],
      ['loan_term_months', extendedApplication.loan_term_months],
      ['applicant.name', extendedApplication.applicant?.name],
      ['applicant.email', extendedApplication.applicant?.email],
      ['applicant.mobile_phone', extendedApplication.applicant?.mobile_phone],
      ['applicant.residence_address', extendedApplication.applicant?.residence_address],
      ['product_extra.age', px.age],
      ['product_extra.monthly_pension', px.monthly_pension],
      ['borrowerPassword', form.borrowerPassword],
      ['borrowerPasswordConfirm', form.borrowerPasswordConfirm],
    ])
    if (addCoMaker && coMakerByUserId) {
      Object.assign(missingFields, collectMissingFields([['coMakerId', form.coMakerId]]))
    } else if (addCoMaker) {
      const cmPhone = String(coMakerStatement.residence_tel || coMakerStatement.business_tel || '').trim()
      Object.assign(
        missingFields,
        collectMissingFields([
          ['coMakerStatement.name', coMakerStatement.name],
          ['coMakerStatement.email', coMakerStatement.email],
          ['coMakerStatement.phone', cmPhone],
        ]),
      )
    }
    if (Object.keys(missingFields).length) {
      setFieldErrors(missingFields)
      setStatus('error')
      setErrorMsg(buildMissingFieldsSummary(missingFields))
      focusFirstInvalidField(missingFields)
      return
    }
    const ageNum = Number(px.age)
    if (!Number.isInteger(ageNum) || ageNum < 18 || ageNum > MAX_AGE) {
      setErrorMsg(`Age must be between 18 and ${MAX_AGE} for this product.`)
      setStatus('error')
      return
    }
    if (form.borrowerPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters.')
      setStatus('error')
      return
    }
    if (form.borrowerPassword !== form.borrowerPasswordConfirm) {
      setErrorMsg('Password confirmation does not match.')
      setStatus('error')
      return
    }
    if (addCoMaker) {
      if (!coMakerByUserId) {
        const cmEmail = String(coMakerStatement.email || '').trim().toLowerCase()
        const appEmail = String(derived.email || '').trim().toLowerCase()
        if (cmEmail && appEmail && cmEmail === appEmail) {
          setErrorMsg('Co-maker must use a different email than the applicant.')
          setStatus('error')
          return
        }
      }
    }
    if (!documents.docBirthCertificatePsa || !documents.docPensionVerification) {
      setErrorMsg('Upload required pension documents: PSA/marriage certificate and pension verification.')
      setStatus('error')
      return
    }
    setStatus('loading')
    try {
      const cmPhone = String(coMakerStatement.residence_tel || coMakerStatement.business_tel || '').trim()
      await postSssPensionLoanApplication({
        ...form,
        fullName: derived.fullName,
        email: derived.email,
        phone: derived.phone,
        address: derived.address,
        city: derived.city,
        province: derived.province,
        loanAmount: derived.loanAmount,
        loanTerm: derived.loanTerm,
        pensionType: String(px.pension_type || 'SSS').trim().toUpperCase(),
        monthlyPension: String(px.monthly_pension || '').trim(),
        age: String(px.age || '').trim(),
        extendedApplication: {
          ...normalizeExtendedApplicationPayload(extendedApplication, form),
        },
        coMakerStatement: addCoMaker ? normalizeCoMakerStatementPayload(coMakerStatement, form, extendedApplication) : undefined,
        coMakerId: addCoMaker && coMakerByUserId ? form.coMakerId : '',
        includeCoMaker: addCoMaker && !coMakerByUserId,
        coMakerName: addCoMaker && !coMakerByUserId ? String(coMakerStatement.name || '').trim() : '',
        coMakerEmail: addCoMaker && !coMakerByUserId ? String(coMakerStatement.email || '').trim() : '',
        coMakerPhone: addCoMaker && !coMakerByUserId ? cmPhone : '',
        ...documents,
      })
      setStatus('success')
      setForm({ borrowerPassword: '', borrowerPasswordConfirm: '', coMakerId: '' })
      setAddCoMaker(false)
      setCoMakerByUserId(false)
      setExtendedApplication(createEmptyExtendedApplication(null, { otherSpecify: 'SSS/GSIS Pensioner Loan', loanTermMonthsDefault: '24' }))
      setCoMakerStatement(createEmptyCoMakerStatement())
      setDocuments({
        docApplicationForm: null,
        docBirthCertificatePsa: null,
        docPensionVerification: null,
        docProofOfBilling: null,
        docBankStatements: [],
        docGovernmentIds: [],
      })
      openModal({ message: 'Application submitted successfully.', tone: 'success' })
    } catch (err) {
      setStatus('error')
      setErrorMsg(err?.message || 'Submission failed.')
    }
  }

  const tier = 'purple'
  const applicantName = extendedApplication.applicant?.name || ''
  const loanPrincipal = extendedApplication.loan_principal_php || ''
  const canPrintApplication = isFullApplicationPrintable(extendedApplication, coMakerStatement, addCoMaker)

  return (
    <div className="flex min-h-screen flex-col bg-brand-background-alt text-brand-text">
      <SubPageHeader />
      <main className="flex-1">
        <div className="app-container max-w-6xl py-10 sm:py-14">
          <Link to="/loan-products" className="text-sm font-medium text-brand-primary hover:underline">
            ← Loan products
          </Link>

          <article className={`mt-6 scroll-mt-24 rounded-2xl border p-5 sm:p-8 ${tierCardClass(tier)}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${tierIconWrapClass(tier)}`}>
                  <LoanProductIcon iconKey="shield" className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-brand-text dark:text-white">SSS / GSIS Pensioner Loan</h1>
                  <p className={`mt-1 text-base font-semibold ${tierAccentClass(tier)}`}>{rateLabel}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowEligibility(true)}
                  className="rounded-xl border border-brand-primary/40 px-4 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/10"
                >
                  Check eligibility
                </button>
                <a
                  href="#sss-pension-apply-form"
                  className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-primary-hover"
                >
                  Apply now
                </a>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-brand-text/80 dark:text-white/75">
              For pensioners with documented SSS or GSIS benefits.
            </p>
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-white/60 p-3 dark:bg-black/20">
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">Collateral</dt>
                <dd className="mt-1 text-brand-text dark:text-white">Pension remittance / pension account</dd>
              </div>
              <div className="rounded-xl bg-white/60 p-3 dark:bg-black/20 sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">Requirements</dt>
                <dd className="mt-1 text-brand-text dark:text-white">
                  PSA or marriage certificate, pension verification, government IDs, bank statements, and proof of billing.
                </dd>
              </div>
            </dl>
          </article>

          {showEligibility ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
              <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-[#111827]">
                <h2 className="text-lg font-semibold text-brand-text dark:text-white">Eligibility (Pension)</h2>
                <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-brand-text/85 dark:text-white/80">
                  <li>Receiving SSS or GSIS pension</li>
                  <li>Age {MAX_AGE} or below at application</li>
                  <li>Supporting documents per checklist</li>
                </ul>
                <button
                  type="button"
                  onClick={() => setShowEligibility(false)}
                  className="mt-6 w-full rounded-xl bg-brand-primary py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover"
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}

          <section
            id="sss-pension-apply-form"
            className="mt-10 scroll-mt-24 rounded-2xl border border-brand-secondary/30 bg-white p-5 shadow-sm dark:border-[#1F2937] dark:bg-[#111827] sm:p-8"
          >
            <h2 className="text-lg font-semibold text-brand-text dark:text-white">Application</h2>
            <p className="mt-1 text-sm text-brand-text/70 dark:text-white/60">
              Complete the official Amalgated application and co-maker statement. For pension loans, co-maker is optional. Use the section below to set
              your borrower portal password.
            </p>
            {liveQuote?.fee_breakdown ? (
              <div className="mt-4 rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4 text-sm dark:border-brand-primary/30 dark:bg-brand-primary/10">
                <p className="font-semibold text-brand-text dark:text-white">Live pension computation preview</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <p>Monthly principal: <strong>₱{Number(liveQuote.fee_breakdown.monthly_principal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                  <p>Monthly interest: <strong>₱{Number(liveQuote.fee_breakdown.monthly_interest_on_full_principal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                  <p>Monthly amortization: <strong>₱{Number(liveQuote.monthly_amortization || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                  <p>Semi-monthly: <strong>₱{Number(liveQuote.fee_breakdown.semi_monthly_payment || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                  <p>Total deductions: <strong>₱{Number(liveQuote.fee_breakdown.total_miscellaneous || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                  <p>Net proceeds: <strong>₱{Number(liveQuote.fee_breakdown.net_proceeds_after_misc || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                  <p className="sm:col-span-2">
                    Remaining pension: <strong>₱{Number(liveQuote.fee_breakdown.remaining_pension || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    {' '} (minimum retention ₱{Number(liveQuote.fee_breakdown.pension_retention_threshold || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </p>
                </div>
              </div>
            ) : null}
            {quoteError ? (
              <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                {quoteError}
              </p>
            ) : null}

            {status === 'success' ? (
              <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">
                Thank you. We received your pension loan application. Check your email for confirmation.
              </p>
            ) : null}
            {errorMsg ? (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200" role="alert">
                {errorMsg}
              </p>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-6 space-y-8">
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-900/40">
                <LoanProductDocumentsChecklist productKey={LOAN_PRODUCT_KEYS.SSS_PENSION} />
                <p className="text-sm text-brand-text/85 dark:text-white/75">
                  Official Amalgated application format: complete the sections below. <strong className="font-semibold">Branch</strong> and{' '}
                  <strong className="font-semibold">application nature</strong> (new loan vs re-loan / renewal) are required.
                </p>
                <fieldset className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-900/50">
                  <legend className="px-1 text-sm font-semibold text-brand-text dark:text-white">Applicant &amp; co-maker</legend>
                  <p className="text-xs text-brand-text/70 dark:text-white/55">
                    Co-maker is optional for pension loans. When enabled, complete the co-maker statement below the applicant sections.
                  </p>
                  <AmalgatedLoanApplicationForm
                    presetCategory={null}
                    loanTermOptions={TERM_OPTIONS}
                    value={extendedApplication}
                    onChange={setExtendedApplication}
                    fieldErrors={fieldErrors}
                  />
                  <LoanProductExtraSection mode="pension" value={extendedApplication} onChange={setExtendedApplication} fieldErrors={fieldErrors} />
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-600 dark:bg-slate-900/40">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-brand-text dark:text-white">
                      <input type="checkbox" checked={addCoMaker} onChange={(e) => setAddCoMaker(e.target.checked)} />
                      Include a co-maker (optional)
                    </label>
                    {addCoMaker ? (
                      <>
                        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-brand-text dark:text-white">
                          <input type="checkbox" checked={coMakerByUserId} onChange={(e) => setCoMakerByUserId(e.target.checked)} />
                          Co-maker already has a borrower account (use user ID)
                        </label>
                        {coMakerByUserId ? (
                          <input
                            type="number"
                            min={1}
                            placeholder="Co-maker user ID *"
                            value={form.coMakerId}
                            onChange={(e) => setForm((s) => ({ ...s, coMakerId: e.target.value }))}
                            data-field-path="coMakerId"
                            className={`mt-3 w-full max-w-xs rounded-xl px-4 py-3 text-sm dark:bg-[#0F172A] dark:text-white ${
                              fieldErrors.coMakerId ? 'border border-red-500 ring-1 ring-red-500/20 dark:border-red-500' : 'border border-brand-secondary/40 dark:border-[#374151]'
                            }`}
                          />
                        ) : null}
                        {fieldErrors.coMakerId ? <p className="mt-2 text-xs text-red-600">{fieldErrors.coMakerId}</p> : null}
                      </>
                    ) : null}
                  </div>
                  {addCoMaker ? (
                    <CoMakerStatementForm
                      value={coMakerStatement}
                      onChange={setCoMakerStatement}
                      prefillApplicantName={applicantName}
                      prefillLoanAmount={loanPrincipal}
                      fieldErrors={fieldErrors}
                    />
                  ) : null}
                  <AmalgatedApplicationPrintBundle
                    extendedApplication={extendedApplication}
                    coMakerStatement={addCoMaker ? coMakerStatement : null}
                    includeCoMaker={addCoMaker}
                    canPrint={canPrintApplication}
                  />
                </fieldset>
              </div>

              <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4">
                <legend className="text-sm font-semibold text-brand-text dark:text-white">Required document uploads</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm text-brand-text dark:text-white">
                    Government IDs
                    <input type="file" multiple accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setDocuments((s) => ({ ...s, docGovernmentIds: Array.from(e.target.files || []) }))} className="mt-1 w-full rounded-xl border border-brand-secondary/40 px-3 py-2 text-sm dark:border-[#374151]" />
                  </label>
                  <label className="text-sm text-brand-text dark:text-white">
                    PSA / marriage certificate *
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setDocuments((s) => ({ ...s, docBirthCertificatePsa: e.target.files?.[0] || null }))} className="mt-1 w-full rounded-xl border border-brand-secondary/40 px-3 py-2 text-sm dark:border-[#374151]" />
                  </label>
                  <label className="text-sm text-brand-text dark:text-white">
                    Pension verification *
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setDocuments((s) => ({ ...s, docPensionVerification: e.target.files?.[0] || null }))} className="mt-1 w-full rounded-xl border border-brand-secondary/40 px-3 py-2 text-sm dark:border-[#374151]" />
                  </label>
                  <label className="text-sm text-brand-text dark:text-white">
                    Bank statements
                    <input type="file" multiple accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setDocuments((s) => ({ ...s, docBankStatements: Array.from(e.target.files || []) }))} className="mt-1 w-full rounded-xl border border-brand-secondary/40 px-3 py-2 text-sm dark:border-[#374151]" />
                  </label>
                  <label className="text-sm text-brand-text dark:text-white">
                    Proof of billing
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setDocuments((s) => ({ ...s, docProofOfBilling: e.target.files?.[0] || null }))} className="mt-1 w-full rounded-xl border border-brand-secondary/40 px-3 py-2 text-sm dark:border-[#374151]" />
                  </label>
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="text-sm font-semibold text-brand-text dark:text-white">Borrower portal password</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="Create borrower portal password *"
                    value={form.borrowerPassword}
                    onChange={(e) => setForm((s) => ({ ...s, borrowerPassword: e.target.value }))}
                    data-field-path="borrowerPassword"
                    className={`w-full rounded-xl px-4 py-3 text-sm dark:bg-[#0F172A] dark:text-white ${
                      fieldErrors.borrowerPassword ? 'border border-red-500 ring-1 ring-red-500/20 dark:border-red-500' : 'border border-brand-secondary/40 dark:border-[#374151]'
                    }`}
                  />
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="Confirm password *"
                    value={form.borrowerPasswordConfirm}
                    onChange={(e) => setForm((s) => ({ ...s, borrowerPasswordConfirm: e.target.value }))}
                    data-field-path="borrowerPasswordConfirm"
                    className={`w-full rounded-xl px-4 py-3 text-sm dark:bg-[#0F172A] dark:text-white ${
                      fieldErrors.borrowerPasswordConfirm ? 'border border-red-500 ring-1 ring-red-500/20 dark:border-red-500' : 'border border-brand-secondary/40 dark:border-[#374151]'
                    }`}
                  />
                </div>
                {fieldErrors.borrowerPassword || fieldErrors.borrowerPasswordConfirm ? (
                  <p className="text-xs text-red-600">Create and confirm your borrower portal password.</p>
                ) : null}
              </fieldset>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full rounded-xl bg-brand-primary py-3.5 text-sm font-semibold text-white shadow transition hover:bg-brand-primary-hover disabled:opacity-60"
              >
                {status === 'loading' ? 'Submitting…' : 'Submit application'}
              </button>
            </form>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
