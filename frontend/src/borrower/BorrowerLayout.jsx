import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import { useBorrowerAuth } from './context/useBorrowerAuth.js'
import { borrowerApi } from './api/client.js'
import { getLaravelStorageFileUrl } from '../utils/lendingLaravelApi.js'
import { COOKIE_PREFERENCES_EVENT } from '../components/privacy/CookiePreferencesModal.jsx'

/**
 * BorrowerNotificationsPage is only ever mounted inside the notifications modal
 * (toggled with the bell icon). Lazy loading keeps it out of the initial
 * borrower portal bundle so the dashboard paints faster.
 */
const BorrowerNotificationsPage = lazy(() => import('./pages/BorrowerNotificationsPage.jsx'))

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'B'
  const first = parts[0]?.[0] || ''
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : ''
  return `${first}${second}`.toUpperCase()
}

function isImagePath(path) {
  return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(String(path || ''))
}

function fallbackAvatar(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Borrower')}&background=fee2e2&color=b91c1c&size=96&bold=true`
}

const nav = [
  { to: '/borrower/dashboard', label: 'Dashboard' },
  { to: '/borrower/applications', label: 'Applications' },
  { to: '/borrower/apply-loan', label: 'Apply (wizard)' },
  { to: '/borrower/payments', label: 'Payments' },
  { to: '/borrower/chat', label: 'Chat' },
  { to: '/borrower/profile', label: 'Profile' },
  { to: '/borrower/security', label: 'Security' },
]

export default function BorrowerLayout() {
  const { user, logout } = useBorrowerAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifUnread, setNotifUnread] = useState(null)
  const [notifModalOpen, setNotifModalOpen] = useState(false)
  const avatarUrl = isImagePath(user?.profile_photo_path)
    ? getLaravelStorageFileUrl(user?.profile_photo_path)
    : isImagePath(user?.profile_photo_url)
      ? getLaravelStorageFileUrl(user?.profile_photo_url)
      : isImagePath(user?.id_document_path)
        ? getLaravelStorageFileUrl(user?.id_document_path)
        : isImagePath(user?.id_document_url)
          ? getLaravelStorageFileUrl(user?.id_document_url)
          : null

  useEffect(() => {
    if (!user) return undefined
    let cancelled = false
    const fetchCount = async () => {
      try {
        const res = await borrowerApi('/borrower/notifications/unread-count')
        if (!cancelled) setNotifUnread(typeof res.count === 'number' ? res.count : 0)
      } catch {
        if (!cancelled) setNotifUnread(null)
      }
    }
    fetchCount()
    const id = setInterval(fetchCount, 60_000)
    const onChange = () => fetchCount()
    window.addEventListener('borrower-notifications-changed', onChange)
    return () => {
      cancelled = true
      clearInterval(id)
      window.removeEventListener('borrower-notifications-changed', onChange)
    }
  }, [user])

  const asideBase =
    'fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-56 flex-col border-r border-gray-200 bg-white shadow-xl transition duration-300 ease-out dark:border-[#1F2937] dark:bg-gradient-to-b dark:from-[#0F172A] dark:via-[#0c1220] dark:to-[#020617] lg:translate-x-0'
  const sidebarTransform = mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'

  return (
    <div className="flex h-[100dvh] min-h-0 w-full max-w-full flex-col overflow-hidden bg-gray-100 text-gray-900 transition-colors duration-300 dark:bg-[#0F172A] dark:text-gray-100">
      {/* Mobile: dim background when drawer open */}
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside className={`${asideBase} ${sidebarTransform}`}>
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-gray-200 px-5 py-5 dark:border-[#1F2937]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#DC2626]">Borrower Portal</p>
            <div className="mt-2 flex items-center gap-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user?.name || 'Borrower'}
                  className="h-9 w-9 rounded-full border border-gray-200 object-cover dark:border-[#374151]"
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = fallbackAvatar(user?.name || 'Borrower')
                  }}
                />
              ) : (
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-200">
                  {initials(user?.name || 'Borrower')}
                </span>
              )}
              <p className="min-w-0 truncate text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                {user?.name || 'Borrower'}
              </p>
            </div>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 space-y-0.5">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  [
                    'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
                    isActive
                      ? 'bg-red-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main column: padding reserves space for fixed sidebar (margin + w-full overflows viewport) */}
      <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col lg:pl-56">
        <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur-md transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#0F172A]/95">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.2em] text-[#DC2626]">Borrower Portal</p>
              <div className="mt-1 flex items-center gap-2">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={user?.name || 'Borrower'}
                    className="h-8 w-8 rounded-full border border-gray-200 object-cover dark:border-[#374151]"
                    onError={(e) => {
                      e.currentTarget.onerror = null
                      e.currentTarget.src = fallbackAvatar(user?.name || 'Borrower')
                    }}
                  />
                ) : (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-200">
                    {initials(user?.name || 'Borrower')}
                  </span>
                )}
                <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{user?.name || 'Borrower'}</h1>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNotifModalOpen(true)}
                className="relative rounded-lg border border-gray-200 p-2 text-gray-800 transition-colors duration-300 hover:bg-gray-100 dark:border-[#1F2937] dark:text-gray-100 dark:hover:bg-[#1F2937]"
                aria-label="Notifications"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {notifUnread != null && notifUnread > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                    {notifUnread > 99 ? '99+' : notifUnread}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="rounded-lg border border-gray-200 p-2 text-gray-800 transition-colors duration-300 hover:bg-gray-100 dark:border-[#1F2937] dark:text-gray-100 dark:hover:bg-[#1F2937] lg:hidden"
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {mobileOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent(COOKIE_PREFERENCES_EVENT))}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors duration-300 hover:bg-gray-100 dark:border-[#1F2937] dark:text-gray-200 dark:hover:bg-[#1F2937] sm:text-sm"
              >
                Cookie Settings
              </button>
              <button
                type="button"
                onClick={async () => {
                  await logout()
                  navigate('/borrower/login', { replace: true })
                }}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 sm:px-4"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="min-h-0 min-w-0 max-w-full flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain p-4 [-webkit-overflow-scrolling:touch] sm:p-6 lg:px-8 lg:py-6">
          <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-4">
            <Outlet />
          </div>
        </main>
      </div>
      {notifModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-4 pt-20 backdrop-blur-[1px] sm:items-center sm:pt-4">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close notifications"
            onClick={() => setNotifModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-[#1F2937] dark:bg-[#111827] sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Notifications</h2>
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 dark:border-[#374151] dark:text-gray-200 dark:hover:bg-white/10"
                onClick={() => setNotifModalOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-10 text-sm text-gray-500 dark:text-gray-400">
                    Loading notifications…
                  </div>
                }
              >
                <BorrowerNotificationsPage embedded />
              </Suspense>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
