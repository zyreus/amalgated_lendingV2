/**
 * Push AI / agent / escalation messages from chat-server → Laravel warehouse (optional).
 *
 * Laravel: POST /api/v1/internal/support/sync/message
 * Header: X-Support-Sync-Secret → amalgated-lending-api `SUPPORT_CHAT_SYNC_SECRET`
 *
 * Env (chat-server `.env`):
 *   LARAVEL_CHAT_SYNC_URL=http://127.0.0.1:8000/api/v1
 *   LARAVEL_CHAT_SYNC_SECRET=<same secret as Laravel>
 */

const SYNC_URL_ROOT = String(process.env.LARAVEL_CHAT_SYNC_URL || '')
  .trim()
  .replace(/\/$/, '')
const SYNC_SECRET = String(process.env.LARAVEL_CHAT_SYNC_SECRET || '').trim()

/** Log once — missing env is the usual reason Laravel CRM inbox/analytics stay empty while Node chat works */
let skippedSyncWarned = false

function warnSyncSkipped(reason) {
  if (skippedSyncWarned) return
  skippedSyncWarned = true
  console.warn(
    '[laravelSupportSync] Laravel warehouse mirror disabled:',
    reason,
    'Set LARAVEL_CHAT_SYNC_URL (…/api/v1) + LARAVEL_CHAT_SYNC_SECRET (match Laravel SUPPORT_CHAT_SYNC_SECRET).',
  )
}

async function postJson(path, payload) {
  if (!SYNC_URL_ROOT || !SYNC_SECRET) {
    warnSyncSkipped(!SYNC_URL_ROOT ? 'LARAVEL_CHAT_SYNC_URL empty' : 'LARAVEL_CHAT_SYNC_SECRET empty')
    return { skipped: true }
  }
  const url = `${SYNC_URL_ROOT}${path.startsWith('/') ? path : `/${path}`}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Support-Sync-Secret': SYNC_SECRET,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn('[laravelSupportSync]', res.status, url, text.slice(0, 200))
    }
    return { skipped: false, ok: res.ok }
  } catch (e) {
    console.warn('[laravelSupportSync]', e?.message || e)
    return { skipped: false, ok: false }
  }
}

/**
 * Mirror an outbound CRM message into Laravel (`chat_messages`).
 * Always pass `dedupeKey` when the same logical message could be synced more than once.
 */
export function syncOutboundChatMessage(payload) {
  const {
    sessionId,
    visitorId,
    senderType,
    senderName,
    message,
    dedupeKey,
    isFeedback,
    aiLogMs,
    conversationPatch,
  } = payload || {}
  if (!sessionId || !message?.trim()) return Promise.resolve()

  const body = {
    session_id: String(sessionId).trim(),
    visitor_id: visitorId ? String(visitorId).trim() : null,
    sender_type: senderType ? String(senderType).trim().toLowerCase() : 'ai',
    sender_name: senderName ? String(senderName).trim() : null,
    message: message.trim(),
    is_feedback: !!isFeedback,
    conversation_patch: conversationPatch || null,
  }
  if (dedupeKey && String(dedupeKey).trim()) {
    body.dedupe_key = String(dedupeKey).trim()
  }
  if (aiLogMs != null && senderType === 'ai') {
    body.ai_log = { latency_ms: Math.max(0, Math.floor(aiLogMs)) }
  }

  return postJson('/internal/support/sync/message', body)
}

/** Mirror CRM feedback submissions for analytics parity. */
export function syncOutboundFeedback(payload) {
  const { sessionId, rating, subject, comment, name, email, loan_type, consent_public_display } = payload || {}
  if (!sessionId || !rating || !comment?.trim()) return Promise.resolve()

  return postJson('/internal/support/sync/feedback', {
    session_id: String(sessionId).trim(),
    rating: Number(rating),
    subject: subject ? String(subject).trim() : null,
    comment: comment.trim(),
    name: name ? String(name).trim() : null,
    email: email ? String(email).trim() : null,
    loan_type: loan_type ? String(loan_type).trim().slice(0, 96) : null,
    consent_public_display: Boolean(consent_public_display),
  })
}
