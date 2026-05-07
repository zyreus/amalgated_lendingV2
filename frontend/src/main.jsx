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

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const registerWorker = () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {
      // Ignore registration errors to avoid impacting app boot.
    })
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(registerWorker, { timeout: 3000 })
  } else {
    window.setTimeout(registerWorker, 1200)
  }
}
