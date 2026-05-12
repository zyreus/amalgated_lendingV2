import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLaravelStorageFileUrl } from '../../utils/lendingLaravelApi.js'
import { borrowerApi } from '../api/client.js'
import { getBorrowerDocumentLoanApplications } from '../../utils/documentLoanApi.js'
import { dueCountdownLabel, formatDate, formatPeso, paymentStatusBadge } from '../utils/formatters.js'
import { useBorrowerAuth } from '../context/useBorrowerAuth.js'
import { admin as ui } from '../../admin/components/AdminUi.jsx'
import { AdminPageSkeleton } from '../../components/AppSkeletons.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'

const paymentMethods = [
  { id: 'gcash', label: 'GCash' },
  { id: 'bank', label: 'Bank' },
  { id: 'cash', label: 'Cash' },
]

function sameOriginPrintUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (raw.startsWith('/print/')) return raw
  try {
    const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    if (parsed.pathname.startsWith('/print/')) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    }
  } catch {
    return raw
  }
  return raw
}

function describeBorrowerLoanInterest(loan) {
  const annual = Number(loan?.annual_interest_rate ?? 0)
  const pl = loan?.application_payload
  if (pl?.selected_rate_type === 'monthly' && pl?.selected_interest_rate != null) {
    const m = Number(pl.selected_interest_rate)
    if (Number.isFinite(m) && m > 0) {
      return `${m.toFixed(2)}% per month`
    }
  }
  if (Number.isFinite(annual) && annual > 0) {
    const monthly = annual / 12
    return `${monthly.toFixed(2)}% per month`
  }
  return '—'
}

function isSssGsisPensionLoan(loan) {
  if (!loan) return false
  const slug = loan.application_payload?.loan_product_slug
  const type = loan.loan_application?.loan_type
  return slug === 'sss-pension-loan' || type === 'sss_pension'
}

function isSalaryLoan(loan) {
  if (!loan) return false
  const slug = loan.application_payload?.loan_product_slug
  const type = loan.loan_application?.loan_type
  return slug === 'salary-loan' || type === 'salary'
}

