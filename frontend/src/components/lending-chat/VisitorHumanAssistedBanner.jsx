export default function VisitorHumanAssistedBanner({ visible }) {
  if (!visible) return null

  return (
    <div
      className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-xs font-medium text-emerald-900"
      role="status"
      aria-live="polite"
    >
      AI Assistant disabled. Human Support Agent is now handling this conversation.
    </div>
  )
}
