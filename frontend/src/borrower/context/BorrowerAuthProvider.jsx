import { useCallback, useEffect, useMemo, useState } from 'react'
import { clearBorrowerUser, setBorrowerUser } from '../../auth/session.js'
import { borrowerApi, getBorrowerToken, setBorrowerToken } from '../api/client.js'
import { BorrowerAuthContext } from './borrowerAuthContext.js'

export function BorrowerAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(!!getBorrowerToken())

  const loadMe = useCallback(async () => {
    const token = getBorrowerToken()
    if (!token) {
      setUser(null)
      setBooting(false)
      return
    }
    try {
      const res = await borrowerApi('/borrower/me')
      setUser(res.user)
      setBorrowerUser(res.user)
    } catch {
      setBorrowerToken(null)
      clearBorrowerUser()
      setUser(null)
    } finally {
      setBooting(false)
    }
  }, [])

  useEffect(() => {
    loadMe()
  }, [loadMe])

  useEffect(() => {
    const onUnauth = () => setUser(null)
    window.addEventListener('lending-borrower-unauthorized', onUnauth)
    return () => window.removeEventListener('lending-borrower-unauthorized', onUnauth)
  }, [])

  /** Refresh profile after inbox verification (user may still be logged in from registration). */
  useEffect(() => {
    const onVerified = () => {
      if (getBorrowerToken()) void loadMe()
    }
    window.addEventListener('lending-borrower-email-verified', onVerified)
    return () => window.removeEventListener('lending-borrower-email-verified', onVerified)
  }, [loadMe])

  const login = useCallback(async (identifier, password) => {
    const res = await borrowerApi('/borrower/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    })
    setBorrowerToken(res.token || res.access_token)
    setBorrowerUser(res.user)
    setUser(res.user)
    return res
  }, [])

  const register = useCallback(async (payload) => {
    const body =
      typeof FormData !== 'undefined' && payload instanceof FormData
        ? payload
        : JSON.stringify(payload)
    const res = await borrowerApi('/borrower/register', {
      method: 'POST',
      body,
    })
    if (res.token || res.access_token) {
      setBorrowerToken(res.token || res.access_token)
      setBorrowerUser(res.user)
      setUser(res.user)
    }
    return res
  }, [])

  const verifyOtp = useCallback(async (username, code) => {
    const res = await borrowerApi('/borrower/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ username, code }),
    })
    setBorrowerToken(res.token || res.access_token)
    setBorrowerUser(res.user)
    setUser(res.user)
    return res
  }, [])

  const requestOtp = useCallback(async (username) => {
    return borrowerApi('/borrower/otp/request', {
      method: 'POST',
      body: JSON.stringify({ username }),
    })
  }, [])

  const requestPasswordOtp = useCallback(async (identifier) => {
    return borrowerApi('/borrower/password/forgot-otp', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    })
  }, [])

  const resetPasswordWithOtp = useCallback(async ({ identifier, code, password, password_confirmation }) => {
    const res = await borrowerApi('/borrower/reset-password', {
      method: 'POST',
      body: JSON.stringify({ identifier, code, password, password_confirmation }),
    })
    setBorrowerToken(res.token || res.access_token)
    setBorrowerUser(res.user)
    setUser(res.user)
    return res
  }, [])

  const logout = useCallback(async () => {
    try {
      await borrowerApi('/borrower/logout', { method: 'POST', body: '{}' })
    } catch {
      // ignore
    }
    setBorrowerToken(null)
    clearBorrowerUser()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      booting,
      authed: !!user,
      login,
      register,
      verifyOtp,
      requestOtp,
      requestPasswordOtp,
      resetPasswordWithOtp,
      logout,
      loadMe,
    }),
    [user, booting, login, register, verifyOtp, requestOtp, requestPasswordOtp, resetPasswordWithOtp, logout, loadMe],
  )

  return <BorrowerAuthContext.Provider value={value}>{children}</BorrowerAuthContext.Provider>
}
