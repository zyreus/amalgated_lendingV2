import { useCallback, useState } from 'react'
import { borrowerApi } from '../borrower/api/client.js'
import { admin as ui } from '../admin/components/AdminUi.jsx'
import { loadFaceIOSdk } from '../utils/loadFaceIOSdk.js'

function extractFacePayload(userData) {
  if (!userData || typeof userData !== 'object') {
    return { faceId: '', confidence: null }
  }
  const faceId =
    userData.facialId ?? userData.faceId ?? userData.facialID ?? userData.userId ?? ''
  const details = userData.details && typeof userData.details === 'object' ? userData.details : {}
  let confidence =
    details.confidence ??
    userData.confidence ??
    (typeof details.score === 'number' ? details.score : null)
  if (confidence !== null && confidence !== undefined && typeof confidence !== 'number') {
    const n = Number(confidence)
    confidence = Number.isFinite(n) ? n : null
  }
  return { faceId: String(faceId || ''), confidence }
}

/**
 * FaceIO (CDN fio.js) liveness: authenticate() → POST /api/v1/liveness/faceio-verify
 */
export default function FaceIOLiveness({ borrowerId, onVerified, onFailed }) {
  const publicId = import.meta.env.VITE_FACEIO_PUBLIC_ID || ''
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('') // '' | success | failed
  const [message, setMessage] = useState('')
  const [confidence, setConfidence] = useState(null)
  const [sdkError, setSdkError] = useState('')

  const isConfigured = typeof publicId === 'string' && publicId.trim() !== ''

  const reset = useCallback(() => {
    setStatus('')
    setMessage('')
    setConfidence(null)
    setSdkError('')
  }, [])

  const verify = useCallback(async () => {
    if (!borrowerId) {
      setStatus('failed')
      setMessage('Sign in as a borrower to verify.')
      return
    }
    if (!isConfigured) {
      setSdkError('Setup required: add VITE_FACEIO_PUBLIC_ID to your Vite env, then restart Vite.')
      return
    }
    const loaded = await loadFaceIOSdk()
    const FaceIOConstructor = typeof window !== 'undefined' ? window.faceIO : null
    if (!loaded || typeof FaceIOConstructor !== 'function') {
      setSdkError('FaceIO script failed to load. Refresh the page.')
      return
    }

    setSdkError('')
    setLoading(true)
    setStatus('')
    setMessage('')
    setConfidence(null)

    try {
      const faceio = new FaceIOConstructor(publicId)
      const userData = await faceio.authenticate({ locale: 'auto' })
      const { faceId, confidence: conf } = extractFacePayload(userData)

      if (!faceId || conf === null || conf === undefined) {
        throw new Error('FaceIO response missing facialId or confidence.')
      }

      const body = {
        borrower_id: borrowerId,
        face_id: faceId,
        confidence: conf,
      }

      const data = await borrowerApi('/liveness/faceio-verify', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const c =
        typeof data.confidence === 'number'
          ? data.confidence
          : typeof conf === 'number'
            ? conf
            : null
      setConfidence(c)

      if (data.status === 'verified') {
        setStatus('success')
        setMessage(data.message || 'Liveness verification successful')
        onVerified?.(data)
      } else {
        setStatus('failed')
        setMessage(data.message || 'Liveness verification failed')
        onFailed?.(data)
      }
    } catch (err) {
      console.warn('FaceIO verification failed:', err)
      const body = err?.body && typeof err.body === 'object' ? err.body : {}
      if (typeof body.confidence === 'number') {
        setConfidence(body.confidence)
      }
      const msg =
        err?.message ||
        body.message ||
        (typeof err === 'string' ? err : 'Verification was cancelled or failed.')
      setStatus('failed')
      setMessage(msg)
      onFailed?.(err)
    } finally {
      setLoading(false)
    }
  }, [borrowerId, isConfigured, publicId, onVerified, onFailed])

  return (
    <div className="mx-auto flex max-w-md flex-col items-center">
      <div
        className="w-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-colors dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg"
      >
        <h2 className="text-center text-lg font-semibold text-gray-900 dark:text-gray-100">
          Identity Verification
        </h2>
        <p className={`mt-2 text-center text-sm ${ui.textMuted}`}>
          Click verify and follow camera instructions
        </p>

        {!isConfigured ? (
          <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="font-semibold">FaceIO is not configured.</p>
            <p className="mt-1">
              Add <code className="rounded bg-black/5 px-1 dark:bg-white/10">VITE_FACEIO_PUBLIC_ID</code> to
              <code className="rounded bg-black/5 px-1 dark:bg-white/10">amalgated-lending/.env.development.local</code>
              then restart Vite.
            </p>
          </div>
        ) : sdkError ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-center text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            {sdkError}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col items-center gap-4">
          <button
            type="button"
            disabled={loading || !borrowerId || !isConfigured}
            onClick={verify}
            className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                  aria-hidden
                />
                Verifying…
              </span>
            ) : (
              'Verify Identity'
            )}
          </button>

          {loading ? (
            <p className={`text-xs ${ui.textMuted}`}>Opening camera — stay in frame</p>
          ) : null}

          {confidence !== null && confidence !== undefined ? (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Confidence:{' '}
              <span className="font-mono font-medium">
                {confidence <= 1
                  ? `${(confidence * 100).toFixed(1)}%`
                  : `${Number(confidence).toFixed(1)}%`}
              </span>
            </p>
          ) : null}

          {status === 'success' ? (
            <p className="text-center text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Success — {message}
            </p>
          ) : null}
          {status === 'failed' && message ? (
            <p className="text-center text-sm font-medium text-red-700 dark:text-red-400">
              Failed — {message}
            </p>
          ) : null}

          {(status === 'success' || status === 'failed') && !loading ? (
            <button
              type="button"
              onClick={reset}
              className={`text-sm font-medium text-slate-600 underline underline-offset-2 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200`}
            >
              Try again
            </button>
          ) : null}
        </div>
      </div>
      <p className={`mt-3 max-w-md text-center text-xs ${ui.textMuted}`}>
        Verification attempts are logged. Maximum {3} liveness checks per 24 hours (all methods
        combined). Use HTTPS in production.
      </p>
    </div>
  )
}
