import { useEffect, useState } from 'react'
import { borrowerApi } from '../api/client.js'
import { useBorrowerAuth } from '../context/useBorrowerAuth.js'
import { admin as ui } from '../../admin/components/AdminUi.jsx'

export default function BorrowerProfilePage() {
  const { user, loadMe } = useBorrowerAuth()
  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [profileDocs, setProfileDocs] = useState([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await borrowerApi('/borrower/profile/documents')
        if (!cancelled && Array.isArray(res.data)) setProfileDocs(res.data)
      } catch {
        if (!cancelled) setProfileDocs([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [msg])

  const saveProfile = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    setError('')
    try {
      const body = new FormData()
      body.append('name', name)
      body.append('phone', phone)
      const res = await borrowerApi('/borrower/profile', { method: 'POST', body })
      await loadMe()
      setMsg(res.message || 'Profile updated.')
    } catch (err) {
      setError(err.message || 'Unable to update profile.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Profile settings</h2>
        <p className={`mt-1 text-sm ${ui.textMuted}`}>Update your borrower profile and upload a valid ID.</p>
        <form onSubmit={saveProfile} className="mt-4 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={ui.input}
            placeholder="Full name"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={ui.input}
            placeholder="Phone number"
          />
          <button
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? 'Saving...' : 'Save profile'}
          </button>
        </form>
        {msg ? (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-green-500/10 dark:text-green-300">
            {msg}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        ) : null}
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Password and security</h3>
        <p className={`mt-1 text-sm ${ui.textMuted}`}>Use the Security tab in sidebar to change your password.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">General documents uploaded</h3>
        <p className={`mt-1 text-sm ${ui.textMuted}`}>
          General documents uploaded by the borrower, including profile ID and files from general loan applications.
        </p>
        {profileDocs.length === 0 ? (
          <p className={`mt-3 text-sm ${ui.textMuted}`}>No documents yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-200 dark:divide-[#1F2937]">
            {profileDocs.map((d, idx) => (
              <li key={`${d.path || d.label}-${idx}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="text-gray-800 dark:text-gray-200">
                  {d.label === 'Valid ID (profile)' ? 'Valid ID' : d.label}
                </span>
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer" className="font-semibold text-red-600 hover:underline dark:text-red-400">
                    Open
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
