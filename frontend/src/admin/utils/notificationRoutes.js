function value(...items) {
  for (const item of items) {
    if (item != null && String(item).trim() !== '') return String(item).trim()
  }
  return ''
}

function paramsFor(n) {
  const data = n?.data && typeof n.data === 'object' && !Array.isArray(n.data) ? n.data : {}
  const route = n?.route_params && typeof n.route_params === 'object' && !Array.isArray(n.route_params) ? n.route_params : {}
  return { ...data, ...route }
}

function withQuery(path, entries) {
  const qs = new URLSearchParams()
  Object.entries(entries).forEach(([key, val]) => {
    if (val != null && String(val).trim() !== '') qs.set(key, String(val).trim())
  })
  const s = qs.toString()
  return s ? `${path}?${s}` : path
}

const ROUTE_BUILDERS = {
  'admin.crm.thread': (n, p) => {
    const conversationId = value(p.conversation_id, p.conversationId, p.session_id, p.sessionId, n.resource_id)
    if (conversationId) return withQuery('/admin/chat-crm', { view: 'chats', conversation: conversationId })
    return withQuery('/admin/chat-crm', { view: 'leads', lead: value(p.lead_id, p.leadId, n.resource_id) })
  },
  'admin.portal.conversation': (n, p) =>
    withQuery('/admin/chat-crm', {
      view: 'chats',
      inbox: 'borrower',
      type: 'portal',
      portal_conversation: value(p.portal_conversation_id, p.portalConversationId, p.lead_id, p.leadId, n.resource_id),
    }),
  'admin.support.ticket': (n, p) =>
    withQuery('/admin/chat-crm', {
      view: 'chats',
      inbox: 'borrower',
      type: 'tickets',
      ticket: value(p.ticket_id, p.ticketId, p.lead_id, p.leadId, n.resource_id),
    }),
  'admin.loan_application.details': (n, p) => {
    const loanId = value(p.loan_id, p.loanId, n.resource_type === 'loan' ? n.resource_id : '')
    if (loanId) return `/admin/loans/${encodeURIComponent(loanId)}`
    return withQuery('/admin/applications', { application_id: value(p.loan_application_id, p.application_id, n.resource_id) })
  },
  'admin.borrower.profile': (n, p) => {
    const borrowerId = value(p.borrower_id, p.borrowerId, n.resource_type === 'borrower' ? n.resource_id : '')
    return borrowerId ? `/admin/borrowers/${encodeURIComponent(borrowerId)}` : '/admin/borrowers'
  },
  'admin.document.viewer': (n, p) => {
    const borrowerId = value(p.borrower_id, p.borrowerId)
    if (borrowerId) return withQuery(`/admin/borrowers/${encodeURIComponent(borrowerId)}`, { tab: 'documents', document_id: value(p.document_id, n.resource_id) })
    return withQuery('/admin/document-loan-applications', { document_id: value(p.document_id, n.resource_id) })
  },
  'admin.payments': (_n, p) => withQuery('/admin/payments', { payment_id: p.payment_id, loan_search: p.loan_id, status: p.status }),
  'admin.notification.details': (n) => withQuery('/admin/notifications', { notification: n?.id }),

  'borrower.portal.conversation': (_n, p) => withQuery('/borrower/chat', { conversation: value(p.portal_conversation_id, p.conversation_id), q: p.q }),
  'borrower.support.ticket': (n, p) => withQuery('/borrower/tickets', { ticket: value(p.ticket_id, p.lead_id, n?.resource_id) }),
  'borrower.loan_application.details': (n, p) => withQuery('/borrower/applications', { application_id: value(p.loan_application_id, p.application_id, n?.resource_id), loan_id: p.loan_id }),
  'borrower.profile.activity': (_n, p) => withQuery('/borrower/profile', { tab: 'activity', borrower_id: p.borrower_id }),
  'borrower.document.viewer': (n, p) => withQuery('/borrower/profile', { tab: 'documents', document_id: value(p.document_id, n?.resource_id) }),
  'borrower.payments': (_n, p) => withQuery('/borrower/payments', { payment_id: p.payment_id, loan_id: p.loan_id }),
  'borrower.notification.details': (n) => withQuery('/borrower/notifications', { notification: n?.id }),
}

export function getNotificationHref(notification, audience = 'admin') {
  if (!notification || typeof notification !== 'object') return null
  const p = paramsFor(notification)
  const routeName = value(notification.route_name)
  const builder = ROUTE_BUILDERS[routeName]
  if (builder) return builder(notification, p)

  const fallback = audience === 'borrower' ? ROUTE_BUILDERS['borrower.notification.details'] : ROUTE_BUILDERS['admin.notification.details']
  return fallback(notification, p)
}

export function getAdminNotificationHref(notification) {
  return getNotificationHref(notification, 'admin')
}

export function getBorrowerNotificationHref(notification) {
  return getNotificationHref(notification, 'borrower')
}

export async function handleNotificationClick(notification, options = {}) {
  const {
    audience = 'admin',
    event = null,
    markRead = null,
    navigate = null,
    onNavigate = null,
  } = options
  event?.preventDefault?.()
  event?.stopPropagation?.()

  if (!notification) return null
  if (!notification.is_read && !notification.read_at && typeof markRead === 'function') {
    await markRead(notification.id)
  }

  const href = getNotificationHref(notification, audience)
  if (!href) return null
  if (typeof onNavigate === 'function') onNavigate()
  if (typeof navigate === 'function') navigate(href)
  else if (typeof window !== 'undefined') window.location.assign(href)
  return href
}
