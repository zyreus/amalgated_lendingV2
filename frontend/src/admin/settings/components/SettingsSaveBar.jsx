import { admin } from '../../components/AdminUi.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { useSettingsCategory } from '../context/SettingsCategoryContext.jsx'

function formatSavedTime(date) {
  if (!date) return null
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function SettingsSaveBar({ keys, label = 'Save changes' }) {
  const { isDirty, saving, cancelChanges, saveKeys, lastSavedAt } = useSettings()
  const { readOnly } = useSettingsCategory()

  if (readOnly) return null

  return (
    <div
      className="sticky bottom-0 z-20 -mx-1 mt-8 border-t border-gray-200 bg-white/95 px-1 py-3 shadow-[0_-8px_32px_rgba(15,23,42,0.06)] backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-[#1F2937] dark:bg-[#0F172A]/95 dark:supports-[backdrop-filter]:bg-[#0F172A]/80 sm:-mx-2 sm:px-2"
      role="region"
      aria-label="Save settings"
    >
      <div className="mx-auto flex max-w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
            {isDirty ? (
              <>
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" aria-hidden />
                Unsaved changes
              </>
            ) : saving ? (
              'Saving your changes…'
            ) : (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                All changes saved
              </>
            )}
          </p>
          {!isDirty && lastSavedAt ? (
            <p className={`text-[11px] ${admin.textMuted}`}>Last saved at {formatSavedTime(lastSavedAt)}</p>
          ) : (
            <p className={`text-[11px] ${admin.textMuted}`}>Changes apply after you save.</p>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={cancelChanges}
            className={`${admin.btnSecondary} w-full sm:w-auto`}
            disabled={!isDirty || saving}
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => saveKeys(keys)}
            disabled={!isDirty || saving}
            className={`${admin.btnPrimary} w-full sm:w-auto disabled:opacity-60`}
          >
            {saving ? 'Saving…' : label}
          </button>
        </div>
      </div>
    </div>
  )
}
