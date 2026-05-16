import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SubPageHeader from '../components/SubPageHeader.jsx'
import Footer from '../components/Footer.jsx'
import LoanProductIcon from '../components/loan/LoanProductIcon.jsx'
import { tierAccentClass, tierCardClass, tierIconWrapClass } from '../components/loan/loanProductStyles.js'
import AmalgatedLoanApplicationForm from '../components/loan/AmalgatedLoanApplicationForm.jsx'
import LoanProductDocumentsChecklist from '../components/loan/LoanProductDocumentsChecklist.jsx'
import LoanProductExtraSection from '../components/loan/LoanProductExtraSection.jsx'
import { LOAN_PRODUCT_KEYS } from '../components/loan/loanProductDocuments.js'
import { createEmptyExtendedApplication } from '../components/loan/amalgatedApplicationFormState.js'
import AmalgatedApplicationPrintBundle from '../components/loan/AmalgatedApplicationPrintBundle.jsx'
import { deriveApplicantFromExtended, normalizeExtendedApplicationPayload } from '../components/loan/amalgatedPayloadMerge.js'
import { postRealEstateMortgageApplication } from '../utils/lendingApi.js'
import { openModal } from '../utils/systemModal.js'
import { buildMissingFieldsSummary, collectMissingFields, focusFirstInvalidField } from '../utils/applicationFormValidation.js'
import { isFullApplicationPrintable } from '../components/loan/amalgatedApplicationCompleteness.js'
import { getLoanProducts } from '../utils/loanProductsPublicApi.js'

const TERM_OPTIONS = [12, 24, 36]

