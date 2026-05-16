import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import SubPageHeader from '../components/SubPageHeader.jsx'
import Footer from '../components/Footer.jsx'
import DocumentLoanWizardSection from '../components/DocumentLoanWizardSection.jsx'
import { getBorrowerToken, setBorrowerToken } from '../borrower/api/client.js'
import {
  createBorrowerDocumentDraft,
  createDocumentLoanApplication,
  fetchApplicationPrintHtml,
  openClientLoanApplicationPrintPreview,
  fetchDocumentRequirementsBySlug,
  getDocumentLoanApplication,
  getDocumentLoanDraft,
  reuploadDocumentForRequirement,
  submitDocumentLoanApplication,
  uploadDocumentForRequirement,
  uploadSignedApplicationForm,
} from '../utils/documentLoanApi.js'
import { getLaravelStorageFileUrl } from '../utils/lendingLaravelApi.js'

const FORM_ERROR_BANNER_CLASS =
  'rounded-2xl bg-red-50 p-5 text-sm leading-relaxed text-red-800 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900/50 sm:p-6'

function statusBadgeClass(upload) {
  if (!upload) return 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100'
  if (upload.status === 'verified') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
  if (upload.status === 'rejected') return 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300'
  return 'bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-100'
}

function uploadLabel(upload) {
  if (!upload) return 'Pending'
  if (upload.status === 'verified') return 'Verified'
  if (upload.status === 'rejected') return 'Rejected'
  return 'Uploaded'
}

