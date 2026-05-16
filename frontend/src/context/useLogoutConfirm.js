import { useContext } from 'react'
import { LogoutConfirmContext } from './logoutConfirmContext.js'

export function useLogoutConfirm() {
  const ctx = useContext(LogoutConfirmContext)
  if (ctx == null) {
    throw new Error('useLogoutConfirm must be used inside LogoutConfirmProvider.')
  }
  return ctx
}
