import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      const err = this.state.error
      return (
        <div className="min-h-screen bg-gray-100 p-8 text-gray-900 dark:bg-[#0F172A] dark:text-gray-100">
          <h1 className="text-xl font-semibold text-red-600 dark:text-red-400">Something went wrong</h1>
          <pre className="mt-4 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded border border-gray-200 bg-white p-4 text-sm dark:border-gray-700 dark:bg-gray-900">
            {err?.message || String(err)}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}
