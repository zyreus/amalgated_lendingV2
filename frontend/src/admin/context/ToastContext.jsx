import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import AlertModal from '../../components/AlertModal.jsx'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)

  const dismissToast = useCallback(() => setToast(null), [])

  const showToast = useCallback((message, variant = 'info') => {
    setToast({ message, variant, id: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(dismissToast, 6000)
    return () => window.clearTimeout(timer)
  }, [toast, dismissToast])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <AlertModal
        open={Boolean(toast)}
        message={toast?.message}
        variant={toast?.variant}
        onClose={dismissToast}
      />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) return { showToast: () => {} }
  return ctx
}
