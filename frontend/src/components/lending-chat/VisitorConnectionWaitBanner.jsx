/**
 * Shown while the WebSocket is not connected; matches yellow status-dot rule.
 *
 * @param {{ visible: boolean }} props
 */
export default function VisitorConnectionWaitBanner({ visible }) {
  if (!visible) return null
  return (
    <div
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900"
      role="status"
    >
      Wait for the green indicator before sending your message.
    </div>
  )
}
