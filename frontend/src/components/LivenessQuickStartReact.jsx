import React from 'react'
import { FaceLivenessDetector } from '@aws-amplify/ui-react-liveness'
import { Loader, ThemeProvider } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import { borrowerApi } from '../borrower/api/client.js'
import { ensureAmplifyConfigured } from '../amplifyLivenessConfig.js'

/**
 * AWS quickstart-style flow: load session on mount, then FaceLivenessDetector.
 * Uses POST /liveness/amplify-session and polls GET .../results (JWT), not mock data.
 */
export function LivenessQuickStartReact({ borrowerId, onVerified, onFailed }) {
  const [loading, setLoading] = React.useState(true)
  const [createLivenessApiData, setCreateLivenessApiData] = React.useState(null)
  const [processing, setProcessing] = React.useState(false)
  const [finished, setFinished] = React.useState(false)

  const hasIdentityPool = Boolean(
    import.meta.env.VITE_AWS_COGNITO_IDENTITY_POOL_ID &&
      String(import.meta.env.VITE_AWS_COGNITO_IDENTITY_POOL_ID).trim() !== '',
  )

  const fetchCreateLiveness = React.useCallback(async () => {
    setCreateLivenessApiData(null)
    setLoading(true)
    try {
      await ensureAmplifyConfigured()
      const data = await borrowerApi('/liveness/amplify-session', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      if (!data.sessionId || !data.region) {
        throw new Error('Invalid response from liveness session API.')
      }
      setCreateLivenessApiData({ sessionId: data.sessionId, region: data.region })
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e?.message || e))
      onFailed?.({ message: err.message, status: 'session_error' })
      setCreateLivenessApiData(null)
      setFinished(true)
    } finally {
      setLoading(false)
    }
  }, [onFailed])

  React.useEffect(() => {
    if (!borrowerId || !hasIdentityPool) {
      setLoading(false)
      return
    }
    void fetchCreateLiveness()
  }, [borrowerId, hasIdentityPool, fetchCreateLiveness])

  const pollResults = React.useCallback(async (sessionId) => {
    const path = `/liveness/amplify-session/${encodeURIComponent(sessionId)}/results`
    for (let i = 0; i < 25; i += 1) {
      try {
        const data = await borrowerApi(path, { method: 'GET' })
        if (data.status !== 'pending') {
          return data
        }
      } catch (e) {
        if (e.status === 422 && e.body) {
          return e.body
        }
        if (e.status === 429 && e.body) {
          return e.body
        }
        throw e
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
    throw new Error('Timed out waiting for liveness results.')
  }, [])

  const handleAnalysisComplete = React.useCallback(async () => {
    if (!createLivenessApiData?.sessionId) return
    const sid = createLivenessApiData.sessionId
    setCreateLivenessApiData(null)
    setProcessing(true)
    try {
      const data = await pollResults(sid)
      const live = data.isLive === true || data.status === 'verified'
      setFinished(true)
      if (live) {
        onVerified?.(data)
      } else {
        onFailed?.(data)
      }
    } catch (e) {
      setFinished(true)
      onFailed?.(e)
    } finally {
      setProcessing(false)
    }
  }, [createLivenessApiData, onFailed, onVerified, pollResults])

  const isHandlingError = React.useRef(false)

  const handleError = React.useCallback(
    async (error) => {
      console.error('Liveness error:', error)
      if (isHandlingError.current) return
      isHandlingError.current = true
      setLoading(true)
      try {
        await fetchCreateLiveness()
      } finally {
        isHandlingError.current = false
      }
    },
    [fetchCreateLiveness],
  )

  if (!borrowerId || !hasIdentityPool) {
    return null
  }

  if (finished) {
    return null
  }

  return (
    <ThemeProvider>
      {loading || processing ? (
        <div className="flex justify-center py-8">
          <Loader size="large" />
        </div>
      ) : createLivenessApiData ? (
        <FaceLivenessDetector
          sessionId={createLivenessApiData.sessionId}
          region={createLivenessApiData.region}
          onAnalysisComplete={() => void handleAnalysisComplete()}
          onError={(e) => void handleError(e)}
        />
      ) : null}
    </ThemeProvider>
  )
}
