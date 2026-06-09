import { useEffect, useRef, useState } from 'react'
import { getApplications } from '../services/applicationsService.js'

export function useApplications({ status, search, page, perPage = 15, refreshKey = 0 }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const lastRefreshKey = useRef(refreshKey)

  useEffect(() => {
    const controller = new AbortController()
    const force = refreshKey !== lastRefreshKey.current
    lastRefreshKey.current = refreshKey
    setLoading(true)
    setError(null)

    getApplications({ status, search, page, perPage }, { signal: controller.signal, force })
      .then((nextData) => {
        if (!controller.signal.aborted) setData(nextData)
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [status, search, page, perPage, refreshKey])

  return {
    data,
    rows: data?.data || [],
    loading,
    error,
    meta: data,
  }
}
