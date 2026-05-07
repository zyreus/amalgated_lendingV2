import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { admin } from './AdminUi.jsx'

const employmentStatusOptions = ['Employed', 'Self-Employed', 'Unemployed', 'Student', 'Retired', 'Other']

const schema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(128),
  last_name: z.string().trim().min(1, 'Last name is required').max(128),
  email: z.string().trim().email('Enter a valid email').max(255),
  phone_number: z
    .string()
    .trim()
    .max(32, 'Phone number is too long')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
  date_of_birth: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v))
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Use a valid date'),
  address: z
    .string()
    .trim()
    .max(500, 'Address is too long')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
  monthly_income: z
    .preprocess((v) => {
      if (v === '' || v == null) return undefined
      const n = typeof v === 'number' ? v : Number(String(v))
      return Number.isFinite(n) ? n : undefined
    }, z.number().min(0, 'Monthly income must be >= 0').max(1e12, 'Monthly income is too large').optional()),
  employment_status: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v))
    .refine((v) => !v || employmentStatusOptions.includes(v), 'Select a valid employment status'),
  password: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v))
    .refine((v) => !v || v.length >= 8, 'Password must be at least 8 characters'),
})

function normalizePayload(values) {
  // Values already transformed by schema; keep backend payload explicit.
  return {
    first_name: values.first_name,
    last_name: values.last_name,
    email: values.email,
    phone_number: values.phone_number ?? null,
    date_of_birth: values.date_of_birth ?? null,
    address: values.address ?? null,
    monthly_income: values.monthly_income ?? null,
    employment_status: values.employment_status ?? null,
    password: values.password ?? null,
  }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  // Fallback for older browsers.
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'absolute'
  ta.style.left = '-9999px'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  ta.remove()
}

