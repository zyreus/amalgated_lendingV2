const SCRIPT_SRC = 'https://cdn.faceio.net/fio.js'
const ATTR = 'data-lending-faceio'

let loadPromise = null

/**
 * Injects fio.js once. Global index.html no longer loads it (avoids appendChild
 * before <body> and errors on pages that never use FaceIO).
 */
export function loadFaceIOSdk() {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (typeof window.faceIO === 'function') return Promise.resolve(true)

  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve) => {
    const existing = document.querySelector(`script[${ATTR}]`)
    if (existing) {
      const done = () => resolve(typeof window.faceIO === 'function')
      if (existing.getAttribute('data-loaded') === '1') {
        done()
        return
      }
      existing.addEventListener('load', () => {
        existing.setAttribute('data-loaded', '1')
        done()
      })
      existing.addEventListener('error', () => resolve(false))
      return
    }

    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.setAttribute(ATTR, '1')
    s.onload = () => {
      s.setAttribute('data-loaded', '1')
      resolve(typeof window.faceIO === 'function')
    }
    s.onerror = () => resolve(false)

    const parent = document.body || document.documentElement
    parent.appendChild(s)
  })

  return loadPromise
}
