import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import SubPageHeader from '../components/SubPageHeader.jsx'
import Footer from '../components/Footer.jsx'
import LoanProductIcon from '../components/loan/LoanProductIcon.jsx'
import { tierAccentClass, tierCardClass, tierIconWrapClass } from '../components/loan/loanProductStyles.js'
import AmalgatedLoanApplicationForm from '../components/loan/AmalgatedLoanApplicationForm.jsx'
import LoanProductDocumentsChecklist from '../components/loan/LoanProductDocumentsChecklist.jsx'
import LoanProductExtraSection from '../components/loan/LoanProductExtraSection.jsx'
import CoMakerStatementForm from '../components/loan/CoMakerStatementForm.jsx'
import { LOAN_PRODUCT_KEYS } from '../components/loan/loanProductDocuments.js'
import { createEmptyCoMakerStatement, createEmptyExtendedApplication } from '../components/loan/amalgatedApplicationFormState.js'
import AmalgatedApplicationPrintBundle from '../components/loan/AmalgatedApplicationPrintBundle.jsx'
import {
  deriveApplicantFromExtended,
  normalizeCoMakerStatementPayload,
  normalizeExtendedApplicationPayload,
} from '../components/loan/amalgatedPayloadMerge.js'
import { postSalaryLoanApplication } from '../utils/lendingApi.js'
import { openModal } from '../utils/systemModal.js'
import { buildMissingFieldsSummary, collectMissingFields, focusFirstInvalidField } from '../utils/applicationFormValidation.js'
import { isFullApplicationPrintable } from '../components/loan/amalgatedApplicationCompleteness.js'
import { getLoanProducts } from '../utils/loanProductsPublicApi.js'

/** Must match `SalaryLoanController::SALARY_TO_PRINCIPAL_MULTIPLIER` */
const SALARY_PRINCIPAL_MULTIPLIER = 6

const TERM_OPTIONS = [6, 12, 18, 24, 36, 48, 60]

function maxPrincipalForSalary(monthlySalary) {
  const n = Number(monthlySalary)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.floor(n * SALARY_PRINCIPAL_MULTIPLIER * 100) / 100
}

