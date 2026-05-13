const TZ_STORAGE_KEY = 'crm_display_timezone'

/**
 * Preferred display timezone: explicit user profile (IANA), then localStorage override, then browser default.
 * @param {{ timezone?: string | null } | null | undefined} user
 */
export function getResolvedDisplayTimeZone(user) {
  const fromUser = user?.timezone && String(user.timezone).trim()
  if (fromUser) return fromUser
  try {
    const fromStore = typeof localStorage !== 'undefined' ? localStorage.getItem(TZ_STORAGE_KEY) : null
    if (fromStore && String(fromStore).trim()) return String(fromStore).trim()
  } catch {
    /* ignore */
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * @param {string | number | Date | null | undefined} isoOrDate
 * @param {{ timeZone?: string, locale?: string }} [opts]
 */
export function formatChatTime(isoOrDate, opts = {}) {
  const d = toDate(isoOrDate)
  if (!d) return ''
  const locale = opts.locale || 'en-US'
  const timeZone = opts.timeZone || getResolvedDisplayTimeZone()
  return d.toLocaleTimeString(locale, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Full CRM / audit log line (local calendar + clock).
 */
export function formatCrmLog(isoOrDate, opts = {}) {
  const d = toDate(isoOrDate)
  if (!d) return ''
  const locale = opts.locale || 'en-US'
  const timeZone = opts.timeZone || getResolvedDisplayTimeZone()
  return d.toLocaleString(locale, {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Visitor inbox row — fixed pattern "May 13, 2026, 3:55 PM" (comma before time).
 */
export function formatCrmInboxDate(isoOrDate, opts = {}) {
  const d = toDate(isoOrDate)
  if (!d) return ''
  const locale = opts.locale || 'en-US'
  const timeZone = opts.timeZone || getResolvedDisplayTimeZone()
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d)
  const pick = (type) => parts.find((p) => p.type === type)?.value || ''
  const month = pick('month')
  const day = pick('day')
  const year = pick('year')
  const hour = pick('hour')
  const minute = pick('minute')
  const dayPeriod = (pick('dayPeriod') || '').toUpperCase()
  if (!month || !day || !year) return formatCrmLog(isoOrDate, opts)
  const timeSeg = hour && minute ? `${hour}:${minute}${dayPeriod ? ` ${dayPeriod}` : ''}` : ''
  return timeSeg ? `${month} ${day}, ${year}, ${timeSeg}` : `${month} ${day}, ${year}`
}

/**
 * Relative time from UTC instant (browser clock).
 */
export function formatRelativeUtc(isoOrDate) {
  const d = toDate(isoOrDate)
  if (!d) return ''
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  let s = Math.round((d.getTime() - Date.now()) / 1000)
  const abs = Math.abs(s)
  if (abs < 60) return rtf.format(s, 'second')
  let m = Math.round(s / 60)
  if (Math.abs(m) < 60) return rtf.format(m, 'minute')
  let h = Math.round(s / 3600)
  if (Math.abs(h) < 48) return rtf.format(h, 'hour')
  let days = Math.round(s / 86400)
  if (Math.abs(days) < 14) return rtf.format(days, 'day')
  let weeks = Math.round(s / 604800)
  if (Math.abs(weeks) < 8) return rtf.format(weeks, 'week')
  let months = Math.round(s / 2592000)
  if (Math.abs(months) < 24) return rtf.format(months, 'month')
  return rtf.format(Math.round(s / 31536000), 'year')
}

/**
 * Outgoing message receipt label (WhatsApp-style) for support chat payloads.
 * @param {Record<string, unknown>} msg — API row with read_at / delivered_at / sent_at (ISO strings)
 * @param {'staff' | 'visitor'} perspective
 */
export function chatOutgoingReceiptLabel(msg, perspective) {
  const isStaffPerspective = perspective === 'staff'
  const outgoing =
    (isStaffPerspective && (msg?.sender === 'admin' || msg?.sender === 'ai' || msg?.sender === 'system')) ||
    (!isStaffPerspective && msg?.sender === 'user')
  if (!outgoing) return ''
  if (msg?.read_at) return 'Read'
  if (msg?.delivered_at) return 'Delivered'
  if (msg?.sent_at || msg?.created_at) return 'Sent'
  return ''
}

function toDate(isoOrDate) {
  if (isoOrDate == null || isoOrDate === '') return null
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return null
  return d
}
