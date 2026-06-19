import {
  formatRelativeTime,
  isWebsiteChatNotification,
  visitorInitials,
  websiteChatMeta,
} from '../utils/websiteChatNotificationEffects.js'

export default function WebsiteChatNotificationCard({
  notification,
  isRead,
  onOpen,
  onMarkRead,
  onMarkUnread,
  onDelete,
}) {
  if (!isWebsiteChatNotification(notification)) return null

  const meta = websiteChatMeta(notification)
  const displayTitle = notification.title || 'New Website Chat Message'
  const preview = meta.messagePreview
    ? `"${meta.messagePreview.length > 120 ? `${meta.messagePreview.slice(0, 117)}…` : meta.messagePreview}"`
    : null

  return (
    <div className="flex min-w-0 flex-1 gap-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-pink-200 text-sm font-bold text-rose-700 dark:from-rose-900/40 dark:to-pink-900/30 dark:text-rose-200"
        aria-hidden
      >
        {visitorInitials(meta.visitorName)}
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={(event) => onOpen?.(event)}
          className="w-full rounded-lg text-left outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <p className="font-semibold text-gray-900 dark:text-gray-100">{meta.visitorName}</p>
          <p className="mt-0.5 text-sm font-medium text-gray-800 dark:text-gray-200">{displayTitle}</p>
          {preview ? (
            <p className="mt-1 text-sm italic text-gray-600 dark:text-gray-400">{preview}</p>
          ) : null}
          {meta.conversationId ? (
            <p className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-300">
              Conversation #{meta.conversationId.slice(0, 24)}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {formatRelativeTime(meta.timestamp)}
          </p>
        </button>
        <div className="mt-2 flex flex-wrap gap-2">
          {!isRead ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onMarkRead?.()
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 dark:border-white/15 dark:bg-transparent dark:text-gray-100 dark:hover:bg-white/5"
            >
              Mark read
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onMarkUnread?.()
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 dark:border-white/15 dark:bg-transparent dark:text-gray-100 dark:hover:bg-white/5"
            >
              Mark unread
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete?.()
            }}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-500/30 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-900/20"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