export default function DocumentLoanApplyPage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [metaError, setMetaError] = useState('')
  const [product, setProduct] = useState(null)
  const [application, setApplication] = useState(null)
  const [reg, setReg] = useState({ name: '', email: '', password: '', phone: '' })
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [uploadingId, setUploadingId] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [signedUploading, setSignedUploading] = useState(false)
  const [printLoading, setPrintLoading] = useState(false)

  const refreshApplication = useCallback(async (id) => {
    const res = await getDocumentLoanApplication(id)
    if (res?.loan_application) setApplication(res.loan_application)
  }, [])

  const tryLoadDraft = useCallback(async (productId) => {
    if (!getBorrowerToken()) return
    try {
      const res = await getDocumentLoanDraft(productId)
      if (res?.loan_application) setApplication(res.loan_application)
    } catch (e) {
      if (e.status !== 404) setFormError(e.message || 'Could not load draft.')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingMeta(true)
      setMetaError('')
      setProduct(null)
      setApplication(null)
      try {
        const { product: p } = await fetchDocumentRequirementsBySlug(slug)
        if (cancelled) return
        if (!p?.id) {
          setMetaError('Loan product not found.')
          return
        }
        setProduct(p)
        await tryLoadDraft(p.id)
        if (searchParams.get('start') === '1' && getBorrowerToken() && !cancelled) {
          try {
            const res = await createBorrowerDocumentDraft(p.id)
            if (res?.loan_application) setApplication(res.loan_application)
          } catch (e) {
            if (e.status !== 404) setFormError(e.message || 'Could not start application.')
          }
        }
      } catch (e) {
        if (!cancelled) setMetaError(e.message || 'Failed to load product.')
      } finally {
        if (!cancelled) setLoadingMeta(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, tryLoadDraft, searchParams])

  const handleRegister = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!product?.id) return
    setBusy(true)
    try {
      const res = await createDocumentLoanApplication({
        loan_product_id: product.id,
        email: reg.email.trim(),
        name: reg.name.trim(),
        password: reg.password,
        phone: reg.phone.trim() || null,
      })
      if (res?.token) setBorrowerToken(res.token)
      if (res?.loan_application) setApplication(res.loan_application)
      setReg({ name: '', email: '', password: '', phone: '' })
    } catch (err) {
      const msg = err?.message || 'Registration failed.'
      setFormError(msg)
    } finally {
      setBusy(false)
    }
  }

  const handleStartLoggedIn = async () => {
    if (!product?.id) return
    setFormError('')
    setBusy(true)
    try {
      const res = await createBorrowerDocumentDraft(product.id)
      if (res?.loan_application) setApplication(res.loan_application)
    } catch (e) {
      setFormError(e.message || 'Could not start application.')
    } finally {
      setBusy(false)
    }
  }

  const handleFile = async (requirementId, file) => {
    if (!application?.id || !file) return
    const row = application.requirements?.find((r) => r.requirement?.id === requirementId)
    if (row?.upload && !row.upload.can_replace) {
      setFormError(
        'This file is awaiting review. Replace is allowed only if it was rejected, or after you upload a signed application form.',
      )
      return
    }
    setFormError('')
    setUploadingId(requirementId)
    try {
      if (row?.upload) {
        await reuploadDocumentForRequirement({
          documentLoanApplicationId: application.id,
          requirementId,
          file,
        })
      } else {
        await uploadDocumentForRequirement({
          documentLoanApplicationId: application.id,
          requirementId,
          file,
        })
      }
      await refreshApplication(application.id)
    } catch (e) {
      setFormError(e.message || 'Upload failed.')
    } finally {
      setUploadingId(null)
    }
  }

  const handlePrint = async () => {
    setPrintLoading(true)
    setFormError('')
    try {
      if (application?.id) {
        const html = await fetchApplicationPrintHtml(application.id)
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const w = window.open(url, '_blank', 'noopener,noreferrer')
        if (w) w.focus()
      } else if (product) {
        openClientLoanApplicationPrintPreview(product)
      }
    } catch (e) {
      setFormError(e.message || 'Could not open printable form.')
    } finally {
      setPrintLoading(false)
    }
  }

  const handleSignedUpload = async (file) => {
    if (!application?.id || !file) return
    setSignedUploading(true)
    setFormError('')
    try {
      const res = await uploadSignedApplicationForm({ documentLoanApplicationId: application.id, file })
      if (res?.loan_application) setApplication(res.loan_application)
      else await refreshApplication(application.id)
    } catch (e) {
      setFormError(e.message || 'Signed form upload failed.')
    } finally {
      setSignedUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!application?.id) return
    const uploaded = Number(application?.progress?.uploaded || 0)
    const total = Number(application?.progress?.total || 0)
    const signed = Boolean(application?.progress?.signed_form)
    const missingUploads = Math.max(0, total - uploaded)
    if (!application?.can_submit) {
      const blocker = [
        missingUploads > 0 ? `Upload ${missingUploads} more required document${missingUploads === 1 ? '' : 's'}.` : null,
        !signed ? 'Upload the signed application form.' : null,
      ]
        .filter(Boolean)
        .join(' ')
      setFormError(blocker || 'Please complete all required uploads before submitting.')
      return
    }
    setFormError('')
    setBusy(true)
    try {
      const res = await submitDocumentLoanApplication(application.id)
      if (res?.loan_application) setApplication(res.loan_application)
    } catch (e) {
      setFormError(e.message || 'Submit failed.')
    } finally {
      setBusy(false)
    }
  }

  const progress = application?.progress
  const submitted = Boolean(application?.submitted_at)
  const hasToken = Boolean(getBorrowerToken())
  const signedOk = Boolean(progress?.signed_form)
  const uploadedCount = Number(progress?.uploaded || 0)
  const totalRequired = Number(progress?.total || 0)
  const missingUploads = Math.max(0, totalRequired - uploadedCount)
  const canSubmitNow = Boolean(application?.can_submit)
  const submitBlockerMessage =
    !canSubmitNow && !submitted
      ? [
          missingUploads > 0
            ? `Upload ${missingUploads} more required document${missingUploads === 1 ? '' : 's'}.`
            : null,
          !signedOk ? 'Upload the signed application form.' : null,
        ]
          .filter(Boolean)
          .join(' ')
      : ''

  return (
    <div className="flex min-h-screen flex-col page-shell-bg text-brand-text">
      <SubPageHeader />
      <main className="flex-1">
        <div className="app-container max-w-6xl py-10 sm:py-14">
          <Link to="/loan-products" className="text-sm font-medium text-brand-primary hover:underline">
            ← Loan products
          </Link>

          {loadingMeta ? (
            <div className="mt-8 h-40 animate-pulse rounded-2xl bg-black/[0.06] dark:bg-white/[0.06]" />
          ) : metaError ? (
            <p className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              {metaError}
            </p>
          ) : (
            <>
              <div className="mt-8 rounded-2xl border border-brand-secondary/30 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Document-only application</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-text dark:text-white">{product?.name}</h1>
                {product?.description ? (
                  <p className="mt-3 text-sm leading-relaxed text-brand-text/80 dark:text-white/75">{product.description}</p>
                ) : null}
                {!application ? (
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                    <button
                      type="button"
                      onClick={handlePrint}
                      disabled={printLoading}
                      className="inline-flex w-fit items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-brand-text shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                    >
                      {printLoading ? 'Opening…' : 'Print application form'}
                    </button>
                    <p className="text-xs text-brand-text/70 dark:text-white/60">
                      Works before you sign up — missing fields print as N/A. Use your browser&apos;s print dialog to save as PDF.
                    </p>
                  </div>
                ) : null}
              </div>

              {!application && !hasToken ? (
                <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/60">
                  <h2 className="text-lg font-semibold text-brand-text dark:text-white">Create your borrower account</h2>
                  <p className="mt-2 text-sm text-brand-text/75 dark:text-white/70">
                    Requirements are satisfied by uploading files only — no manual entry of requirement text. Use a unique email
                    to start; if you already have an account,{' '}
                    <Link
                      to={`/borrower/login?redirect=${encodeURIComponent(`/apply/documents/${slug}?start=1`)}`}
                      className="font-semibold text-brand-primary hover:underline"
                    >
                      sign in
                    </Link>{' '}
                    to continue.
                  </p>
                  <form onSubmit={handleRegister} className="mt-6 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">
                        Full name
                      </label>
                      <input
                        required
                        value={reg.name}
                        onChange={(e) => setReg((s) => ({ ...s, name: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        value={reg.email}
                        onChange={(e) => setReg((s) => ({ ...s, email: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">
                        Phone (optional)
                      </label>
                      <input
                        value={reg.phone}
                        onChange={(e) => setReg((s) => ({ ...s, phone: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">
                        Password (min 8 characters)
                      </label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={reg.password}
                        onChange={(e) => setReg((s) => ({ ...s, password: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    {formError ? (
                      <div role="alert" className={FORM_ERROR_BANNER_CLASS}>
                        {formError}
                      </div>
                    ) : null}
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white shadow transition hover:bg-brand-primary-hover disabled:opacity-60"
                    >
                      {busy ? 'Starting…' : 'Start & upload documents'}
                    </button>
                  </form>
                </section>
              ) : null}

              {!application && hasToken ? (
                <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/60">
                  <h2 className="text-lg font-semibold text-brand-text dark:text-white">Continue your application</h2>
                  <p className="mt-2 text-sm text-brand-text/75 dark:text-white/70">
                    Start a new document checklist for this loan product, or sign in from the email we sent you if you already
                    began one.
                  </p>
                  {formError ? (
                    <div role="alert" className={`mt-4 ${FORM_ERROR_BANNER_CLASS}`}>
                      {formError}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleStartLoggedIn}
                    disabled={busy}
                    className="mt-4 rounded-xl bg-brand-primary px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-brand-primary-hover disabled:opacity-60"
                  >
                    {busy ? 'Opening…' : 'Open document checklist'}
                  </button>
                </section>
              ) : null}

              {application ? (
                <section className="mt-8 space-y-6">
                  {submitted ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
                      Application submitted. Our team will review your documents. You may track status in your borrower portal.
                    </div>
                  ) : null}

                  {!submitted ? (
                    <DocumentLoanWizardSection
                      application={application}
                      product={product}
                      onApplicationRefresh={() => refreshApplication(application.id)}
                    />
                  ) : null}

                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900/60">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">Progress</p>
                        <p className="mt-1 text-lg font-semibold text-brand-text dark:text-white">
                          Documents uploaded: {progress?.uploaded ?? 0} / {progress?.total ?? 0}
                        </p>
                        <p className="mt-1 text-sm text-brand-text/80 dark:text-white/70">
                          Signed form: {signedOk ? '✅ Yes' : '❌ No'}
                        </p>
                      </div>
                      <div className="h-2 w-full max-w-xs flex-1 rounded-full bg-slate-200 dark:bg-slate-700 sm:w-auto">
                        <div
                          className="h-2 rounded-full bg-brand-primary transition-all"
                          style={{
                            width: `${progress?.total ? Math.min(100, (100 * (progress.uploaded || 0)) / progress.total) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/60">
                    <h3 className="text-base font-semibold text-brand-text dark:text-white">Application form</h3>
                    <p className="mt-1 text-sm text-brand-text/70 dark:text-white/60">
                      Print anytime — you do not need to finish uploads or the checklist first. Missing details show as N/A on the
                      printable page{submitted ? ' (for your records).' : '. Sign the printed form, then upload it below.'}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handlePrint}
                        disabled={printLoading}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-brand-text shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                      >
                        {printLoading ? 'Opening…' : 'Print application form'}
                      </button>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                        Signed copy: {signedOk ? 'Uploaded ✅' : 'Not uploaded ❌'}
                      </span>
                    </div>
                  </div>

                  {!submitted ? (
                    <div className="rounded-2xl border border-dashed border-brand-primary/40 bg-brand-background-alt/50 p-5 dark:bg-slate-800/40">
                      <p className="text-sm font-medium text-brand-text dark:text-white">Upload signed application form</p>
                      <p className="mt-1 text-xs text-brand-text/65 dark:text-white/55">PDF, JPG, or PNG (max 15 MB)</p>
                      <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-primary-hover disabled:opacity-60">
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                          className="sr-only"
                          disabled={signedUploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            e.target.value = ''
                            if (f) handleSignedUpload(f)
                          }}
                        />
                        {signedUploading ? 'Uploading…' : signedOk ? 'Replace signed form' : 'Upload signed form'}
                      </label>
                      {application.signed_form_url ? (
                        <a
                          href={getLaravelStorageFileUrl(application.signed_form_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-3 text-sm font-semibold text-brand-primary hover:underline"
                        >
                          View uploaded
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-brand-text/70 dark:text-white/55">
                      Submitted applications are read-only here. Use <strong className="font-semibold">Print application form</strong>{' '}
                      above if you need another copy.
                    </p>
                  )}

                  <ul className="space-y-4">
                    {(application.requirements || []).map((row) => {
                      const req = row.requirement
                      const upload = row.upload
                      const rid = req?.id
                      const fileUrl = upload?.url || (upload?.file_path ? getLaravelStorageFileUrl(upload.file_path) : '')
                      const canAct = !upload || upload.can_replace
                      const isDrag = dragId === rid
                      return (
                        <li
                          key={rid}
                          className={`rounded-2xl border bg-white p-5 transition-colors dark:bg-slate-900/60 ${
                            isDrag
                              ? 'border-brand-primary ring-2 ring-brand-primary/30'
                              : 'border-slate-200 dark:border-slate-700'
                          }`}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setDragId(rid)
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault()
                            if (!e.currentTarget.contains(e.relatedTarget)) setDragId(null)
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setDragId(null)
                            const f = e.dataTransfer.files?.[0]
                            if (f) handleFile(rid, f)
                          }}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-brand-text/50 dark:text-white/45">
                                Requirement
                              </p>
                              <p className="mt-1 font-medium text-brand-text dark:text-white">{req?.requirement_name}</p>
                              {upload?.original_name ? (
                                <p className="mt-1 text-xs text-brand-text/65 dark:text-white/55">{upload.original_name}</p>
                              ) : null}
                              {upload?.version > 1 ? (
                                <p className="mt-1 text-xs text-brand-text/50 dark:text-white/45">Version {upload.version}</p>
                              ) : null}
                              {upload?.remarks ? (
                                <p className="mt-2 text-xs text-red-700 dark:text-red-300">Note: {upload.remarks}</p>
                              ) : null}
                            </div>
                            <span
                              className={`inline-flex w-fit shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(upload)}`}
                            >
                              {uploadLabel(upload)}
                            </span>
                          </div>
                          {!submitted ? (
                            <div className="mt-4 space-y-2">
                              <p className="text-xs text-brand-text/60 dark:text-white/50">
                                Drag &amp; drop a file here, or use the button. PDF, JPG, PNG · max 15 MB
                              </p>
                              <div className="flex flex-wrap items-center gap-3">
                                <label
                                  className={`inline-flex cursor-pointer items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white shadow transition ${
                                    canAct && uploadingId !== rid
                                      ? 'bg-brand-primary hover:bg-brand-primary-hover'
                                      : 'cursor-not-allowed bg-slate-400 opacity-70 dark:bg-slate-600'
                                  }`}
                                >
                                  <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                                    className="sr-only"
                                    disabled={!canAct || uploadingId === rid}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0]
                                      e.target.value = ''
                                      if (f) handleFile(rid, f)
                                    }}
                                  />
                                  {uploadingId === rid
                                    ? 'Uploading…'
                                    : upload
                                      ? canAct
                                        ? 'Replace file'
                                        : 'Locked (awaiting review)'
                                      : 'Upload file'}
                                </label>
                                {fileUrl ? (
                                  <a
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm font-semibold text-brand-primary hover:underline"
                                  >
                                    Preview
                                  </a>
                                ) : null}
                              </div>
                              {upload && !canAct ? (
                                <p className="text-xs text-amber-800 dark:text-amber-200">
                                  Replace unlocks if this document is rejected, or after you upload a signed application form.
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>

                  {!submitted ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {formError ? (
                        <div role="alert" className={`min-w-0 flex-1 ${FORM_ERROR_BANNER_CLASS}`}>
                          {formError}
                        </div>
                      ) : (
                        <p className="text-sm text-brand-text/70 dark:text-white/60">
                          {canSubmitNow
                            ? 'Ready to submit.'
                            : submitBlockerMessage || 'Submit only when every requirement has a file and your signed application form is uploaded.'}
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleSubmit}
                        className="rounded-xl bg-brand-dark px-8 py-3 text-sm font-semibold text-white shadow transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busy ? 'Submitting…' : 'Submit application'}
                      </button>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
