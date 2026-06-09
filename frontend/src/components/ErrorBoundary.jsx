import { Component } from 'react'

function isDynamicImportError(error) {
  const text = `${error?.message || ''} ${error?.stack || ''}`.toLowerCase()
  return (
    text.includes('failed to fetch dynamically imported module') ||
    text.includes('error loading dynamically imported module') ||
    text.includes('importing a module script failed') ||
    text.includes('loading chunk') ||
    text.includes('chunkloaderror')
  )
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error) {
    if (typeof window === 'undefined' || !isDynamicImportError(error)) return

    const key = 'amalgated:chunk-reload-attempt'
    const lastAttempt = Number(window.sessionStorage.getItem(key) || 0)
    const now = Date.now()
    if (now - lastAttempt < 30000) return

    window.sessionStorage.setItem(key, String(now))
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      const err = this.state.error
      const chunkError = isDynamicImportError(err)
      return (
        <div className="min-h-screen bg-gray-100 p-8 text-gray-900 dark:bg-[#0F172A] dark:text-gray-100">
          <h1 className="text-xl font-semibold text-red-600 dark:text-red-400">Something went wrong</h1>
          {chunkError ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">The application updated while this page was open.</p>
              <p className="mt-1">Reload the page to fetch the latest dashboard files.</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Reload page
              </button>
            </div>
          ) : null}
          <pre className="mt-4 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded border border-gray-200 bg-white p-4 text-sm dark:border-gray-700 dark:bg-gray-900">
            {err?.message || String(err)}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}
