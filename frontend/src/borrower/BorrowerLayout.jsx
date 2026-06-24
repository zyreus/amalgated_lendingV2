import { Link, Outlet, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.js'
import { useBorrowerAuth } from './context/useBorrowerAuth.js'
import { useLogoutConfirm } from '../context/useLogoutConfirm.js'
import { borrowerApi } from './api/client.js'
import { getLaravelStorageFileUrl } from '../utils/lendingLaravelApi.js'
import { COOKIE_PREFERENCES_EVENT } from '../components/privacy/CookiePreferencesModal.jsx'
import { NotificationPanelShell } from '../components/NotificationPanelShell.jsx'
import { BORROWER_NAV_GROUPS, BORROWER_DASHBOARD_NAV } from './borrowerNavConfig.js'
import BorrowerSidebarAccordion from './components/BorrowerSidebarAccordion.jsx'
import {
  ClipboardList,
  CreditCard,
  FilePlus2,
  FileText,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  MessageCircleMore,
  ShieldCheck,
  ShieldPlus,
  Ticket,
  UserRound,
} from 'lucide-react'

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
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Borrower')}&background=e2e8f0&color=0f2744&size=96&bold=true`
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

const BORROWER_ICON_CONFIG = {
  dashboard: { Icon: LayoutDashboard, wrapper: 'bg-rose-100 text-rose-600' },
  wellness: { Icon: ShieldPlus, wrapper: 'bg-emerald-100 text-emerald-600' },
  applications: { Icon: ClipboardList, wrapper: 'bg-violet-100 text-violet-600' },
  apply: { Icon: FilePlus2, wrapper: 'bg-blue-100 text-blue-600' },
  payments: { Icon: CreditCard, wrapper: 'bg-rose-100 text-rose-600' },
  statements: { Icon: FileText, wrapper: 'bg-cyan-100 text-cyan-600' },
  chat: { Icon: MessageCircleMore, wrapper: 'bg-red-100 text-brand-primary' },
  help: { Icon: LifeBuoy, wrapper: 'bg-amber-100 text-amber-600' },
  tickets: { Icon: Ticket, wrapper: 'bg-orange-100 text-orange-600' },
  profile: { Icon: UserRound, wrapper: 'bg-pink-100 text-pink-600' },
  privacy: { Icon: ShieldCheck, wrapper: 'bg-green-100 text-green-600' },
  password: { Icon: KeyRound, wrapper: 'bg-purple-100 text-purple-600' },
  logout: { Icon: LogOut, wrapper: 'bg-red-100 text-red-600' },
}

function buildBorrowerNavGroups() {
  return BORROWER_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.map((item, i) => ({
      id: `nav-${group.id}-${i}`,
      path: item.to,
      label: item.label,
      icon_key: item.icon_key,
      match_end: Boolean(item.match_end),
    })),
  })).filter((group) => group.items.length > 0)
}

function buildBorrowerTopNavItems() {
  return [
    {
      id: 'nav-dashboard',
      path: BORROWER_DASHBOARD_NAV.to,
      label: BORROWER_DASHBOARD_NAV.label,
      icon_key: BORROWER_DASHBOARD_NAV.icon_key,
      match_end: Boolean(BORROWER_DASHBOARD_NAV.match_end),
    },
  ]
}