export default function BorrowerDashboardPage() {
  const { user, loadMe } = useBorrowerAuth()
  const [data, setData] = useState(null)
  const [historyRows, setHistoryRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [modalRow, setModalRow] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ referenceNumber: '', paymentMethod: 'gcash', receiptFile: null })
  const [documentApps, setDocumentApps] = useState([])
  const [lendingApps, setLendingApps] = useState({ general: [], general_drafts: [], travel: [] })
  const [deletingDraftId, setDeletingDraftId] = useState(null)
  const [confirmDeleteDraftId, setConfirmDeleteDraftId] = useState(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [dashRes, docRes, lendRes] = await Promise.all([
        borrowerApi('/borrower/dashboard'),
        getBorrowerDocumentLoanApplications().catch(() => ({ data: [] })),
        borrowerApi('/borrower/lending-applications').catch(() => ({
          data: { general: [], general_drafts: [], travel: [] },
        })),
      ])
      setData(dashRes.data)
      const ph = dashRes?.data?.payment_history
      setHistoryRows(Array.isArray(ph) ? ph : [])
      setDocumentApps(Array.isArray(docRes?.data) ? docRes.data : [])
      setLendingApps(
        lendRes?.data && typeof lendRes.data === 'object'
          ? {
              general: lendRes.data.general || [],
              general_drafts: lendRes.data.general_drafts || [],
              travel: lendRes.data.travel || [],
            }
          : { general: [], general_drafts: [], travel: [] },
      )
    } catch (err) {
      setError(err.message || 'Failed to load dashboard.')
    } finally {
      setLoading(false)
    }
  }

  /** Refresh dashboard payload only (no full-page skeleton; skips document/lending fetches). */
  const refreshDashboardSilent = useCallback(async () => {
    try {
      const dashRes = await borrowerApi('/borrower/dashboard?skip_payment_reminder_sync=1')
      setData(dashRes.data)
      const ph = dashRes?.data?.payment_history
      setHistoryRows(Array.isArray(ph) ? ph : [])
    } catch (err) {
      setError(err.message || 'Failed to refresh dashboard.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [])

  const performDeleteGeneralDraft = async () => {
    const id = confirmDeleteDraftId
    if (id == null) return
    setDeletingDraftId(id)
    setError('')
    try {
      await borrowerApi(`/borrower/loan-applications/${id}`, { method: 'DELETE' })
      const lendRes = await borrowerApi('/borrower/lending-applications')
      setLendingApps(
        lendRes?.data && typeof lendRes.data === 'object'
          ? {
              general: lendRes.data.general || [],
              general_drafts: lendRes.data.general_drafts || [],
              travel: lendRes.data.travel || [],
            }
          : { general: [], general_drafts: [], travel: [] },
      )
      setConfirmDeleteDraftId(null)
    } catch (err) {
      setError(err.message || 'Could not delete draft.')
    } finally {
      setDeletingDraftId(null)
    }
  }

  const summary = data?.summary || {}
  const loan = data?.active_loan
  const amortizationOnlyLoanUi = isSssGsisPensionLoan(loan) || isSalaryLoan(loan)
  const loansList = Array.isArray(data?.loans) ? data.loans : []
  const pendingRows = useMemo(() => data?.pending_payments || [], [data])
  const notifications = data?.notifications || []
  const recentPaid = historyRows.slice(0, 3)

  const invoiceNumber = (payment) => `INV-${String(payment?.id || '').padStart(6, '0')}`
  const paymentReference = (payment) =>
    payment?.reference_number || payment?.reference_no || `PAY-${payment?.id || 'N/A'}`

  const buildInvoiceHtml = (payment) => {
    const brandLogoUrl =
      typeof window !== 'undefined'
        ? new URL('/amalgated-lending-logo.png', window.location.origin).toString()
        : '/amalgated-lending-logo.png'

    return `<!doctype html>
<html><head><meta charset="utf-8" /><title>${invoiceNumber(payment)}</title>
<style>
body{font-family:Arial,sans-serif;padding:24px;color:#111827}
.wrap{max-width:760px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:24px}
.muted{color:#6b7280;font-size:12px}
.head{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.logo{width:52px;height:52px;object-fit:contain}
.title{font-size:22px;font-weight:700;margin:0}
table{width:100%;border-collapse:collapse;margin-top:16px}
th,td{border:1px solid #e5e7eb;padding:10px;font-size:13px;text-align:left}
th{background:#f9fafb}
</style>
</head><body><div class="wrap">
<div class="head">
  <img class="logo" src="${brandLogoUrl}" alt="Amalgated Lending Inc." />
  <div>
    <p class="title">Amalgated Lending Inc. Payment Invoice</p>
    <p class="muted" style="margin:6px 0 0">Invoice #: ${invoiceNumber(payment)}</p>
  </div>
</div>
<p><strong>Borrower:</strong> ${user?.name || user?.full_name || 'Borrower'}</p>
<p><strong>Email:</strong> ${user?.email || payment?.borrower_email || 'N/A'}</p>
<p><strong>Payment Date:</strong> ${formatDate(payment?.paid_at || payment?.due_date)}</p>
<p><strong>Reference:</strong> ${paymentReference(payment)}</p>
<table><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody>
<tr><td>Installment Due</td><td>${formatPeso(payment?.amount_due || 0)}</td></tr>
<tr><td>Penalty</td><td>${formatPeso(payment?.penalty_amount || 0)}</td></tr>
<tr><td><strong>Amount Paid</strong></td><td><strong>${formatPeso(payment?.amount_paid || 0)}</strong></td></tr>
</tbody></table><p class="muted" style="margin-top:16px">This is a system-generated payment invoice/receipt.</p></div></body></html>`
  }

  const downloadInvoiceFile = (payment) => {
    const blob = new Blob([buildInvoiceHtml(payment)], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoiceNumber(payment)}.html`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const submitUpload = async (e) => {
    e.preventDefault()
    if (!modalRow?.id || !form.receiptFile) return
    setUploading(true)
    setToast('')
    setError('')
    try {
      const body = new FormData()
      body.append('payment_id', String(modalRow.id))
      body.append('reference_number', form.referenceNumber)
      body.append('payment_method', form.paymentMethod)
      body.append('receipt', form.receiptFile)
      await borrowerApi('/borrower/upload-payment', { method: 'POST', body })
      setToast('Receipt uploaded. Waiting for confirmation.')
      setModalRow(null)
      setForm({ referenceNumber: '', paymentMethod: 'gcash', receiptFile: null })
      await refreshDashboardSilent()
    } catch (err) {
      setError(err.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const emailVerified = Boolean(user?.email_verified)

  const handleResendVerification = async () => {
    setVerifyBusy(true)
    setToast('')
    setError('')
    try {
      await borrowerApi('/borrower/email/resend-verification', { method: 'POST', body: '{}' })
      setToast('If your address is eligible, we sent another verification email.')
      await loadMe()
    } catch (err) {
      setToast(err.message || 'Could not resend verification email.')
    } finally {
      setVerifyBusy(false)
    }
  }

  if (loading) return <AdminPageSkeleton />
  if (error && !data) {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>
  }

  return (
    <div className="space-y-5">
      {!emailVerified ? (
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/40"
          role="status"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Verify your email</p>
              <p className={`mt-1 text-sm ${ui.textMuted}`}>
                Confirm <span className="font-medium text-gray-800 dark:text-gray-200">{user?.email}</span> so we can send
                receipts and account updates reliably.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={verifyBusy}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:opacity-60 dark:bg-amber-600 dark:hover:bg-amber-500"
            >
              {verifyBusy ? 'Sending…' : 'Resend verification email'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-100 p-5 shadow-md transition-colors duration-300 dark:border-[#1F2937] dark:from-[#111827] dark:to-[#0F172A] dark:shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-[#DC2626]">Borrower Dashboard</p>
        <h2 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">Loan overview</h2>
        <p className={`mt-1 text-sm ${ui.textMuted}`}>Your current loan health, due dates, and payment actions.</p>
        <Link
          to="/borrower/apply-loan"
          className="mt-3 inline-flex rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          New loan application (wizard)
        </Link>
      </div>

      {loansList.length > 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Your loans &amp; applications</h3>
          <p className={`mt-1 text-sm ${ui.textMuted}`}>
            {loansList.length > 1
              ? 'Everything tied to your borrower account. Payment schedule below uses your primary loan (ongoing first, otherwise newest by status).'
              : 'Your application and repayment details are listed below.'}
          </p>
          <ul className="mt-4 divide-y divide-gray-200 dark:divide-[#1F2937]">
            {loansList.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Loan #{l.id}</p>
                  <p className={`text-xs ${ui.tableMuted}`}>
                    Applied {formatPeso(l.applied_principal ?? l.requested_principal ?? l.principal)} · Approved{' '}
                    {formatPeso(l.principal)} · {l.term_months} mo · submitted {formatDate(l.created_at)}
                  </p>
                  {l.print_statement_url ? (
                    <a
                      href={sameOriginPrintUrl(l.print_statement_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                    >
                      Statement of Account (SOA)
                    </a>
                  ) : null}
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold capitalize text-gray-800 ring-1 ring-gray-200 dark:bg-[#0F172A] dark:text-gray-100 dark:ring-[#374151]">
                  {String(l.status || '—').replace(/_/g, ' ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : !loading && data ? (
        <div
          className={`rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm ${ui.textMuted} dark:border-gray-600 dark:bg-[#0F172A]/30`}
        >
          No loan applications are linked to this borrower login. Use the same email you used when applying, or contact support if an admin created your loan under a different account.
        </div>
      ) : null}

      {toast ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-green-500/10 dark:text-green-300">
          {toast}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>
      ) : null}

      {documentApps.length > 0 ? (
        <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-white p-5 shadow-sm transition-colors duration-300 dark:border-red-900/40 dark:from-red-950/30 dark:to-[#111827] dark:shadow-lg">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">📂 My documents &amp; document applications</h3>
          <p className={`mt-1 text-sm ${ui.textMuted}`}>
            Complete product requirements and upload the signed copy before final submission.
          </p>
          <ul className="mt-4 space-y-3">
            {documentApps.map((app) => (
              <li
                key={app.id}
                className="rounded-xl border border-gray-200 bg-white p-4 dark:border-[#1F2937] dark:bg-[#0F172A]/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{app.product?.name || 'Loan application'}</p>
                    <p className={`mt-1 text-xs ${ui.textMuted}`}>
                      Documents: {app.progress?.uploaded ?? 0} / {app.progress?.total ?? 0} · Signed form:{' '}
                      {app.progress?.signed_form ? '✅' : '❌'}
                      {app.submitted_at ? ` · Submitted ${formatDate(app.submitted_at)}` : ''}
                    </p>
                  </div>
                  {app.product?.slug ? (
                    <Link
                      to={`/apply/documents/${encodeURIComponent(app.product.slug)}`}
                      className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                    >
                      Open upload page
                    </Link>
                  ) : null}
                </div>
                {app.signed_form_url ? (
                  <a
                    href={getLaravelStorageFileUrl(app.signed_form_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                  >
                    View uploaded signed form
                  </a>
                ) : null}
                {app.embedded_documents?.valid_id_url || app.embedded_documents?.proof_income_url ? (
                  <div className="mt-3 flex flex-wrap gap-3 text-xs">
                    {app.embedded_documents?.valid_id_url ? (
                      <a
                        href={getLaravelStorageFileUrl(app.embedded_documents.valid_id_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-red-700 hover:underline dark:text-red-300"
                      >
                        Valid ID
                      </a>
                    ) : null}
                    {app.embedded_documents?.proof_income_url ? (
                      <a
                        href={getLaravelStorageFileUrl(app.embedded_documents.proof_income_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-red-700 hover:underline dark:text-red-300"
                      >
                        Proof of income
                      </a>
                    ) : null}
                    {Array.isArray(app.embedded_documents?.additional_urls) && app.embedded_documents.additional_urls.length ? (
                      <span className="text-gray-600 dark:text-gray-400">
                        Additional: {app.embedded_documents.additional_urls.length} file(s)
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {lendingApps.general.length > 0 ||
      (lendingApps.general_drafts && lendingApps.general_drafts.length > 0) ||
      lendingApps.travel.length > 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Loan applications</h3>
          <p className={`mt-1 text-sm ${ui.textMuted}`}>
            Submitted general applications and travel assistance: document checklist and signatures. Drafts are listed separately
            until you submit.
          </p>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            {lendingApps.general.length > 0 || (lendingApps.general_drafts && lendingApps.general_drafts.length > 0) ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">General</p>
                {lendingApps.general.length === 0 ? (
                  <p className={`mt-2 rounded-lg border border-dashed border-gray-200 px-2 py-2 text-xs ${ui.textMuted} dark:border-[#374151]`}>
                    No submitted loan applications yet.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-3">
                    {lendingApps.general.map((row) => (
                      <li
                        key={`g-${row.id}`}
                        className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-[#1F2937] dark:bg-[#0F172A]/40"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              #{row.id} · {row.loan_type_label || row.loan_type}
                            </p>
                            <p className={`text-xs capitalize ${ui.tableMuted}`}>
                              {row.status}
                              {row.submitted_at ? ` · Submitted ${formatDate(row.submitted_at)}` : ''}
                            </p>
                          </div>
                        </div>
                        {Array.isArray(row.documents_checklist) && row.documents_checklist.length > 0 ? (
                          <ul className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                            {row.documents_checklist.map((d) => (
                              <li key={d.key} className="flex gap-1.5 text-gray-700 dark:text-gray-300">
                                <span>{d.uploaded ? '✔' : '✖'}</span>
                                <span>{d.label}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {Array.isArray(row.uploaded_documents) && row.uploaded_documents.length > 0 ? (
                          <div className="mt-2">
                            <p className={`text-[11px] uppercase tracking-wide ${ui.textMuted}`}>Uploaded documents</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {row.uploaded_documents.map((doc, idx) => (
                                <a
                                  key={`${row.id}-${doc.key}-${idx}`}
                                  href={doc.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100 dark:border-[#374151] dark:text-gray-200 dark:hover:bg-white/10"
                                >
                                  {doc.label}
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
                          {row.signatures?.applicant ? (
                            <a href={row.signatures.applicant} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                              Applicant sig
                            </a>
                          ) : (
                            <span>Applicant sig: —</span>
                          )}
                          {row.signatures?.comaker ? (
                            <a href={row.signatures.comaker} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                              Co-maker sig
                            </a>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {lendingApps.general_drafts && lendingApps.general_drafts.length > 0 ? (
                  <div className="mt-4 border-t border-gray-100 pt-3 dark:border-[#1F2937]">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Saved drafts</p>
                    <ul className="mt-2 space-y-2">
                      {lendingApps.general_drafts.map((d) => (
                        <li
                          key={`gd-${d.id}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/40 px-2 py-1.5 dark:border-[#374151] dark:bg-[#0F172A]/25"
                        >
                          <span className={`text-xs ${ui.tableMuted}`}>
                            #{d.id} · {d.loan_type_label || d.loan_type} · step {d.draft_step ?? '—'}
                          </span>
                          <span className="flex flex-wrap items-center gap-2">
                            {d.resume_path ? (
                              <Link
                                to={d.resume_path}
                                className="text-[11px] font-semibold text-red-700 hover:underline dark:text-red-300"
                              >
                                Resume
                              </Link>
                            ) : null}
                            <button
                              type="button"
                              disabled={deletingDraftId === d.id}
                              onClick={() => setConfirmDeleteDraftId(d.id)}
                              className="text-[11px] font-semibold text-gray-600 hover:text-red-800 disabled:opacity-50 dark:text-gray-400 dark:hover:text-red-300"
                            >
                              {deletingDraftId === d.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
            {lendingApps.travel.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Travel assistance
                </p>
                <ul className="mt-2 space-y-3">
                  {lendingApps.travel.map((row) => (
                    <li
                      key={`t-${row.id}`}
                      className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-[#1F2937] dark:bg-[#0F172A]/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Travel #{row.id}</p>
                          <p className={`text-xs capitalize ${ui.tableMuted}`}>{row.status}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {row.terms_url ? (
                            <a
                              href={row.terms_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-800 dark:border-gray-600 dark:text-gray-200"
                            >
                              Terms
                            </a>
                          ) : null}
                        </div>
                      </div>
                      {Array.isArray(row.documents_checklist) && row.documents_checklist.length > 0 ? (
                        <ul className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                          {row.documents_checklist.map((d) => (
                            <li key={d.key} className="flex gap-1.5 text-gray-700 dark:text-gray-300">
                              <span>{d.uploaded ? '✔' : '✖'}</span>
                              <span>{d.label}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {Array.isArray(row.uploaded_documents) && row.uploaded_documents.length > 0 ? (
                        <div className="mt-2">
                          <p className={`text-[11px] uppercase tracking-wide ${ui.textMuted}`}>Uploaded documents</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {row.uploaded_documents.map((doc, idx) => (
                              <a
                                key={`${row.id}-tdoc-${doc.key}-${idx}`}
                                href={doc.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100 dark:border-[#374151] dark:text-gray-200 dark:hover:bg-white/10"
                              >
                                {doc.label}
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Loan Balance" value={formatPeso(summary.total_loan_balance)} />
        <SummaryCard
          label={amortizationOnlyLoanUi ? 'Monthly amortization' : 'Monthly Payment'}
          value={formatPeso(summary.monthly_payment)}
        />
        <SummaryCard label="Next Due Date" value={formatDate(summary.next_due_date)} sub={dueCountdownLabel(summary.next_due_date)} />
        <SummaryCard
          label="Overdue Amount"
          value={formatPeso(summary.overdue_amount)}
          danger={Number(summary.overdue_amount || 0) > 0}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Payment progress</h3>
          <p className={`mt-1 text-sm ${ui.textMuted}`}>
            {formatPeso(summary.paid_amount)} / {formatPeso(summary.total_payable)}
          </p>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, Number(summary.progress_percent || 0)))}%` }}
            />
          </div>
          <p className={`mt-2 text-xs ${ui.textMuted}`}>{Number(summary.progress_percent || 0).toFixed(2)}% complete</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
          <div className="mt-3 space-y-2">
            {notifications.length ? (
              notifications.map((n, idx) => (
                <p
                  key={`${n.type}-${idx}`}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#0F172A]/50 dark:text-gray-300"
                >
                  {n.message}
                </p>
              ))
            ) : (
              <p className={`text-sm ${ui.textMuted}`}>No new alerts.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Pending payments</h3>
          <div className="mt-4 space-y-3 md:hidden">
            {pendingRows.length ? (
              pendingRows.map((p) => (
                <div key={p.id} className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-[#1F2937] dark:bg-[#0F172A]/50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatDate(p.due_date)}</p>
                      <p className={`text-xs ${ui.textMuted}`}>{dueCountdownLabel(p.due_date)}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs ring-1 ${paymentStatusBadge(p.status)}`}>
                      {String(p.status || '').toUpperCase()}
                    </span>
                  </div>
                  <dl className="mt-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <dt className={ui.textMuted}>Amount due</dt>
                      <dd className="font-medium text-gray-900 dark:text-gray-100">{formatPeso(p.amount_due)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className={ui.textMuted}>Amount paid</dt>
                      <dd className="font-medium text-gray-900 dark:text-gray-100">{formatPeso(p.amount_paid)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className={ui.textMuted}>Penalty</dt>
                      <dd className="font-medium text-gray-900 dark:text-gray-100">{formatPeso(p.penalty_amount)}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className="mt-3 w-full rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                    onClick={() => setModalRow(p)}
                  >
                    Upload Payment
                  </button>
                </div>
              ))
            ) : (
              <p className={`rounded-xl border border-dashed border-gray-300 px-3 py-6 text-center text-sm ${ui.textMuted} dark:border-gray-600`}>
                No pending installments.
              </p>
            )}
          </div>
          <div className={`hidden md:block ${ui.tableScroll}`}>
            <table className={`${ui.tableBase} ${ui.tableText} ${ui.tableMin800}`}>
              <thead>
                <tr className={ui.thead}>
                  <th className={`${ui.tableCell} text-left`}>Due Date</th>
                  <th className={`${ui.tableCell} text-left`}>Amount Due</th>
                  <th className={`${ui.tableCell} text-left`}>Amount Paid</th>
                  <th className={`${ui.tableCell} text-left`}>Penalty</th>
                  <th className={`${ui.tableCell} text-left`}>Status</th>
                  <th className={`${ui.tableCell} text-left`}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingRows.map((p) => (
                  <tr key={p.id} className={ui.tbodyRow}>
                    <td className={ui.tableCell}>
                      <p>{formatDate(p.due_date)}</p>
                      <p className={`text-xs ${ui.textMuted}`}>{dueCountdownLabel(p.due_date)}</p>
                    </td>
                    <td className={ui.tableCell}>{formatPeso(p.amount_due)}</td>
                    <td className={ui.tableCell}>{formatPeso(p.amount_paid)}</td>
                    <td className={ui.tableCell}>{formatPeso(p.penalty_amount)}</td>
                    <td className={ui.tableCell}>
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs ring-1 ${paymentStatusBadge(p.status)}`}>
                        {String(p.status || '').toUpperCase()}
                      </span>
                    </td>
                    <td className={ui.tableCell}>
                      <button
                        type="button"
                        className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 sm:px-3"
                        onClick={() => setModalRow(p)}
                      >
                        Upload Payment
                      </button>
                    </td>
                  </tr>
                ))}
                {!pendingRows.length ? (
                  <tr>
                    <td colSpan={6} className={`${ui.tableCell} py-8 text-center ${ui.textMuted}`}>
                      No pending installments.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Loan details</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Amount applied" value={formatPeso(loan?.applied_principal ?? loan?.requested_principal ?? loan?.principal)} />
            <Row
              label="Approved principal"
              value={formatPeso(loan?.loan_application?.approved_amount ?? loan?.principal)}
            />
            {amortizationOnlyLoanUi ? (
              <Row label="Monthly amortization" value={formatPeso(loan?.monthly_payment)} />
            ) : (
              <>
                <Row label="Monthly payment" value={formatPeso(loan?.monthly_payment)} />
                <Row
                  label="Semi-monthly payment"
                  value={formatPeso(
                    loan?.monthly_payment != null ? Number(loan.monthly_payment) / 2 : null,
                  )}
                />
                <Row label="Monthly principal" value={formatPeso(loan?.monthly_principal)} />
                <Row label="Monthly interest" value={formatPeso(loan?.monthly_interest)} />
                <Row label="Service charge" value={formatPeso(loan?.service_charge)} />
                <Row label="Insurance / MRI" value={formatPeso(loan?.mri_fee)} />
                <Row label="Doc stamp" value={formatPeso(loan?.doc_stamp)} />
                <Row label="Notarial fee" value={formatPeso(loan?.notarial_fee)} />
                <Row label="Total deductions" value={formatPeso(loan?.total_deductions)} />
                <Row label="Net proceeds" value={formatPeso(loan?.net_proceeds)} />
                <Row
                  label="Remaining pension"
                  value={formatPeso(
                    loan?.loan_computation_snapshot?.breakdown?.remaining_pension ??
                      (loan?.application_payload?.monthly_pension != null && loan?.monthly_payment != null
                        ? Number(loan.application_payload.monthly_pension) - Number(loan.monthly_payment)
                        : null),
                  )}
                />
              </>
            )}
            <Row
              label="Final installment (scheduled)"
              value={formatPeso(
                (() => {
                  const rows = Array.isArray(loan?.payments) ? loan.payments : []
                  const term = Number(loan?.term_months || 0)
                  const last = rows.find((x) => Number(x.installment_no) === term)
                  return last?.amount_due ?? null
                })(),
              )}
            />
            <Row label="Interest rate" value={describeBorrowerLoanInterest(loan)} />
            <Row label="Term" value={`${loan?.term_months || 0} months`} />
            <Row label="Remaining balance" value={formatPeso(loan?.outstanding_balance)} />
            <Row label="Total payable" value={formatPeso(summary.total_payable)} />
          </dl>
          {Number(summary?.total_payable) > 0 ? (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>Repayment progress</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {Math.min(100, Math.round(Number(summary.progress_percent || 0)))}%
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-[#1F2937]">
                <div
                  className="h-full rounded-full bg-red-600 transition-all dark:bg-red-500"
                  style={{ width: `${Math.min(100, Math.round(Number(summary.progress_percent || 0)))}%` }}
                />
              </div>
            </div>
          ) : null}
          {Array.isArray(loan?.schedule_json) && loan.schedule_json.length > 0 ? (
            <details className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-[#1F2937] dark:bg-[#0F172A]/50">
              <summary className="cursor-pointer text-sm font-semibold text-gray-900 dark:text-gray-100">
                Amortization schedule
              </summary>
              <div className={`mt-2 max-h-56 overflow-auto text-xs ${ui.tableScroll}`}>
                <table className={`${ui.tableBase} ${ui.tableMin640}`}>
                  <thead>
                    <tr className={ui.thead}>
                      <th className={ui.tableCell}>#</th>
                      <th className={ui.tableCell}>Due</th>
                      <th className={ui.tableCell}>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loan.schedule_json.map((r) => (
                      <tr key={r.installment_no} className={ui.tbodyRow}>
                        <td className={ui.tableCell}>{r.installment_no}</td>
                        <td className={ui.tableCell}>{r.due_date ? formatDate(r.due_date) : '—'}</td>
                        <td className={ui.tableCell}>{formatPeso(r.payment ?? r.amortization)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#0F172A]/50">
            <p className="text-xs uppercase tracking-[0.15em] text-gray-500 dark:text-gray-500">Penalty Breakdown</p>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Original amount: {formatPeso(summary.total_payable - (summary.overdue_amount || 0))}
            </p>
            <p className="text-sm text-red-600 dark:text-red-300">Penalty: {formatPeso(summary.overdue_amount)}</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100">Total due: {formatPeso(summary.total_payable)}</p>
          </div>
          <Link
            to="/apply"
            className="mt-4 inline-block rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-800 transition hover:bg-gray-50 dark:border-[#1F2937] dark:text-gray-100 dark:hover:bg-white/5"
          >
            Apply Again
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Recent payment receipts</h3>
          <Link to="/borrower/payments" className="text-xs font-medium text-red-600 hover:underline dark:text-red-400">
            View all
          </Link>
        </div>
        <div className="mt-3 space-y-3">
          {recentPaid.length ? (
            recentPaid.map((p) => (
              <div key={p.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-[#1F2937] dark:bg-[#0F172A]/50">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatDate(p.paid_at || p.due_date)} · {formatPeso(p.amount_paid || 0)}
                </p>
                <p className={`mt-1 text-xs ${ui.textMuted}`}>Reference: {paymentReference(p)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => downloadInvoiceFile(p)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-[#374151] dark:text-gray-200 dark:hover:bg-white/10"
                  >
                    Download Invoice
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className={`text-sm ${ui.textMuted}`}>No completed payments yet.</p>
          )}
        </div>
      </div>

      {modalRow ? (
        <div className={ui.modalOverlay}>
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827]">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Upload payment receipt</h4>
            <p className={`mt-1 text-sm ${ui.textMuted}`}>Installment #{modalRow.installment_no}</p>
            <form className="mt-4 space-y-3" onSubmit={submitUpload}>
              <input
                required
                placeholder="Reference number"
                value={form.referenceNumber}
                onChange={(e) => setForm((s) => ({ ...s, referenceNumber: e.target.value }))}
                className={ui.input}
              />
              <select
                value={form.paymentMethod}
                onChange={(e) => setForm((s) => ({ ...s, paymentMethod: e.target.value }))}
                className={ui.input}
              >
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <input
                type="file"
                required
                onChange={(e) => setForm((s) => ({ ...s, receiptFile: e.target.files?.[0] || null }))}
                className={`w-full rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 file:mr-3 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-300`}
                accept=".jpg,.jpeg,.png,.webp,.pdf"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalRow(null)}
                  className={ui.btnSecondary}
                >
                  Cancel
                </button>
                <button
                  disabled={uploading}
                  type="submit"
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                >
                  {uploading ? 'Uploading...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDeleteDraftId != null}
        title="Confirm deletion"
        message="Delete this saved draft? Any uploaded documents and signatures will be removed. This cannot be undone."
        onCancel={() => setConfirmDeleteDraftId(null)}
        onConfirm={performDeleteGeneralDraft}
        busy={deletingDraftId != null && deletingDraftId === confirmDeleteDraftId}
      />
    </div>
  )
}

function SummaryCard({ label, value, sub, danger = false }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-px hover:shadow-md dark:border-[#1F2937] dark:bg-[#111827] dark:hover:border-gray-600">
      <p className={`text-xs ${ui.textMuted}`}>{label}</p>
      <p
        className={`mt-1 text-lg font-semibold ${danger ? 'text-red-600 dark:text-red-300' : 'text-gray-900 dark:text-gray-100'}`}
      >
        {value}
      </p>
      {sub ? <p className={`mt-1 text-xs ${ui.textMuted}`}>{sub}</p> : null}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={ui.textMuted}>{label}</dt>
      <dd className="font-medium text-gray-900 dark:text-gray-100">{value}</dd>
    </div>
  )
}
