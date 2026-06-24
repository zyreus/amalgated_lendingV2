import { useEffect } from 'react'

/** Warn on tab close when settings have unsaved changes. */
export function useUnsavedChangesGuard(isDirty) {
  useEffect(() => {
    if (!isDirty) return undefined
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])
}
