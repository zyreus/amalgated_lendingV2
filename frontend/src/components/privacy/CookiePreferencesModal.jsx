import { useEffect, useState } from 'react'
import {
  getDefaultCookiePreferences,
  loadCookiePreferences,
  saveCookiePreferences,
} from '../../utils/cookieUtils.js'

export const COOKIE_PREFERENCES_EVENT = 'amalgated:open-cookie-preferences'
export const COOKIE_PREFERENCES_UPDATED_EVENT = 'amalgated:cookie-preferences-updated'

export default function CookiePreferencesModal({ isOpen, onClose, onSaved }) {
  const [preferences, setPreferences] = useState(getDefaultCookiePreferences)

  useEffect(() => {
    if (!isOpen) return
    const body = document.body
    const previous = body.style.overflow
    body.style.overflow = 'hidden'
    return () => {
      body.style.overflow = previous
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const stored = loadCookiePreferences()
    setPreferences(stored || getDefaultCookiePreferences())
  }, [isOpen])

  if (!isOpen) return null

  const toggle = (key) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const saveChanges = () => {
    const saved = saveCookiePreferences(preferences)
    window.dispatchEvent(new CustomEvent(COOKIE_PREFERENCES_UPDATED_EVENT, { detail: saved }))
    onSaved?.(saved)
    onClose?.()
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 px-4 py-6 backdrop-blur-sm sm:items-center"
      style={{ animation: 'cookie-fade-in 220ms ease-out' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-pref-title"
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 border-t-[3px] border-t-brand-primary bg-white shadow-2xl dark:border-[#1F2937] dark:border-t-brand-primary dark:bg-[#111827]"
        style={{ animation: 'cookie-slide-up 260ms ease-out' }}
      >
        <div className="border-b border-gray-200 px-6 py-4 dark:border-[#1F2937]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-primary">Preferences</p>
          <h2 id="cookie-pref-title" className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Cookie Preferences
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage your privacy settings. Essential cookies are always enabled for platform security and core functionality.
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <CookieRow
            title="Essential Cookies"
            description="Required for login, security, fraud prevention, and basic website operation."
            checked
            disabled
            onToggle={() => {}}
          />
          <CookieRow
            title="Analytics Cookies"
            description="Help us understand usage patterns and improve lending workflows."
            checked={preferences.analytics}
            onToggle={() => toggle('analytics')}
          />
          <CookieRow
            title="Marketing Cookies"
            description="Used to personalize offers and measure campaign effectiveness."
            checked={preferences.marketing}
            onToggle={() => toggle('marketing')}
          />
          <CookieRow
            title="Preference Cookies"
            description="Remember your UI and interaction preferences across visits."
            checked={preferences.preferences}
            onToggle={() => toggle('preferences')}
          />
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-gray-200 px-6 py-4 sm:flex-row sm:justify-end dark:border-[#1F2937]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 dark:border-[#1F2937] dark:bg-[#1F2937] dark:text-gray-100 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveChanges}
            className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-primary-hover"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  )
}

function CookieRow({ title, description, checked, disabled = false, onToggle }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 p-4 dark:border-[#1F2937]">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onToggle}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
          checked ? 'bg-brand-primary' : 'bg-gray-300 dark:bg-gray-700'
        } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
