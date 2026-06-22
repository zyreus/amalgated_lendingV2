/**
 * Sort chat messages oldest → newest (standard chat: new messages at the bottom).
 */
export function sortChatMessagesChronological(messages) {
  return [...(messages || [])].sort((a, b) => {
    const ta = new Date(a?.created_at || a?.sent_at || 0).getTime()
    const tb = new Date(b?.created_at || b?.sent_at || 0).getTime()
    if (ta !== tb) return ta - tb
    return (Number(a?.id) || 0) - (Number(b?.id) || 0)
  })
}

export function scrollChatToBottom(containerRef, behavior = 'smooth') {
  requestAnimationFrame(() => {
    const el = containerRef?.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  })
}
