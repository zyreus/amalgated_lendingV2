import { useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronLeft, Search, Settings2 } from 'lucide-react'
import { AdminPageSkeleton } from '../../components/AppSkeletons.jsx'
import { admin } from '../components/AdminUi.jsx'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { SettingsProvider, useSettings } from './context/SettingsContext.jsx'
import { SETTINGS_CATEGORIES, findCategoryByPath } from './settingsNavConfig.js'
import { canAccessSettingsCategory, isSettingsCategoryReadOnly } from './settingsPermissions.js'

function SettingsLayoutInner() {
  const { loading, isDirty } = useSettings()
  const { can } = useAdminApiAuth()
  const location = useLocation()
  const [query, setQuery] = useState('')

  const accessibleCategories = useMemo(
    () => SETTINGS_CATEGORIES.filter((c) => canAccessSettingsCategory(can, c.id)),
    [can],
  )

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return accessibleCategories
    return accessibleCategories.filter((c) => {
      const hay = `${c.label} ${c.description}`.toLowerCase()
      return hay.includes(q)
    })
  }, [query, accessibleCategories])

  if (loading) return <AdminPageSkeleton />

  const isHub = location.pathname === '/admin/settings'
  const activeCategory = findCategoryByPath(location.pathname)

  return (
    <div className="w-full min-w-0 pb-6">
      <div className="sticky top-0 z-10 -mx-3 border-b border-gray-200 bg-gray-100/90 px-3 py-4 backdrop-blur dark:border-[#1F2937] dark:bg-[#0F172A]/85 sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            {!isHub && activeCategory ? (
              <Link
                to="/admin/settings"
                className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition hover:text-brand-primary dark:text-gray-400"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                All settings
              </Link>
            ) : null}
            <div className="flex min-w-0 items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-brand-primary shadow-sm dark:border-[#1F2937] dark:bg-[#111827]">
                {activeCategory && !isHub ? (
                  <activeCategory.icon className="h-5 w-5" aria-hidden />
                ) : (
                  <Settings2 className="h-5 w-5" aria-hidden />
                )}
              </span>
              <div className="min-w-0">
                {!isHub ? (
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-primary">Settings</p>
                ) : null}
                <h1 className={admin.pageTitle}>{isHub ? 'Settings' : activeCategory?.label ?? 'Settings'}</h1>
                <p className={admin.pageSubtitle}>
                  {isHub
                    ? 'Configure your lending platform — organized by category.'
                    : activeCategory?.description}
                  {isDirty ? (
                    <span className="font-medium text-amber-600 dark:text-amber-400"> · Unsaved changes</span>
                  ) : null}
                </p>
              </div>
            </div>
          </div>
          {isHub ? (
            <div className="relative w-full min-w-0 lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search settings categories…"
                className={`w-full pl-9 ${admin.input}`}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className={`mt-6 grid min-w-0 gap-6 ${isHub ? '' : 'lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]'}`}>
        {!isHub ? (
          <aside className="min-w-0">
            <div className={`${admin.cardNoHover} p-2 lg:sticky lg:top-[7.5rem]`}>
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Categories
              </p>
              <nav className="flex max-w-full flex-nowrap gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
                <NavLink
                  to="/admin/settings"
                  end
                  className={({ isActive }) =>
                    `inline-flex shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium transition lg:w-full ${
                      isActive
                        ? 'bg-brand-primary/10 text-brand-primary'
                        : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-[#1F2937]'
                    }`
                  }
                >
                  Overview
                </NavLink>
                {filteredCategories.length === 0 ? (
                  <p className={`px-2 py-2 text-xs ${admin.textMuted}`}>No categories match your search.</p>
                ) : (
                  filteredCategories.map((cat) => {
                    const readOnly = isSettingsCategoryReadOnly(can, cat.id)
                    return (
                      <NavLink
                        key={cat.id}
                        to={cat.to}
                        className={({ isActive }) =>
                          `inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition lg:w-full ${
                            isActive
                              ? 'bg-brand-primary/10 text-brand-primary'
                              : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-[#1F2937]'
                          }`
                        }
                      >
                        <cat.icon className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="truncate">{cat.label}</span>
                        {readOnly ? (
                          <span className="ml-auto hidden rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 lg:inline dark:bg-sky-950/50 dark:text-sky-300">
                            View
                          </span>
                        ) : null}
                      </NavLink>
                    )
                  })
                )}
              </nav>
            </div>
          </aside>
        ) : null}

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default function SettingsLayout() {
  return (
    <SettingsProvider>
      <SettingsLayoutInner />
    </SettingsProvider>
  )
}