export default function SalaryLoanPage() {
  const [showEligibility, setShowEligibility] = useState(false)
  const [coMakerByUserId, setCoMakerByUserId] = useState(false)
  const [form, setForm] = useState({
    borrowerPassword: '',
    borrowerPasswordConfirm: '',
    coMakerId: '',
  })
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [extendedApplication, setExtendedApplication] = useState(() => createEmptyExtendedApplication('salary'))
  const [coMakerStatement, setCoMakerStatement] = useState(() => createEmptyCoMakerStatement())
  const [documents, setDocuments] = useState({
    docApplicationForm: null,
    docPayslipBorrower: null,
    docPayslipCoMaker: null,
    docProofOfBilling: null,
    docBarangayCertification: null,
    docBorrowerGovernmentIds: [],
    docCoMakerGovernmentIds: [],
  })
  const canPrintApplication = isFullApplicationPrintable(extendedApplication, coMakerStatement, true)
  const [rateLabel, setRateLabel] = useState('1.50% per month')

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
        const p = (rows || []).find((x) => String(x.slug || '').toLowerCase() === 'salary-loan')
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

  const monthlySalaryNum = Number(extendedApplication.product_extra?.monthly_salary || 0)
  const maxLoan = useMemo(() => maxPrincipalForSalary(monthlySalaryNum), [monthlySalaryNum])

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
      ['product_extra.employer_name', px.employer_name],
      ['product_extra.monthly_salary', px.monthly_salary],
      ['borrowerPassword', form.borrowerPassword],
      ['borrowerPasswordConfirm', form.borrowerPasswordConfirm],
    ])
    if (coMakerByUserId) {
      Object.assign(missingFields, collectMissingFields([['coMakerId', form.coMakerId]]))
    } else {
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
    const principal = Number(derived.loanAmount)
    if (!Number.isFinite(principal) || principal < 1000) {
      setErrorMsg('Loan amount must be at least ₱1,000.')
      setStatus('error')
      return
    }
    if (maxLoan <= 0) {
      setErrorMsg('Enter a valid monthly salary in the employment section.')
      setStatus('error')
      return
    }
    if (principal > maxLoan + 0.009) {
      setErrorMsg(
        `Loan amount cannot exceed your salary-based limit of ₱${maxLoan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${SALARY_PRINCIPAL_MULTIPLIER}× monthly salary).`,
      )
      setStatus('error')
      return
    }
    if (!documents.docPayslipBorrower || !documents.docProofOfBilling || !documents.docBarangayCertification) {
      setErrorMsg('Upload required documents: borrower payslip, proof of billing, and barangay certification.')
      setStatus('error')
      return
    }
    if (!Array.isArray(documents.docBorrowerGovernmentIds) || documents.docBorrowerGovernmentIds.length < 1) {
      setErrorMsg('Upload at least one borrower government ID.')
      setStatus('error')
      return
    }
    const cmPhone = String(coMakerStatement.residence_tel || coMakerStatement.business_tel || '').trim()
    if (!coMakerByUserId) {
      const cmEmail = String(coMakerStatement.email || '').trim().toLowerCase()
      const appEmail = String(derived.email || '').trim().toLowerCase()
      if (cmEmail && appEmail && cmEmail === appEmail) {
        setErrorMsg('Co-maker must use a different email than the applicant.')
        setStatus('error')
        return
      }
    }

    setStatus('loading')
    try {
      await postSalaryLoanApplication({
        ...form,
        fullName: derived.fullName,
        email: derived.email,
        phone: derived.phone,
        address: derived.address,
        city: derived.city,
        province: derived.province,
        loanAmount: derived.loanAmount,
        loanTerm: derived.loanTerm,
        monthlySalary: String(px.monthly_salary || '').trim(),
        employerName: String(px.employer_name || '').trim(),
        extendedApplication: {
          ...normalizeExtendedApplicationPayload(extendedApplication, form),
        },
        coMakerStatement: normalizeCoMakerStatementPayload(coMakerStatement, form, extendedApplication),
        coMakerId: coMakerByUserId ? form.coMakerId : '',
        coMakerName: coMakerByUserId ? '' : String(coMakerStatement.name || '').trim(),
        coMakerEmail: coMakerByUserId ? '' : String(coMakerStatement.email || '').trim(),
        coMakerPhone: coMakerByUserId ? '' : cmPhone,
        ...documents,
      })
      setStatus('success')
      setForm({ borrowerPassword: '', borrowerPasswordConfirm: '', coMakerId: '' })
      setExtendedApplication(createEmptyExtendedApplication('salary'))
      setCoMakerStatement(createEmptyCoMakerStatement())
      setDocuments({
        docApplicationForm: null,
        docPayslipBorrower: null,
        docPayslipCoMaker: null,
        docProofOfBilling: null,
        docBarangayCertification: null,
        docBorrowerGovernmentIds: [],
        docCoMakerGovernmentIds: [],
      })
      openModal({ message: 'Application submitted successfully.', tone: 'success' })
    } catch (err) {
      setStatus('error')
      setErrorMsg(err?.message || 'Submission failed.')
    }
  }

  const tier = 'green'
  const applicantName = extendedApplication.applicant?.name || ''
  const loanPrincipal = extendedApplication.loan_principal_php || ''

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
                  <LoanProductIcon iconKey="briefcase" className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-brand-text dark:text-white">Salary Loan</h1>
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
                  href="#salary-apply-form"
                  className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-primary-hover"
                >
                  Apply now
                </a>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-brand-text/80 dark:text-white/75">
              For salaried employees with a qualified co-maker; principal capped at {SALARY_PRINCIPAL_MULTIPLIER}× monthly gross salary.
            </p>
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-white/60 p-3 dark:bg-black/20">
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">Co-maker</dt>
                <dd className="mt-1 text-brand-text dark:text-white">Required</dd>
              </div>
              <div className="rounded-xl bg-white/60 p-3 dark:bg-black/20 sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">Requirements</dt>
                <dd className="mt-1 text-brand-text dark:text-white">
                  Borrower and co-maker IDs, payslip, proof of billing, barangay certification, and completed application form.
                </dd>
              </div>
            </dl>
          </article>

          {showEligibility ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
              <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-[#111827]">
                <h2 className="text-lg font-semibold text-brand-text dark:text-white">Eligibility (Salary)</h2>
                <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-brand-text/85 dark:text-white/80">
                  <li>Documented employment and stable income</li>
                  <li>Qualified co-maker (co-maker statement required)</li>
                  <li>Loan amount within policy limits</li>
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

          <section id="salary-apply-form" className="mt-10 scroll-mt-24 rounded-2xl border border-brand-secondary/30 bg-white p-5 shadow-sm dark:border-[#1F2937] dark:bg-[#111827] sm:p-8">
            <h2 className="text-lg font-semibold text-brand-text dark:text-white">Application</h2>
            <p className="mt-1 text-sm text-brand-text/70 dark:text-white/60">
              Complete the official Amalgated application and co-maker statement. Co-maker is mandatory. Max loan ≈ ₱
              {maxLoan > 0 ? maxLoan.toLocaleString() : '—'} (when salary is entered).
            </p>

            {status === 'success' ? (
              <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">
                Thank you. We received your Salary Loan application. Check your email for confirmation.
              </p>
            ) : null}
            {errorMsg ? (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200" role="alert">
                {errorMsg}
              </p>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-6 space-y-8">
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-900/40">
                <LoanProductDocumentsChecklist productKey={LOAN_PRODUCT_KEYS.SALARY_LOAN} />
                <p className="text-sm text-brand-text/85 dark:text-white/75">
                  Official Amalgated application: <strong className="font-semibold">Branch</strong> and{' '}
                  <strong className="font-semibold">application nature</strong> are required. Co-maker statement is required.
                </p>
                <fieldset className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-900/50">
                  <legend className="px-1 text-sm font-semibold text-brand-text dark:text-white">Applicant &amp; co-maker</legend>
                  <AmalgatedLoanApplicationForm
                    presetCategory="salary"
                    loanTermOptions={TERM_OPTIONS}
                    value={extendedApplication}
                    onChange={setExtendedApplication}
                    fieldErrors={fieldErrors}
                  />
                  <LoanProductExtraSection mode="salary" value={extendedApplication} onChange={setExtendedApplication} fieldErrors={fieldErrors} />
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-600 dark:bg-slate-900/40">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-brand-text dark:text-white">
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
                  </div>
                  <CoMakerStatementForm
                    value={coMakerStatement}
                    onChange={setCoMakerStatement}
                    prefillApplicantName={applicantName}
                    prefillLoanAmount={loanPrincipal}
                    fieldErrors={fieldErrors}
                  />
                  <AmalgatedApplicationPrintBundle
                    extendedApplication={extendedApplication}
                    coMakerStatement={coMakerStatement}
                    includeCoMaker
                    canPrint={canPrintApplication}
                  />
                </fieldset>
              </div>

              <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4">
                <legend className="text-sm font-semibold text-brand-text dark:text-white">Required document uploads</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm text-brand-text dark:text-white">
                    Borrower government IDs *
                    <input
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => setDocuments((s) => ({ ...s, docBorrowerGovernmentIds: Array.from(e.target.files || []) }))}
                      className="mt-1 w-full rounded-xl border border-brand-secondary/40 px-3 py-2 text-sm dark:border-[#374151]"
                    />
                  </label>
                  <label className="text-sm text-brand-text dark:text-white">
                    Co-maker government IDs
                    <input
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => setDocuments((s) => ({ ...s, docCoMakerGovernmentIds: Array.from(e.target.files || []) }))}
                      className="mt-1 w-full rounded-xl border border-brand-secondary/40 px-3 py-2 text-sm dark:border-[#374151]"
                    />
                  </label>
                  <label className="text-sm text-brand-text dark:text-white">
                    Borrower payslip *
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => setDocuments((s) => ({ ...s, docPayslipBorrower: e.target.files?.[0] || null }))}
                      className="mt-1 w-full rounded-xl border border-brand-secondary/40 px-3 py-2 text-sm dark:border-[#374151]"
                    />
                  </label>
                  <label className="text-sm text-brand-text dark:text-white">
                    Co-maker payslip
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => setDocuments((s) => ({ ...s, docPayslipCoMaker: e.target.files?.[0] || null }))}
                      className="mt-1 w-full rounded-xl border border-brand-secondary/40 px-3 py-2 text-sm dark:border-[#374151]"
                    />
                  </label>
                  <label className="text-sm text-brand-text dark:text-white">
                    Proof of billing *
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => setDocuments((s) => ({ ...s, docProofOfBilling: e.target.files?.[0] || null }))}
                      className="mt-1 w-full rounded-xl border border-brand-secondary/40 px-3 py-2 text-sm dark:border-[#374151]"
                    />
                  </label>
                  <label className="text-sm text-brand-text dark:text-white">
                    Barangay certification *
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => setDocuments((s) => ({ ...s, docBarangayCertification: e.target.files?.[0] || null }))}
                      className="mt-1 w-full rounded-xl border border-brand-secondary/40 px-3 py-2 text-sm dark:border-[#374151]"
                    />
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