export default function CreateBorrowerModal({ open, onClose, onCreated }) {
  const { showToast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [createdTempPassword, setCreatedTempPassword] = useState(null)
  const [createdSuccess, setCreatedSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone_number: '',
      date_of_birth: '',
      address: '',
      monthly_income: '',
      employment_status: '',
      password: '',
    },
  })

  const canSubmit = useMemo(() => open && !createdSuccess, [open, createdSuccess])

  useEffect(() => {
    if (!open) {
      setSubmitting(false)
      setCreatedTempPassword(null)
      setCreatedSuccess(false)
      reset()
    }
  }, [open, reset])

  const closeAndReset = () => {
    setCreatedTempPassword(null)
    setCreatedSuccess(false)
    reset()
    onClose?.()
  }

  const submit = handleSubmit(async (values) => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const parsed = schema.safeParse(values)
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const path = issue.path?.[0]
          if (typeof path === 'string') {
            setError(path, { type: 'manual', message: issue.message })
          }
        }
        return
      }

      const payload = normalizePayload(parsed.data)
      const res = await api('/borrowers', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      const temp = res?.temporary_password || null
      setCreatedTempPassword(temp)
      setCreatedSuccess(true)
      showToast('Borrower created successfully.', 'success')

      // Refresh borrowers table right away; user can copy the temp password first.
      if (typeof onCreated === 'function') {
        await onCreated()
      }
    } catch (e) {
      showToast(e.message || 'Failed to create borrower.', 'error')
    } finally {
      setSubmitting(false)
    }
  })

  const handleCopyAndClose = async () => {
    if (!createdTempPassword) {
      closeAndReset()
      return
    }
    try {
      await copyText(createdTempPassword)
      showToast('Temporary password copied.', 'success')
    } catch {
      showToast('Could not copy password. You can copy it manually.', 'error')
    } finally {
      closeAndReset()
    }
  }

  if (!open) return null

  return (
    <div
      className={admin.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Create new borrower"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeAndReset()
      }}
    >
      <div className={`${admin.modalCard} max-w-2xl`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create New Borrower</h2>
            <p className={`mt-1 text-xs ${admin.textMuted}`}>
              {createdTempPassword
                ? 'Account created. Copy the temporary password to share with the borrower.'
                : 'Fill out the borrower details. Password is optional.'}
            </p>
          </div>
          <button type="button" className={admin.btnSecondary} onClick={closeAndReset} disabled={submitting}>
            Close
          </button>
        </div>

        <form className="mt-4 space-y-3" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">First Name</label>
              <input
                {...register('first_name')}
                className={`w-full ${admin.input}`}
                placeholder="First name"
                autoComplete="given-name"
                disabled={!!createdTempPassword || submitting}
              />
              {errors.first_name?.message ? (
                <p className="text-xs text-red-700 dark:text-red-300">{errors.first_name.message}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Last Name</label>
              <input
                {...register('last_name')}
                className={`w-full ${admin.input}`}
                placeholder="Last name"
                autoComplete="family-name"
                disabled={!!createdTempPassword || submitting}
              />
              {errors.last_name?.message ? (
                <p className="text-xs text-red-700 dark:text-red-300">{errors.last_name.message}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Email</label>
            <input
              {...register('email')}
              type="email"
              className={`w-full ${admin.input}`}
              placeholder="Email"
              autoComplete="email"
              disabled={!!createdTempPassword || submitting}
            />
            {errors.email?.message ? <p className="text-xs text-red-700 dark:text-red-300">{errors.email.message}</p> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Phone Number</label>
              <input
                {...register('phone_number')}
                className={`w-full ${admin.input}`}
                placeholder="Phone (optional)"
                autoComplete="tel"
                disabled={!!createdTempPassword || submitting}
              />
              {errors.phone_number?.message ? (
                <p className="text-xs text-red-700 dark:text-red-300">{errors.phone_number.message}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Date of Birth</label>
              <input
                {...register('date_of_birth')}
                type="date"
                className={`w-full ${admin.input}`}
                disabled={!!createdTempPassword || submitting}
              />
              {errors.date_of_birth?.message ? (
                <p className="text-xs text-red-700 dark:text-red-300">{errors.date_of_birth.message}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Address</label>
            <textarea
              {...register('address')}
              className={`w-full ${admin.input}`}
              placeholder="Address"
              rows={3}
              disabled={!!createdTempPassword || submitting}
            />
            {errors.address?.message ? <p className="text-xs text-red-700 dark:text-red-300">{errors.address.message}</p> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Monthly Income</label>
              <input
                {...register('monthly_income')}
                type="number"
                inputMode="decimal"
                step="0.01"
                className={`w-full ${admin.input}`}
                placeholder="Monthly income (optional)"
                disabled={!!createdTempPassword || submitting}
              />
              {errors.monthly_income?.message ? (
                <p className="text-xs text-red-700 dark:text-red-300">{errors.monthly_income.message}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Employment Status</label>
              <select
                {...register('employment_status')}
                className={`w-full ${admin.input}`}
                disabled={!!createdTempPassword || submitting}
                defaultValue=""
              >
                <option value="">Select...</option>
                {employmentStatusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {errors.employment_status?.message ? (
                <p className="text-xs text-red-700 dark:text-red-300">{errors.employment_status.message}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Password (optional)</label>
            <input
              {...register('password')}
              type="password"
              className={`w-full ${admin.input}`}
              placeholder="Leave blank to auto-generate a strong password"
              disabled={!!createdTempPassword || submitting}
            />
            {errors.password?.message ? <p className="text-xs text-red-700 dark:text-red-300">{errors.password.message}</p> : null}
          </div>

          {createdTempPassword ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/20">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Temporary password</p>
              <p className="mt-2 break-all font-mono text-sm text-emerald-900 dark:text-emerald-100">
                {createdTempPassword}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopyAndClose}
                  className={`${admin.btnPrimary} !px-5`}
                >
                  Copy & Close
                </button>
                <button type="button" onClick={closeAndReset} className={admin.btnSecondary}>
                  Done
                </button>
              </div>
            </div>
          ) : createdSuccess ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/20">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Borrower created</p>
              <p className={`mt-1 text-xs ${admin.textMuted}`}>No temporary password was returned.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={closeAndReset} className={`${admin.btnPrimary} !px-5`}>
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="submit" disabled={submitting || !!createdTempPassword} className={`${admin.btnPrimary} disabled:opacity-50`}>
                {submitting ? 'Creating…' : 'Create Borrower'}
              </button>
              <button type="button" onClick={closeAndReset} className={admin.btnSecondary} disabled={submitting}>
                Cancel
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

