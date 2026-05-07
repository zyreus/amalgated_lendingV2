/**
 * Three-dot typing animation while waiting for the first streamed token.
 *
 * @param {{ visible: boolean }} props
 */
export default function VisitorStreamTypingIndicator({ visible }) {
  if (!visible) return null
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-[#C9CED4]/30 bg-[#F4F6F8] px-4 py-3">
        <span className="chat-dot h-2 w-2 rounded-full bg-brand-primary/60" />
        <span className="chat-dot h-2 w-2 rounded-full bg-brand-primary/60 [animation-delay:0.15s]" />
        <span className="chat-dot h-2 w-2 rounded-full bg-brand-primary/60 [animation-delay:0.3s]" />
      </div>
    </div>
  )
}
