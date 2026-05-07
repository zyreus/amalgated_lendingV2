import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SubPageHeader from '../components/SubPageHeader.jsx'
import Footer from '../components/Footer.jsx'
import AmalgatedLoanApplicationForm from '../components/loan/AmalgatedLoanApplicationForm.jsx'
import CoMakerStatementForm from '../components/loan/CoMakerStatementForm.jsx'
import {
  createEmptyCoMakerStatement,
  createEmptyExtendedApplication,
  getAmalgatedPresetFromLoanContext,
} from '../components/loan/amalgatedApplicationFormState.js'
import AmalgatedApplicationPrintBundle from '../components/loan/AmalgatedApplicationPrintBundle.jsx'
import LoanProductDocumentsChecklist from '../components/loan/LoanProductDocumentsChecklist.jsx'
import { documentProductKeyFromSlug } from '../components/loan/loanProductDocuments.js'
import PrivacyPolicyModal from '../components/privacy/PrivacyPolicyModal.jsx'
import PrivacyConsentCheckbox from '../components/privacy/PrivacyConsentCheckbox.jsx'
import { PRIVACY_POLICY_VERSION } from '../components/privacy/PrivacyPolicyContent.jsx'
import {
  deriveApplicantFromExtended,
  normalizeCoMakerStatementPayload,
  normalizeExtendedApplicationPayload,
} from '../components/loan/amalgatedPayloadMerge.js'
import { getLoanProducts } from '../utils/loanProductsPublicApi.js'
import { postAliLaravelApplication } from '../utils/lendingApi.js'

const LOAN_TYPES = ['Personal Loan', 'Business Loan', 'Salary Loan', 'Retail Financing', 'Home Loan', 'Vehicle Loan']
const TERM_PRESETS = [3, 6, 12, 24, 36, 60]

function monthlyAmortization(principal, annualOrMonthlyRatePercent, termMonths, rateType = 'monthly') {
  const p = Number(principal) || 0
  const n = Number(termMonths) || 0
  if (p <= 0 || n <= 0) return 0
  let monthlyRate = (Number(annualOrMonthlyRatePercent) || 0) / 100
  if (rateType === 'fixed') monthlyRate = monthlyRate / Math.max(1, n)
  if (monthlyRate <= 0) return p / n
  const pow = Math.pow(1 + monthlyRate, n)
  return p * ((monthlyRate * pow) / (pow - 1))
}

