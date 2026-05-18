import { useEffect, useState } from 'react'
import {
  getDefaultCookiePreferences,
  loadCookiePreferences,
  saveCookiePreferences,
} from '../../utils/cookieUtils.js'
import {
  COOKIE_PREFERENCES_EVENT,
  COOKIE_PREFERENCES_UPDATED_EVENT,
} from './CookiePreferencesModal.jsx'

export default function CookieBanner({ onOpenPreferences, onConsentSaved }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const saved = loadCookiePreferences()
    setVisible(!saved?.consentGiven)
  }, [])

  useEffect(() => {
    const onUpdated = () => setVisible(false)
    window.addEventListener(COOKIE_PREFERENCES_UPDATED_EVENT, onUpdated)
    return () => window.removeEventListener(COOKIE_PREFERENCES_UPDATED_EVENT, onUpdated)
  }, [])

  if (!visible) return null

  const applyConsent = (nextPreferences) => {
    const saved = saveCookiePreferences(nextPreferences)
    setVisible(false)
    onConsentSaved?.(saved)
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[65] px-3 pb-3 sm:px-6 sm:pb-6">
      <div
        className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200/80 bg-brand-cream/95 p-4 shadow-[0_16px_48px_rgba(217,34,67,0.1)] backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/95 sm:p-5"
        style={{ animation: 'cookie-slide-up 240ms ease-out' }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-primary">Privacy Controls</p>
            <h2 className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-50 sm:text-lg">
              We use cookies to secure and improve your lending experience.
            </h2>
            <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">
              Essential cookies keep core features available. You can accept all cookies, reject non-essential cookies, or choose your preferences.
            </p>
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-3 md:w-auto">
            <button
              type="button"
              onClick={() =>
                applyConsent({
                  ...getDefaultCookiePreferences(),
                  analytics: true,
                  marketing: true,
                  preferences: true,
                })
              }
              className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-primary-hover"
            >
              Accept All
            </button>
            <button
              type="button"
              onClick={() => applyConsent(getDefaultCookiePreferences())}
              className="rounded-xl border border-black/15 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-white/20 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Reject Non-Essential
            </button>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent(COOKIE_PREFERENCES_EVENT))
                onOpenPreferences?.()
              }}
              className="rounded-xl border border-black/15 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-white/20 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Manage Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
