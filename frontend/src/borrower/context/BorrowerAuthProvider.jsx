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

  const login = useCallback(async (username, password) => {
    const res = await borrowerApi('/borrower/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    setBorrowerToken(res.token || res.access_token)
    setBorrowerUser(res.user)
    setUser(res.user)
    return res
  }, [])

  const register = useCallback(async ({ name, email, phone, password, password_confirmation }) => {
    const res = await borrowerApi('/borrower/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, phone, password, password_confirmation }),
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
    () => ({ user, booting, authed: !!user, login, register, logout, loadMe }),
    [user, booting, login, register, logout, loadMe],
  )

  return <BorrowerAuthContext.Provider value={value}>{children}</BorrowerAuthContext.Provider>
}
