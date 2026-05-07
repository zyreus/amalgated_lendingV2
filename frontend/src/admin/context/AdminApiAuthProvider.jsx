import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken } from '../api/client.js'
import { clearAdminUser, setAdminUser } from '../../auth/session.js'
import { AdminApiAuthContext } from './adminApiAuthContext.js'
import { clearSessionLendingAdminSecret, setSessionLendingAdminSecret } from '../../utils/adminChatApi.js'

export function AdminApiAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(!!getToken())

  const loadMe = useCallback(async () => {
    const t = getToken()
    if (!t) {
      setUser(null)
      setBooting(false)
      return
    }
    try {
      const res = await api('/admin/me')
      setUser(res.user)
      setAdminUser(res.user)
      setSessionLendingAdminSecret(res.chat_api_secret)
    } catch {
      setToken(null)
      clearAdminUser()
      clearSessionLendingAdminSecret()
      setUser(null)
    } finally {
      setBooting(false)
    }
  }, [])

  useEffect(() => {
    loadMe()
  }, [loadMe])

  useEffect(() => {
    const onUnauth = () => {
      setUser(null)
    }
    window.addEventListener('lending-admin-unauthorized', onUnauth)
    return () => window.removeEventListener('lending-admin-unauthorized', onUnauth)
  }, [])

  const login = useCallback(async (username, password) => {
    const res = await api('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    setToken(res.token || res.access_token)
    setUser(res.user)
    setAdminUser(res.user)
    setSessionLendingAdminSecret(res.chat_api_secret)
    return res
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/admin/logout', { method: 'POST', body: '{}' })
    } catch {
      /* ignore */
    }
    setToken(null)
    clearAdminUser()
    clearSessionLendingAdminSecret()
    setUser(null)
  }, [])

  const can = useCallback(
    (slug) => {
      if (!user?.permissions?.length) return false
      return user.permissions.some((p) => p.slug === slug)
    },
    [user],
  )

  const value = useMemo(
    () => ({
      user,
      booting,
      login,
      logout,
      loadMe,
      can,
      authed: !!user,
    }),
    [user, booting, login, logout, loadMe, can],
  )

  return <AdminApiAuthContext.Provider value={value}>{children}</AdminApiAuthContext.Provider>
}
