/** Maps settings keys to granular manage permissions (mirrors backend SettingsAuthorization). */
export const SETTINGS_KEY_PERMISSIONS = {
  company: 'settings.general.manage',
  locale: 'settings.general.manage',
  branding: 'settings.documents.manage',
  loan_defaults: 'settings.loans.manage',
  loan_configuration: 'settings.loans.manage',
  interest_settings: 'settings.loans.manage',
  collection_settings: 'settings.collections.manage',
  payment_settings: 'settings.financial.manage',
  notifications: 'settings.communication.manage',
  email_settings: 'settings.communication.manage',
  website_chat: 'settings.communication.manage',
  credit_scoring: 'settings.operations.manage',
  reports: 'settings.operations.manage',
  integrations: 'settings.operations.manage',
  security: 'settings.security.manage',
  audit: 'settings.security.manage',
  system: 'settings.system.manage',
  log_cleanup: 'settings.system.manage',
}

export const SETTINGS_CATEGORY_PERMISSIONS = {
  general: 'settings.general.manage',
  users: 'settings.view',
  loans: 'settings.loans.manage',
  collections: 'settings.collections.manage',
  financial: 'settings.financial.manage',
  communication: 'settings.communication.manage',
  documents: 'settings.documents.manage',
  operations: 'settings.operations.manage',
  security: 'settings.security.manage',
  system: 'settings.system.manage',
}

const ALL_MANAGE_PERMS = [...new Set(Object.values(SETTINGS_KEY_PERMISSIONS))]

/** Full settings access (legacy super-admin perm). */
export function hasSettingsManageAll(can) {
  return can('settings.manage')
}

export function canViewSettings(can) {
  if (hasSettingsManageAll(can) || can('settings.view')) return true
  return ALL_MANAGE_PERMS.some((p) => can(p))
}

export function canManageSettingsKey(can, key) {
  if (hasSettingsManageAll(can)) return true
  const perm = SETTINGS_KEY_PERMISSIONS[key]
  return perm ? can(perm) : false
}

export function canManageSettingsCategory(can, categoryId) {
  if (hasSettingsManageAll(can)) return true
  if (categoryId === 'users') return false
  const perm = SETTINGS_CATEGORY_PERMISSIONS[categoryId]
  return perm ? can(perm) : false
}

export function canAccessSettingsCategory(can, categoryId) {
  if (canManageSettingsCategory(can, categoryId)) return true
  if (can('settings.view')) return true
  if (categoryId === 'users') return can('users.view') || can('roles.manage')
  return false
}

export function isSettingsCategoryReadOnly(can, categoryId) {
  return canAccessSettingsCategory(can, categoryId) && !canManageSettingsCategory(can, categoryId)
}

export function filterManageableKeys(can, keys) {
  return keys.filter((key) => canManageSettingsKey(can, key))
}
