import { useEffect, useState } from 'react'
import { getLaravelStorageFileUrl } from '../../utils/lendingLaravelApi.js'
import { borrowerApi } from '../api/client.js'
import { escapeHtmlForReceipt, formatDate, formatPeso, paymentStatusBadge } from '../utils/formatters.js'
import { corporatePrintHeaderBlock } from '../../utils/corporatePrintHeaderHtml.js'
import { useBorrowerAuth } from '../context/useBorrowerAuth.js'
import { admin as ui } from '../../admin/components/AdminUi.jsx'
import { SkeletonLine } from '../../components/AppSkeletons.jsx'

function invoiceNumber(payment) {
  return `INV-${String(payment?.id || '').padStart(6, '0')}`
}

function paymentReference(payment) {
  return payment?.reference_number || payment?.reference_no || `PAY-${payment?.id || 'N/A'}`
}

function borrowerDisplayName(payment, user) {
  return (
    payment?.borrower_name ||
    payment?.borrower?.name ||
    user?.name ||
    user?.full_name ||
    'Borrower'
  )
}

function buildInvoiceHtml(payment, user) {
  const invNo = invoiceNumber(payment)
  const paidDate = formatDate(payment?.paid_at || payment?.due_date)
  const amountPaid = formatPeso(payment?.amount_paid || 0)
  const dueAmount = formatPeso(payment?.amount_due || 0)
  const penalty = formatPeso(payment?.penalty_amount || 0)
  const ref = paymentReference(payment)
  const name = borrowerDisplayName(payment, user)
  const email = user?.email || payment?.borrower_email || 'N/A'
  const orNo = String(payment?.official_receipt_number ?? '').trim()
  const arNo = String(payment?.acknowledgement_receipt_number ?? '').trim()
  const brandLogoUrl =
    typeof window !== 'undefined'
      ? new URL('/amalgated-lending-logo.png', window.location.origin).toString()
      : '/amalgated-lending-logo.png'

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${invNo}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4; margin: 14mm; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; padding: 28px; color: #0f172a; background: #ffffff; }
    .wrap { max-width: 820px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 14px; padding: 24px; }
    .topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding-bottom: 14px; border-bottom: 1px solid #e5e7eb; margin-top: 4px; }
    .invmeta { text-align: right; }
    .invmeta .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
    .invmeta .value { margin-top: 2px; font-size: 15px; font-weight: 800; }
    .badge { display: inline-flex; align-items: center; justify-content: center; margin-top: 8px; padding: 5px 10px; border-radius: 999px; border: 1px solid #fecaca; background: #fff1f2; color: #b91c1c; font-size: 11px; font-weight: 700; }
    .section { margin-top: 16px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; background: #ffffff; }
    .card h2 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.10em; color: #64748b; }
    .row { display: flex; justify-content: space-between; gap: 10px; margin: 6px 0; font-size: 13px; }
    .row strong { color: #0f172a; }
    .muted { color: #64748b; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 12px; overflow: hidden; border: 1px solid #e5e7eb; border-radius: 12px; }
    th, td { padding: 11px 12px; font-size: 13px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f8fafc; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
    tr:last-child td { border-bottom: 0; }
    td.amount { text-align: right; font-variant-numeric: tabular-nums; }
    .totals { margin-top: 14px; display: grid; grid-template-columns: 1fr; gap: 8px; }
    .totalrow { display: flex; justify-content: space-between; gap: 10px; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 12px; background: #f8fafc; }
    .totalrow .k { color: #475569; font-weight: 700; }
    .totalrow .v { font-weight: 900; }
    .footer { margin-top: 18px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; gap: 12px; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    @media print {
      body { padding: 0; }
      .wrap { border: 0; border-radius: 0; padding: 0; }
      .badge { border-color: #fecaca; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    ${corporatePrintHeaderBlock(brandLogoUrl, 46)}
    <div class="topbar">
      <div style="min-width:0">
        <p style="margin:0;font-size:12px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.06em">Payment invoice / receipt</p>
      </div>
      <div class="invmeta">
        <div class="label">Invoice</div>
        <div class="value mono">${invNo}</div>
        <div class="badge">PAID</div>
      </div>
    </div>

    <div class="section grid">
      <div class="card">
        <h2>Bill to</h2>
        <div class="row"><strong>Borrower</strong><span>${name}</span></div>
        <div class="row"><strong>Email</strong><span class="mono">${email}</span></div>
      </div>
      <div class="card">
        <h2>Payment details</h2>
        <div class="row"><strong>Payment date</strong><span>${paidDate}</span></div>
        <div class="row"><strong>Reference</strong><span class="mono">${ref}</span></div>
        <div class="row"><strong>OR No.</strong><span class="mono">${escapeHtmlForReceipt(orNo || '—')}</span></div>
        <div class="row"><strong>AR No.</strong><span class="mono">${escapeHtmlForReceipt(arNo || '—')}</span></div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Installment due</td><td class="amount">${dueAmount}</td></tr>
        <tr><td>Penalty</td><td class="amount">${penalty}</td></tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="totalrow">
        <span class="k">Amount paid</span>
        <span class="v">${amountPaid}</span>
      </div>
    </div>

    <div class="footer">
      <span>This is a system-generated invoice/receipt.</span>
      <span class="mono">Ref: ${ref}</span>
    </div>
  </div>
</body>
</html>`
}

function officialPdfHref(payment) {
  const u = payment?.official_receipt_pdf_url
  if (u && String(u).trim()) return String(u).trim()
  if (payment?.invoice_pdf_path) return getLaravelStorageFileUrl(payment.invoice_pdf_path)
  return ''
}

function receiptEmailStatusLabel(status) {
  if (status == null || status === '') return ''
  const s = String(status).toLowerCase()
  const map = { queued: 'Confirmation email queued', sent: 'Confirmation email sent', failed: 'Email failed' }
  return map[s] || `Email: ${status}`
}

function downloadInvoiceFile(payment, user) {
  const html = buildInvoiceHtml(payment, user)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${invoiceNumber(payment)}.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function BorrowerPaymentsPage() {
  const { user } = useBorrowerAuth()
  const [tab, setTab] = useState('pending')
  const [pendingRows, setPendingRows] = useState([])
  const [historyRows, setHistoryRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const [pendingRes, historyRes] = await Promise.all([
          borrowerApi('/borrower/payments'),
          borrowerApi('/borrower/payments/history'),
        ])
        if (!mounted) return
        setPendingRows(pendingRes?.data?.data || [])
        setHistoryRows(historyRes?.data?.data || [])
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load payments.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Payments</h2>
        <div className="rounded-lg border border-gray-200 bg-gray-100 p-1 text-xs dark:border-[#1F2937] dark:bg-[#0F172A]">
          <button
            type="button"
            onClick={() => setTab('pending')}
            className={`rounded-md px-3 py-1.5 transition-colors duration-300 ${tab === 'pending' ? 'bg-red-600 text-white' : `${ui.textMuted}`}`}
          >
            Pending
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`rounded-md px-3 py-1.5 transition-colors duration-300 ${tab === 'history' ? 'bg-red-600 text-white' : `${ui.textMuted}`}`}
          >
            History
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">
          <SkeletonLine className="h-4 w-40" />
          <div className={`${ui.tableScroll}`}>
            <table className={`${ui.tableBase} ${ui.tableMin720}`}>
              <tbody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className={ui.tbodyRow}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className={ui.tableCell}>
                        <SkeletonLine className="h-3 w-full max-w-[7rem]" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>
      ) : null}
      {!loading && !error && tab === 'pending' && (
        <>
          <div className="mt-4 space-y-3 md:hidden">
            {pendingRows.length ? (
              pendingRows.map((p) => (
                <div key={p.id} className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-[#1F2937] dark:bg-[#0F172A]/50">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatDate(p.due_date)}</p>
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
                </div>
              ))
            ) : (
              <p className={`rounded-xl border border-dashed border-gray-300 px-3 py-6 text-center text-sm ${ui.textMuted} dark:border-gray-600`}>
                No pending payments.
              </p>
            )}
          </div>
          <div className={`${ui.tableScroll} mt-4 hidden md:block`}>
            <table className={`${ui.tableBase} ${ui.tableText} ${ui.tableMin720}`}>
              <thead>
                <tr className={ui.thead}>
                  <th className={`${ui.tableCell} text-left`}>Due date</th>
                  <th className={`${ui.tableCell} text-left`}>Amount due</th>
                  <th className={`${ui.tableCell} text-left`}>Amount paid</th>
                  <th className={`${ui.tableCell} text-left`}>Penalty</th>
                  <th className={`${ui.tableCell} text-left`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingRows.map((p) => (
                  <tr key={p.id} className={ui.tbodyRow}>
                    <td className={ui.tableCell}>{formatDate(p.due_date)}</td>
                    <td className={ui.tableCell}>{formatPeso(p.amount_due)}</td>
                    <td className={ui.tableCell}>{formatPeso(p.amount_paid)}</td>
                    <td className={ui.tableCell}>{formatPeso(p.penalty_amount)}</td>
                    <td className={ui.tableCell}>
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs ring-1 ${paymentStatusBadge(p.status)}`}>
                        {String(p.status || '').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
                {!pendingRows.length ? (
                  <tr>
                    <td colSpan={5} className={`${ui.tableCell} py-8 text-center ${ui.textMuted}`}>
                      No pending payments.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && !error && tab === 'history' && (
        <div className={`${ui.tableScroll} mt-4`}>
          <table className={`${ui.tableBase} ${ui.tableText} ${ui.tableMin640}`}>
            <thead>
              <tr className={ui.thead}>
                <th className={`${ui.tableCell} text-left`}>Date paid</th>
                <th className={`${ui.tableCell} text-left`}>Amount</th>
                <th className={`${ui.tableCell} text-left`}>Reference</th>
                <th className={`${ui.tableCell} text-left`}>Proof</th>
                <th className={`${ui.tableCell} text-left`}>Official PDF</th>
                <th className={`${ui.tableCell} text-left`}>Email status</th>
                <th className={`${ui.tableCell} text-left`}>Invoice (HTML)</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map((p) => (
                <tr key={p.id} className={ui.tbodyRow}>
                  <td className={ui.tableCell}>{formatDate(p.paid_at || p.due_date)}</td>
                  <td className={ui.tableCell}>{formatPeso(p.amount_paid)}</td>
                  <td className={ui.tableCell}>{p.reference_number || '-'}</td>
                  <td className={ui.tableCell}>
                    {p.receipt_path ? (
                      <a
                        href={getLaravelStorageFileUrl(p.receipt_path)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-red-600 underline dark:text-red-400"
                      >
                        View proof
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className={ui.tableCell}>
                    {officialPdfHref(p) ? (
                      <a
                        href={officialPdfHref(p)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-red-600 underline dark:text-red-400"
                      >
                        Download PDF
                      </a>
                    ) : (
                      <span className={`text-xs ${ui.textMuted}`}>—</span>
                    )}
                  </td>
                  <td className={`${ui.tableCell} text-xs ${ui.textMuted}`}>
                    {receiptEmailStatusLabel(p.receipt_email_status) || '—'}
                  </td>
                  <td className={ui.tableCell}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => downloadInvoiceFile(p, user)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-[#374151] dark:text-gray-200 dark:hover:bg-white/10"
                      >
                        Download HTML
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!historyRows.length ? (
                <tr>
                  <td colSpan={7} className={`${ui.tableCell} py-8 text-center ${ui.textMuted}`}>
                    No completed payments yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
