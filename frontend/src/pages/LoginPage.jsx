import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, setToken } from '../admin/api/client.js'
import { setAuthUser } from '../auth/session.js'
import { setAuthOverlay } from '../utils/globalLoadingBus.js'
import { LoadingButton, FormLoadingOverlay } from '../components/loading'

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setAuthOverlay('Signing In...')
    try {
      const res = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const token = res.token || res.access_token
      const user = res.user
      if (!token || !user?.role) {
        throw new Error('Invalid login response from server.')
      }

      setToken(token)
      setAuthUser(user)

      if (user.role === 'admin') navigate('/admin/dashboard', { replace: true })
      else if (user.role === 'borrower') navigate('/borrower/dashboard', { replace: true })
      else if (user.role === 'loan_officer') navigate('/officer/dashboard', { replace: true })
      else if (user.role === 'collector') navigate('/collector/dashboard', { replace: true })
      else if (user.role === 'accountant') navigate('/accounting/dashboard', { replace: true })
      else navigate('/unauthorized', { replace: true })
    } catch (err) {
      setErrorMsg(err.message || 'Login failed.')
    } finally {
      setAuthOverlay(null)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0a] p-8 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">Amalgated Lending Inc.</p>
        <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-white/60">Sign in with your username/email and password.</p>

        <FormLoadingOverlay submitting={loading} label="Signing In...">
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-white/70">Username or email</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-sm text-white outline-none focus:border-red-600"
              autoComplete="username"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-white/70">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="mt-1 w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-sm text-white outline-none focus:border-red-600"
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </div>
          {errorMsg ? <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{errorMsg}</p> : null}
          <LoadingButton
            type="submit"
            loading={loading}
            loadingKey="signIn"
            minWidth="100%"
            className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700"
          >
            Sign in
          </LoadingButton>
        </form>
        </FormLoadingOverlay>
        <p className="mt-6 text-center text-sm text-white/50">
          <Link to="/" className="text-red-400 hover:underline">← Back to home</Link>
        </p>
      </div>
    </div>
  )
}
