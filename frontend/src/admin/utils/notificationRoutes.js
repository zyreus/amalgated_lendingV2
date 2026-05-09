/**
 * Deep-link target for admin notification list items (matches Laravel AdminNotification `type` + `data`).
 * @param {{ type?: string, data?: Record<string, unknown> | null }} | null | undefined} n
 * @returns {string | null} In-app path, or null when unknown / no target
 */
export function getAdminNotificationHref(n) {
  if (!n || typeof n !== 'object') return null
  const type = String(n.type || '').trim()
  const raw = n.data
  const d = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const loanId = d.loan_id ?? d.loanId
  const borrowerId = d.borrower_id ?? d.borrowerId
  const paymentId = d.payment_id ?? d.paymentId

  if (type === 'borrower_payment_submitted' || type === 'payment_uploaded') {
    if (loanId != null && String(loanId).trim() !== '') {
      return `/admin/payments?loan_search=${encodeURIComponent(String(loanId).trim())}`
    }
    if (borrowerId != null && String(borrowerId).trim() !== '') {
      return `/admin/borrowers/${String(borrowerId).trim()}`
    }
    return '/admin/payments'
  }

  if (type === 'loan_submitted' || type === 'loan_application_submitted') {
    if (loanId != null && String(loanId).trim() !== '') {
      return `/admin/loans/${String(loanId).trim()}`
    }
    return '/admin/loans'
  }

  if (type === 'loan_approved' || type === 'loan_rejected' || type === 'loan_application_approved' || type === 'loan_application_rejected') {
    if (loanId != null && String(loanId).trim() !== '') return `/admin/loans/${String(loanId).trim()}`
    return '/admin/loans'
  }

  if (type === 'document_uploaded' || type === 'document_verification') {
    if (borrowerId != null && String(borrowerId).trim() !== '') {
      return `/admin/borrowers/${String(borrowerId).trim()}`
    }
    return '/admin/borrowers'
  }

  if (type === 'feedback_submitted' || type === 'crm_customer_inquiry' || type === 'support_ticket_update') {
    return '/admin/chat-crm'
  }

  if (type === 'overdue_alert' || type === 'payment_overdue') {
    return '/admin/payments?status=overdue'
  }

  if (paymentId != null && String(paymentId).trim() !== '') {
    return `/admin/payments?payment_id=${encodeURIComponent(String(paymentId).trim())}`
  }

  return null
}
