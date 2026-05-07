/**
 * Header indicator: green when realtime socket is connected (AI stream pipe ready).
 * Yellow while disconnected / reconnecting — composer must stay disabled until green.
 *
 * @param {{ aiReady: boolean }} props
 */
export default function VisitorChatStatusDot({ aiReady }) {
  return (
    <span
      title={aiReady ? 'Connected — you can send messages' : 'Connecting… wait for green before sending'}
      className={`flex h-2.5 w-2.5 rounded-full shadow-[0_0_6px_rgba(52,211,153,0.35)] ${
        aiReady ? 'bg-emerald-400' : 'bg-amber-400'
      }`}
      role="status"
      aria-live="polite"
      aria-label={aiReady ? 'AI connection ready' : 'AI connection pending'}
    />
  )
}
