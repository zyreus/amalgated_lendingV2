import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import LoadingSpinner from '../components/loading/LoadingSpinner.jsx'
import ProgressUpload from '../components/loading/ProgressUpload.jsx'
import {
  setAuthOverlay as busSetAuthOverlay,
  subscribeGlobalLoading,
} from '../utils/globalLoadingBus.js'

const LoadingContext = createContext(null)

export function useGlobalLoading() {
  const ctx = useContext(LoadingContext)
  if (!ctx) {
    return {
      pendingRequests: 0,
      slowVisible: false,
      authOverlay: null,
      setAuthOverlay: busSetAuthOverlay,
      isUploading: false,
      uploadProgress: {},
    }
  }
  return ctx
}

function GlobalSlowBar({ visible }) {
  if (!visible) return null
  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-1 overflow-hidden bg-transparent"
      role="progressbar"
      aria-label="Loading"
      aria-valuetext="Request in progress"
    >
      <div className="global-loading-bar h-full w-1/3 animate-[loadingSlide_1.1s_ease-in-out_infinite] bg-brand-primary dark:bg-red-500" />
      <style>{`
        @keyframes loadingSlide {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(420%); }
        }
      `}</style>
    </div>,
    document.body,
  )
}

function AuthFullScreenOverlay({ label }) {
  if (!label) return null
  return createPortal(
    <div
      className="fixed inset-0 z-[250] flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm dark:bg-[#0F172A]/92"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={label}
    >
      <LoadingSpinner size="xl" label={label} className="text-brand-primary dark:text-red-400" />
      <p className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">{label}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Please wait…</p>
    </div>,
    document.body,
  )
}

function GlobalUploadBanner({ uploads, isUploading }) {
  if (!isUploading) return null
  const entries = Object.entries(uploads || {})
  if (!entries.length) return null
  const [id, meta] = entries[entries.length - 1]
  return createPortal(
    <div className="fixed bottom-4 left-4 right-4 z-[190] mx-auto max-w-lg sm:left-auto sm:right-6 sm:max-w-md">
      <ProgressUpload percent={meta?.percent ?? 0} label={meta?.label || 'Uploading...'} show preventNavigation />
    </div>,
    document.body,
  )
}

export function LoadingProvider({ children }) {
  const [state, setState] = useState(() => ({
    pendingRequests: 0,
    slowVisible: false,
    authOverlay: null,
    uploadProgress: {},
    isUploading: false,
  }))

  useEffect(() => subscribeGlobalLoading(setState), [])

  const value = useMemo(
    () => ({
      ...state,
      setAuthOverlay: busSetAuthOverlay,
    }),
    [state],
  )

  return (
    <LoadingContext.Provider value={value}>
      {children}
      <GlobalSlowBar visible={state.slowVisible && !state.authOverlay} />
      <AuthFullScreenOverlay label={state.authOverlay?.label} />
      <GlobalUploadBanner uploads={state.uploadProgress} isUploading={state.isUploading} />
    </LoadingContext.Provider>
  )
}
