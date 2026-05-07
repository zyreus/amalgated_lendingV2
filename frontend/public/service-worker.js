const SW_VERSION = 'amalgated-sw-v1'
const STATIC_CACHE = `${SW_VERSION}-static`
const API_CACHE = `${SW_VERSION}-api`
const OFFLINE_URL = '/offline.html'

const STATIC_ASSETS = ['/', '/index.html', '/favicon.svg', '/amalgated-lending-logo.svg', OFFLINE_URL]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => ![STATIC_CACHE, API_CACHE].includes(key)).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  )
})

function isApiGet(request) {
  return request.method === 'GET' && new URL(request.url).pathname.startsWith('/api/')
}

function isStaticAsset(request) {
  if (request.method !== 'GET') return false
  const { pathname } = new URL(request.url)
  return (
    pathname.startsWith('/assets/') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.gif') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js')
  )
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request, { ignoreSearch: false })
  if (cached) return cached

  const response = await fetch(request)
  if (response && response.ok) {
    cache.put(request, response.clone())
  }
  return response
}

async function networkFirstForApi(request) {
  const cache = await caches.open(API_CACHE)

  try {
    const response = await fetch(request)
    if (response && response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await cache.match(request, { ignoreSearch: false })
    if (cached) return cached
    return new Response(JSON.stringify({ message: 'Offline. Cached API data unavailable.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (isApiGet(request)) {
    event.respondWith(networkFirstForApi(request))
    return
  }

  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE)
        return cache.match(OFFLINE_URL) || cache.match('/index.html')
      })
    )
  }
})
