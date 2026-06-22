import { useEffect } from 'react'
import PrivacyPolicyContent from './PrivacyPolicyContent.jsx'
import { admin } from '../../admin/components/AdminUi.jsx'

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
    <div
      className={admin.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Privacy Policy"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div
        className={`${admin.modalCard} max-h-[88vh] max-w-3xl overflow-hidden p-0`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-[#1F2937]">
          <div>
            <p className={admin.modalEyebrow}>Legal</p>
            <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Privacy Policy</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={admin.btnSecondary}
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
