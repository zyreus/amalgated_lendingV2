const DEFAULT_MESSAGE =
  'Your inquiry has been received. Please wait for a Support Agent to respond before sending additional messages.'

export default function VisitorSendLockedBanner({ visible, message }) {
  if (!visible) return null

  return (
    <div
      className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-center text-xs font-medium leading-relaxed text-rose-950"
      role="status"
      aria-live="polite"
    >
      {message || DEFAULT_MESSAGE}
    </div>
  )
}
