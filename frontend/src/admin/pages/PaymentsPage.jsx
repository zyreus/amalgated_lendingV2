import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, getToken, API_BASE } from '../api/client.js'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { useToast } from '../context/ToastContext.jsx'
import { admin, TableSkeletonRows } from '../components/AdminUi.jsx'
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

function getOfficialReceiptPublicUrl(payment) {
  const u = payment?.invoice_pdf_url || payment?.official_receipt_pdf_url
  if (u && String(u).trim()) return getLaravelStorageFileUrl(String(u).trim())
  const path = payment?.receipt_pdf_path || payment?.invoice_pdf_path
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
          loading="lazy"
          decoding="async"
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

function formatPeso(value) {
  return `₱${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function processorInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '—'
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('')
}

function roleLabel(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return raw.replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

function ProcessorCell({ name, role }) {
  const displayName = String(name || '').trim()
  if (!displayName) return <span className={`text-xs ${admin.textMuted}`}>—</span>
  const displayRole = roleLabel(role)
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-600 to-red-500 text-[11px] font-bold text-white shadow-sm">
        {processorInitials(displayName)}
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">{displayName}</div>
        {displayRole ? <small className={`block truncate ${admin.textMuted}`}>{displayRole}</small> : null}
      </div>
    </div>
  )
}

function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(t)
  }, [value, delay])
  return debounced
}

function paymentStatusBadge(payment) {
  const status = String(payment?.status || '').toLowerCase()
  const missingOr = !String(payment?.official_receipt_number || '').trim()
  const missingAr = !String(payment?.acknowledgement_receipt_number || '').trim()
  if (status === 'paid' && missingOr && missingAr) {
    return { label: 'Missing OR & AR', className: 'bg-orange-100 text-orange-700' }
  }
  if (status === 'paid' && missingOr) return { label: 'Missing OR', className: 'bg-orange-100 text-orange-700' }
  if (status === 'paid' && missingAr) return { label: 'Missing AR', className: 'bg-pink-100 text-pink-700' }
  if (status === 'paid') return { label: 'Paid', className: 'bg-green-100 text-green-700' }
  if (status === 'overdue') return { label: 'Overdue', className: 'bg-red-100 text-red-700' }
  if (status === 'partial') return { label: 'Partial', className: 'bg-blue-100 text-blue-700' }
  return { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' }
}

function isActionablePayment(payment) {
  return ['pending', 'partial', 'overdue'].includes(String(payment?.status || '').toLowerCase())
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
  const [orFilter, setOrFilter] = useState('')
  const [arFilter, setArFilter] = useState('')
  const [orFromFilter, setOrFromFilter] = useState('')
  const [orToFilter, setOrToFilter] = useState('')
  const [arFromFilter, setArFromFilter] = useState('')
  const [arToFilter, setArToFilter] = useState('')
  const [apiStatus, setApiStatus] = useState('')
  const [workflow, setWorkflow] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [showPaidInLoanFilter, setShowPaidInLoanFilter] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [sortBy, setSortBy] = useState('due_date')
  const [sortDir, setSortDir] = useState('desc')
  const [refreshing, setRefreshing] = useState(false)
  const [receiptEdit, setReceiptEdit] = useState(null)
  const [receiptOrInput, setReceiptOrInput] = useState('')
  const [receiptArInput, setReceiptArInput] = useState('')
  const [receiptSaving, setReceiptSaving] = useState(false)
  const [receiptAuditFor, setReceiptAuditFor] = useState(null)
  const [receiptAuditRows, setReceiptAuditRows] = useState([])
  const [receiptAuditLoading, setReceiptAuditLoading] = useState(false)
  const [processorNameFilter, setProcessorNameFilter] = useState('')
  const [processorRoleFilter, setProcessorRoleFilter] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [manualLoans, setManualLoans] = useState([])
  const [manualLoading, setManualLoading] = useState(false)
  const [manualSaving, setManualSaving] = useState(false)
  const [manualResult, setManualResult] = useState(null)
  const [manualForm, setManualForm] = useState({
    borrower_id: '',
    loan_id: '',
    payment_id: '',
    amount_paid: '',
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: 'cash',
    payment_type: 'partial',
    penalty_amount: '0',
    reference_number: '',
    official_receipt_number: '',
    acknowledgement_receipt_number: '',
    notes: '',
  })
  const requestSeq = useRef(0)
  const borrowerSearchDebounced = useDebouncedValue(borrowerNameFilter.trim(), 350)
  const loanSearchDebounced = useDebouncedValue(loanNumberFilter.trim(), 350)
  const orDebounced = useDebouncedValue(orFilter.trim(), 350)
  const arDebounced = useDebouncedValue(arFilter.trim(), 350)
  const orFromDebounced = useDebouncedValue(orFromFilter.trim(), 350)
  const orToDebounced = useDebouncedValue(orToFilter.trim(), 350)
  const arFromDebounced = useDebouncedValue(arFromFilter.trim(), 350)
  const arToDebounced = useDebouncedValue(arToFilter.trim(), 350)
  const processorNameDebounced = useDebouncedValue(processorNameFilter.trim(), 350)
  const processorRoleDebounced = useDebouncedValue(processorRoleFilter.trim(), 350)

  const loadBorrowers = async () => {
    try {
      const all = []
      let page = 1
      for (let guard = 0; guard < 20; guard += 1) {
        const borrowersRes = await api(`/borrowers?per_page=100&page=${page}`)
        const payload = borrowersRes?.data || {}
        const pageRows = Array.isArray(payload?.data) ? payload.data : []
        all.push(...pageRows)
        const current = Number(payload?.current_page || page)
        const last = Number(payload?.last_page || current)
        if (pageRows.length === 0 || current >= last) break
        page = current + 1
      }
      setBorrowersData(all)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const buildPaymentsQuery = useCallback(() => {
    const qs = new URLSearchParams({
      per_page: String(perPage),
      page: String(page),
      sort: sortBy,
      direction: sortDir,
    })
    const paymentId = (searchParams.get('payment_id') || '').trim()
    if (paymentId) qs.set('payment_id', paymentId)
    if (borrowerFilter) {
      if (/^\d+$/.test(String(borrowerFilter))) qs.set('borrower_id', String(borrowerFilter))
      else qs.set('borrower_search', borrowerFilter)
    }
    if (borrowerSearchDebounced) qs.set('borrower_search', borrowerSearchDebounced)
    if (loanSearchDebounced) qs.set('loan_search', loanSearchDebounced)
    if (orDebounced) qs.set('official_receipt_q', orDebounced)
    if (arDebounced) qs.set('acknowledgement_receipt_q', arDebounced)
    if (orFromDebounced) qs.set('or_from', orFromDebounced)
    if (orToDebounced) qs.set('or_to', orToDebounced)
    if (arFromDebounced) qs.set('ar_from', arFromDebounced)
    if (arToDebounced) qs.set('ar_to', arToDebounced)
    if (loanSearchDebounced && !showPaidInLoanFilter && apiStatus !== 'paid' && workflow !== 'ledger') {
      qs.set('outstanding_only', '1')
    }
    if (apiStatus) qs.set('status', apiStatus)
    else {
      const stUrl = (searchParams.get('status') || '').trim()
      if (stUrl) qs.set('status', stUrl)
    }
    if (workflow) qs.set('workflow', workflow)
    if (paymentMethod) qs.set('payment_method', paymentMethod)
    if (processorNameDebounced) qs.set('collector_search', processorNameDebounced)
    if (processorRoleDebounced) qs.set('processor_role', processorRoleDebounced)
    const ov = searchParams.get('overdue')
    if (ov === '1' || ov === 'true') qs.set('overdue', '1')
    const dpdMin = searchParams.get('installment_dpd_min')
    const dpdMax = searchParams.get('installment_dpd_max')
    if (dpdMin) qs.set('installment_dpd_min', dpdMin)
    if (dpdMax) qs.set('installment_dpd_max', dpdMax)
    return qs
  }, [
    borrowerFilter,
    borrowerSearchDebounced,
    loanSearchDebounced,
    orDebounced,
    arDebounced,
    orFromDebounced,
    orToDebounced,
    arFromDebounced,
    arToDebounced,
    apiStatus,
    workflow,
    paymentMethod,
    processorNameDebounced,
    processorRoleDebounced,
    searchParams,
    showPaidInLoanFilter,
    page,
    perPage,
    sortBy,
    sortDir,
  ])

  const loadPayments = useCallback(async ({ silent = false } = {}) => {
    const seq = requestSeq.current + 1
    requestSeq.current = seq
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const paymentsRes = await api(`/payments?${buildPaymentsQuery().toString()}`)
      if (seq !== requestSeq.current) return
      setData(paymentsRes.data)
    } catch (e) {
      if (seq !== requestSeq.current) return
      showToast(e.message, 'error')
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [buildPaymentsQuery, showToast])

  const loadPaymentsSilent = useCallback(async () => {
    await loadPayments({ silent: true })
  }, [loadPayments])

  useEffect(() => {
    void loadBorrowers()
  }, [])

  useEffect(() => {
    const q = (searchParams.get('loan_search') || searchParams.get('loan') || '').trim()
    if (q) setLoanNumberFilter(q)
    const paymentId = (searchParams.get('payment_id') || '').trim()
    if (paymentId) {
      setLoanNumberFilter('')
      setBorrowerFilter('')
      setBorrowerNameFilter('')
      setApiStatus('')
      setWorkflow('')
    }
  }, [searchParams])

  useEffect(() => {
    void loadPayments()
  }, [loadPayments])

  useEffect(() => {
    const t = window.setInterval(() => {
      if (!confirmTarget && !adjustPanel && !receiptEdit && !auditFor && !receiptAuditFor) {
        void loadPayments({ silent: true })
      }
    }, 30000)
    return () => window.clearInterval(t)
  }, [adjustPanel, auditFor, confirmTarget, loadPayments, receiptAuditFor, receiptEdit])

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
      const processedByName =
        p?.processed_by_name ||
        p?.encoder_name ||
        p?.recorded_by_name ||
        p?.confirmed_by_name ||
        '—'
      const processedByRole = p?.processed_by_role || p?.encoder_role || p?.receipt_issued_role || ''
      return {
        ...p,
        borrowerId: String(borrowerId || ''),
        borrowerName: String(borrowerName || '—'),
        loanNumber: String(loanNumber || ''),
        borrowerEmail: String(borrowerEmail || ''),
        paymentRef: getPaymentReference(p),
        officerName: String(officerName || '—'),
        collectorName: String(collectorName || '—'),
        processedByName: String(processedByName || '—'),
        processedByRole: String(processedByRole || ''),
        orNumber: String(p?.official_receipt_number || '').trim(),
        arNumber: String(p?.acknowledgement_receipt_number || '').trim(),
      }
    })
  }, [data, borrowersData])

  const borrowerOptions = useMemo(() => {
    const byId = new Map()
    borrowersData.forEach((b) => {
      const id = String(b?.id || '').trim()
      const name = String(b?.name || b?.account_name || '').trim()
      if (id && name && !byId.has(id)) byId.set(id, name)
    })
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [borrowersData])

  const selectedBorrowerName = useMemo(
    () => borrowerOptions.find((b) => b.id === borrowerFilter)?.name || borrowerFilter,
    [borrowerOptions, borrowerFilter],
  )

  const filteredRows = rows

  const pagination = useMemo(() => ({
    total: Number(data?.total || 0),
    from: Number(data?.from || 0),
    to: Number(data?.to || 0),
    currentPage: Number(data?.current_page || page),
    lastPage: Number(data?.last_page || 1),
  }), [data, page])

  const resetToFirstPage = () => setPage(1)
  const setFilter = (setter) => (value) => {
    resetToFirstPage()
    setter(value)
  }

  const clearFilters = () => {
    setBorrowerFilter('')
    setBorrowerNameFilter('')
    setLoanNumberFilter('')
    setOrFilter('')
    setArFilter('')
    setOrFromFilter('')
    setOrToFilter('')
    setArFromFilter('')
    setArToFilter('')
    setApiStatus('')
    setWorkflow('')
    setPaymentMethod('')
    setProcessorNameFilter('')
    setProcessorRoleFilter('')
    setShowPaidInLoanFilter(false)
    setPage(1)
  }

  const activeFilterChips = useMemo(() => {
    const statusLabels = {
      pending: 'Pending',
      paid: 'Paid',
      overdue: 'Overdue',
      missing_or: 'Missing OR',
      missing_ar: 'Missing AR',
      missing_both: 'Missing Both',
    }
    const workflowLabels = {
      verified: 'Verified',
      pending_verification: 'Pending Verification',
      missing_receipt: 'Missing Receipt',
      ledger: 'Read-only Ledger',
    }
    const methodLabels = {
      cash: 'Cash',
      gcash: 'GCash',
      maya: 'Maya',
      bank: 'Bank Transfer',
    }
    return [
      borrowerFilter
        ? { key: 'borrower', label: `Borrower: ${selectedBorrowerName}`, remove: () => setFilter(setBorrowerFilter)('') }
        : null,
      borrowerNameFilter.trim()
        ? { key: 'borrowerName', label: `Name: ${borrowerNameFilter.trim()}`, remove: () => setFilter(setBorrowerNameFilter)('') }
        : null,
      loanNumberFilter.trim()
        ? { key: 'loan', label: `Loan: ${loanNumberFilter.trim()}`, remove: () => setFilter(setLoanNumberFilter)('') }
        : null,
      orFilter.trim()
        ? { key: 'or', label: `OR: ${orFilter.trim()}`, remove: () => setFilter(setOrFilter)('') }
        : null,
      arFilter.trim()
        ? { key: 'ar', label: `AR: ${arFilter.trim()}`, remove: () => setFilter(setArFilter)('') }
        : null,
      orFromFilter.trim() || orToFilter.trim()
        ? { key: 'orRange', label: `OR range: ${orFromFilter.trim() || '...'} - ${orToFilter.trim() || '...'}`, remove: () => { setFilter(setOrFromFilter)(''); setFilter(setOrToFilter)('') } }
        : null,
      arFromFilter.trim() || arToFilter.trim()
        ? { key: 'arRange', label: `AR range: ${arFromFilter.trim() || '...'} - ${arToFilter.trim() || '...'}`, remove: () => { setFilter(setArFromFilter)(''); setFilter(setArToFilter)('') } }
        : null,
      apiStatus ? { key: 'status', label: `Status: ${statusLabels[apiStatus] || apiStatus}`, remove: () => setFilter(setApiStatus)('') } : null,
      workflow ? { key: 'workflow', label: `Workflow: ${workflowLabels[workflow] || workflow}`, remove: () => setFilter(setWorkflow)('') } : null,
      paymentMethod
        ? { key: 'method', label: `Method: ${methodLabels[paymentMethod] || paymentMethod}`, remove: () => setFilter(setPaymentMethod)('') }
        : null,
      processorNameFilter.trim()
        ? { key: 'processor', label: `Processor: ${processorNameFilter.trim()}`, remove: () => setFilter(setProcessorNameFilter)('') }
        : null,
      processorRoleFilter.trim()
        ? { key: 'processorRole', label: `Role: ${processorRoleFilter.trim()}`, remove: () => setFilter(setProcessorRoleFilter)('') }
        : null,
      showPaidInLoanFilter ? { key: 'ledger', label: 'Include paid ledger', remove: () => setFilter(setShowPaidInLoanFilter)(false) } : null,
    ].filter(Boolean)
  }, [
    arFilter,
    arFromFilter,
    arToFilter,
    apiStatus,
    borrowerFilter,
    borrowerNameFilter,
    loanNumberFilter,
    orFilter,
    orFromFilter,
    orToFilter,
    paymentMethod,
    processorNameFilter,
    processorRoleFilter,
    selectedBorrowerName,
    showPaidInLoanFilter,
    workflow,
  ])

  const sortColumn = (key) => {
    resetToFirstPage()
    if (sortBy === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortBy(key)
    setSortDir(key === 'borrower' || key === 'loan' ? 'asc' : 'desc')
  }

  const renderSortableHeader = (sortKey, label, className = '') => (
    <th className={`${admin.tableCell} ${className}`}>
      <button
        type="button"
        onClick={() => sortColumn(sortKey)}
        className="inline-flex items-center gap-1 text-left font-semibold uppercase tracking-wider"
      >
        {label}
        <span className="text-[10px] text-gray-400">
          {sortBy === sortKey ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  )

  const filterFieldClass = 'block min-w-0'
  const filterLabelClass = `block truncate text-xs font-medium ${admin.textMuted}`
  const filterInputClass = `mt-1 h-12 w-full min-w-0 rounded-xl border border-[#D8D8D8] bg-white px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#E11D48] focus:ring-2 focus:ring-[#E11D48]/20 dark:border-[#374151] dark:bg-[#111827] dark:text-gray-100`

  const renderEmptyPaymentsState = (colSpan) => (
    <tr>
      <td colSpan={colSpan} className="px-6 py-14">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-2xl text-rose-600">
            ₱
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900">No matching payments were found</h3>
          <p className={`mt-2 text-sm ${admin.textMuted}`}>
            No matching payments were found for the current filters. Try clearing filters or searching a different loan, receipt, or borrower.
          </p>
          <button type="button" onClick={clearFilters} className="mt-4 rounded-xl bg-[#E11D48] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#be123c]">
            Clear filters
          </button>
        </div>
      </td>
    </tr>
  )

  const openConfirmModal = (payment) => {
    setConfirmTarget(payment)
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
      qs.delete('page')
      qs.delete('per_page')
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
    setConfirmingId(confirmTarget.id)
    try {
      const body = {
        status: 'paid',
        auto_mint_receipt_numbers: true,
      }
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

  const openManualModal = () => {
    setManualOpen(true)
    setManualLoans([])
    setManualForm({
      borrower_id: '',
      loan_id: '',
      payment_id: '',
      amount_paid: '',
      payment_date: new Date().toISOString().slice(0, 10),
      payment_method: 'cash',
      payment_type: 'partial',
      penalty_amount: '0',
      reference_number: '',
      official_receipt_number: '',
      acknowledgement_receipt_number: '',
      notes: '',
    })
  }

  const loadManualOptions = async (borrowerId) => {
    const id = String(borrowerId || '').trim()
    setManualLoans([])
    setManualForm((current) => ({ ...current, borrower_id: id, loan_id: '', payment_id: '', amount_paid: '' }))
    if (!id) return
    setManualLoading(true)
    try {
      const res = await api(`/payments/manual-options?borrower_id=${encodeURIComponent(id)}`)
      const loans = Array.isArray(res?.data) ? res.data : []
      setManualLoans(loans)
      const firstLoan = loans[0]
      const firstPayment = firstLoan?.payments?.[0]
      setManualForm((current) => ({
        ...current,
        borrower_id: id,
        loan_id: firstLoan?.id ? String(firstLoan.id) : '',
        payment_id: firstPayment?.id ? String(firstPayment.id) : '',
        amount_paid: firstPayment?.remaining_due != null ? String(Number(firstPayment.remaining_due)) : '',
      }))
    } catch (e) {
      showToast(e.message || 'Could not load active loans for this borrower.', 'error')
    } finally {
      setManualLoading(false)
    }
  }

  const selectedManualLoan = manualLoans.find((loan) => String(loan.id) === String(manualForm.loan_id))
  const selectedManualPayment = selectedManualLoan?.payments?.find((payment) => String(payment.id) === String(manualForm.payment_id))
  const selectedManualBorrower = borrowerOptions.find((borrower) => String(borrower.id) === String(manualForm.borrower_id))
  const manualRemaining = Number(selectedManualPayment?.remaining_due || 0)
  const manualNewRemaining = Math.max(manualRemaining - Number(manualForm.amount_paid || 0), 0)

  const changeManualLoan = (loanId) => {
    const loan = manualLoans.find((row) => String(row.id) === String(loanId))
    const payment = loan?.payments?.[0]
    setManualForm((current) => ({
      ...current,
      loan_id: String(loanId || ''),
      payment_id: payment?.id ? String(payment.id) : '',
      amount_paid: payment?.remaining_due != null ? String(Number(payment.remaining_due)) : '',
    }))
  }

  const changeManualPayment = (paymentId) => {
    const payment = selectedManualLoan?.payments?.find((row) => String(row.id) === String(paymentId))
    setManualForm((current) => ({
      ...current,
      payment_id: String(paymentId || ''),
      amount_paid: payment?.remaining_due != null ? String(Number(payment.remaining_due)) : current.amount_paid,
    }))
  }

  const submitManualPayment = async () => {
    const amount = Number(manualForm.amount_paid)
    if (!manualForm.borrower_id || !manualForm.loan_id || !manualForm.payment_id) {
      showToast('Select a borrower and active loan installment.', 'error')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Enter a valid payment amount.', 'error')
      return
    }
    if (amount - manualRemaining > 0.009) {
      showToast('Payment amount cannot exceed the selected installment balance.', 'error')
      return
    }
    setManualSaving(true)
    try {
      const res = await api(`/payments/${manualForm.payment_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          amount_paid: Number(selectedManualPayment?.amount_paid || 0) + amount,
          paid_at: manualForm.payment_date,
          payment_method: manualForm.payment_method,
          payment_type: manualForm.payment_type,
          penalty_amount: Number(manualForm.penalty_amount || 0),
          reference_number: manualForm.reference_number.trim(),
          external_ref: manualForm.reference_number.trim(),
          official_receipt_number: manualForm.official_receipt_number.trim(),
          acknowledgement_receipt_number: manualForm.acknowledgement_receipt_number.trim(),
          or_number: manualForm.official_receipt_number.trim(),
          ar_number: manualForm.acknowledgement_receipt_number.trim(),
          notes: manualForm.notes.trim(),
          source: 'manual',
          auto_mint_receipt_numbers: !manualForm.official_receipt_number.trim() && !manualForm.acknowledgement_receipt_number.trim(),
        }),
      })
      showToast('Payment successfully posted and receipt sent to borrower.', 'success')
      setManualOpen(false)
      setManualResult({
        payment: res?.payment || null,
        emailStatus: res?.last_payment_receipt_email?.status || (res?.receipt_email_sent ? 'queued' : ''),
      })
      await loadPaymentsSilent()
    } catch (e) {
      showToast(e.message || 'Manual payment could not be saved.', 'error')
    } finally {
      setManualSaving(false)
    }
  }

  const reversePayment = async (p) => {
    if (!p?.id) return
    const ok = window.confirm(`Reverse payment #${p.id}? This will reopen the installment and update borrower balances.`)
    if (!ok) return
    try {
      await api(`/payments/${p.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'pending' }),
      })
      showToast('Payment reversed and balances refreshed.', 'success')
      await loadPaymentsSilent()
    } catch (e) {
      showToast(e.message || 'Payment reversal failed.', 'error')
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={admin.pageTitle}>Payments &amp; collections</h1>
          <p className={admin.pageSubtitle}>Installments, OR/AR receipt control, and verification workflow.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('payments.manage') ? (
            <button
              type="button"
              onClick={openManualModal}
              className="shrink-0 rounded-lg bg-gradient-to-r from-[#E11D48] to-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-[#be123c] hover:to-red-700"
            >
              Manual Payment Entry
            </button>
          ) : null}
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
      </div>

      <div className="relative z-20 rounded-2xl border border-[#D8D8D8] bg-white/95 p-4 shadow-md">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
          <label className={filterFieldClass}>
            <span className={filterLabelClass}>Borrower account</span>
            <select
              value={borrowerFilter}
              onChange={(e) => setFilter(setBorrowerFilter)(e.target.value)}
              className={filterInputClass}
            >
              <option value="">All accounts</option>
              {borrowerOptions.map((borrower) => (
                <option key={borrower.id} value={borrower.id}>
                  {borrower.name}
                </option>
              ))}
            </select>
          </label>
          <label className={filterFieldClass}>
            <span className={filterLabelClass}>Filter borrower name</span>
            <input
              value={borrowerNameFilter}
              onChange={(e) => setFilter(setBorrowerNameFilter)(e.target.value)}
              placeholder="Name or email"
              className={filterInputClass}
            />
          </label>
          <label className={filterFieldClass}>
            <span className={filterLabelClass}>Filter loan number</span>
            <input
              value={loanNumberFilter}
              onChange={(e) => setFilter(setLoanNumberFilter)(e.target.value)}
              placeholder="LN-000006 or #6"
              className={filterInputClass}
            />
          </label>
          <label className={filterFieldClass}>
            <span className={filterLabelClass}>Search OR no.</span>
            <input
              value={orFilter}
              onChange={(e) => setFilter(setOrFilter)(e.target.value)}
              placeholder="Official receipt"
              className={`${filterInputClass} font-mono uppercase`}
            />
          </label>
          <label className={filterFieldClass}>
            <span className={filterLabelClass}>OR from</span>
            <input
              value={orFromFilter}
              onChange={(e) => setFilter(setOrFromFilter)(e.target.value)}
              placeholder="OR-2026-0001"
              className={`${filterInputClass} font-mono uppercase`}
            />
          </label>
          <label className={filterFieldClass}>
            <span className={filterLabelClass}>OR to</span>
            <input
              value={orToFilter}
              onChange={(e) => setFilter(setOrToFilter)(e.target.value)}
              placeholder="OR-2026-0099"
              className={`${filterInputClass} font-mono uppercase`}
            />
          </label>
          <label className={filterFieldClass}>
            <span className={filterLabelClass}>Search AR no.</span>
            <input
              value={arFilter}
              onChange={(e) => setFilter(setArFilter)(e.target.value)}
              placeholder="Acknowledgement receipt"
              className={`${filterInputClass} font-mono uppercase`}
            />
          </label>
          <label className={filterFieldClass}>
            <span className={filterLabelClass}>AR from</span>
            <input
              value={arFromFilter}
              onChange={(e) => setFilter(setArFromFilter)(e.target.value)}
              placeholder="AR-2026-0001"
              className={`${filterInputClass} font-mono uppercase`}
            />
          </label>
          <label className={filterFieldClass}>
            <span className={filterLabelClass}>AR to</span>
            <input
              value={arToFilter}
              onChange={(e) => setFilter(setArToFilter)(e.target.value)}
              placeholder="AR-2026-0099"
              className={`${filterInputClass} font-mono uppercase`}
            />
          </label>
          <label className={filterFieldClass}>
            <span className={filterLabelClass}>Payment status</span>
            <select
              value={apiStatus}
              onChange={(e) => setFilter(setApiStatus)(e.target.value)}
              className={filterInputClass}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="missing_or">Missing OR</option>
              <option value="missing_ar">Missing AR</option>
              <option value="missing_both">Missing Both</option>
            </select>
          </label>
          <label className={filterFieldClass}>
            <span className={filterLabelClass}>Workflow</span>
            <select
              value={workflow}
              onChange={(e) => setFilter(setWorkflow)(e.target.value)}
              className={filterInputClass}
            >
              <option value="">Any</option>
              <option value="verified">Verified</option>
              <option value="pending_verification">Pending Verification</option>
              <option value="missing_receipt">Missing Receipt</option>
              <option value="ledger">Read-only Ledger</option>
            </select>
          </label>
          <label className={filterFieldClass}>
            <span className={filterLabelClass}>Payment method</span>
            <select
              value={paymentMethod}
              onChange={(e) => setFilter(setPaymentMethod)(e.target.value)}
              className={filterInputClass}
            >
              <option value="">Any method</option>
              <option value="cash">Cash</option>
              <option value="gcash">GCash</option>
              <option value="maya">Maya</option>
              <option value="bank">Bank Transfer</option>
            </select>
          </label>
          <label className={filterFieldClass}>
            <span className={filterLabelClass}>Processor name</span>
            <input
              value={processorNameFilter}
              onChange={(e) => setFilter(setProcessorNameFilter)(e.target.value)}
              placeholder="Full name"
              className={filterInputClass}
            />
          </label>
          <label className={filterFieldClass}>
            <span className={filterLabelClass}>Processor role</span>
            <select
              value={processorRoleFilter}
              onChange={(e) => setFilter(setProcessorRoleFilter)(e.target.value)}
              className={filterInputClass}
            >
              <option value="">Any role</option>
              <option value="Admin">Admin</option>
              <option value="Collector">Collector</option>
              <option value="Loan Officer">Loan Officer</option>
              <option value="Accountant">Accountant</option>
            </select>
          </label>
        </div>
        <label className={`mt-4 flex cursor-pointer items-center gap-2 text-xs ${admin.textMuted}`}>
          <input
            type="checkbox"
            checked={showPaidInLoanFilter}
            onChange={(e) => setFilter(setShowPaidInLoanFilter)(e.target.checked)}
            className="rounded border-[#D8D8D8] text-[#E11D48] focus:ring-[#E11D48]"
          />
          When filtering by loan number, include paid installments (read-only ledger view)
        </label>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {activeFilterChips.length === 0 ? (
              <span className={`text-xs ${admin.textMuted}`}>No active filters. Showing latest payment records.</span>
            ) : (
              activeFilterChips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                >
                  {chip.label}
                  <button type="button" onClick={chip.remove} className="text-rose-500 hover:text-rose-800" aria-label={`Remove ${chip.label}`}>
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
          {activeFilterChips.length > 0 ? (
            <button type="button" onClick={clearFilters} className="self-start rounded-xl border border-[#D8D8D8] px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-[#F8F8F8] lg:self-auto">
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-[#D8D8D8] bg-[#F8F8F8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {loading ? 'Loading payments…' : `${pagination.total.toLocaleString()} result${pagination.total === 1 ? '' : 's'}`}
          </p>
          <p className={`text-xs ${admin.textMuted}`}>
            {pagination.total > 0 ? `Showing ${pagination.from}-${pagination.to} of ${pagination.total}` : 'Filters update automatically without reloading the page.'}
            {refreshing ? ' · Refreshing…' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={perPage}
            onChange={(e) => {
              setPage(1)
              setPerPage(Number(e.target.value))
            }}
            className="h-10 rounded-xl border border-[#D8D8D8] bg-white px-3 text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-[#E11D48]/20"
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
          <button
            type="button"
            onClick={() => void loadPayments({ silent: true })}
            className="h-10 rounded-xl border border-[#D8D8D8] bg-white px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
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
          <div className="rounded-2xl border border-[#D8D8D8] bg-[#F8F8F8] p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-2xl text-rose-600">₱</div>
            <h3 className="mt-4 text-base font-semibold text-gray-900">No matching payments were found</h3>
            <p className={`mt-2 text-sm ${admin.textMuted}`}>No matching payments were found for the current filters.</p>
            <button type="button" onClick={clearFilters} className="mt-4 rounded-xl bg-[#E11D48] px-4 py-2 text-sm font-semibold text-white">
              Clear filters
            </button>
          </div>
        ) : (
          filteredRows.map((p) => (
            <div key={p.id} className={`${admin.cardNoHover} space-y-2 p-4`}>
              {(() => {
                const actionable = isActionablePayment(p)
                const canConfirm = actionable && hasBorrowerPaymentEvidence(p)
                const badge = paymentStatusBadge(p)
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
                <span className={`rounded-full px-2 py-1 font-semibold ${badge.className}`}>{badge.label}</span>
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
              </p>
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-wide ${admin.textMuted}`}>Processed by</p>
                <div className="mt-1">
                  <ProcessorCell name={p.processedByName} role={p.processedByRole} />
                </div>
              </div>
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
              {actionable ? (
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
                {canAdjustFinal(p) && can('payments.adjust_final') ? (
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
                  View
                </button>
                {String(p.status || '').toLowerCase() === 'paid' && p.invoice_pdf_url ? (
                  <a
                    href={p.invoice_pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-200"
                  >
                    Print Receipt
                  </a>
                ) : null}
                {String(p.status || '').toLowerCase() === 'paid' && can('payments.override_locked') ? (
                  <button
                    type="button"
                    onClick={() => void reversePayment(p)}
                    className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-200"
                  >
                    Reverse Payment
                  </button>
                ) : null}
                {actionable && hasBorrowerPaymentEvidence(p) && can('payments.verify') ? (
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
      <div className="hidden max-h-[calc(100vh-12rem)] overflow-x-auto overflow-y-auto rounded-2xl border border-[#D8D8D8] bg-[#F8F8F8] shadow-md lg:block">
        <table className="min-w-[1500px] w-full border-collapse text-left text-sm text-gray-900">
          <thead className="sticky top-0 z-10 bg-[#F3F4F6] text-[11px] uppercase tracking-wider text-gray-500 shadow-sm">
            <tr>
              {renderSortableHeader('borrower', 'Borrower')}
              {renderSortableHeader('loan', 'Loan')}
              {renderSortableHeader('due_date', 'Due Date')}
              {renderSortableHeader('due_amount', 'Due Amount', 'text-right')}
              {renderSortableHeader('remaining', 'Remaining Balance', 'text-right')}
              {renderSortableHeader('paid_amount', 'Paid Amount', 'text-right')}
              {renderSortableHeader('status', 'Status')}
              {renderSortableHeader('or_number', 'OR Number')}
              {renderSortableHeader('ar_number', 'AR Number')}
              <th className={admin.tableCell}>Officer</th>
              <th className={admin.tableCell}>Processed By</th>
              <th className={admin.tableCell}>Verification</th>
              <th className={admin.tableCell}>Receipt Email</th>
              <th className={`${admin.tableCell} sticky right-0 bg-[#F3F4F6]`}>Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {loading ? (
              <TableSkeletonRows cols={14} rows={6} />
            ) : filteredRows.length === 0 ? (
              renderEmptyPaymentsState(14)
            ) : (
              filteredRows.map((p) => {
                const actionable = isActionablePayment(p)
                const canConfirm = actionable && hasBorrowerPaymentEvidence(p)
                const badge = paymentStatusBadge(p)
                const remaining = Number(p.amount_due || 0) - Number(p.amount_paid || 0)
                return (
                  <tr key={p.id} className="border-b border-gray-100 transition-colors duration-150 hover:bg-[#FAFAFA]">
                    <td className={`${admin.tableCell} min-w-[13rem]`}>
                      <p className="font-semibold text-gray-900">{p.borrowerName}</p>
                      <p className={`text-xs ${admin.textMuted}`}>{p.borrowerEmail || 'No email'}</p>
                    </td>
                    <td className={`${admin.tableCell} whitespace-nowrap`}>
                      <p className="font-semibold">#{paymentLoanId(p) || '—'}</p>
                      <p className={`text-xs ${admin.textMuted}`}>{p.loanNumber || '—'} · Inst. {p.installment_no}</p>
                    </td>
                    <td className={`${admin.tableCell} whitespace-nowrap`}>{formatDueDate(p.due_date)}</td>
                    <td className={`${admin.tableCell} whitespace-nowrap text-right font-semibold`}>{formatPeso(p.amount_due)}</td>
                    <td className={`${admin.tableCell} whitespace-nowrap text-right`}>{formatPeso(Math.max(remaining, 0))}</td>
                    <td className={`${admin.tableCell} whitespace-nowrap text-right`}>{formatPeso(p.amount_paid)}</td>
                    <td className={`${admin.tableCell} whitespace-nowrap`}>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
                    </td>
                    <td className={`${admin.tableCell} max-w-[9rem] truncate font-mono text-xs`} title={p.orNumber || ''}>{p.orNumber || '—'}</td>
                    <td className={`${admin.tableCell} max-w-[9rem] truncate font-mono text-xs`} title={p.arNumber || ''}>{p.arNumber || '—'}</td>
                    <td className={`${admin.tableCell} max-w-[9rem] truncate text-xs`}>{p.officerName}</td>
                    <td className={`${admin.tableCell} min-w-[13rem] text-xs`}>
                      <ProcessorCell name={p.processedByName} role={p.processedByRole} />
                    </td>
                    <td className={`${admin.tableCell} whitespace-nowrap text-xs`}>
                      {p.verified_by_name ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-700">Verified</span>
                      ) : (
                        <span className="rounded-full bg-yellow-100 px-2 py-1 font-semibold text-yellow-700">Pending</span>
                      )}
                    </td>
                    <td className={`${admin.tableCell} align-top text-xs`}>
                      <ReceiptEmailCell payment={p} />
                    </td>
                    <td className={`${admin.tableCell} sticky right-0 bg-white shadow-[-8px_0_12px_-14px_rgba(15,23,42,0.45)]`}>
                      <div className="flex min-w-[9rem] flex-col gap-1">
                        {actionable ? (
                          <button
                            type="button"
                            onClick={() => openConfirmModal(p)}
                            disabled={confirmingId === p.id || !canConfirm}
                            className="rounded-xl bg-[#E11D48] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#be123c] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {confirmingId === p.id ? 'Confirming…' : 'Confirm'}
                          </button>
                        ) : null}
                        {actionable && hasBorrowerPaymentEvidence(p) && can('payments.verify') ? (
                          <button type="button" onClick={() => void verifyPaymentRow(p)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                            Verify
                          </button>
                        ) : null}
                        <button type="button" onClick={() => openReceiptEditModal(p)} disabled={p.is_receipt_locked && !can('payments.override_locked')} className="rounded-xl border border-[#D8D8D8] bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50">
                          OR / AR
                        </button>
                        <button type="button" onClick={() => void openReceiptAuditModal(p)} className="rounded-xl border border-[#D8D8D8] bg-white px-3 py-1.5 text-xs font-semibold text-gray-700">
                          View
                        </button>
                        {String(p.status || '').toLowerCase() === 'paid' && p.invoice_pdf_url ? (
                          <a
                            href={p.invoice_pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-center text-xs font-semibold text-rose-700"
                          >
                            Print Receipt
                          </a>
                        ) : null}
                        {String(p.status || '').toLowerCase() === 'paid' && can('payments.override_locked') ? (
                          <button type="button" onClick={() => void reversePayment(p)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                            Reverse Payment
                          </button>
                        ) : null}
                        {canAdjustFinal(p) && can('payments.adjust_final') ? (
                          <button type="button" onClick={() => openAdjustPanel(p)} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                            Adjust final
                          </button>
                        ) : null}
                        <button type="button" onClick={() => void openAuditModal(p)} className="rounded-xl border border-[#D8D8D8] bg-white px-3 py-1.5 text-xs font-semibold text-gray-700">
                          Final audit
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-[#D8D8D8] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className={`text-sm ${admin.textMuted}`}>
          {pagination.total > 0
            ? `Page ${pagination.currentPage} of ${pagination.lastPage} · ${pagination.total.toLocaleString()} payments`
            : 'No records to paginate'}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pagination.currentPage <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className={admin.paginationBtn}
          >
            Previous
          </button>
          <button
            type="button"
            disabled={pagination.currentPage >= pagination.lastPage || loading}
            onClick={() => setPage((current) => Math.min(pagination.lastPage, current + 1))}
            className={admin.paginationBtn}
          >
            Next
          </button>
        </div>
      </div>

      {manualOpen ? (
        <div
          className={admin.modalOverlay}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !manualSaving) setManualOpen(false)
          }}
        >
          <div
            className={`${admin.modalCard} max-w-3xl`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-payment-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 id="manual-payment-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Manual Payment Entry
                </h3>
                <p className={`mt-1 text-sm ${admin.textMuted}`}>
                  Encode a staff-processed payment directly to the borrower ledger. The authenticated user is saved as the processor.
                </p>
              </div>
              {selectedManualBorrower ? (
                <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                  {selectedManualBorrower.name}
                </span>
              ) : null}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className={`text-xs font-medium ${admin.textMuted}`}>Borrower</span>
                <select
                  value={manualForm.borrower_id}
                  onChange={(e) => void loadManualOptions(e.target.value)}
                  className={`mt-1 w-full ${admin.input}`}
                  disabled={manualSaving}
                >
                  <option value="">Select borrower</option>
                  {borrowerOptions.map((borrower) => (
                    <option key={borrower.id} value={borrower.id}>
                      {borrower.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={`text-xs font-medium ${admin.textMuted}`}>Active loan</span>
                <select
                  value={manualForm.loan_id}
                  onChange={(e) => changeManualLoan(e.target.value)}
                  className={`mt-1 w-full ${admin.input}`}
                  disabled={manualLoading || manualSaving || manualLoans.length === 0}
                >
                  <option value="">{manualLoading ? 'Loading loans...' : 'Select active loan'}</option>
                  {manualLoans.map((loan) => (
                    <option key={loan.id} value={loan.id}>
                      {loan.loan_number || `LN-${String(loan.id).padStart(6, '0')}`} · {roleLabel(loan.status)} · Outstanding {formatPeso(loan.outstanding_balance)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={`text-xs font-medium ${admin.textMuted}`}>Installment</span>
                <select
                  value={manualForm.payment_id}
                  onChange={(e) => changeManualPayment(e.target.value)}
                  className={`mt-1 w-full ${admin.input}`}
                  disabled={!selectedManualLoan || manualSaving}
                >
                  <option value="">Select installment</option>
                  {(selectedManualLoan?.payments || []).map((payment) => (
                    <option key={payment.id} value={payment.id}>
                      Inst. {payment.installment_no} · Due {formatDueDate(payment.due_date)} · Balance {formatPeso(payment.remaining_due)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={`text-xs font-medium ${admin.textMuted}`}>Payment amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualForm.amount_paid}
                  onChange={(e) => setManualForm((current) => ({ ...current, amount_paid: e.target.value }))}
                  className={`mt-1 w-full ${admin.input}`}
                  disabled={manualSaving}
                />
                {selectedManualPayment ? (
                  <span className={`mt-1 block text-[11px] ${admin.textMuted}`}>
                    Remaining after save: {formatPeso(manualNewRemaining)}
                  </span>
                ) : null}
              </label>

              <label className="block">
                <span className={`text-xs font-medium ${admin.textMuted}`}>Payment date</span>
                <input
                  type="date"
                  value={manualForm.payment_date}
                  onChange={(e) => setManualForm((current) => ({ ...current, payment_date: e.target.value }))}
                  className={`mt-1 w-full ${admin.input}`}
                  disabled={manualSaving}
                />
              </label>

              <label className="block">
                <span className={`text-xs font-medium ${admin.textMuted}`}>Payment method</span>
                <select
                  value={manualForm.payment_method}
                  onChange={(e) => setManualForm((current) => ({ ...current, payment_method: e.target.value }))}
                  className={`mt-1 w-full ${admin.input}`}
                  disabled={manualSaving}
                >
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </label>

              <label className="block">
                <span className={`text-xs font-medium ${admin.textMuted}`}>Payment type</span>
                <select
                  value={manualForm.payment_type}
                  onChange={(e) => setManualForm((current) => ({ ...current, payment_type: e.target.value }))}
                  className={`mt-1 w-full ${admin.input}`}
                  disabled={manualSaving}
                >
                  <option value="partial">Partial</option>
                  <option value="full">Full</option>
                  <option value="advance">Advance</option>
                </select>
              </label>

              <label className="block">
                <span className={`text-xs font-medium ${admin.textMuted}`}>Penalty amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualForm.penalty_amount}
                  onChange={(e) => setManualForm((current) => ({ ...current, penalty_amount: e.target.value }))}
                  className={`mt-1 w-full ${admin.input}`}
                  disabled={manualSaving}
                />
              </label>

              <label className="block md:col-span-2">
                <span className={`text-xs font-medium ${admin.textMuted}`}>Reference number</span>
                <input
                  value={manualForm.reference_number}
                  onChange={(e) => setManualForm((current) => ({ ...current, reference_number: e.target.value }))}
                  placeholder="Receipt, GCash, bank trace, or internal reference"
                  className={`mt-1 w-full ${admin.input}`}
                  disabled={manualSaving}
                />
              </label>

              <div className="md:col-span-2 rounded-2xl border border-rose-100 bg-rose-50/60 p-4 dark:border-rose-500/20 dark:bg-rose-950/10">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-200">
                  Receipt Numbers
                </p>
                <p className={`mt-1 text-xs ${admin.textMuted}`}>
                  Enter official OR/AR numbers manually. The system prevents duplicates across existing payments.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className={`text-xs font-medium ${admin.textMuted}`}>Official Receipt Number</span>
                    <input
                      value={manualForm.official_receipt_number}
                      onChange={(e) => setManualForm((current) => ({ ...current, official_receipt_number: e.target.value.toUpperCase() }))}
                      placeholder="OR-2026-0001"
                      className={`mt-1 w-full font-mono uppercase ${admin.input}`}
                      disabled={manualSaving}
                    />
                  </label>
                  <label className="block">
                    <span className={`text-xs font-medium ${admin.textMuted}`}>Acknowledgement Receipt Number</span>
                    <input
                      value={manualForm.acknowledgement_receipt_number}
                      onChange={(e) => setManualForm((current) => ({ ...current, acknowledgement_receipt_number: e.target.value.toUpperCase() }))}
                      placeholder="AR-2026-0001"
                      className={`mt-1 w-full font-mono uppercase ${admin.input}`}
                      disabled={manualSaving}
                    />
                  </label>
                </div>
              </div>

              <label className="block md:col-span-2">
                <span className={`text-xs font-medium ${admin.textMuted}`}>Remarks</span>
                <textarea
                  rows={3}
                  value={manualForm.notes}
                  onChange={(e) => setManualForm((current) => ({ ...current, notes: e.target.value }))}
                  className={`mt-1 w-full ${admin.input}`}
                  placeholder="Optional notes for audit and borrower statement context"
                  disabled={manualSaving}
                />
              </label>
            </div>

            {manualForm.borrower_id && !manualLoading && manualLoans.length === 0 ? (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                This borrower has no active unpaid loan installments available for manual encoding.
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className={admin.btnSecondary} onClick={() => setManualOpen(false)} disabled={manualSaving}>
                Cancel
              </button>
              <button type="button" className={admin.btnPrimary} onClick={() => void submitManualPayment()} disabled={manualSaving || manualLoading}>
                {manualSaving ? 'Saving...' : 'Save Manual Payment'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {manualResult ? (
        <div className={admin.modalOverlay} role="presentation">
          <div className={admin.modalCard} role="dialog" aria-modal="true" aria-labelledby="manual-payment-success-title">
            <h3 id="manual-payment-success-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Payment posted
            </h3>
            <p className={`mt-2 text-sm ${admin.textMuted}`}>
              Payment successfully posted and receipt sent to borrower.
            </p>
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-900 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-100">
              <p>
                <span className="font-medium">OR:</span>{' '}
                <span className="font-mono">{manualResult.payment?.official_receipt_number || '—'}</span>
              </p>
              <p>
                <span className="font-medium">AR:</span>{' '}
                <span className="font-mono">{manualResult.payment?.acknowledgement_receipt_number || '—'}</span>
              </p>
              <p>
                <span className="font-medium">Email:</span> {formatReceiptEmailStatus(manualResult.emailStatus)}
              </p>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {getOfficialReceiptPublicUrl(manualResult.payment) ? (
                <>
                  <a
                    href={getOfficialReceiptPublicUrl(manualResult.payment)}
                    target="_blank"
                    rel="noreferrer"
                    className={admin.btnSecondary}
                  >
                    View Receipt
                  </a>
                  <a
                    href={getOfficialReceiptPublicUrl(manualResult.payment)}
                    download
                    className={admin.btnSecondary}
                  >
                    Download PDF
                  </a>
                  <button
                    type="button"
                    className={admin.btnSecondary}
                    onClick={() => {
                      const win = window.open(getOfficialReceiptPublicUrl(manualResult.payment), '_blank', 'noopener,noreferrer')
                      if (win) {
                        win.addEventListener('load', () => {
                          try {
                            win.print()
                          } catch {
                            // Browser print restrictions are handled by opening the PDF tab.
                          }
                        })
                      }
                    }}
                  >
                    Print Receipt
                  </button>
                </>
              ) : null}
              <button type="button" className={admin.btnPrimary} onClick={() => setManualResult(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
