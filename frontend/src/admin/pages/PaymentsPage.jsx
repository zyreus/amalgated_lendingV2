import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, getToken, API_BASE } from '../api/client.js'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { useToast } from '../context/ToastContext.jsx'
import { admin, TableSkeletonRows, EmptyTableRow } from '../components/AdminUi.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { getLaravelStorageFileUrl } from '../../utils/lendingLaravelApi.js'

function formatDueDate(value) {
  if (value == null || value === '') return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function getBorrowerEmail(payment) {
  return (
    payment?.borrowerEmail ||
    payment?.borrower?.email ||
    payment?.borrower_email ||
    payment?.email ||
    ''
  )
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase()
}

/** Parse admin loan filter: #6, 6, LN-000006, ln-000006 */
function parseLoanSearchToId(raw) {
  const t = String(raw || '').trim().toLowerCase()
  if (!t) return null
  const ln = /^ln-0*(\d+)$/.exec(t)
  if (ln) return ln[1]
  const hash = /^#?(\d+)$/.exec(t)
  if (hash) return hash[1]
  return null
}

function paymentLoanId(p) {
  const id = p?.loan_id ?? p?.loan?.id
  return id != null && id !== '' ? String(id) : ''
}

/** LN-000006 style for numeric id (matches Laravel Loan accessor). */
function formatLoanNumberFromId(id) {
  const s = String(id ?? '').replace(/\D/g, '')
  if (!s) return ''
  return `LN-${s.padStart(6, '0')}`
}

function paymentMatchesLoanSearch(p, rawQuery) {
  const raw = String(rawQuery || '').trim()
  const q = raw.toLowerCase()
  if (!q) return true
  const loanId = paymentLoanId(p)
  const idFromQuery = parseLoanSearchToId(raw)
  if (idFromQuery && loanId === idFromQuery) return true
  const padded = formatLoanNumberFromId(loanId).toLowerCase()
  const hash = loanId ? `#${loanId}` : ''
  const labels = [
    loanId,
    hash,
    padded,
    String(p.loanNumber || '').toLowerCase(),
    String(p.loan?.loan_number || '').toLowerCase(),
    String(p.loan?.reference_number || '').toLowerCase(),
  ].filter(Boolean)
  return labels.some((c) => c === q || c.includes(q) || q.includes(c.replace(/^#/, '')))
}

/** Unpaid installment (still has balance or not marked paid). */
function hasOutstandingBalance(p) {
  const s = String(p.status || '').toLowerCase()
  if (s === 'paid' || s === 'waived') return false
  const due = Number(p.amount_due || 0)
  const paid = Number(p.amount_paid || 0)
  return due - paid > 0.009
}

/** Borrower upload modal sends `reference_number`; API may use variants. */
function getPaymentReference(payment) {
  const raw =
    payment?.reference_number ??
    payment?.reference_no ??
    payment?.payment_reference ??
    payment?.ref_number ??
    payment?.meta?.reference_number
  const s = String(raw ?? '').trim()
  return s
}

/** Full URL to borrower-uploaded receipt (served by Laravel `/storage`, not Vite). */
function formatReceiptEmailStatus(status) {
  if (status == null || status === '') return '—'
  const s = String(status).toLowerCase()
  const map = {
    queued: 'Email queued',
    sent: 'Email sent',
    failed: 'Email failed',
    skipped_duplicate: 'Email skipped (dup)',
  }
  return map[s] || String(status)
}

/** Borrower address used for payment receipt mail + latest delivery status from EmailLog. */
function ReceiptEmailCell({ payment }) {
  const to = String(getBorrowerEmail(payment) || '').trim()
  const status = formatReceiptEmailStatus(payment.receipt_email_status)
  return (
    <div className="flex max-w-[15rem] flex-col gap-0.5">
      <span
        className={`break-all text-xs ${to ? 'font-medium text-gray-900 dark:text-gray-100' : admin.textMuted}`}
        title={to || 'No email on file for this borrower'}
      >
        {to || '—'}
      </span>
      <span className={`text-[10px] ${admin.textMuted}`}>{status}</span>
    </div>
  )
}

function getReceiptPublicUrl(payment) {
  const u = payment?.receipt_url
  if (u && String(u).trim()) return getLaravelStorageFileUrl(String(u).trim())
  const path = payment?.receipt_path
  if (!path || !String(path).trim()) return ''
  return getLaravelStorageFileUrl(path)
}

function isImageReceiptPath(pathOrName) {
  return /\.(jpe?g|png|gif|webp)$/i.test(String(pathOrName || ''))
}

function ProofCell({ payment }) {
  const path = payment?.receipt_path
  const url = getReceiptPublicUrl(payment)
  if (!path && !url) {
    return <span className={`text-xs ${admin.textMuted}`}>—</span>
  }
  const href = url || '#'
  const label = String(payment?.receipt_name || path || 'Proof').trim()
  const showThumb = isImageReceiptPath(path) || isImageReceiptPath(label) || isImageReceiptPath(href)
  if (showThumb) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex max-w-[10rem] items-center gap-2"
        title={label}
      >
        <img
          src={href}
          alt=""
          className="h-12 w-12 shrink-0 rounded-md border border-gray-200 object-cover dark:border-[#374151]"
        />
        <span className="text-xs font-medium text-red-600 underline dark:text-red-400">Open</span>
      </a>
    )
  }
  const isPdf = /\.pdf$/i.test(label) || /\.pdf$/i.test(String(path || ''))
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-xs font-medium text-red-600 underline dark:text-red-400">
      {isPdf ? 'View PDF' : 'View file'}
    </a>
  )
}

function hasBorrowerPaymentEvidence(payment) {
  const paid = Number(payment?.amount_paid || 0) > 0
  const hasRef = Boolean(
    String(payment?.reference_number || payment?.reference_no || '').trim()
  )
  const hasProof = Boolean(String(payment?.receipt_path || '').trim())
  return paid || hasRef || hasProof
}

export default function PaymentsPage() {
  const { showToast } = useToast()
  const { can } = useAdminApiAuth()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [borrowersData, setBorrowersData] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmingId, setConfirmingId] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [adjustPanel, setAdjustPanel] = useState(null)
  const [adjustPaymentId, setAdjustPaymentId] = useState(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustConfirmOpen, setAdjustConfirmOpen] = useState(false)
  const [adjustSaving, setAdjustSaving] = useState(false)
  const [auditFor, setAuditFor] = useState(null)
  const [auditRows, setAuditRows] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [borrowerFilter, setBorrowerFilter] = useState('')
  const [borrowerNameFilter, setBorrowerNameFilter] = useState('')
  const [loanNumberFilter, setLoanNumberFilter] = useState('')
  const [loanSearchDebounced, setLoanSearchDebounced] = useState('')
  const [orFilter, setOrFilter] = useState('')
  const [arFilter, setArFilter] = useState('')
  const [orArDebounced, setOrArDebounced] = useState({ or: '', ar: '' })
  const [apiStatus, setApiStatus] = useState('')
  const [approvalStatus, setApprovalStatus] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [showPaidInLoanFilter, setShowPaidInLoanFilter] = useState(false)
  const [confirmOr, setConfirmOr] = useState('')
  const [confirmAr, setConfirmAr] = useState('')
  const [confirmAutoMint, setConfirmAutoMint] = useState(true)
  const [receiptEdit, setReceiptEdit] = useState(null)
  const [receiptOrInput, setReceiptOrInput] = useState('')
  const [receiptArInput, setReceiptArInput] = useState('')
  const [receiptSaving, setReceiptSaving] = useState(false)
  const [receiptAuditFor, setReceiptAuditFor] = useState(null)
  const [receiptAuditRows, setReceiptAuditRows] = useState([])
  const [receiptAuditLoading, setReceiptAuditLoading] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => {
      setLoanSearchDebounced(loanNumberFilter.trim())
    }, 350)
    return () => window.clearTimeout(t)
  }, [loanNumberFilter])

  useEffect(() => {
    const t = window.setTimeout(() => {
      setOrArDebounced({ or: orFilter.trim(), ar: arFilter.trim() })
    }, 400)
    return () => window.clearTimeout(t)
  }, [orFilter, arFilter])

  const loadBorrowers = async () => {
    try {
      const borrowersRes = await api('/borrowers?per_page=500')
      setBorrowersData(borrowersRes?.data?.data || [])
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const buildPaymentsQuery = useCallback(() => {
    const qs = new URLSearchParams({ per_page: '300' })
    if (loanSearchDebounced) qs.set('loan_search', loanSearchDebounced)
    if (orArDebounced.or) qs.set('official_receipt_q', orArDebounced.or)
    if (orArDebounced.ar) qs.set('acknowledgement_receipt_q', orArDebounced.ar)
    if (apiStatus) qs.set('status', apiStatus)
    else {
      const stUrl = (searchParams.get('status') || '').trim()
      if (stUrl) qs.set('status', stUrl)
    }
    if (approvalStatus) qs.set('approval_status', approvalStatus)
    if (paymentMethod) qs.set('payment_method', paymentMethod)
    const ov = searchParams.get('overdue')
    if (ov === '1' || ov === 'true') qs.set('overdue', '1')
    const dpdMin = searchParams.get('installment_dpd_min')
    const dpdMax = searchParams.get('installment_dpd_max')
    if (dpdMin) qs.set('installment_dpd_min', dpdMin)
    if (dpdMax) qs.set('installment_dpd_max', dpdMax)
    return qs
  }, [
    loanSearchDebounced,
    orArDebounced.or,
    orArDebounced.ar,
    apiStatus,
    approvalStatus,
    paymentMethod,
    searchParams,
  ])

  const loadPayments = async () => {
    setLoading(true)
    try {
      const paymentsRes = await api(`/payments?${buildPaymentsQuery().toString()}`)
      setData(paymentsRes.data)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadPaymentsSilent = useCallback(async () => {
    try {
      const paymentsRes = await api(`/payments?${buildPaymentsQuery().toString()}`)
      setData(paymentsRes.data)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }, [buildPaymentsQuery, showToast])

  useEffect(() => {
    void loadBorrowers()
  }, [])

  useEffect(() => {
    const q = (searchParams.get('loan_search') || searchParams.get('loan') || '').trim()
    if (q) setLoanNumberFilter(q)
  }, [searchParams])

  useEffect(() => {
    void loadPayments()
  }, [loanSearchDebounced, orArDebounced.or, orArDebounced.ar, apiStatus, approvalStatus, paymentMethod, searchParams])

  const rows = useMemo(() => {
    const byId = new Map()
    const byName = new Map()
    borrowersData.forEach((b) => {
      const idKey = String(b?.id || '')
      if (idKey) byId.set(idKey, b)
      const n = normalizeName(b?.name || b?.account_name)
      if (n && !byName.has(n)) byName.set(n, b)
    })

    const raw = data?.data || []
    return raw.map((p) => {
      const borrowerName =
        p?.borrower?.account_name ||
        p?.borrower?.name ||
        p?.borrower_name ||
        p?.account_name ||
        p?.loan?.borrower?.name ||
        '—'
      const loanIdStr = String(p?.loan_id ?? p?.loan?.id ?? '').trim()
      const loanNumber =
        p?.loan_number ||
        p?.loan?.loan_number ||
        (loanIdStr ? formatLoanNumberFromId(loanIdStr) : '') ||
        p?.loan?.reference_number ||
        loanIdStr ||
        ''
      const borrowerId =
        p?.borrower_id ||
        p?.borrower?.id ||
        p?.loan?.borrower_id ||
        ''
      const matchedBorrower =
        byId.get(String(borrowerId || '')) ||
        byName.get(normalizeName(borrowerName))
      const borrowerEmail =
        p?.borrower?.email ||
        p?.borrower_email ||
        p?.loan?.borrower?.email ||
        p?.email ||
        matchedBorrower?.email ||
        ''
      const officerName = p?.loan?.assigned_officer?.name || p?.assigned_officer_name || '—'
      const collectorName = p?.recorded_by_name || '—'
      return {
        ...p,
        borrowerName: String(borrowerName || '—'),
        loanNumber: String(loanNumber || ''),
        borrowerEmail: String(borrowerEmail || ''),
        paymentRef: getPaymentReference(p),
        officerName: String(officerName || '—'),
        collectorName: String(collectorName || '—'),
        orNumber: String(p?.official_receipt_number || '').trim(),
        arNumber: String(p?.acknowledgement_receipt_number || '').trim(),
      }
    })
  }, [data, borrowersData])

  const borrowerOptions = useMemo(() => {
    const names = new Set()
    rows.forEach((p) => {
      if (p.borrowerName && p.borrowerName !== '—') names.add(p.borrowerName)
    })
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filteredRows = useMemo(() => {
    let next = rows

    if (borrowerFilter) {
      // Borrower selection intentionally shows pending-only items for that account.
      next = next.filter(
        (p) =>
          p.borrowerName === borrowerFilter &&
          String(p.status || '').toLowerCase() === 'pending',
      )
    }

    const borrowerQ = borrowerNameFilter.trim().toLowerCase()
    if (borrowerQ) {
      next = next.filter((p) => p.borrowerName.toLowerCase().includes(borrowerQ))
    }

    const loanQ = loanNumberFilter.trim()
    if (loanQ) {
      next = next.filter(
        (p) => paymentMatchesLoanSearch(p, loanQ) && (showPaidInLoanFilter || hasOutstandingBalance(p)),
      )
    }

    return next
  }, [rows, borrowerFilter, borrowerNameFilter, loanNumberFilter, showPaidInLoanFilter])

  const openConfirmModal = (payment) => {
    setConfirmTarget(payment)
    setConfirmOr(String(payment?.official_receipt_number || '').trim())
    setConfirmAr(String(payment?.acknowledgement_receipt_number || '').trim())
    setConfirmAutoMint(true)
  }

  const openReceiptEditModal = (p) => {
    setReceiptEdit(p)
    setReceiptOrInput(String(p?.official_receipt_number || '').trim())
    setReceiptArInput(String(p?.acknowledgement_receipt_number || '').trim())
  }

  const saveReceiptEdit = async () => {
    if (!receiptEdit?.id) return
    if (!receiptOrInput.trim() && !receiptArInput.trim()) {
      showToast('Enter at least one receipt number.', 'error')
      return
    }
    setReceiptSaving(true)
    try {
      const body = {}
      if (receiptOrInput.trim()) body.official_receipt_number = receiptOrInput.trim()
      if (receiptArInput.trim()) body.acknowledgement_receipt_number = receiptArInput.trim()
      await api(`/payments/${receiptEdit.id}/receipts`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      showToast('Receipt numbers saved.', 'success')
      setReceiptEdit(null)
      await loadPaymentsSilent()
    } catch (e) {
      showToast(e.message || 'Could not save receipt numbers.', 'error')
    } finally {
      setReceiptSaving(false)
    }
  }

  const verifyPaymentRow = async (p) => {
    try {
      await api(`/payments/${p.id}/verify`, { method: 'PATCH', body: '{}' })
      showToast('Payment verified.', 'success')
      await loadPaymentsSilent()
    } catch (e) {
      showToast(e.message || 'Verification failed.', 'error')
    }
  }

  const openReceiptAuditModal = async (p) => {
    setReceiptAuditFor(p)
    setReceiptAuditLoading(true)
    setReceiptAuditRows([])
    try {
      const res = await api(`/payments/${p.id}/receipt-audits`)
      setReceiptAuditRows(Array.isArray(res?.data) ? res.data : [])
    } catch (e) {
      showToast(e.message || 'Could not load receipt audit trail.', 'error')
      setReceiptAuditFor(null)
    } finally {
      setReceiptAuditLoading(false)
    }
  }

  const downloadPaymentsExport = async () => {
    try {
      const qs = buildPaymentsQuery()
      const rel = `/payments/export?${qs.toString()}`
      const token = getToken()
      const prefix = String(API_BASE || '/api/v1').replace(/\/$/, '')
      const url = `${window.location.origin}${prefix}${rel.startsWith('/') ? rel : `/${rel}`}`
      const res = await fetch(url, {
        headers: { Accept: 'text/csv', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(errText || `Export failed (${res.status})`)
      }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'payments-export.csv'
      a.click()
      URL.revokeObjectURL(a.href)
      showToast('Export downloaded.', 'success')
    } catch (e) {
      showToast(e.message || 'Export failed.', 'error')
    }
  }

  const canAdjustFinal = (p) =>
    Boolean(p?.is_final_payment) && String(p?.loan?.status || '').toLowerCase() === 'ongoing'

  const openAdjustPanel = (p) => {
    setAdjustPanel(p)
    setAdjustPaymentId(null)
    setAdjustAmount(String(Number(p.amount_due ?? 0)))
    setAdjustReason('')
    setAdjustConfirmOpen(false)
  }

  const runAdjustFinal = async () => {
    const id = adjustPaymentId ?? adjustPanel?.id
    if (!id) return
    const amt = Number(adjustAmount)
    if (!Number.isFinite(amt) || amt < 0) {
      showToast('Enter a valid non-negative amount.', 'error')
      throw new Error('validation')
    }
    const reason = adjustReason.trim()
    if (reason.length < 8) {
      showToast('Reason must be at least 8 characters.', 'error')
      throw new Error('validation')
    }
    setAdjustSaving(true)
    try {
      await api(`/payments/${id}/adjust-final`, {
        method: 'PATCH',
        body: JSON.stringify({ amount_due: amt, adjustment_reason: reason }),
      })
      showToast('Final installment updated.', 'success')
      setAdjustConfirmOpen(false)
      setAdjustPanel(null)
      setAdjustPaymentId(null)
      await loadPayments()
    } catch (e) {
      showToast(e.message || 'Adjustment failed.', 'error')
      throw e
    } finally {
      setAdjustSaving(false)
    }
  }

  const openAuditModal = async (p) => {
    setAuditFor(p)
    setAuditLoading(true)
    setAuditRows([])
    try {
      const res = await api(`/payments/${p.id}/adjustment-audits`)
      setAuditRows(Array.isArray(res?.data) ? res.data : [])
    } catch (e) {
      showToast(e.message || 'Could not load audit trail.', 'error')
      setAuditFor(null)
    } finally {
      setAuditLoading(false)
    }
  }

  const confirmPayment = async () => {
    if (!confirmTarget?.id) return
    if (!hasBorrowerPaymentEvidence(confirmTarget)) {
      showToast('Borrower must submit payment first before confirmation.', 'error')
      return
    }
    if (!confirmAutoMint && !confirmOr.trim() && !confirmAr.trim()) {
      showToast('Provide at least an OR number or an AR number, or enable auto-generate.', 'error')
      return
    }
    setConfirmingId(confirmTarget.id)
    try {
      const body = {
        status: 'paid',
        auto_mint_receipt_numbers: confirmAutoMint,
      }
      if (confirmOr.trim()) body.official_receipt_number = confirmOr.trim()
      if (confirmAr.trim()) body.acknowledgement_receipt_number = confirmAr.trim()
      const res = await api(`/payments/${confirmTarget.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      if (res.receipt_email_sent) {
        const em = res.last_payment_receipt_email
        const detail = em?.status ? ` ${String(em.status)}.` : ''
        showToast(`Payment confirmed. Receipt email queued.${detail}`, 'success')
      } else if (res.receipt_email_note === 'no_borrower_email') {
        showToast(
          'Payment confirmed. Receipt was not emailed: borrower has no valid email on file.',
          'error',
        )
      } else if (res.receipt_email_note === 'mail_transport_failed') {
        showToast(
          'Payment confirmed, but the receipt email failed to send. Check API mail settings (MAIL_HOST, SMTP).',
          'error',
        )
      } else if (res.receipt_email_note === 'mail_logged_only') {
        showToast(
          'Payment confirmed. Receipt email transport is unavailable, so the message was written to API logs instead.',
          'success',
        )
      } else {
        showToast('Payment confirmed.', 'success')
      }
      setConfirmTarget(null)
      await loadPaymentsSilent()
    } catch (e) {
      showToast(e.message || 'Failed to confirm payment.', 'error')
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={admin.pageTitle}>Payments &amp; collections</h1>
          <p className={admin.pageSubtitle}>Installments, OR/AR receipt control, and verification workflow.</p>
        </div>
        {can('payments.export') ? (
          <button
            type="button"
            onClick={() => void downloadPaymentsExport()}
            className={`shrink-0 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-[#374151] dark:text-gray-100 dark:hover:bg-white/5`}
          >
            Export CSV
          </button>
        ) : null}
      </div>

      <div className={`${admin.cardNoHover} p-4`}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <label className="block">
            <span className={`text-xs font-medium ${admin.textMuted}`}>Borrower account</span>
            <select
              value={borrowerFilter}
              onChange={(e) => setBorrowerFilter(e.target.value)}
              className={`mt-1 w-full ${admin.input}`}
            >
              <option value="">All accounts</option>
              {borrowerOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={`text-xs font-medium ${admin.textMuted}`}>Filter borrower name</span>
            <input
              value={borrowerNameFilter}
              onChange={(e) => setBorrowerNameFilter(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              className={`mt-1 w-full ${admin.input}`}
            />
          </label>
          <label className="block">
            <span className={`text-xs font-medium ${admin.textMuted}`}>Filter loan number</span>
            <input
              value={loanNumberFilter}
              onChange={(e) => setLoanNumberFilter(e.target.value)}
              placeholder="e.g. #6 or LN-000006"
              className={`mt-1 w-full ${admin.input}`}
            />
          </label>
          <label className="block">
            <span className={`text-xs font-medium ${admin.textMuted}`}>Search OR no.</span>
            <input
              value={orFilter}
              onChange={(e) => setOrFilter(e.target.value)}
              placeholder="Official receipt"
              className={`mt-1 w-full ${admin.input} font-mono uppercase`}
            />
          </label>
          <label className="block">
            <span className={`text-xs font-medium ${admin.textMuted}`}>Search AR no.</span>
            <input
              value={arFilter}
              onChange={(e) => setArFilter(e.target.value)}
              placeholder="Acknowledgement receipt"
              className={`mt-1 w-full ${admin.input} font-mono uppercase`}
            />
          </label>
          <label className="block">
            <span className={`text-xs font-medium ${admin.textMuted}`}>Payment status</span>
            <select
              value={apiStatus}
              onChange={(e) => setApiStatus(e.target.value)}
              className={`mt-1 w-full ${admin.input}`}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </label>
          <label className="block">
            <span className={`text-xs font-medium ${admin.textMuted}`}>Workflow</span>
            <select
              value={approvalStatus}
              onChange={(e) => setApprovalStatus(e.target.value)}
              className={`mt-1 w-full ${admin.input}`}
            >
              <option value="">Any</option>
              <option value="missing_receipts">Paid · missing both OR &amp; AR</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending queue</option>
              <option value="paid">Paid only</option>
            </select>
          </label>
          <label className="block">
            <span className={`text-xs font-medium ${admin.textMuted}`}>Payment method</span>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className={`mt-1 w-full ${admin.input}`}
            >
              <option value="">Any method</option>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="gcash">GCash</option>
            </select>
          </label>
        </div>
        <label className={`mt-3 flex cursor-pointer items-center gap-2 text-xs ${admin.textMuted}`}>
          <input
            type="checkbox"
            checked={showPaidInLoanFilter}
            onChange={(e) => setShowPaidInLoanFilter(e.target.checked)}
            className="rounded border-gray-300"
          />
          When filtering by loan number, include paid installments (read-only ledger view)
        </label>
        {borrowerFilter ? (
          <p className={`mt-2 text-xs ${admin.textMuted}`}>
            Showing pending payments for <span className="font-semibold">{borrowerFilter}</span>.
          </p>
        ) : null}
        {loanNumberFilter.trim() ? (
          <p className={`mt-2 text-xs ${admin.textMuted}`}>
            Loan filter: loans matching <span className="font-mono font-semibold">{loanNumberFilter.trim()}</span>
            {showPaidInLoanFilter ? ' (including paid installments).' : ' (unpaid installments only — tick checkbox above to include paid).'}
          </p>
        ) : null}
      </div>

      {/* Cards on small + tablets: avoid horizontal squeezing/zoom requirements */}
      <div className="space-y-3 lg:hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${admin.cardNoHover} p-4`}>
              <div className="h-3 w-24 animate-pulse rounded bg-gray-200 dark:bg-[#1F2937]" />
              <div className="mt-3 h-3 w-40 animate-pulse rounded bg-gray-200 dark:bg-[#1F2937]" />
              <div className="mt-2 h-3 w-36 animate-pulse rounded bg-gray-200 dark:bg-[#1F2937]" />
            </div>
          ))
        ) : filteredRows.length === 0 ? (
          <div className={`${admin.cardNoHover} p-4 text-sm ${admin.textMuted}`}>No payments found.</div>
        ) : (
          filteredRows.map((p) => (
            <div key={p.id} className={`${admin.cardNoHover} space-y-2 p-4`}>
              {(() => {
                const pending = String(p.status || '').toLowerCase() === 'pending'
                const canConfirm = pending && hasBorrowerPaymentEvidence(p)
                return (
                  <>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Loan {paymentLoanId(p) ? `#${paymentLoanId(p)}` : '—'}
                {p.loanNumber ? ` (${p.loanNumber})` : ''} · Installment {p.installment_no}
              </p>
              <p className={`text-xs ${admin.textMuted}`}>Borrower: {p.borrowerName}</p>
              <p className={`text-xs ${admin.textMuted}`}>Due: {formatDueDate(p.due_date)}</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className={`text-xs ${admin.textMuted}`}>Due amount</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">₱{Number(p.amount_due).toLocaleString()}</p>
                </div>
                <div>
                  <p className={`text-xs ${admin.textMuted}`}>Paid</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">₱{Number(p.amount_paid || 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs uppercase tracking-wide text-gray-700 dark:text-gray-300">
                <span>Status: {p.status}</span>
                {p.paymentRef ? (
                  <span className="normal-case tracking-normal text-gray-600 dark:text-gray-400">
                    · Ref: <span className="font-mono font-medium text-gray-900 dark:text-gray-200">{p.paymentRef}</span>
                  </span>
                ) : null}
              </div>
              <div className="mt-1 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <p className={`${admin.textMuted}`}>OR no.</p>
                  <p className="font-mono text-gray-900 dark:text-gray-100">{p.orNumber || '—'}</p>
                </div>
                <div>
                  <p className={`${admin.textMuted}`}>AR no.</p>
                  <p className="font-mono text-gray-900 dark:text-gray-100">{p.arNumber || '—'}</p>
                </div>
              </div>
              <p className={`text-[11px] ${admin.textMuted}`}>
                Officer: <span className="font-medium text-gray-800 dark:text-gray-200">{p.officerName}</span>
                {' · '}
                Collector: <span className="font-medium text-gray-800 dark:text-gray-200">{p.collectorName}</span>
              </p>
              {p.receipt_path || getReceiptPublicUrl(p) ? (
                <div className="mt-2">
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${admin.textMuted}`}>Payment proof</p>
                  <div className="mt-1">
                    <ProofCell payment={p} />
                  </div>
                </div>
              ) : null}
              <div className={`text-xs ${admin.textMuted}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-wide ${admin.textMuted}`}>Receipt email</p>
                <ReceiptEmailCell payment={p} />
              </div>
              {pending ? (
                <>
                <button
                  type="button"
                  onClick={() => openConfirmModal(p)}
                  disabled={confirmingId === p.id || !canConfirm}
                  className="mt-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirmingId === p.id ? 'Confirming...' : 'Confirm Payment'}
                </button>
                {!canConfirm ? (
                  <p className={`text-xs ${admin.textMuted}`}>
                    Waiting for borrower payment proof/reference before confirmation.
                  </p>
                ) : null}
                </>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {canAdjustFinal(p) ? (
                  <button
                    type="button"
                    onClick={() => openAdjustPanel(p)}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200"
                  >
                    Adjust final
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void openReceiptAuditModal(p)}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-800 dark:border-[#374151] dark:text-gray-200"
                >
                  Receipt log
                </button>
                {pending && hasBorrowerPaymentEvidence(p) && can('payments.verify') ? (
                  <button
                    type="button"
                    onClick={() => void verifyPaymentRow(p)}
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                  >
                    Verify
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => openReceiptEditModal(p)}
                  disabled={p.is_receipt_locked && !can('payments.override_locked')}
                  className="rounded-lg border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-500/40 dark:bg-sky-950/30 dark:text-sky-200"
                >
                  OR / AR
                </button>
                <button
                  type="button"
                  onClick={() => void openAuditModal(p)}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-800 dark:border-[#374151] dark:text-gray-200"
                >
                  Final adj. audit
                </button>
              </div>
                  </>
                )
              })()}
            </div>
          ))
        )}
      </div>

      {/* Desktop table (lg+) */}
      <div className={`hidden lg:block max-h-[calc(100vh-12rem)] overflow-auto ${admin.tableWrap}`}>
        <table className={`${admin.tableBase} ${admin.tableText} min-w-[1180px]`}>
          <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm dark:bg-[#0b1220]">
            <tr className={admin.thead}>
              <th className={admin.tableCell}>Borrower account</th>
              <th className={admin.tableCell}>Loan</th>
              <th className={admin.tableCell}>#</th>
              <th className={admin.tableCell}>Due</th>
              <th className={admin.tableCell}>Due amount</th>
              <th className={admin.tableCell}>Orig. final</th>
              <th className={admin.tableCell}>Remaining</th>
              <th className={admin.tableCell}>Paid</th>
              <th className={admin.tableCell}>Status</th>
              <th className={admin.tableCell}>OR no.</th>
              <th className={admin.tableCell}>AR no.</th>
              <th className={admin.tableCell}>Officer</th>
              <th className={admin.tableCell}>Collector</th>
              <th className={admin.tableCell}>Verified</th>
              <th className={admin.tableCell}>Reference</th>
              <th className={admin.tableCell}>Proof</th>
              <th className={admin.tableCell}>Receipt email</th>
              <th className={admin.tableCell}>Tools</th>
              <th className={admin.tableCell}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeletonRows cols={19} rows={5} />
            ) : filteredRows.length === 0 ? (
              <EmptyTableRow colSpan={19} message="No payments found." />
            ) : (
              filteredRows.map((p) => (
                <tr key={p.id} className={admin.tbodyRow}>
                  {(() => {
                    const pending = String(p.status || '').toLowerCase() === 'pending'
                    const canConfirm = pending && hasBorrowerPaymentEvidence(p)
                    return (
                      <>
                  <td className={`${admin.tableCell} whitespace-nowrap`}>{p.borrowerName}</td>
                  <td className={`${admin.tableCell} whitespace-nowrap`}>
                    {paymentLoanId(p) ? (
                      <>
                        <span className="font-medium">#{paymentLoanId(p)}</span>
                        {p.loanNumber ? (
                          <span className={`ml-1 text-xs ${admin.textMuted}`}>({p.loanNumber})</span>
                        ) : null}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`${admin.tableCell} whitespace-nowrap`}>{p.installment_no}</td>
                  <td className={`${admin.tableCell} whitespace-nowrap`}>{formatDueDate(p.due_date)}</td>
                  <td className={`${admin.tableCell} whitespace-nowrap`}>₱{Number(p.amount_due).toLocaleString()}</td>
                  <td className={`${admin.tableCell} whitespace-nowrap text-xs`}>
                    {p.original_amount_due != null ? `₱${Number(p.original_amount_due).toLocaleString()}` : '—'}
                  </td>
                  <td className={`${admin.tableCell} whitespace-nowrap text-xs`}>
                    {p.loan_outstanding_balance != null
                      ? `₱${Number(p.loan_outstanding_balance).toLocaleString()}`
                      : '—'}
                  </td>
                  <td className={`${admin.tableCell} whitespace-nowrap`}>₱{Number(p.amount_paid || 0).toLocaleString()}</td>
                  <td className={`${admin.tableCell} capitalize whitespace-nowrap`}>
                    <span className="inline-flex flex-col gap-0.5">
                      <span>{p.status}</span>
                      {p.adjusted_at ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
                          Adjusted final
                        </span>
                      ) : null}
                      {p.is_receipt_locked ? (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-800 dark:bg-slate-600/40 dark:text-slate-100">
                          Locked
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className={`${admin.tableCell} max-w-[7rem] truncate font-mono text-xs`} title={p.orNumber || ''}>
                    {p.orNumber || '—'}
                  </td>
                  <td className={`${admin.tableCell} max-w-[7rem] truncate font-mono text-xs`} title={p.arNumber || ''}>
                    {p.arNumber || '—'}
                  </td>
                  <td className={`${admin.tableCell} max-w-[7rem] truncate text-xs`}>{p.officerName}</td>
                  <td className={`${admin.tableCell} max-w-[7rem] truncate text-xs`}>{p.collectorName}</td>
                  <td className={`${admin.tableCell} whitespace-nowrap text-xs`}>
                    {p.verified_by_name ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100">
                        Yes
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`${admin.tableCell} max-w-[12rem] break-words font-mono text-xs`}>
                    {p.paymentRef || '—'}
                  </td>
                  <td className={`${admin.tableCell} align-middle`}>
                    <ProofCell payment={p} />
                  </td>
                  <td className={`${admin.tableCell} align-top text-xs`}>
                    <ReceiptEmailCell payment={p} />
                  </td>
                  <td className={`${admin.tableCell} max-w-[12rem] whitespace-normal text-xs`}>
                    <div className="flex flex-col gap-1">
                      {canAdjustFinal(p) ? (
                        <button
                          type="button"
                          onClick={() => openAdjustPanel(p)}
                          className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200"
                        >
                          Adjust final
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void openReceiptAuditModal(p)}
                        className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-800 hover:bg-gray-50 dark:border-[#374151] dark:text-gray-200 dark:hover:bg-white/5"
                      >
                        Receipt log
                      </button>
                      {pending && hasBorrowerPaymentEvidence(p) && can('payments.verify') ? (
                        <button
                          type="button"
                          onClick={() => void verifyPaymentRow(p)}
                          className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                        >
                          Verify
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openReceiptEditModal(p)}
                        disabled={p.is_receipt_locked && !can('payments.override_locked')}
                        className="rounded-lg border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-900 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-500/40 dark:bg-sky-950/30 dark:text-sky-200"
                      >
                        OR / AR
                      </button>
                      <button
                        type="button"
                        onClick={() => void openAuditModal(p)}
                        className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-800 hover:bg-gray-50 dark:border-[#374151] dark:text-gray-200 dark:hover:bg-white/5"
                      >
                        Final adj. audit
                      </button>
                    </div>
                  </td>
                  <td className={`${admin.tableCell} whitespace-nowrap`}>
                    {pending ? (
                      <button
                        type="button"
                        onClick={() => openConfirmModal(p)}
                        disabled={confirmingId === p.id || !canConfirm}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        title={
                          canConfirm
                            ? 'Confirm borrower payment'
                            : 'Borrower must pay first (proof/reference/amount) before confirmation'
                        }
                      >
                        {confirmingId === p.id ? 'Confirming...' : 'Confirm'}
                      </button>
                    ) : (
                      <span className={`text-xs ${admin.textMuted}`}>—</span>
                    )}
                  </td>
                      </>
                    )
                  })()}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {confirmTarget ? (
        <div className={admin.modalOverlay}>
          <div className={admin.modalCard}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Confirm Payment</h3>
            <p className={`mt-1 text-sm ${admin.textMuted}`}>
              Mark this installment as paid for <span className="font-semibold">{confirmTarget.borrowerName}</span>?
            </p>
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-[#1F2937] dark:bg-[#0F172A]/50">
              <p>
                <span className="font-medium">Loan:</span> #
                {paymentLoanId(confirmTarget) || confirmTarget.loan_id}
                {confirmTarget.loanNumber ? (
                  <span className={`ml-1 ${admin.textMuted}`}>({confirmTarget.loanNumber})</span>
                ) : null}
              </p>
              <p><span className="font-medium">Installment:</span> {confirmTarget.installment_no}</p>
              <p><span className="font-medium">Due date:</span> {formatDueDate(confirmTarget.due_date)}</p>
              <p><span className="font-medium">Due amount:</span> ₱{Number(confirmTarget.amount_due || 0).toLocaleString()}</p>
              <p><span className="font-medium">Amount paid:</span> ₱{Number(confirmTarget.amount_paid || 0).toLocaleString()}</p>
              <p>
                <span className="font-medium">Reference:</span>{' '}
                <span className="font-mono">{confirmTarget.paymentRef || '—'}</span>
              </p>
              {confirmTarget.receipt_path || getReceiptPublicUrl(confirmTarget) ? (
                <div className="mt-2 border-t border-gray-200 pt-2 dark:border-[#374151]">
                  <p className="font-medium">Borrower proof</p>
                  <div className="mt-2">
                    <ProofCell payment={confirmTarget} />
                  </div>
                </div>
              ) : null}
              <p><span className="font-medium">Borrower email:</span> {getBorrowerEmail(confirmTarget) || 'Not available'}</p>
            </div>
            <div className="mt-4 space-y-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-[#1F2937] dark:bg-[#111827]/80">
              <p className={`text-xs font-semibold uppercase tracking-wide ${admin.textMuted}`}>Receipt numbers</p>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={confirmAutoMint}
                  onChange={(e) => setConfirmAutoMint(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Auto-generate missing OR/AR (OR-YYYY-###### / AR-YYYY-######)
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={`text-xs font-medium ${admin.textMuted}`}>Official receipt (OR)</span>
                  <input
                    value={confirmOr}
                    onChange={(e) => setConfirmOr(e.target.value)}
                    className={`mt-1 w-full font-mono uppercase ${admin.input}`}
                    placeholder="Leave blank to auto-fill when enabled"
                  />
                </label>
                <label className="block">
                  <span className={`text-xs font-medium ${admin.textMuted}`}>Acknowledgement (AR)</span>
                  <input
                    value={confirmAr}
                    onChange={(e) => setConfirmAr(e.target.value)}
                    className={`mt-1 w-full font-mono uppercase ${admin.input}`}
                    placeholder="Leave blank to auto-fill when enabled"
                  />
                </label>
              </div>
              {!confirmAutoMint ? (
                <p className={`text-xs ${admin.textMuted}`}>
                  When auto-generate is off, enter at least one receipt number (OR only, AR only, or both).
                </p>
              ) : (
                <p className={`text-xs ${admin.textMuted}`}>
                  Auto-generate fills both numbers only when both fields would otherwise be empty. You can still type
                  just an OR or just an AR and leave the other blank.
                </p>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className={admin.btnSecondary}
                disabled={confirmingId === confirmTarget.id}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPayment}
                disabled={confirmingId === confirmTarget.id}
                className={`${admin.btnPrimary} disabled:opacity-60`}
              >
                {confirmingId === confirmTarget.id ? 'Confirming...' : 'Confirm as Paid'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {adjustPanel ? (
        <div
          className={admin.modalOverlay}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAdjustPanel(null)
          }}
        >
          <div
            className={`${admin.modalCard} max-w-lg`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="adjust-final-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="adjust-final-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Adjust final installment
            </h3>
            <p className={`mt-1 text-sm ${admin.textMuted}`}>
              Loan {paymentLoanId(adjustPanel) ? `#${paymentLoanId(adjustPanel)}` : '—'}
              {adjustPanel.loanNumber ? ` (${adjustPanel.loanNumber})` : ''} · Installment {adjustPanel.installment_no}
              {adjustPanel.original_amount_due != null ? (
                <>
                  {' '}
                  · Original scheduled ₱{Number(adjustPanel.original_amount_due).toLocaleString()}
                </>
              ) : null}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className={`text-xs font-medium ${admin.textMuted}`}>New amount due (₱)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className={`mt-1 w-full ${admin.input}`}
                />
              </label>
              <label className="block">
                <span className={`text-xs font-medium ${admin.textMuted}`}>Reason (required for audit)</span>
                <textarea
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  rows={3}
                  className={`mt-1 w-full ${admin.input}`}
                  placeholder="e.g. Early settlement discount approved by credit committee…"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className={admin.btnSecondary} onClick={() => setAdjustPanel(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={admin.btnPrimary}
                onClick={() => {
                  const amt = Number(adjustAmount)
                  if (!Number.isFinite(amt) || amt < 0) {
                    showToast('Enter a valid non-negative amount.', 'error')
                    return
                  }
                  if (adjustReason.trim().length < 8) {
                    showToast('Reason must be at least 8 characters.', 'error')
                    return
                  }
                  setAdjustPaymentId(adjustPanel.id)
                  setAdjustPanel(null)
                  setAdjustConfirmOpen(true)
                }}
              >
                Review &amp; confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={adjustConfirmOpen}
        onClose={() => {
          if (adjustSaving) return
          setAdjustConfirmOpen(false)
          setAdjustPaymentId(null)
        }}
        title="Save final installment adjustment?"
        description={`This updates the scheduled amount due for the last installment to ₱${Number(adjustAmount || 0).toLocaleString()} and notifies the borrower. This action is logged for audit.`}
        confirmLabel="Save adjustment"
        cancelLabel="Back"
        tone="danger"
        onConfirm={runAdjustFinal}
      />

      {auditFor ? (
        <div
          className={admin.modalOverlay}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAuditFor(null)
          }}
        >
          <div
            className={`${admin.modalCard} max-w-2xl`}
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Adjustment audit trail</h3>
            <p className={`mt-1 text-sm ${admin.textMuted}`}>
              Payment #{auditFor.id} · Loan {paymentLoanId(auditFor) ? `#${paymentLoanId(auditFor)}` : '—'}
            </p>
            <div className={`mt-4 max-h-80 overflow-y-auto text-sm ${admin.textMuted}`}>
              {auditLoading ? (
                <p>Loading…</p>
              ) : auditRows.length === 0 ? (
                <p>No adjustments recorded for this installment.</p>
              ) : (
                <ul className="space-y-3">
                  {auditRows.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-[#374151] dark:bg-[#0F172A]/50"
                    >
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        ₱{Number(a.previous_amount_due).toLocaleString()} → ₱{Number(a.new_amount_due).toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs">
                        {a.created_at ? new Date(a.created_at).toLocaleString() : '—'} ·{' '}
                        {a.admin_user?.name || a.admin_user?.email || 'Admin'}
                      </p>
                      <p className="mt-2 text-xs text-gray-700 dark:text-gray-300">{a.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" className={admin.btnSecondary} onClick={() => setAuditFor(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {receiptEdit ? (
        <div
          className={admin.modalOverlay}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setReceiptEdit(null)
          }}
        >
          <div
            className={`${admin.modalCard} max-w-md`}
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Receipt numbers</h3>
            <p className={`mt-1 text-sm ${admin.textMuted}`}>
              Payment #{receiptEdit.id} · {receiptEdit.borrowerName}
              {receiptEdit.is_receipt_locked ? (
                <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900 dark:bg-amber-500/20 dark:text-amber-100">
                  Locked — override role required to edit
                </span>
              ) : null}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className={`text-xs font-medium ${admin.textMuted}`}>Official receipt (OR)</span>
                <input
                  value={receiptOrInput}
                  onChange={(e) => setReceiptOrInput(e.target.value)}
                  className={`mt-1 w-full font-mono uppercase ${admin.input}`}
                />
              </label>
              <label className="block">
                <span className={`text-xs font-medium ${admin.textMuted}`}>Acknowledgement (AR)</span>
                <input
                  value={receiptArInput}
                  onChange={(e) => setReceiptArInput(e.target.value)}
                  className={`mt-1 w-full font-mono uppercase ${admin.input}`}
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={admin.btnSecondary} onClick={() => setReceiptEdit(null)} disabled={receiptSaving}>
                Cancel
              </button>
              <button
                type="button"
                className={admin.btnPrimary}
                disabled={receiptSaving}
                onClick={() => void saveReceiptEdit()}
              >
                {receiptSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {receiptAuditFor ? (
        <div
          className={admin.modalOverlay}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setReceiptAuditFor(null)
          }}
        >
          <div
            className={`${admin.modalCard} max-w-2xl`}
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Receipt audit log</h3>
            <p className={`mt-1 text-sm ${admin.textMuted}`}>
              Payment #{receiptAuditFor.id} · Loan {paymentLoanId(receiptAuditFor) ? `#${paymentLoanId(receiptAuditFor)}` : '—'}
            </p>
            <div className={`mt-4 max-h-80 overflow-y-auto text-sm ${admin.textMuted}`}>
              {receiptAuditLoading ? (
                <p>Loading…</p>
              ) : receiptAuditRows.length === 0 ? (
                <p>No receipt events logged yet.</p>
              ) : (
                <ul className="space-y-3">
                  {receiptAuditRows.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-[#374151] dark:bg-[#0F172A]/50"
                    >
                      <p className="font-medium text-gray-900 dark:text-gray-100">{a.action}</p>
                      <p className="mt-1 font-mono text-xs text-gray-800 dark:text-gray-200">
                        OR {a.official_receipt_number || '—'} · AR {a.acknowledgement_receipt_number || '—'}
                      </p>
                      <p className="mt-1 text-xs">
                        {a.created_at ? new Date(a.created_at).toLocaleString() : '—'} ·{' '}
                        {a.user?.name || a.user?.email || 'System'}
                      </p>
                      {a.meta ? (
                        <pre className="mt-2 max-h-24 overflow-auto rounded bg-black/5 p-2 text-[10px] dark:bg-white/5">
                          {JSON.stringify(a.meta, null, 2)}
                        </pre>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" className={admin.btnSecondary} onClick={() => setReceiptAuditFor(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
