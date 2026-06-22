import { useState } from 'react'

/**
 * Lightweight eligibility hints — not a substitute for formal underwriting.
 */
export default function EligibilityChecker({ product, onClose }) {
  const [age, setAge] = useState('')
  const [pension, setPension] = useState('')

  const ageN = parseInt(age, 10)
  const safe = product?.safe_age
  const limit = product?.age_limit
  let status = 'neutral'
  let message = 'Enter your age to see a quick guideline for this product.'

  if (age && !Number.isNaN(ageN)) {
    if (limit != null && ageN > limit) {
      status = 'no'
      message = `This product lists a maximum age of ${limit}. You may need special approval.`
    } else if (safe != null && ageN > safe) {
      status = 'warn'
      message = `Preferred age for standard terms is up to ${safe}. Our team can still review your case.`
    } else {
      status = 'ok'
      message = 'Age appears within typical guidelines for this product (subject to full verification).'
    }
  }

  if (product?.slug === 'sss-gsis' && pension && Number(pension) > 0 && Number(pension) < 1000) {
    status = 'warn'
    message = 'Very low pension amounts may limit loanable principal — we will confirm during review.'
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="elig-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-200 border-t-[3px] border-t-brand-primary bg-white p-6 shadow-2xl dark:border-[#1F2937] dark:bg-[#111827]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-primary">Guidelines</p>
        <h2 id="elig-title" className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Eligibility checker
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{product?.name}</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400" htmlFor="elig-age">
              Your age
            </label>
            <input
              id="elig-age"
              type="number"
              min={18}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/15 dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-100"
            />
          </div>
          {product?.slug === 'sss-gsis' ? (
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400" htmlFor="elig-pen">
                Monthly pension (optional)
              </label>
              <input
                id="elig-pen"
                inputMode="decimal"
                value={pension}
                onChange={(e) => setPension(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/15 dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-100"
              />
            </div>
          ) : null}
        </div>

        <div
          className={`mt-4 rounded-xl px-3 py-2 text-sm ${
            status === 'ok'
              ? 'bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100'
              : status === 'warn'
                ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                : status === 'no'
                  ? 'bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
                  : 'bg-gray-50 text-gray-700 dark:bg-[#0F172A]/50 dark:text-gray-300'
          }`}
        >
          {message}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-brand-primary py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover"
        >
          Close
        </button>
      </div>
    </div>
  )
}
