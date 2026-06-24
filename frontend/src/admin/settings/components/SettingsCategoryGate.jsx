import { useAdminApiAuth } from '../../context/useAdminApiAuth.js'
import {
  canAccessSettingsCategory,
  canManageSettingsCategory,
} from '../settingsPermissions.js'
import { SettingsCategoryProvider } from '../context/SettingsCategoryContext.jsx'
import SettingsAccessDenied from './SettingsAccessDenied.jsx'

export default function SettingsCategoryGate({ categoryId, children }) {
  const { can } = useAdminApiAuth()

  if (!canAccessSettingsCategory(can, categoryId)) {
    return <SettingsAccessDenied />
  }

  const canManage = canManageSettingsCategory(can, categoryId)

  return (
    <SettingsCategoryProvider readOnly={!canManage} canManage={canManage}>
      {children}
    </SettingsCategoryProvider>
  )
}
