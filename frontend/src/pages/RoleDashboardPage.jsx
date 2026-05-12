import { useNavigate } from 'react-router-dom'
import { getAuthUser } from '../auth/session.js'
import { logoutAndRedirect } from '../components/ProtectedRoute.jsx'

export default function RoleDashboardPage({ title }) {
  const navigate = useNavigate()
  const user = getAuthUser()

  return (
    <div className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-[#0a0a0a] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-red-400">Amalgated Lending Inc.</p>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-white/60">
          Signed in as {user?.name || 'User'} ({user?.email || '—'}) · role: {user?.role || '—'}
        </p>
        <button
          type="button"
          onClick={() => logoutAndRedirect(navigate)}
          className="mt-6 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </div>
  )
}
