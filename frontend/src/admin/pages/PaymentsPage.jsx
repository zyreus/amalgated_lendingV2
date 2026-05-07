import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { admin, TableSkeletonRows, EmptyTableRow } from '../components/AdminUi.jsx'
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
  const [searchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [borrowersData, setBorrowersData] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmingId, setConfirmingId] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [borrowerFilter, setBorrowerFilter] = useState('')
  const [borrowerNameFilter, setBorrowerNameFilter] = useState('')
  const [loanNumberFilter, setLoanNumberFilter] = useState('')
  const [loanSearchDebounced, setLoanSearchDebounced] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => {
      setLoanSearchDebounced(loanNumberFilter.trim())
    }, 350)
    return () => window.clearTimeout(t)
  }, [loanNumberFilter])

  const loadBorrowers = async () => {
    try {
      const borrowersRes = await api('/borrowers?per_page=500')
      setBorrowersData(borrowersRes?.data?.data || [])
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const loadPayments = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ per_page: '200' })
      if (loanSearchDebounced) qs.set('loan_search', loanSearchDebounced)
      const paymentsRes = await api(`/payments?${qs.toString()}`)
      setData(paymentsRes.data)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadBorrowers()
  }, [])

  useEffect(() => {
    const q = (searchParams.get('loan_search') || searchParams.get('loan') || '').trim()
    if (q) setLoanNumberFilter(q)
  }, [searchParams])

  useEffect(() => {
    void loadPayments()
  }, [loanSearchDebounced])

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
        p?.email ||
        matchedBorrower?.email ||
        ''
      return {
        ...p,
        borrowerName: String(borrowerName || '—'),
        loanNumber: String(loanNumber || ''),
        borrowerEmail: String(borrowerEmail || ''),
        paymentRef: getPaymentReference(p),
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
      next = next.filter((p) => paymentMatchesLoanSearch(p, loanQ) && hasOutstandingBalance(p))
    }

    return next
  }, [rows, borrowerFilter, borrowerNameFilter, loanNumberFilter])

  const openConfirmModal = (payment) => {
    setConfirmTarget(payment)
  }

  const confirmPayment = async () => {
    if (!confirmTarget?.id) return
    if (!hasBorrowerPaymentEvidence(confirmTarget)) {
      showToast('Borrower must submit payment first before confirmation.', 'error')
      return
    }
    setConfirmingId(confirmTarget.id)
    try {
      const res = await api(`/payments/${confirmTarget.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'paid' }),
      })
      if (res.receipt_email_sent) {
        showToast('Payment confirmed. Receipt email sent to the borrower.', 'success')
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
      await loadPayments()
    } catch (e) {
      showToast(e.message || 'Failed to confirm payment.', 'error')
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <h1 className={admin.pageTitle}>Payments &amp; collections</h1>
        <p className={admin.pageSubtitle}>Installments and recorded payments.</p>
      </div>

      <div className={`${admin.cardNoHover} p-4`}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
        </div>
        {borrowerFilter ? (
          <p className={`mt-2 text-xs ${admin.textMuted}`}>
            Showing pending payments for <span className="font-semibold">{borrowerFilter}</span>.
          </p>
        ) : null}
        {loanNumberFilter.trim() ? (
          <p className={`mt-2 text-xs ${admin.textMuted}`}>
            Showing unpaid installments (due balance) for loans matching{' '}
            <span className="font-mono font-semibold">{loanNumberFilter.trim()}</span>.
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
              {p.receipt_path || getReceiptPublicUrl(p) ? (
                <div className="mt-2">
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${admin.textMuted}`}>Payment proof</p>
                  <div className="mt-1">
                    <ProofCell payment={p} />
                  </div>
                </div>
              ) : null}
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
                  </>
                )
              })()}
            </div>
          ))
        )}
      </div>

      {/* Desktop table (lg+) */}
      <div className={`hidden lg:block ${admin.tableWrap}`}>
        <table className={`${admin.tableBase} ${admin.tableText} ${admin.tableMin900}`}>
          <thead>
            <tr className={admin.thead}>
              <th className={admin.tableCell}>Borrower account</th>
              <th className={admin.tableCell}>Loan</th>
              <th className={admin.tableCell}>#</th>
              <th className={admin.tableCell}>Due</th>
              <th className={admin.tableCell}>Due amount</th>
              <th className={admin.tableCell}>Paid</th>
              <th className={admin.tableCell}>Status</th>
              <th className={admin.tableCell}>Reference</th>
              <th className={admin.tableCell}>Proof</th>
              <th className={admin.tableCell}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeletonRows cols={10} rows={5} />
            ) : filteredRows.length === 0 ? (
              <EmptyTableRow colSpan={10} message="No payments found." />
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
                  <td className={`${admin.tableCell} whitespace-nowrap`}>₱{Number(p.amount_paid || 0).toLocaleString()}</td>
                  <td className={`${admin.tableCell} capitalize whitespace-nowrap`}>{p.status}</td>
                  <td className={`${admin.tableCell} max-w-[12rem] break-words font-mono text-xs`}>
                    {p.paymentRef || '—'}
                  </td>
                  <td className={`${admin.tableCell} align-middle`}>
                    <ProofCell payment={p} />
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
    </div>
  )
}
