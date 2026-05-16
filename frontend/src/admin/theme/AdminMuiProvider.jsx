import { createContext, useContext, useEffect, useMemo } from 'react'
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material'

const AdminMuiThemeContext = createContext(null)

function clearDarkClass() {
  if (typeof document === 'undefined') return
  document.documentElement.classList.remove('dark')
}

/**
 * App-wide theme: light only. MUI palette + Tailwind `dark:` (inactive — `.dark` is never set on `html`).
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
        palette: {
          mode: 'light',
          /** Matches Tailwind `@theme` — primary #E63946, surfaces #F8F9FA / #FFFFFF */
          primary: { main: '#E63946', dark: '#C72F3A', light: '#FF6B6B' },
          error: { main: '#E63946' },
          background: { default: '#FFFFFF', paper: '#FFFFFF' },
          text: { primary: '#1D1D1F', secondary: '#6B7280' },
          divider: 'rgba(29, 29, 31, 0.08)',
        },
        shape: { borderRadius: 16 },
        transitions: { duration: { shortest: 200 } },
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
