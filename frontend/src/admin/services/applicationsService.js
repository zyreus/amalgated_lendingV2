import { api } from '../api/client.js'

const applicationsCache = new Map()

function cacheKey(params) {
  return JSON.stringify({
    status: params.status || 'all',
    search: params.search || '',
    page: Number(params.page || 1),
    perPage: Number(params.perPage || 15),
  })
}

export function clearApplicationsCache() {
  applicationsCache.clear()
}

export async function getApplications(params, options = {}) {
  const key = cacheKey(params)
  if (!options.force && applicationsCache.has(key)) {
    return applicationsCache.get(key)
  }

  const q = new URLSearchParams({
    page: String(params.page || 1),
    per_page: String(params.perPage || 15),
  })

  if (params.status && params.status !== 'all') q.set('status', params.status)
  if (params.search?.trim()) q.set('search', params.search.trim())

  const res = await api(`/applications?${q.toString()}`, { signal: options.signal })
  applicationsCache.set(key, res.data)
  return res.data
}

export async function preApproveApplication(id, body = {}) {
  clearApplicationsCache()
  return api(`/applications/${id}/pre-approve`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function returnApplicationToPending(id, body = {}) {
  clearApplicationsCache()
  return api(`/applications/${id}/return-to-pending`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
