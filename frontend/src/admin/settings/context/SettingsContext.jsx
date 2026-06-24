import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client.js'
import { useToast } from '../../context/ToastContext.jsx'
import {
  SETTINGS_DEFAULTS,
  SETTINGS_LABELS,
  WIRED_SETTINGS_KEYS,
  mergeSettingsFromApi,
} from '../settingsDefaults.js'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard.js'
import { filterManageableKeys } from '../settingsPermissions.js'
import { useAdminApiAuth } from '../../context/useAdminApiAuth.js'

const SettingsContext = createContext(null)

function parseApiFieldErrors(body) {
  if (!body?.errors || typeof body.errors !== 'object') return {}
  const mapped = {}
  Object.entries(body.errors).forEach(([path, messages]) => {
    const msg = Array.isArray(messages) ? messages[0] : String(messages)
    mapped[path] = msg
  })
  return mapped
}

export function SettingsProvider({ children }) {
  const { showToast } = useToast()
  const { can } = useAdminApiAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sections, setSections] = useState(SETTINGS_DEFAULTS)
  const [initialSections, setInitialSections] = useState(SETTINGS_DEFAULTS)
  const [fieldErrors, setFieldErrors] = useState({})
  const [lastSavedAt, setLastSavedAt] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api('/settings')
      const merged = mergeSettingsFromApi(res.settings || {})
      setSections(merged)
      setInitialSections(merged)
      setFieldErrors({})
    } catch (e) {
      showToast(e.message || 'Failed loading settings', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  const isDirty = useMemo(
    () => JSON.stringify(sections) !== JSON.stringify(initialSections),
    [sections, initialSections],
  )

  useUnsavedChangesGuard(isDirty)

  const patch = useCallback((key, partial) => {
    setFieldErrors((prev) => {
      const next = { ...prev }
      Object.keys(partial).forEach((field) => {
        delete next[`${key}.${field}`]
      })
      return next
    })
    setSections((prev) => {
      const next = { ...prev, [key]: { ...prev[key], ...partial } }
      if (key === 'loan_defaults' && partial.interest_rate != null) {
        next.loan_defaults.default_annual_rate = partial.interest_rate
      }
      if (key === 'loan_configuration' && partial.penalty_rate != null) {
        next.loan_defaults = { ...next.loan_defaults, penalty_percent: partial.penalty_rate }
      }
      return next
    })
  }, [])

  const fieldError = useCallback(
    (key, field) => fieldErrors[`${key}.${field}`] || fieldErrors[field],
    [fieldErrors],
  )

  const saveKeys = useCallback(
    async (keys) => {
      const allowed = filterManageableKeys(can, keys)
      if (allowed.length === 0) {
        showToast('You do not have permission to save these settings.', 'error')
        return false
      }

      setSaving(true)
      setFieldErrors({})

      const payload = {}
      allowed.forEach((key) => {
        payload[key] = sections[key] ?? {}
      })

      try {
        const res = await api('/settings/batch', {
          method: 'POST',
          body: JSON.stringify({ settings: payload }),
        })

        const saved = res.settings || {}
        setInitialSections((prev) => {
          const next = { ...prev }
          allowed.forEach((key) => {
            next[key] = saved[key]?.value ? { ...next[key], ...saved[key].value } : { ...sections[key] }
          })
          return next
        })
        setLastSavedAt(new Date())
        showToast('Settings saved successfully.', 'success')
        return true
      } catch (e) {
        const errors = parseApiFieldErrors(e.body)
        if (Object.keys(errors).length) {
          setFieldErrors(errors)
          showToast('Please fix the highlighted fields and try again.', 'error')
        } else {
          showToast(e.message || 'Failed to save settings.', 'error')
        }
        return false
      } finally {
        setSaving(false)
      }
    },
    [can, sections, showToast],
  )

  const cancelChanges = useCallback(() => {
    setSections(initialSections)
    setFieldErrors({})
    showToast('Changes reverted.', 'success')
  }, [initialSections, showToast])

  const value = useMemo(
    () => ({
      loading,
      saving,
      sections,
      initialSections,
      isDirty,
      fieldErrors,
      fieldError,
      lastSavedAt,
      patch,
      saveKeys,
      cancelChanges,
      reload: load,
      WIRED_SETTINGS_KEYS,
    }),
    [
      loading,
      saving,
      sections,
      initialSections,
      isDirty,
      fieldErrors,
      fieldError,
      lastSavedAt,
      patch,
      saveKeys,
      cancelChanges,
      load,
    ],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
