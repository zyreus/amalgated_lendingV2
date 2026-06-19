import { useState } from 'react'
import { LoadingButton, FormLoadingOverlay } from '../../components/loading'
import { borrowerApi } from '../api/client.js'
import { admin as ui } from '../../admin/components/AdminUi.jsx'

export default function BorrowerSecurityPage() {
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSuccess('')
    setError('')
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setSuccess('')
    setError('')
    try {
      await borrowerApi('/borrower/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: form.currentPassword,
          new_password: form.newPassword,
          new_password_confirmation: form.confirmNewPassword,
        }),
      })
      setSuccess('Password updated successfully.')
      setForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
    } catch (err) {
      setError(err.message || 'Failed to update password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Security</h2>
        <p className={`mt-1 text-sm ${ui.textMuted}`}>Change your borrower account password.</p>
        <FormLoadingOverlay submitting={loading} label="Updating...">
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <label className={`text-xs ${ui.textMuted}`}>Current password</label>
            <input
              type="password"
              required
              value={form.currentPassword}
              onChange={(e) => onChange('currentPassword', e.target.value)}
              className={`mt-2 w-full ${ui.input}`}
            />
          </div>
          <div>
            <label className={`text-xs ${ui.textMuted}`}>New password</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.newPassword}
              onChange={(e) => onChange('newPassword', e.target.value)}
              className={`mt-2 w-full ${ui.input}`}
            />
          </div>
          <div>
            <label className={`text-xs ${ui.textMuted}`}>Confirm new password</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.confirmNewPassword}
              onChange={(e) => onChange('confirmNewPassword', e.target.value)}
              className={`mt-2 w-full ${ui.input}`}
            />
          </div>
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>
          ) : null}
          {success ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-green-500/10 dark:text-green-300">
              {success}
            </p>
          ) : null}
          <LoadingButton
            type="submit"
            loading={loading}
            loadingKey="update"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Update password
          </LoadingButton>
        </form>
        </FormLoadingOverlay>
      </div>
    </div>
  )
}
