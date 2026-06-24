import { admin } from '../../components/AdminUi.jsx'
import { useSettingsCategory } from '../context/SettingsCategoryContext.jsx'
import SettingsBreadcrumb from './SettingsBreadcrumb.jsx'
import SettingsReadOnlyBanner from './SettingsReadOnlyBanner.jsx'
import SettingsSaveBar from './SettingsSaveBar.jsx'

/**
 * Shared wrapper for settings category pages — breadcrumb, optional lead text, save bar.
 */
export default function SettingsPageShell({ breadcrumb = [], lead, children, saveKeys, saveLabel }) {
  const { readOnly } = useSettingsCategory()

  return (
    <div className="min-w-0 space-y-6">
      {readOnly ? <SettingsReadOnlyBanner /> : null}
      {breadcrumb.length > 0 ? <SettingsBreadcrumb items={breadcrumb} /> : null}
      {lead ? <p className={`-mt-2 text-sm leading-relaxed ${admin.textMuted}`}>{lead}</p> : null}
      {children}
      {saveKeys?.length ? <SettingsSaveBar keys={saveKeys} label={saveLabel} /> : null}
    </div>
  )
}
