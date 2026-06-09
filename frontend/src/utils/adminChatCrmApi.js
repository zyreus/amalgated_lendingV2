/**
 * CRM & Chat data layer: Laravel warehouse (JWT) with Node chat-server fallback (shared secret).
 * Fixes empty inbox when LARAVEL_CHAT_SYNC is not configured but the widget still writes to Node/SQLite.
 */

import { api as adminApi } from '../admin/api/client.js'
import { chatFetch, hasChatServerAuth } from './adminChatApi.js'

export function normalizeNodeConversation(row) {
  const status = row?.status || 'open'
  return {
    id: row.id,
    session_id: row.id,
    visitor_id: row.visitor_id || null,
    visitor_name: row.visitor_name || 'Website Visitor',
    visitor_email: row.visitor_email || null,
    status,
    lifecycle_status: status,
    visitor_type: row.mode === 'human' ? 'human' : 'ai',
    mode: row.mode || 'ai',
    needs_human: row.mode === 'human',
    assigned_to: row.assigned_to ?? null,
    last_handling: row.last_responder_type || null,
    last_message_at: row.updated_at || row.created_at,
    updated_at: row.updated_at || row.created_at,
    unread_count: Number(row.admin_unread_count) || 0,
    admin_unread_count: Number(row.admin_unread_count) || 0,
    visitor_message_count: Number(row.visitor_message_count) || 0,
    last_message: row.last_message || null,
  }
}

export function normalizeNodeMessage(row) {
  const rawSender = String(row?.sender || '').toLowerCase()
  const sender =
    rawSender === 'customer' || rawSender === 'visitor' ? 'user' : rawSender || 'user'
  return {
    id: row.id,
    session_id: row.conversation_id || row.session_id,
    content: row.content ?? row.message ?? '',
    sender,
    sender_type: sender === 'user' ? 'customer' : sender,
    sender_name: row.admin_name || row.sender_name || null,
    admin_name: row.admin_name || null,
    created_at: row.created_at,
    sent_at: row.sent_at || row.created_at,
    delivered_at: row.delivered_at || null,
    read_at: row.read_at || null,
  }
}

async function tryLaravel(fn) {
  try {
    return { ok: true, value: await fn() }
  } catch (error) {
    return { ok: false, error }
  }
}

async function tryNodeJson(path, init = {}) {
  if (!hasChatServerAuth()) return { ok: false, reason: 'no_secret' }
  try {
    const { res } = await chatFetch(path, init)
    if (!res?.ok) return { ok: false, status: res?.status }
    const data = await res.json().catch(() => null)
    return { ok: true, data }
  } catch (error) {
    return { ok: false, error }
  }
}

function nodeConversationQuery(laravelQs) {
  const incoming = new URLSearchParams(String(laravelQs || ''))
  const out = new URLSearchParams()
  out.set('limit', incoming.get('limit') || '250')
  const status = incoming.get('status')
  if (status === 'archived') out.set('archived', '1')
  return out
}

/**
 * @returns {Promise<{ rows: object[], source: 'laravel'|'node'|null, error?: Error }>}
 */
export async function fetchCrmConversations(params) {
  const qs = params instanceof URLSearchParams ? params.toString() : String(params || '')

  const laravel = await tryLaravel(() => adminApi(`/admin/chat/conversations?${qs}`))
  if (laravel.ok && Array.isArray(laravel.value) && laravel.value.length > 0) {
    return { rows: laravel.value, source: 'laravel' }
  }

  const node = await tryNodeJson(`/api/admin/conversations?${nodeConversationQuery(qs)}`)
  if (node.ok && Array.isArray(node.data) && node.data.length > 0) {
    return { rows: node.data.map(normalizeNodeConversation), source: 'node' }
  }

  if (laravel.ok && Array.isArray(laravel.value)) {
    return { rows: laravel.value, source: 'laravel' }
  }

  return { rows: [], source: null, error: laravel.error }
}

export async function fetchCrmMessages(sessionId, params) {
  const enc = encodeURIComponent(String(sessionId || '').trim())
  if (!enc) return []
  const qs = params instanceof URLSearchParams ? params.toString() : String(params || '')

  const laravel = await tryLaravel(() => adminApi(`/admin/chat/conversations/${enc}/messages?${qs}`))
  if (laravel.ok && Array.isArray(laravel.value) && laravel.value.length > 0) {
    return laravel.value
  }

  const node = await tryNodeJson(`/api/admin/conversations/${enc}/messages?${qs}`)
  if (node.ok && Array.isArray(node.data) && node.data.length > 0) {
    return node.data.map(normalizeNodeMessage)
  }

  if (laravel.ok && Array.isArray(laravel.value)) return laravel.value
  return []
}

export async function postCrmConversationMessage(sessionId, text) {
  const enc = encodeURIComponent(String(sessionId || '').trim())
  return adminApi(`/admin/chat/conversations/${enc}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message: text }),
  })
}

/**
 * Paginated Laravel leads with optional Node fallback (chat-captured leads table).
 */
export async function fetchCrmLeads(params) {
  const qs = params instanceof URLSearchParams ? params.toString() : String(params || '')

  try {
    const res = await adminApi(`/admin/leads?${qs}`)
    const page = res?.data
    const rows = Array.isArray(page?.data) ? page.data : Array.isArray(res?.data) ? res.data : []
    if (rows.length > 0) return rows
  } catch {
    /* try node */
  }

  const nodeQs = new URLSearchParams(qs)
  const node = await tryNodeJson(`/api/admin/leads?${nodeQs}`)
  if (node.ok && Array.isArray(node.data)) return node.data
  return []
}

export async function fetchCrmBorrowerLeads(params) {
  return fetchCrmLeads(params)
}

export async function fetchCrmLeadMessages(leadId) {
  try {
    const res = await adminApi(`/admin/leads/${leadId}/messages?per_page=50`)
    return Array.isArray(res?.data) ? res.data : []
  } catch {
    return []
  }
}

export async function fetchCrmStaffUsers() {
  try {
    const res = await adminApi('/users?per_page=150&is_active=true')
    const rows = Array.isArray(res?.data?.data) ? res.data.data : []
    return rows.filter((u) => u && String(u.role || '').toLowerCase() !== 'borrower')
  } catch {
    return []
  }
}
