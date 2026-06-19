import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminApiAuth } from '../admin/context/useAdminApiAuth.js'
import { useBorrowerAuth } from '../borrower/context/useBorrowerAuth.js'
import { setAuthOverlay } from '../utils/globalLoadingBus.js'
import LogoutConfirmModal from '../components/LogoutConfirmModal.jsx'
import { LogoutConfirmContext } from './logoutConfirmContext.js'

/**
 * Global logout confirmation — single modal instance for admin + borrower portals.
 * @param {'admin' | 'borrower'} portalRole
 */
export function LogoutConfirmProvider({ children }) {
  const navigate = useNavigate()
  const { logout: adminLogout } = useAdminApiAuth()
  const { logout: borrowerLogout } = useBorrowerAuth()
  const [open, setOpen] = useState(false)
  const [portalRole, setPortalRole] = useState(null)
  const [busy, setBusy] = useState(false)
  const submittingRef = useRef(false)

  const openLogoutModal = useCallback((role) => {
    if (submittingRef.current) return
    setPortalRole(role === 'borrower' ? 'borrower' : 'admin')
    setOpen(true)
  }, [])

  const closeLogoutModal = useCallback(() => {
    if (submittingRef.current) return
    setOpen(false)
    setPortalRole(null)
  }, [])

  const confirmLogout = useCallback(async () => {
    if (submittingRef.current || !portalRole) return
    submittingRef.current = true
    setBusy(true)
    setAuthOverlay('Signing Out...')
    try {
      if (portalRole === 'admin') {
        await adminLogout()
        navigate('/admin/login', { replace: true })
      } else {
        await borrowerLogout()
        navigate('/borrower/login', { replace: true })
      }
      setOpen(false)
      setPortalRole(null)
    } finally {
      setAuthOverlay(null)
      setBusy(false)
      submittingRef.current = false
    }
  }, [portalRole, adminLogout, borrowerLogout, navigate])

  const value = useMemo(
    () => ({
      openLogoutModal,
      closeLogoutModal,
      confirmLogout,
    }),
    [openLogoutModal, closeLogoutModal, confirmLogout],
  )

  return (
    <LogoutConfirmContext.Provider value={value}>
      {children}
      <LogoutConfirmModal
        open={open}
        busy={busy}
        onCancel={closeLogoutModal}
        onConfirm={confirmLogout}
      />
    </LogoutConfirmContext.Provider>
  )
}