export default function RealEstateMortgagePage() {
  const [showEligibility, setShowEligibility] = useState(false)
  const [form, setForm] = useState({
    borrowerPassword: '',
    borrowerPasswordConfirm: '',
  })
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [extendedApplication, setExtendedApplication] = useState(() => createEmptyExtendedApplication('real_estate'))
  const [documents, setDocuments] = useState({
    docApplicationForm: null,
    docCtc: null,
    docTaxDeclaration: null,
    docVicinityMap: null,
    docProofOfIncome: null,
    docGovernmentIds: [],
  })
  const canPrintApplication = isFullApplicationPrintable(extendedApplication, null, false)
  const [rateLabel, setRateLabel] = useState('3.88% per month (standard)')

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
        const p = (rows || []).find((x) => String(x.slug || '').toLowerCase() === 'real-estate-mortgage')
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
      ['product_extra.property_location', px.property_location],
      ['product_extra.property_value', px.property_value],
      ['borrowerPassword', form.borrowerPassword],
      ['borrowerPasswordConfirm', form.borrowerPasswordConfirm],
    ])
    if (Object.keys(missingFields).length) {
      setFieldErrors(missingFields)
      setStatus('error')
      setErrorMsg(buildMissingFieldsSummary(missingFields))
      focusFirstInvalidField(missingFields)
      return
    }
    if (!documents.docCtc || !documents.docTaxDeclaration || !documents.docVicinityMap) {
      setErrorMsg('Upload required property documents: CTC, tax declaration, and sketch/vicinity map.')
      setStatus('error')
      return
    }
    if (!form.borrowerPassword?.trim() || !form.borrowerPasswordConfirm?.trim()) {
      setErrorMsg('Create and confirm your borrower portal password.')
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

    setStatus('loading')
    try {
      const tinFromExtended = String(extendedApplication.applicant?.tin || '').trim()
      await postRealEstateMortgageApplication({
        ...form,
        fullName: derived.fullName,
        email: derived.email,
        phone: derived.phone,
        address: derived.address,
        city: derived.city,
        province: derived.province,
        loanAmount: derived.loanAmount,
        loanTerm: derived.loanTerm,
        tinNumber: tinFromExtended,
        propertyLocation: String(px.property_location || '').trim(),
        propertyValue: String(px.property_value || '').trim(),
        extendedApplication: {
          ...normalizeExtendedApplicationPayload(extendedApplication, form),
        },
        ...documents,
      })
      setStatus('success')
      setForm({ borrowerPassword: '', borrowerPasswordConfirm: '' })
      setExtendedApplication(createEmptyExtendedApplication('real_estate'))
      setDocuments({
        docApplicationForm: null,
        docCtc: null,
        docTaxDeclaration: null,
        docVicinityMap: null,
        docProofOfIncome: null,
        docGovernmentIds: [],
      })
      openModal({ message: 'Application submitted successfully.', tone: 'success' })
    } catch (err) {
      setStatus('error')
      setErrorMsg(err?.message || 'Submission failed.')
    }
  }

  const tier = 'blue'

  return (
    <div className="flex min-h-screen flex-col page-shell-bg text-brand-text">
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
                  <LoanProductIcon iconKey="home" className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-brand-text dark:text-white">Real Estate Mortgage Loan</h1>
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
                  href="#rem-apply-form"
                  className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-primary-hover"
                >
                  Apply now
                </a>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-brand-text/80 dark:text-white/75">
              Long-term financing secured by real property.
            </p>
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-white/60 p-3 dark:bg-black/20">
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">Collateral</dt>
                <dd className="mt-1 text-brand-text dark:text-white">Title</dd>
              </div>
              <div className="rounded-xl bg-white/60 p-3 dark:bg-black/20 sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">Requirements</dt>
                <dd className="mt-1 text-brand-text dark:text-white">
                  Loan application form, 2 government IDs, certified true copy (CTC), 2×2 ID picture, tax declaration &amp; clearance,
                  vicinity / sketch map, TIN (number or ID), bank statement / passbook, proof of billing, proof of income. Optional:
                  marriage contract; separate tax clearance upload if not combined with declaration.
                </dd>
              </div>
            </dl>
          </article>

          {showEligibility ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
              <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-[#111827]">
                <h2 className="text-lg font-semibold text-brand-text dark:text-white">Eligibility (REM)</h2>
                <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-brand-text/85 dark:text-white/80">
                  <li>Valid title to real property offered as collateral</li>
                  <li>Certified true copy of title documents (CTC)</li>
                  <li>Current tax declaration and clearance for the property</li>
                  <li>Proof of income and capacity to repay</li>
                  <li>All required uploads ready before you submit</li>
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

          <section id="rem-apply-form" className="mt-10 scroll-mt-24 rounded-2xl border border-brand-secondary/30 bg-white p-5 shadow-sm dark:border-[#1F2937] dark:bg-[#111827] sm:p-8">
            <h2 className="text-lg font-semibold text-brand-text dark:text-white">Application</h2>
            <p className="mt-1 text-sm text-brand-text/70 dark:text-white/60">
              Complete the official Amalgated application and property details. Enter your TIN in the applicant section. Use the section below to set
              your borrower portal password.
            </p>

            {status === 'success' ? (
              <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">
                Thank you. We received your Real Estate Mortgage application. Check your email for confirmation.
              </p>
            ) : null}
            {errorMsg ? (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200" role="alert">
                {errorMsg}
              </p>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-6 space-y-8">
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-900/40">
                <LoanProductDocumentsChecklist productKey={LOAN_PRODUCT_KEYS.REAL_ESTATE_MORTGAGE} />
                <p className="text-sm text-brand-text/85 dark:text-white/75">
                  Official Amalgated application format: complete the sections below. <strong className="font-semibold">Branch</strong> and{' '}
                  <strong className="font-semibold">application nature</strong> (new loan vs re-loan / renewal) are required.
                </p>
                <AmalgatedLoanApplicationForm
                  presetCategory="real_estate"
                  loanTermOptions={TERM_OPTIONS}
                  value={extendedApplication}
                  onChange={setExtendedApplication}
                  fieldErrors={fieldErrors}
                />
                <LoanProductExtraSection mode="rem" value={extendedApplication} onChange={setExtendedApplication} fieldErrors={fieldErrors} />
                <AmalgatedApplicationPrintBundle
                  extendedApplication={extendedApplication}
                  coMakerStatement={null}
                  includeCoMaker={false}
                  canPrint={canPrintApplication}
                />
              </div>

              <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4">
                <legend className="text-sm font-semibold text-brand-text dark:text-white">Required document uploads</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm text-brand-text dark:text-white">
                    Government IDs
                    <input type="file" multiple accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setDocuments((s) => ({ ...s, docGovernmentIds: Array.from(e.target.files || []) }))} className="mt-1 w-full rounded-xl border border-brand-secondary/40 px-3 py-2 text-sm dark:border-[#374151]" />
                  </label>
                  <label className="text-sm text-brand-text dark:text-white">
                    CTC *
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setDocuments((s) => ({ ...s, docCtc: e.target.files?.[0] || null }))} className="mt-1 w-full rounded-xl border border-brand-secondary/40 px-3 py-2 text-sm dark:border-[#374151]" />
                  </label>
                  <label className="text-sm text-brand-text dark:text-white">
                    Tax declaration *
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setDocuments((s) => ({ ...s, docTaxDeclaration: e.target.files?.[0] || null }))} className="mt-1 w-full rounded-xl border border-brand-secondary/40 px-3 py-2 text-sm dark:border-[#374151]" />
                  </label>
                  <label className="text-sm text-brand-text dark:text-white">
                    Sketch / vicinity map *
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setDocuments((s) => ({ ...s, docVicinityMap: e.target.files?.[0] || null }))} className="mt-1 w-full rounded-xl border border-brand-secondary/40 px-3 py-2 text-sm dark:border-[#374151]" />
                  </label>
                  <label className="text-sm text-brand-text dark:text-white">
                    Proof of income
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setDocuments((s) => ({ ...s, docProofOfIncome: e.target.files?.[0] || null }))} className="mt-1 w-full rounded-xl border border-brand-secondary/40 px-3 py-2 text-sm dark:border-[#374151]" />
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