function BorrowerNavIcon({ name }) {
  const config = BORROWER_ICON_CONFIG[name] || BORROWER_ICON_CONFIG.dashboard
  const Icon = config.Icon
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.wrapper}`}>
      <Icon className="size-[17px] stroke-[2]" aria-hidden />
    </span>
  )
}

function BorrowerSidebarTooltip({ children }) {
  return (
    <span className="pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-[90] hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#0F172A] px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-lg transition-all duration-150 group-hover:translate-x-1 group-hover:opacity-100 lg:block">
      {children}
    </span>
  )
}

const BORROWER_SIDEBAR_COLLAPSED_KEY = 'al-borrower-sidebar-collapsed'

function readBorrowerSidebarCollapsed() {
  try {
    return window.localStorage.getItem(BORROWER_SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeBorrowerSidebarCollapsed(value) {
  try {
    window.localStorage.setItem(BORROWER_SIDEBAR_COLLAPSED_KEY, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/** Prefetch high-traffic borrower routes after first paint (idle time). */
function prefetchBorrowerRoutes() {
  void import('./pages/BorrowerDashboardPage.jsx')
  void import('./pages/BorrowerPaymentsPage.jsx')
  void import('./pages/BorrowerApplicationsPage.jsx')
}

export default function BorrowerLayout() {
  const { user } = useBorrowerAuth()
  const { openLogoutModal } = useLogoutConfirm()
  const location = useLocation()
  const navGroups = useMemo(() => buildBorrowerNavGroups(), [])
  const topNavItems = useMemo(() => buildBorrowerTopNavItems(), [])
  const [mobileOpen, setMobileOpen] = useState(false)
  useBodyScrollLock(mobileOpen)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    typeof window !== 'undefined' ? readBorrowerSidebarCollapsed() : false,
  )
  const [notifUnread, setNotifUnread] = useState(null)
  const [notifModalOpen, setNotifModalOpen] = useState(false)
  const notifWrapRef = useRef(null)
  const avatarUrl = isImagePath(user?.profile_photo_url)
    ? getLaravelStorageFileUrl(user?.profile_photo_url)
    : isImagePath(user?.id_document_url)
      ? getLaravelStorageFileUrl(user?.id_document_url)
      : isImagePath(user?.profile_photo_path)
        ? getLaravelStorageFileUrl(user?.profile_photo_path)
        : isImagePath(user?.id_document_path)
          ? getLaravelStorageFileUrl(user?.id_document_path)
          : null

  useEffect(() => {
    if (!user) return undefined
    const schedulePrefetch = () => {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => prefetchBorrowerRoutes(), { timeout: 2500 })
      } else {
        setTimeout(prefetchBorrowerRoutes, 800)
      }
    }
    schedulePrefetch()
  }, [user])

  useEffect(() => {
    if (!user) return undefined
    let cancelled = false
    const fetchCount = async () => {
      if (document.visibilityState === 'hidden') return
      try {
        const res = await borrowerApi('/borrower/notifications/unread-count')
        if (!cancelled) setNotifUnread(typeof res.count === 'number' ? res.count : 0)
      } catch {
        if (!cancelled) setNotifUnread(null)
      }
    }
    fetchCount()
    const id = setInterval(fetchCount, 120_000)
    const onChange = () => fetchCount()
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchCount()
    }
    const onNotificationNavigate = () => setNotifModalOpen(false)
    const onOpenNotifications = () => setNotifModalOpen(true)
    window.addEventListener('borrower-notifications-changed', onChange)
    window.addEventListener('borrower-notification-navigate', onNotificationNavigate)
    window.addEventListener('borrower-open-notifications', onOpenNotifications)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(id)
      window.removeEventListener('borrower-notifications-changed', onChange)
      window.removeEventListener('borrower-notification-navigate', onNotificationNavigate)
      window.removeEventListener('borrower-open-notifications', onOpenNotifications)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user])

  const asideBase =
    'fixed inset-y-0 left-0 z-50 flex h-[100dvh] flex-col border-r border-[#E5E7EB] bg-white font-[Inter,system-ui,sans-serif] shadow-[4px_0_24px_rgba(15,23,42,0.04)] transition-[transform,width] duration-300 ease-out dark:border-[#1F2937] dark:bg-[#0F172A] lg:translate-x-0'
  const sidebarTransform = mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
  const asideWidthClass = sidebarCollapsed ? 'w-[240px] lg:w-[72px]' : 'w-[240px]'
  const mainPlClass = sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[240px]'
  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      writeBorrowerSidebarCollapsed(next)
      return next
    })
  }

  return (
    <div className="portal-page flex h-[100dvh] min-h-0 w-full max-w-full flex-col overflow-hidden portal-shell-bg text-gray-900 transition-colors duration-300 dark:bg-[#0F172A] dark:text-gray-100">
      {/* Mobile: dim background when drawer open */}
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside className={`${asideBase} ${asideWidthClass} ${sidebarTransform}`}>
        <div className="flex h-full min-h-0 flex-col gap-2 px-3 py-4">
          <div className={`shrink-0 rounded-2xl border border-slate-200/80 bg-[#F8FAFC] px-3 py-3 shadow-sm dark:border-[#1F2937] dark:bg-white/5 ${sidebarCollapsed ? 'lg:px-2 lg:py-2' : ''}`}>
            <div className={`flex items-center justify-between gap-2 ${sidebarCollapsed ? 'lg:flex-col lg:justify-center' : ''}`}>
              <p className={`min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-primary ${sidebarCollapsed ? 'lg:sr-only' : ''}`}>Borrower Portal</p>
              <button
                type="button"
                onClick={toggleSidebarCollapsed}
                className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#64748B] shadow-sm transition hover:scale-105 hover:text-[#0F172A] lg:inline-flex dark:border-[#374151] dark:bg-[#111827] dark:text-gray-400 dark:hover:text-gray-100"
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!sidebarCollapsed}
              >
                <Menu className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <Link
              to="/borrower/dashboard"
              onClick={() => setMobileOpen(false)}
              className={`mt-2 flex items-center gap-2.5 rounded-xl transition hover:bg-white/80 dark:hover:bg-white/5 ${sidebarCollapsed ? 'lg:justify-center' : ''}`}
              title="Dashboard"
            >
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
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-xs font-semibold text-rose-600 dark:bg-red-900/40 dark:text-red-200">
                  {initials(user?.name || 'Borrower')}
                </span>
              )}
              <div className={`min-w-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                <p className="truncate text-[14px] font-semibold tracking-tight text-slate-800 dark:text-gray-100">
                  {user?.name || 'Borrower'}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-gray-400">Amalgated Lending Inc.</p>
              </div>
            </Link>
          </div>

          <nav
            id="borrower-sidebar-nav"
            className="scrollbar-thin scrollbar-thumb-[#D8D8D8] scrollbar-track-transparent min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth py-2 [scrollbar-color:#D8D8D8_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#D8D8D8] [&::-webkit-scrollbar-track]:bg-transparent"
            aria-label="Borrower portal navigation"
          >
            <BorrowerSidebarAccordion
              groups={navGroups}
              topItems={topNavItems}
              sidebarCollapsed={sidebarCollapsed}
              pathname={location.pathname}
              onNavigate={() => setMobileOpen(false)}
              iconConfig={BORROWER_ICON_CONFIG}
            />
          </nav>

          <div className="shrink-0 border-t border-[#E5E7EB] pt-3 dark:border-[#1F2937]">
            <div className="group relative">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false)
                  openLogoutModal('borrower')
                }}
                className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[14px] font-medium text-red-600 transition-all duration-200 hover:bg-[#FEECEC] dark:text-red-400 dark:hover:bg-red-950/30 ${sidebarCollapsed ? 'lg:justify-center lg:gap-0 lg:px-2' : ''}`}
              >
                <BorrowerNavIcon name="logout" />
                <span className={sidebarCollapsed ? 'lg:sr-only' : ''}>Log out</span>
              </button>
              {sidebarCollapsed ? <BorrowerSidebarTooltip>Log out</BorrowerSidebarTooltip> : null}
            </div>
          </div>
        </div>
      </aside>

      {/* Main column: padding reserves space for fixed sidebar (margin + w-full overflows viewport) */}
      <div className={`flex min-h-0 min-w-0 max-w-full flex-1 flex-col ${mainPlClass}`}>
        <header
          className="sticky top-0 z-20 border-b border-gray-200/90 bg-white/95 shadow-[0_1px_0_rgba(15,23,42,0.05),0_6px_20px_-4px_rgba(15,23,42,0.08)] backdrop-blur-md transition-[box-shadow,background-color] duration-300 dark:border-[#1F2937] dark:bg-[#0F172A]/95 dark:shadow-[0_1px_0_rgba(255,255,255,0.04),0_8px_28px_-6px_rgba(0,0,0,0.45)]"
          role="banner"
        >
          <div className="mx-auto flex min-h-[3.25rem] w-full min-w-0 max-w-[min(100%,var(--width-content-standard))] items-center justify-between gap-2 px-4 pb-3 pt-[max(0.5rem,env(safe-area-inset-top,0px))] sm:min-h-16 sm:gap-3 sm:px-6 sm:pb-4 lg:min-h-20 lg:px-12 xl:px-20 2xl:max-w-[min(100%,var(--width-content-wide))]">
            {/* Left: menu (mobile) → avatar → name, then portal label */}
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="inline-flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-800 shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100 lg:hidden dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-[#1F2937] dark:active:bg-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary touch-manipulation"
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
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-primary sm:text-[11px] sm:tracking-[0.2em]">
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
                  className="relative inline-flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-800 shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-[#1F2937] dark:active:bg-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary touch-manipulation"
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
                    <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-primary px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-[#0F172A]">
                      {notifUnread > 99 ? '99+' : notifUnread}
                    </span>
                  ) : null}
                </button>
                <NotificationPanelShell
                  open={notifModalOpen}
                  onClose={() => setNotifModalOpen(false)}
                  anchorRef={notifWrapRef}
                  title="Notifications"
                  titleId="borrower-notif-panel-title"
                  headerActions={(
                    <button
                      type="button"
                      className="shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 dark:border-[#374151] dark:text-gray-200 dark:hover:bg-white/10"
                      onClick={() => setNotifModalOpen(false)}
                      aria-label="Close notifications"
                    >
                      Close
                    </button>
                  )}
                >
                  <Suspense
                    fallback={
                      <div className="space-y-2 p-1" aria-hidden>
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5" />
                        ))}
                      </div>
                    }
                  >
                    <BorrowerNotificationsPage embedded />
                  </Suspense>
                </NotificationPanelShell>
              </div>

              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent(COOKIE_PREFERENCES_EVENT))}
                className="inline-flex h-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-gray-800 shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100 max-[480px]:w-11 max-[480px]:px-0 min-[481px]:px-3.5 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-200 dark:hover:bg-[#1F2937] dark:active:bg-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary touch-manipulation"
                aria-label="Cookie and privacy preferences"
              >
                <CookiePrefsIcon className="h-5 w-5 shrink-0 min-[481px]:hidden" />
                <span className="hidden min-[481px]:inline sm:hidden text-xs font-semibold tracking-tight">Cookies</span>
                <span className="hidden text-xs font-semibold sm:inline sm:text-sm">Cookie Settings</span>
              </button>

              <button
                type="button"
                onClick={() => openLogoutModal('borrower')}
                className="inline-flex h-11 min-h-[44px] shrink-0 items-center justify-center rounded-xl bg-brand-primary px-3.5 text-sm font-semibold text-white shadow-brand-primary transition-colors hover:bg-brand-primary-hover active:opacity-95 sm:px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary touch-manipulation whitespace-nowrap"
                aria-label="Log out of borrower portal"
              >
                Logout
              </button>
            </nav>
          </div>
        </header>

        <main className="min-h-0 min-w-0 max-w-full flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-4 [-webkit-overflow-scrolling:touch] sm:px-6 sm:pt-6 lg:px-12 lg:py-8 xl:px-20">
          <div className="mx-auto flex w-full min-w-0 max-w-[min(100%,var(--width-content-standard))] 2xl:max-w-[min(100%,var(--width-content-wide))] flex-col gap-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
