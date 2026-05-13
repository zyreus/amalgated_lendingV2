import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.js'
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

/** Privacy / cookie preferences — compact for sub-480px headers. */
function CookiePrefsIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  )
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
  useBodyScrollLock(mobileOpen)
  const [notifUnread, setNotifUnread] = useState(null)
  const [notifModalOpen, setNotifModalOpen] = useState(false)
  const notifWrapRef = useRef(null)
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

  useEffect(() => {
    if (!notifModalOpen) return undefined
    const onDocClick = (e) => {
      if (!notifWrapRef.current) return
      if (!notifWrapRef.current.contains(e.target)) setNotifModalOpen(false)
    }
    const onEsc = (e) => {
      if (e.key === 'Escape') setNotifModalOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [notifModalOpen])

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

          <nav
            id="borrower-sidebar-nav"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 space-y-0.5"
            aria-label="Borrower portal navigation"
          >
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
        <header
          className="sticky top-0 z-20 border-b border-gray-200/90 bg-white/95 shadow-[0_1px_0_rgba(15,23,42,0.05),0_6px_20px_-4px_rgba(15,23,42,0.08)] backdrop-blur-md transition-[box-shadow,background-color] duration-300 dark:border-[#1F2937] dark:bg-[#0F172A]/95 dark:shadow-[0_1px_0_rgba(255,255,255,0.04),0_8px_28px_-6px_rgba(0,0,0,0.45)]"
          role="banner"
        >
          <div className="mx-auto flex w-full max-w-[min(100%,var(--width-content-standard))] 2xl:max-w-[min(100%,var(--width-content-wide))] min-w-0 items-center justify-between gap-2 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] sm:gap-3">
            {/* Left: menu (mobile) → avatar → name, then portal label */}
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="inline-flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-800 shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100 lg:hidden dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-[#1F2937] dark:active:bg-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DC2626] touch-manipulation"
                aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={mobileOpen}
                aria-controls="borrower-sidebar-nav"
              >
                <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  {mobileOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>

              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full border border-gray-200 object-cover ring-1 ring-black/[0.04] dark:border-[#374151] dark:ring-white/10"
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = fallbackAvatar(user?.name || 'Borrower')
                  }}
                />
              ) : (
                <span
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-semibold text-red-700 ring-1 ring-black/[0.04] dark:bg-red-900/40 dark:text-red-200 dark:ring-white/10"
                  aria-hidden
                >
                  {initials(user?.name || 'Borrower')}
                </span>
              )}
              <div className="min-w-0 flex-1 leading-tight">
                <p
                  className="truncate text-[15px] font-semibold tracking-tight text-gray-900 sm:text-base dark:text-gray-100"
                  title={user?.name || 'Borrower'}
                >
                  {user?.name || 'Borrower'}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#DC2626] sm:text-[11px] sm:tracking-[0.2em]">
                  Borrower Portal
                </p>
              </div>
            </div>

            <nav
              className="flex shrink-0 items-center gap-2 sm:gap-2.5"
              aria-label="Borrower portal actions"
            >
              <div className="relative" ref={notifWrapRef}>
                <button
                  type="button"
                  onClick={() => setNotifModalOpen((v) => !v)}
                  className="relative inline-flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-800 shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-[#1F2937] dark:active:bg-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DC2626] touch-manipulation"
                  aria-label={
                    notifUnread != null && notifUnread > 0
                      ? `Notifications, ${notifUnread} unread`
                      : 'Notifications'
                  }
                  aria-expanded={notifModalOpen}
                  aria-haspopup="true"
                >
                  <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  {notifUnread != null && notifUnread > 0 ? (
                    <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#DC2626] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-[#0F172A]">
                      {notifUnread > 99 ? '99+' : notifUnread}
                    </span>
                  ) : null}
                </button>
                <div
                  role="region"
                  aria-labelledby="borrower-notif-panel-title"
                  aria-hidden={!notifModalOpen}
                  inert={!notifModalOpen}
                  className={`absolute right-0 top-[calc(100%+10px)] z-[80] w-[min(92vw,30rem)] origin-top-right rounded-2xl border border-gray-200 bg-white shadow-2xl transition-all duration-200 dark:border-[#1F2937] dark:bg-[#111827] ${
                    notifModalOpen ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-[#1F2937]">
                    <h2 id="borrower-notif-panel-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Notifications
                    </h2>
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 dark:border-[#374151] dark:text-gray-200 dark:hover:bg-white/10"
                      onClick={() => setNotifModalOpen(false)}
                      aria-label="Close notifications"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-[68vh] overflow-y-auto p-3">
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

              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent(COOKIE_PREFERENCES_EVENT))}
                className="inline-flex h-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-gray-800 shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100 max-[480px]:w-11 max-[480px]:px-0 min-[481px]:px-3.5 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-200 dark:hover:bg-[#1F2937] dark:active:bg-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DC2626] touch-manipulation"
                aria-label="Cookie and privacy preferences"
              >
                <CookiePrefsIcon className="h-5 w-5 shrink-0 min-[481px]:hidden" />
                <span className="hidden min-[481px]:inline sm:hidden text-xs font-semibold tracking-tight">Cookies</span>
                <span className="hidden text-xs font-semibold sm:inline sm:text-sm">Cookie Settings</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await logout()
                  navigate('/borrower/login', { replace: true })
                }}
                className="inline-flex h-11 min-h-[44px] shrink-0 items-center justify-center rounded-xl bg-[#DC2626] px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 active:bg-red-800 sm:px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DC2626] touch-manipulation whitespace-nowrap"
                aria-label="Log out of borrower portal"
              >
                Logout
              </button>
            </nav>
          </div>
        </header>

        <main className="min-h-0 min-w-0 max-w-full flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] [-webkit-overflow-scrolling:touch] sm:p-6 lg:px-8 lg:py-6">
          <div className="mx-auto flex w-full min-w-0 max-w-[min(100%,var(--width-content-standard))] 2xl:max-w-[min(100%,var(--width-content-wide))] flex-col gap-4">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
