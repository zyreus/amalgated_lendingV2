import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import SubPageHeader from '../components/SubPageHeader.jsx'
import Footer from '../components/Footer.jsx'
import LoanProductIcon from '../components/loan/LoanProductIcon.jsx'
import { tierAccentClass, tierCardClass, tierIconWrapClass } from '../components/loan/loanProductStyles.js'
import TravelWizardForm from '../components/travel/TravelWizardForm.jsx'
import { createEmptyWizard, DRAFT_KEY } from '../components/travel/travelWizardState.js'
import { validateTravelWizardClient } from '../components/travel/travelWizardValidate.js'
import { postTravelLoanWizardApplication } from '../utils/lendingApi.js'
import { openModal } from '../utils/systemModal.js'
import { focusFirstInvalidField } from '../utils/applicationFormValidation.js'
import { getLoanProducts } from '../utils/loanProductsPublicApi.js'

const MAX_LOAN = 2_000_000

function todayISODate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function TravelAssistanceLoanPage() {
  const [showEligibility, setShowEligibility] = useState(false)
  const [wizard, setWizard] = useState(() => {
    const w = createEmptyWizard()
    w.loan.desired_term = '1'
    w.loan.travel_date = todayISODate()
    return w
  })
  const [files, setFiles] = useState({
    passport_photos: [null, null, null],
    passport_copy: null,
    valid_id_1: null,
    valid_id_2: null,
    community_tax_certificate: null,
    residence_sketch: null,
  })
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [signatureDate, setSignatureDate] = useState(todayISODate())
  const [borrowerPassword, setBorrowerPassword] = useState('')
  const [borrowerPasswordConfirm, setBorrowerPasswordConfirm] = useState('')
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [rateLabel, setRateLabel] = useState('3.50% per month')

  const flatErrorCount = useMemo(() => Object.keys(fieldErrors).length, [fieldErrors])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const d = JSON.parse(raw)
      if (d?.wizard) setWizard(d.wizard)
      if (d?.termsAccepted != null) setTermsAccepted(d.termsAccepted)
      if (d?.signatureDate) setSignatureDate(d.signatureDate)
    } catch {
      /* ignore */
    }
  }, [])

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
        const p = (rows || []).find((x) => String(x.slug || '').toLowerCase() === 'travel-assistance-loan')
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

  const saveDraft = () => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          wizard,
          termsAccepted,
          signatureDate,
          savedAt: new Date().toISOString(),
        }),
      )
      setErrorMsg('')
      openModal({ message: 'Draft saved in this browser.', tone: 'success' })
    } catch {
      openModal({ message: 'Could not save draft.', tone: 'error' })
    }
  }

  const printApplication = () => {
    window.print()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setFieldErrors({})

    const merged = {
      ...wizard,
      loan: { ...wizard.loan, desired_term: '1' },
    }

    const errs = validateTravelWizardClient(merged, {
      termsAccepted,
      files,
    })

    if (!borrowerPassword?.trim() || !borrowerPasswordConfirm?.trim()) {
      errs.borrowerPassword = 'Enter your borrower portal password.'
      errs.borrowerPasswordConfirm = 'Confirm your borrower portal password.'
    } else if (borrowerPassword.length < 8) {
      errs.borrowerPassword = 'Password must be at least 8 characters.'
    } else if (borrowerPassword !== borrowerPasswordConfirm) {
      errs.borrowerPasswordConfirm = 'Password confirmation does not match.'
    }

    if (Object.keys(errs).length) {
      setFieldErrors(errs)
      setStatus('error')
      setErrorMsg('Please fill in all required fields.')
      focusFirstInvalidField(errs)
      return
    }

    setStatus('loading')
    try {
      await postTravelLoanWizardApplication({
        wizard: merged,
        password: borrowerPassword,
        termsAccepted: true,
        signatureDate,
        files,
      })
      setStatus('success')
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* ignore */
      }
      setWizard(() => {
        const w = createEmptyWizard()
        w.loan.desired_term = '1'
        w.loan.travel_date = todayISODate()
        return w
      })
      setFiles({
        passport_photos: [null, null, null],
        passport_copy: null,
        valid_id_1: null,
        valid_id_2: null,
        community_tax_certificate: null,
        residence_sketch: null,
      })
      setTermsAccepted(false)
      setSignatureDate(todayISODate())
      setBorrowerPassword('')
      setBorrowerPasswordConfirm('')
      openModal({ message: 'Application submitted successfully.', tone: 'success' })
    } catch (err) {
      setStatus('error')
      setErrorMsg(err?.message || 'Submission failed.')
    }
  }

  const tier = 'orange'

  return (
    <div className="flex min-h-screen flex-col bg-brand-background-alt text-brand-text print:bg-white">
      <SubPageHeader />
      <main className="flex-1">
        <div className="app-container max-w-6xl py-10 sm:py-14">
          <Link to="/loan-products" className="text-sm font-medium text-brand-primary hover:underline print:hidden">
            ← Loan products
          </Link>

          <article className={`mt-6 scroll-mt-24 rounded-2xl border p-5 sm:p-8 ${tierCardClass(tier)} print:hidden`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${tierIconWrapClass(tier)}`}>
                  <LoanProductIcon iconKey="plane" className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-brand-text dark:text-white">Travel Assistance Loan</h1>
                  <p className={`mt-1 text-base font-semibold ${tierAccentClass(tier)}`}>{rateLabel}</p>
                  <p className="mt-1 text-xs text-brand-text/70 dark:text-white/55">
                    Max loan ₱{MAX_LOAN.toLocaleString()} · term: monthly renewal (1 month)
                  </p>
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
                  href="#travel-assistance-apply-form"
                  className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-primary-hover"
                >
                  Apply now
                </a>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-brand-text/80 dark:text-white/75">Loan for overseas work/travel.</p>
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-white/60 p-3 dark:bg-black/20">
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">Collateral</dt>
                <dd className="mt-1 text-brand-text dark:text-white">Landbank account</dd>
              </div>
              <div className="rounded-xl bg-white/60 p-3 dark:bg-black/20 sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">Requirements</dt>
                <dd className="mt-1 text-brand-text dark:text-white">
                  Passport photos (3), passport copy, 2 valid IDs, community tax certificate, residence sketch, completed application below.
                </dd>
              </div>
            </dl>
          </article>

          {showEligibility ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden" role="dialog" aria-modal="true">
              <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-[#111827]">
                <h2 className="text-lg font-semibold text-brand-text dark:text-white">Eligibility (Travel Assistance)</h2>
                <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-brand-text/85 dark:text-white/80">
                  <li>Documented travel or overseas work plans</li>
                  <li>Landbank (or designated) account for disbursement</li>
                  <li>Valid TIN and complete KYC documents</li>
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
            id="travel-assistance-apply-form"
            className="mt-10 scroll-mt-24 rounded-2xl border border-brand-secondary/30 bg-white p-5 shadow-sm dark:border-[#1F2937] dark:bg-[#111827] sm:p-8 print:border-0 print:shadow-none"
          >
            <div className="print:block hidden">
              <h1 className="text-lg font-bold text-black">Travel Assistance Loan — Application</h1>
              <p className="text-xs text-black/70">Printed {new Date().toLocaleString()}</p>
            </div>

            <h2 className="text-lg font-semibold text-brand-text dark:text-white print:text-black">Application</h2>
            <p className="mt-1 text-sm text-brand-text/70 dark:text-white/60 print:text-black/70">
              Complete all sections. Loan amount cannot exceed ₱{MAX_LOAN.toLocaleString()}. Term is fixed at 1 month (monthly renewal).
            </p>

            {status === 'success' ? (
              <p
                className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 print:hidden"
                role="status"
              >
                Thank you. We received your Travel Assistance Loan application. Check your email for confirmation.
              </p>
            ) : null}
            {errorMsg ? (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200 print:hidden" role="alert">
                {errorMsg}
                {flatErrorCount > 0 ? ` (${flatErrorCount} field${flatErrorCount === 1 ? '' : 's'})` : ''}
              </p>
            ) : null}
            {fieldErrors.password ? (
              <p className="mt-2 text-sm text-red-600 print:hidden">{fieldErrors.password}</p>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-6 space-y-8">
              <div id="travel-wizard-print-root">
                <TravelWizardForm
                  wizard={wizard}
                  setWizard={setWizard}
                  errors={fieldErrors}
                  termsAccepted={termsAccepted}
                  setTermsAccepted={setTermsAccepted}
                  signatureDate={signatureDate}
                  setSignatureDate={setSignatureDate}
                  files={files}
                  setFiles={setFiles}
                />
              </div>

              <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4 print:hidden">
                <legend className="text-sm font-semibold text-brand-text dark:text-white">Borrower portal password</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="Create borrower portal password *"
                    value={borrowerPassword}
                    onChange={(e) => setBorrowerPassword(e.target.value)}
                    data-field-path="borrowerPassword"
                    className={`w-full rounded-xl px-4 py-3 text-sm dark:bg-[#0F172A] dark:text-white ${
                      fieldErrors.borrowerPassword ? 'border border-red-500 ring-1 ring-red-500/20 dark:border-red-500' : 'border border-brand-secondary/40 dark:border-[#374151]'
                    }`}
                  />
                  {fieldErrors.borrowerPassword ? <p className="text-xs text-red-600">{fieldErrors.borrowerPassword}</p> : null}
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="Confirm password *"
                    value={borrowerPasswordConfirm}
                    onChange={(e) => setBorrowerPasswordConfirm(e.target.value)}
                    data-field-path="borrowerPasswordConfirm"
                    className={`w-full rounded-xl px-4 py-3 text-sm dark:bg-[#0F172A] dark:text-white ${
                      fieldErrors.borrowerPasswordConfirm ? 'border border-red-500 ring-1 ring-red-500/20 dark:border-red-500' : 'border border-brand-secondary/40 dark:border-[#374151]'
                    }`}
                  />
                  {fieldErrors.borrowerPasswordConfirm ? <p className="text-xs text-red-600">{fieldErrors.borrowerPasswordConfirm}</p> : null}
                </div>
              </fieldset>

              <div className="flex flex-wrap gap-3 print:hidden">
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="flex-1 min-w-[160px] rounded-xl bg-brand-primary py-3.5 text-sm font-semibold text-white shadow transition hover:bg-brand-primary-hover disabled:opacity-60"
                >
                  {status === 'loading' ? 'Submitting…' : 'Submit application'}
                </button>
                <button type="button" onClick={saveDraft} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                  Save draft
                </button>
                <button type="button" onClick={printApplication} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                  Print
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
