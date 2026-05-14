export function formatPeso(value) {
  const n = Number(value || 0)
  return `PHP ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export function paymentStatusBadge(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'paid') {
    return 'bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-green-500/15 dark:text-green-300 dark:ring-green-500/30'
  }
  if (s === 'overdue') {
    return 'bg-red-100 text-red-800 ring-red-300 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30'
  }
  return 'bg-amber-100 text-amber-900 ring-amber-300 dark:bg-yellow-500/15 dark:text-yellow-300 dark:ring-yellow-500/30'
}

export function dueCountdownLabel(dueDate) {
  if (!dueDate) return '-'
  const due = new Date(dueDate)
  const now = new Date()
  const msPerDay = 24 * 60 * 60 * 1000
  const delta = Math.ceil((due.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / msPerDay)
  if (delta < 0) return `Overdue by ${Math.abs(delta)} day(s)`
  return `${delta} day(s) left`
}

/** Escape text embedded in static receipt / invoice HTML. */
export function escapeHtmlForReceipt(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * OR/AR lines for borrower payment invoice HTML (matches staff-assigned OR/AR on the payment).
 * @param {Record<string, unknown>} payment
 */
export function paymentOrArInvoiceSnippetHtml(payment) {
  const or = String(payment?.official_receipt_number ?? '').trim()
  const ar = String(payment?.acknowledgement_receipt_number ?? '').trim()
  const e = escapeHtmlForReceipt
  return `<p class="muted" style="margin:6px 0 0"><strong>OR No.:</strong> ${or ? e(or) : e('—')}</p>
<p class="muted" style="margin:4px 0 16px"><strong>AR No.:</strong> ${ar ? e(ar) : e('—')}</p>`
}
