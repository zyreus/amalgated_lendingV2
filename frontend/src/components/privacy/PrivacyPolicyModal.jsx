import { useEffect } from 'react'
import PrivacyPolicyContent from './PrivacyPolicyContent.jsx'

export default function PrivacyPolicyModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Privacy Policy">
      <div className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-black">Privacy Policy</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-black/70 hover:bg-black/5"
          >
            Close
          </button>
        </div>
        <div className="max-h-[72vh] overflow-y-auto px-5 py-4">
          <PrivacyPolicyContent />
        </div>
      </div>
    </div>
  )
}