export default function ApplyPage() {
  const [searchParams] = useSearchParams()
  const [formData, setFormData] = useState({
    loanType: '',
    loanAmount: '',
    loanTerm: '',
    purpose: '',
    borrowerPassword: '',
    borrowerPasswordConfirm: '',
  })
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('')
  /** Which submit path succeeded — only Laravel API sends confirmation email + stores in admin DB */
  const [applySuccessMode, setApplySuccessMode] = useState(null) // 'laravel' | 'legacy' | 'demo' | null
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [extendedApplication, setExtendedApplication] = useState(() => createEmptyExtendedApplication(null))
  const [coMakerStatement, setCoMakerStatement] = useState(() => createEmptyCoMakerStatement())
  const [privacyConsent, setPrivacyConsent] = useState({
    agreed: false,
    agreedAt: null,
    version: PRIVACY_POLICY_VERSION,
  })
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setErrorMsg('')
  }

  const onPrivacyConsentChange = (agreed) => {
    setPrivacyConsent((prev) => ({
      ...prev,
      agreed,
      agreedAt: agreed ? new Date().toISOString() : null,
    }))
    setErrorMsg('')
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setProductsLoading(true)
      try {
        const rows = await getLoanProducts()
        if (cancelled) return
        setProducts(Array.isArray(rows) ? rows : [])
      } catch {
        if (cancelled) return
        setProducts([])
      } finally {
        if (!cancelled) setProductsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!products.length) return
    const slug = (searchParams.get('product') || '').trim().toLowerCase()
    if (!slug) return
    const selected = products.find((p) => String(p.slug || '').toLowerCase() === slug)
    if (!selected) return
    setFormData((prev) => {
      if (prev.loanType === selected.name) return prev
      return {
        ...prev,
        loanType: selected.name,
        loanTerm:
          selected.max_term && Number(selected.max_term) > 0
            ? String(Math.min(12, Number(selected.max_term)))
            : prev.loanTerm || '12',
      }
    })
  }, [products, searchParams])

  const selectedProduct = useMemo(
    () => products.find((p) => p.name === formData.loanType) || null,
    [products, formData.loanType]
  )
  const amalgatedPreset = useMemo(
    () => getAmalgatedPresetFromLoanContext(formData.loanType, selectedProduct?.slug),
    [formData.loanType, selectedProduct?.slug]
  )
  const applyDocKey = useMemo(() => documentProductKeyFromSlug(selectedProduct?.slug), [selectedProduct?.slug])
  const showOfficialApplicationForm = useMemo(() => {
    if (amalgatedPreset != null) return true
    const s = String(selectedProduct?.slug || '').toLowerCase()
    return s.includes('travel-assistance') || s.includes('pension') || s.includes('sss')
  }, [amalgatedPreset, selectedProduct?.slug])
  const showCoMakerOnApply = amalgatedPreset === 'chattel' || amalgatedPreset === 'salary'

  useEffect(() => {
    const preset = getAmalgatedPresetFromLoanContext(formData.loanType, selectedProduct?.slug)
    const slug = String(selectedProduct?.slug || '').toLowerCase()
    let other = ''
    if (slug.includes('travel')) other = 'Travel Assistance Loan'
    else if (slug.includes('pension') || slug.includes('sss')) other = 'SSS/GSIS Pensioner Loan'
    setExtendedApplication(createEmptyExtendedApplication(preset, { otherSpecify: other }))
    setCoMakerStatement(createEmptyCoMakerStatement())
  }, [formData.loanType, selectedProduct?.slug])
  const maxTerm = selectedProduct?.max_term && Number(selectedProduct.max_term) > 0 ? Number(selectedProduct.max_term) : 60
  const termOptions = useMemo(() => {
    const preset = TERM_PRESETS.filter((m) => m <= maxTerm)
    return preset.includes(maxTerm) ? preset : [...preset, maxTerm]
  }, [maxTerm])
  const computed = useMemo(() => {
    const extPrincipal = Number(extendedApplication.loan_principal_php || 0)
    const extTerm = Number(extendedApplication.loan_term_months || 0)
    const principal = showOfficialApplicationForm && extPrincipal > 0 ? extPrincipal : Number(formData.loanAmount || 0)
    const months = showOfficialApplicationForm && extTerm > 0 ? extTerm : Number(formData.loanTerm || 0)
    if (!selectedProduct || principal <= 0 || months <= 0) return null
    const monthly = monthlyAmortization(principal, selectedProduct.interest_rate, months, selectedProduct.rate_type)
    const totalPayment = monthly * months
    const totalInterest = totalPayment - principal
    return { monthly, totalPayment, totalInterest, months, principal }
  }, [formData.loanAmount, formData.loanTerm, selectedProduct, showOfficialApplicationForm, extendedApplication])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.loanType?.trim()) {
      setStatus('error')
      setErrorMsg('Select a loan type.')
      return
    }
    if (!formData.borrowerPassword?.trim() || !formData.borrowerPasswordConfirm?.trim()) {
      setStatus('error')
      setErrorMsg('Enter and confirm your borrower portal password.')
      return
    }
    if (formData.borrowerPassword.length < 8) {
      setStatus('error')
      setErrorMsg('Password must be at least 8 characters.')
      return
    }
    if (formData.borrowerPassword !== formData.borrowerPasswordConfirm) {
      setStatus('error')
      setErrorMsg('Password confirmation does not match.')
      return
    }
    if (!privacyConsent.agreed) {
      setStatus('error')
      setErrorMsg('You must agree to the Privacy Policy to proceed with your loan application.')
      return
    }
    if (showOfficialApplicationForm) {
      const derived = deriveApplicantFromExtended(extendedApplication, formData)
      if (!derived.fullName || !derived.email || !derived.phone || !derived.address) {
        setStatus('error')
        setErrorMsg('Complete the official application: applicant name, email, mobile phone, residence, loan amount, and term.')
        return
      }
      if (!String(extendedApplication.branch_name || '').trim()) {
        setStatus('error')
        setErrorMsg('Enter the branch name in the official application section.')
        return
      }
      if (!extendedApplication.application_nature) {
        setStatus('error')
        setErrorMsg('Select application nature: New loan or Re-loan / renewal.')
        return
      }
      const termCheck = Number(derived.loanTerm || formData.loanTerm)
      if (selectedProduct?.max_term && termCheck > Number(selectedProduct.max_term)) {
        setStatus('error')
        setErrorMsg(`Selected product allows up to ${selectedProduct.max_term} months only.`)
        return
      }
    } else {
      const required = ['loanAmount', 'loanTerm']
      const missing = required.filter((f) => !formData[f]?.trim())
      if (missing.length) {
        setStatus('error')
        setErrorMsg('Enter loan amount and term.')
        return
      }
      if (selectedProduct?.max_term && Number(formData.loanTerm) > Number(selectedProduct.max_term)) {
        setStatus('error')
        setErrorMsg(`Selected product allows up to ${selectedProduct.max_term} months only.`)
        return
      }
    }

    setStatus('loading')
    setErrorMsg('')

    try {
      const extNorm = showOfficialApplicationForm ? normalizeExtendedApplicationPayload(extendedApplication, formData) : undefined
      const derived = extNorm ? deriveApplicantFromExtended(extNorm, formData) : null
      await postAliLaravelApplication({
        ...formData,
        ...(derived
          ? {
              fullName: derived.fullName,
              email: derived.email,
              phone: derived.phone,
              address: derived.address,
              city: derived.city,
              province: derived.province,
              loanAmount: derived.loanAmount || formData.loanAmount,
              loanTerm: derived.loanTerm || formData.loanTerm,
            }
          : {}),
        loanProductSlug: selectedProduct?.slug ?? null,
        selectedInterestRate: selectedProduct?.interest_rate ?? null,
        selectedRateType: selectedProduct?.rate_type ?? null,
        privacyConsent,
        extendedApplication: extNorm,
        coMakerStatement:
          showOfficialApplicationForm && showCoMakerOnApply && extNorm
            ? normalizeCoMakerStatementPayload(coMakerStatement, formData, extNorm)
            : undefined,
      })
      setApplySuccessMode('laravel')
      setStatus('success')
      setFormData({
        loanType: '',
        loanAmount: '',
        loanTerm: '',
        purpose: '',
        borrowerPassword: '',
        borrowerPasswordConfirm: '',
      })
      setPrivacyConsent({
        agreed: false,
        agreedAt: null,
        version: PRIVACY_POLICY_VERSION,
      })
    } catch (err) {
      setStatus('error')
      setErrorMsg(err?.message || 'Unable to submit. Please try again later.')
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SubPageHeader />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="border-l-4 border-red-600 pl-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">Apply</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-black sm:text-3xl">
            Loan application
          </h1>
          <p className="mt-2 text-sm text-black/70">
            Complete the form below. We will review your application and contact you within 1–2 business days.
          </p>
        </div>

        {status === 'success' ? (
          <div className="mt-10 rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
            <h2 className="text-lg font-semibold text-green-800">Application submitted</h2>
            <p className="mt-2 text-sm text-green-700">
              {applySuccessMode === 'laravel' ? (
                <>
                  We’ve sent a confirmation email to your address with your reference number. Our team will review your
                  application in the admin portal and contact you within 1–2 business days.
                </>
              ) : (
                <>
                  Thank you for applying. Our team will review your application and contact you within 1–2 business days.
                </>
              )}
            </p>
            <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700">
              Back to home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 space-y-8">
            <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-black">Loan details</h2>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <label>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/60">Loan type *</span>
                  <select name="loanType" value={formData.loanType} onChange={handleChange} required className="mt-2 w-full rounded-lg border border-black/15 px-4 py-3 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20">
                    <option value="">Select</option>
                    {(products.length ? products.map((p) => p.name) : LOAN_TYPES).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {productsLoading ? <p className="mt-1 text-xs text-black/50">Loading product catalog…</p> : null}
                </label>
                <label>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/60">Interest rate (auto)</span>
                  <input
                    type="text"
                    readOnly
                    value={
                      selectedProduct
                        ? `${Number(selectedProduct.interest_rate || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 3,
                            maximumFractionDigits: 3,
                          })}% ${selectedProduct.rate_type || 'monthly'}`
                        : 'Select loan type first'
                    }
                    className="mt-2 w-full rounded-lg border border-black/15 bg-black/5 px-4 py-3 text-sm text-black/80 outline-none"
                  />
                </label>
                {!showOfficialApplicationForm ? (
                  <>
                    <label>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/60">Amount (PHP) *</span>
                      <input type="number" name="loanAmount" value={formData.loanAmount} onChange={handleChange} required min="1000" placeholder="100000" className="mt-2 w-full rounded-lg border border-black/15 px-4 py-3 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20" />
                    </label>
                    <label>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/60">Term (months) *</span>
                      <select name="loanTerm" value={formData.loanTerm} onChange={handleChange} required className="mt-2 w-full rounded-lg border border-black/15 px-4 py-3 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20">
                        <option value="">Select</option>
                        {termOptions.map((m) => (
                          <option key={m} value={String(m)}>{m} months</option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <p className="sm:col-span-2 text-sm text-black/60">Loan amount and term are entered in the official application below.</p>
                )}
                <label className="sm:col-span-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/60">Purpose</span>
                  <textarea name="purpose" value={formData.purpose} onChange={handleChange} rows={3} placeholder="Brief description of loan purpose" className="mt-2 w-full resize-y rounded-lg border border-black/15 px-4 py-3 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20" />
                </label>
                {computed ? (
                  <div className="sm:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Estimated computation</p>
                    <p className="mt-2 text-sm text-emerald-900">
                      Monthly amortization: <strong>PHP {computed.monthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </p>
                    <p className="mt-1 text-sm text-emerald-900">
                      Interest used: <strong>{Number(selectedProduct?.interest_rate || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}% {selectedProduct?.rate_type || 'monthly'}</strong>
                    </p>
                    <p className="mt-1 text-sm text-emerald-900">
                      Total payment ({computed.months} months): <strong>PHP {computed.totalPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </p>
                    <p className="mt-1 text-sm text-emerald-900">
                      Estimated total interest: <strong>PHP {computed.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </p>
                    <p className="mt-2 text-xs text-emerald-800/80">Estimate only. Final terms depend on eligibility and credit approval.</p>
                  </div>
                ) : null}
              </div>
            </section>

            {showOfficialApplicationForm ? (
              <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-black">Official application (Amalgated format)</h2>
                <p className="mt-1 text-sm text-black/60">
                  Branch and application nature (new loan vs re-loan / renewal) are required. Co-maker statement appears for chattel and salary-type applications.
                </p>
                <div className="mt-4 space-y-4 rounded-xl border border-black/10 bg-black/[0.02] p-4">
                  {applyDocKey ? <LoanProductDocumentsChecklist productKey={applyDocKey} /> : null}
                  <fieldset className="min-w-0 space-y-4 border-0 p-0">
                    <legend className="float-none w-full px-0 text-sm font-semibold text-black">
                      {showCoMakerOnApply ? 'Applicant & co-maker' : 'Applicant'}
                    </legend>
                    <AmalgatedLoanApplicationForm
                      presetCategory={amalgatedPreset}
                      loanTermOptions={termOptions}
                      value={extendedApplication}
                      onChange={setExtendedApplication}
                    />
                    {showCoMakerOnApply ? (
                      <CoMakerStatementForm
                        value={coMakerStatement}
                        onChange={setCoMakerStatement}
                        prefillApplicantName={extendedApplication.applicant?.name || ''}
                        prefillLoanAmount={extendedApplication.loan_principal_php || ''}
                      />
                    ) : null}
                    <AmalgatedApplicationPrintBundle
                      extendedApplication={extendedApplication}
                      coMakerStatement={coMakerStatement}
                      includeCoMaker={showCoMakerOnApply}
                    />
                  </fieldset>
                </div>
              </section>
            ) : null}

            <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-black">Borrower account</h2>
              <p className="mt-1 text-sm text-black/60">Use these credentials to log in after your account is created.</p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <label>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/60">Password *</span>
                  <input type="password" name="borrowerPassword" value={formData.borrowerPassword} onChange={handleChange} required minLength={8} placeholder="At least 8 characters" className="mt-2 w-full rounded-lg border border-black/15 px-4 py-3 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20" />
                </label>
                <label>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/60">Confirm password *</span>
                  <input type="password" name="borrowerPasswordConfirm" value={formData.borrowerPasswordConfirm} onChange={handleChange} required minLength={8} placeholder="Re-enter password" className="mt-2 w-full rounded-lg border border-black/15 px-4 py-3 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20" />
                </label>
              </div>
            </section>

            {status === 'error' && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{errorMsg}</p>
            )}

            <PrivacyConsentCheckbox
              checked={privacyConsent.agreed}
              onChange={onPrivacyConsentChange}
              onOpenPolicy={() => setPrivacyModalOpen(true)}
              error={status === 'error' && errorMsg.includes('Privacy Policy') ? errorMsg : ''}
            />

            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                type="submit"
                disabled={status === 'loading' || !privacyConsent.agreed}
                className="rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-red-700 disabled:opacity-60"
              >
                {status === 'loading' ? 'Submitting...' : 'Submit application'}
              </button>
              <Link to="/borrower/login" className="text-sm font-medium text-red-600 hover:underline">
                Already have an account? Log in
              </Link>
            </div>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-black/60">
          <Link to="/" className="text-red-600 hover:underline">← Back to home</Link>
        </p>
      </main>
      <Footer />
      <PrivacyPolicyModal open={privacyModalOpen} onClose={() => setPrivacyModalOpen(false)} />
    </div>
  )
}
