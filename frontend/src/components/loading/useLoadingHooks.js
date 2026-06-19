import { useCallback, useRef, useState } from 'react'

/**
 * Wrap async handlers with duplicate-click protection and loading state.
 */
export function useAsyncAction(action, options = {}) {
  const { onError, onSuccess } = options
  const [loading, setLoading] = useState(false)
  const lockRef = useRef(false)

  const run = useCallback(
    async (...args) => {
      if (lockRef.current) return undefined
      lockRef.current = true
      setLoading(true)
      try {
        const result = await action(...args)
        onSuccess?.(result)
        return result
      } catch (err) {
        onError?.(err)
        throw err
      } finally {
        lockRef.current = false
        setLoading(false)
      }
    },
    [action, onError, onSuccess],
  )

  return { loading, run, isBusy: loading }
}

/**
 * Form submit helper — prevents duplicate POSTs.
 */
export function useFormSubmit(submitFn, options = {}) {
  const { onError, onSuccess } = options
  const [submitting, setSubmitting] = useState(false)
  const lockRef = useRef(false)

  const handleSubmit = useCallback(
    async (event) => {
      event?.preventDefault?.()
      if (lockRef.current) return
      lockRef.current = true
      setSubmitting(true)
      try {
        const result = await submitFn(event)
        onSuccess?.(result)
        return result
      } catch (err) {
        onError?.(err)
        throw err
      } finally {
        lockRef.current = false
        setSubmitting(false)
      }
    },
    [submitFn, onError, onSuccess],
  )

  return { submitting, handleSubmit, isSubmitting: submitting }
}

/**
 * Upload helper with progress state + beforeunload guard.
 */
export function useUploadProgress(uploadId = 'default') {
  const [percent, setPercent] = useState(0)
  const [uploading, setUploading] = useState(false)

  const start = useCallback(() => {
    setUploading(true)
    setPercent(0)
  }, [])

  const setProgress = useCallback((value) => {
    setPercent(Math.min(100, Math.max(0, Number(value) || 0)))
  }, [])

  const finish = useCallback(() => {
    setPercent(100)
    setUploading(false)
  }, [])

  const reset = useCallback(() => {
    setPercent(0)
    setUploading(false)
  }, [])

  const onUploadProgress = useCallback((event) => {
    if (!event?.total) return
    setProgress(Math.round((event.loaded / event.total) * 100))
  }, [setProgress])

  return {
    uploadId,
    percent,
    uploading,
    start,
    setProgress,
    finish,
    reset,
    onUploadProgress,
  }
}
