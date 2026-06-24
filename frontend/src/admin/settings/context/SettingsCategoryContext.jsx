import { createContext, useContext } from 'react'

const SettingsCategoryContext = createContext({ readOnly: false, canManage: true })

export function SettingsCategoryProvider({ readOnly, canManage, children }) {
  return (
    <SettingsCategoryContext.Provider value={{ readOnly, canManage }}>
      {children}
    </SettingsCategoryContext.Provider>
  )
}

export function useSettingsCategory() {
  return useContext(SettingsCategoryContext)
}
