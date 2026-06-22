import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Root from './Root.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

/**
 * Amplify is configured lazily inside `amplifyLivenessConfig.js` and only
 * pulled in by the FaceLiveness components themselves — keeps ~200–400 KB
 * of `aws-amplify` core out of the initial SPA bundle.
 */

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>,
)

function isLoopbackHost() {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname.toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
}

if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    // Vite dev must never keep a stale production SW (it breaks /borrower/* routes).
    navigator.serviceWorker.getRegistrations().then((regs) => Promise.all(regs.map((r) => r.unregister())))
  } else if (import.meta.env.PROD) {
    const registerWorker = () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          registration.update().catch(() => {})
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          }
        })
        .catch(() => {
          // Ignore registration errors to avoid impacting app boot.
        })
    }

    if (isLoopbackHost()) {
      // Local preview: drop legacy SW caches that served the old dark offline.html.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        Promise.all(regs.map((r) => r.unregister())).finally(registerWorker)
      })
    } else if ('requestIdleCallback' in window) {
      window.requestIdleCallback(registerWorker, { timeout: 3000 })
    } else {
      window.setTimeout(registerWorker, 1200)
    }
  }
}
