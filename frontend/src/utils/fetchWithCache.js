import { clearExpiredCache, getCache, setCache } from './cacheManager.js'

function buildCacheKey(url, options) {
  const method = (options.method || 'GET').toUpperCase()
  const headers = options.headers ? JSON.stringify(options.headers) : ''
  return `${method}:${url}:${headers}`
}

export async function fetchWithCache(url, expiryMinutes = 10, options = {}) {
  const {
    forceRefresh = false,
    fetchOptions = {},
    parser = async (response) => response.json(),
    storage = 'local',
  } = options

  const method = (fetchOptions.method || 'GET').toUpperCase()
  if (method !== 'GET') {
    throw new Error('fetchWithCache only supports GET requests.')
  }

  clearExpiredCache({ storage })

  const cacheKey = buildCacheKey(url, fetchOptions)
  if (!forceRefresh) {
    const cachedData = getCache(cacheKey, { storage })
    if (cachedData !== null) return cachedData
  }

  const response = await fetch(url, {
    ...fetchOptions,
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(fetchOptions.headers || {}),
    },
  })

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  const data = await parser(response)
  setCache(cacheKey, data, expiryMinutes, { storage })
  return data
}
