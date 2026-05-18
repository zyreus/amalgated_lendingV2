import { createContext, useContext, useEffect, useMemo } from 'react'
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material'
import { muiPaletteFromFintech } from '../../theme/designTokens.js'

const AdminMuiThemeContext = createContext(null)

function clearDarkClass() {
  if (typeof document === 'undefined') return
  document.documentElement.classList.remove('dark')
}

/**
 * App-wide theme: light only. Navy + emerald fintech palette (aligned with `index.css` @theme).
 */
export function AdminMuiProvider({ children }) {
  useEffect(() => {
    clearDarkClass()
    try {
      localStorage.removeItem('ali_admin_theme')
      localStorage.removeItem('ali_admin_dark')
    } catch {
      /* ignore */
    }
  }, [])

  const theme = useMemo(
    () =>
      createTheme({
        palette: muiPaletteFromFintech(),
        shape: { borderRadius: 16 },
        transitions: { duration: { shortest: 200 } },
        typography: {
          fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      }),
    [],
  )

  const value = useMemo(
    () => ({
      mode: 'light',
      toggleMode: () => {},
      setMode: () => {},
    }),
    [],
  )

  return (
    <AdminMuiThemeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme={false} />
        <div className="min-h-screen transition-colors duration-300">{children}</div>
      </ThemeProvider>
    </AdminMuiThemeContext.Provider>
  )
}

export function useAdminMuiTheme() {
  const ctx = useContext(AdminMuiThemeContext)
  if (!ctx) throw new Error('useAdminMuiTheme must be used within AdminMuiProvider')
  return ctx
}

/** Alias for consumers that prefer “theme” naming */
export function useAdminTheme() {
  return useAdminMuiTheme()
}
