const CACHE_PREFIX = 'amalgated.cache.v1'

function isBrowser() {
  return typeof window !== 'undefined'
}

function getStorage(storageType = 'local') {
  if (!isBrowser()) return null
  return storageType === 'session' ? window.sessionStorage : window.localStorage
}

function getVersion() {
  return (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_CACHE_VERSION) || '1'
}

function getCacheKey(key) {
  return `${CACHE_PREFIX}:${getVersion()}:${key}`
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function isValidPayload(payload) {
  return (
    payload &&
    typeof payload === 'object' &&
    typeof payload.createdAt === 'number' &&
    typeof payload.expiresAt === 'number' &&
    'data' in payload
  )
}

export function setCache(key, data, expiryMinutes, options = {}) {
  const storage = getStorage(options.storage)
  if (!storage || !key || !Number.isFinite(expiryMinutes) || expiryMinutes <= 0) return false

  const now = Date.now()
  const payload = {
    key,
    version: getVersion(),
    createdAt: now,
    expiresAt: now + expiryMinutes * 60 * 1000,
    data,
  }

  try {
    storage.setItem(getCacheKey(key), JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export function getCache(key, options = {}) {
  const storage = getStorage(options.storage)
  if (!storage || !key) return null

  const cacheKey = getCacheKey(key)
  const raw = storage.getItem(cacheKey)
  if (!raw) return null

  const payload = safeJsonParse(raw)
  if (!isValidPayload(payload)) {
    storage.removeItem(cacheKey)
    return null
  }

  if (payload.expiresAt <= Date.now()) {
    storage.removeItem(cacheKey)
    return null
  }

  return payload.data
}

export function clearExpiredCache(options = {}) {
  const storage = getStorage(options.storage)
  if (!storage) return 0

  const now = Date.now()
  const deletions = []
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i)
    if (!key || !key.startsWith(CACHE_PREFIX)) continue

    const payload = safeJsonParse(storage.getItem(key))
    if (!isValidPayload(payload) || payload.expiresAt <= now) {
      deletions.push(key)
    }
  }

  deletions.forEach((key) => storage.removeItem(key))
  return deletions.length
}

export function clearAllCache(options = {}) {
  const storage = getStorage(options.storage)
  if (!storage) return 0

  const deletions = []
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i)
    if (key && key.startsWith(CACHE_PREFIX)) deletions.push(key)
  }

  deletions.forEach((key) => storage.removeItem(key))
  return deletions.length
}

export function getCacheMeta(key, options = {}) {
  const storage = getStorage(options.storage)
  if (!storage || !key) return null
  const payload = safeJsonParse(storage.getItem(getCacheKey(key)))
  if (!isValidPayload(payload)) return null
  return {
    createdAt: payload.createdAt,
    expiresAt: payload.expiresAt,
    version: payload.version,
  }
}
