import { useEffect, useMemo, useState, useRef, lazy, Suspense } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.js'
import { io } from 'socket.io-client'
import { adminSocketUrls, getLendingChatSecret } from '../utils/adminChatApi.js'
import { api, getToken as getAdminToken } from './api/client.js'
import { useAdminApiAuth } from './context/useAdminApiAuth.js'
import { useLogoutConfirm } from '../context/useLogoutConfirm.js'
import { admin } from './components/AdminUi.jsx'
import AdminHeaderClock from './components/AdminHeaderClock.jsx'
import { ADMIN_NAV_GROUPS } from './adminNavConfig.js'
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  ClipboardList,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  Megaphone,
  Menu,
  MessageCircleMore,
  MessageSquareHeart,
  PieChart,
  Settings,
  ShieldCheck,
  ShieldPlus,
  UserRound,
  UsersRound,
  WalletCards,
} from 'lucide-react'

/** Retired admin routes — hidden from API-driven nav (legacy DB rows). */
const RETIRED_ADMIN_PATHS = new Set([
  '/admin/loans',
  '/admin/underwriting-queue',
  '/admin/document-verification',
  '/admin/risk-analytics',
  '/admin/compliance',
])
import { ADMIN_ROLE_BADGE, ADMIN_ROLE_BADGE_FALLBACK, sortRolesForDisplay } from './utils/roleBadges.js'
import amalgatedLogo from '../assets/amalgated-lending-logo.png'

/**
 * NotificationsPage is mounted only inside the bell-icon modal. Lazy loading
 * keeps it out of the initial admin layout chunk so the dashboard paints faster.
 */
const NotificationsPage = lazy(() => import('./pages/NotificationsPage.jsx'))

const ICON_CONFIG = {
  dash: { Icon: LayoutDashboard, wrapper: 'bg-rose-100 text-rose-600' },
  borrowers: { Icon: UsersRound, wrapper: 'bg-pink-100 text-pink-600' },
  products: { Icon: BriefcaseBusiness, wrapper: 'bg-blue-100 text-blue-600' },
  forms: { Icon: FileText, wrapper: 'bg-green-100 text-green-600' },
  loans: { Icon: ClipboardList, wrapper: 'bg-violet-100 text-violet-600' },
  pay: { Icon: CreditCard, wrapper: 'bg-rose-100 text-rose-600' },
  collections: { Icon: WalletCards, wrapper: 'bg-orange-100 text-orange-600' },
  soa: { Icon: BarChart3, wrapper: 'bg-cyan-100 text-cyan-600' },
  reports: { Icon: PieChart, wrapper: 'bg-purple-100 text-purple-600' },
  wellness: { Icon: ShieldPlus, wrapper: 'bg-emerald-100 text-emerald-600' },
  chat: { Icon: MessageCircleMore, wrapper: 'bg-sky-100 text-sky-600' },
  feedback: { Icon: MessageSquareHeart, wrapper: 'bg-amber-100 text-amber-600' },
  news: { Icon: Megaphone, wrapper: 'bg-fuchsia-100 text-fuchsia-600' },
  users: { Icon: UserRound, wrapper: 'bg-blue-100 text-blue-600' },
  roles: { Icon: ShieldCheck, wrapper: 'bg-green-100 text-green-600' },
  settings: { Icon: Settings, wrapper: 'bg-violet-100 text-violet-600' },
  activity: { Icon: History, wrapper: 'bg-yellow-100 text-yellow-600' },
  bell: { Icon: Bell, wrapper: 'bg-amber-100 text-amber-600' },
  report: { Icon: BarChart3, wrapper: 'bg-cyan-100 text-cyan-600' },
}

function iconKeyForItem(item) {
  const path = item?.path || ''
  if (path === '/admin/collections') return 'collections'
  if (path === '/admin/soa') return 'soa'
  if (path === '/admin/reports') return 'reports'
  if (path === '/admin/credit-wellness') return 'wellness'
  if (path === '/admin/feedback') return 'feedback'
  if (path === '/admin/newsletter') return 'news'
  return item?.icon_key || 'dash'
}

function NavIcon({ item, name, active = false }) {
  const config = ICON_CONFIG[name || iconKeyForItem(item)] || ICON_CONFIG.dash
  const Icon = config.Icon
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ease-in-out group-hover:scale-105 group-hover:shadow-sm ${config.wrapper} ${active ? 'ring-2 ring-white/80' : ''}`}>
      <Icon className="size-[18px] stroke-[2]" aria-hidden />
    </span>
  )
}

function SidebarTooltip({ children }) {
  return (
    <span className="pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-[90] hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#0F172A] px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-lg transition-all duration-200 ease-in-out group-hover:translate-x-1 group-hover:opacity-100 lg:block">
      {children}
    </span>
  )
}

function normalizeNavItem(item, i) {
  return {
    id: item.id ?? `nav-${i}`,
    path: item.path ?? item.to,
    label: item.label ?? 'Menu',
    icon_key: item.icon_key ?? 'dash',
    match_end: Boolean(item.match_end ?? item.end),
  }
}

/** Build grouped nav from config + permission filter */
function buildGroupedNavFromConfig(can) {
  return ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .filter((item) => item.perm == null || can(item.perm))
      .map((item, i) => normalizeNavItem({ ...item, to: item.to }, i)),
  })).filter((g) => g.items.length > 0)
}

/** Merge API rows: drop CMS, ensure CRM + newsletter; group by matching paths to config */
function mergeApiNav(rows, can) {
  const filtered = rows
    .map((r, i) => normalizeNavItem(r, i))
    .filter(
      (r) =>
        r.path &&
        r.path !== '/admin/cms' &&
        r.path !== '/admin/notifications' &&
        !RETIRED_ADMIN_PATHS.has(r.path),
    )

  if (!filtered.some((x) => x.path === '/admin/chat-crm')) {
    filtered.push(normalizeNavItem({ path: '/admin/chat-crm', label: 'CRM & Chat', icon_key: 'chat', match_end: false }, filtered.length))
  }
  if (!filtered.some((x) => x.path === '/admin/feedback')) {
    filtered.push(normalizeNavItem({ path: '/admin/feedback', label: 'Feedback', icon_key: 'bell', match_end: false }, filtered.length))
  }
  if (can('cms.manage') && !filtered.some((x) => x.path === '/admin/newsletter')) {
    filtered.push(normalizeNavItem({ path: '/admin/newsletter', label: 'News & announcements', icon_key: 'bell', match_end: false }, filtered.length))
  }

  const pathToItem = new Map(filtered.map((x) => [x.path, x]))
  const used = new Set()

  const grouped = ADMIN_NAV_GROUPS.map((group) => {
    const items = []
    for (const def of group.items) {
      if (def.perm != null && !can(def.perm)) continue
      const fromApi = pathToItem.get(def.to)
      if (fromApi) {
        items.push(fromApi)
        used.add(fromApi.path)
      } else {
        items.push(normalizeNavItem({ ...def, to: def.to }, items.length))
      }
    }
    return items.length ? { ...group, items } : null
  }).filter(Boolean)

  const rest = filtered.filter((x) => !used.has(x.path))
  if (rest.length) {
    grouped.push({ id: 'other', label: 'More', items: rest })
  }

  return grouped
}

const shell =
  'flex h-[100dvh] min-h-0 w-full max-w-full flex-col overflow-hidden bg-[#F5EEDF] text-brand-text'
const asideBase =
  'fixed inset-y-0 left-0 z-50 flex h-[100dvh] flex-col border-r border-[#E5E7EB] bg-[#F8F8F8] shadow-[8px_0_32px_rgba(15,23,42,0.06)] transition-[transform,width] duration-300 ease-out lg:translate-x-0'

const SIDEBAR_COLLAPSED_KEY = 'al-admin-sidebar-collapsed'

function readSidebarCollapsed() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeSidebarCollapsed(value) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export default function AdminLayout() {
  const { user, can } = useAdminApiAuth()
  const { openLogoutModal } = useLogoutConfirm()
  const navigate = useNavigate()
  const location = useLocation()
  const chatFullBleed = location.pathname.startsWith('/admin/chat-crm')
  const [mobileOpen, setMobileOpen] = useState(false)
  useBodyScrollLock(mobileOpen)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    typeof window !== 'undefined' ? readSidebarCollapsed() : false,
  )
  const [navGroups, setNavGroups] = useState(() => buildGroupedNavFromConfig(can))
  const [navLoading, setNavLoading] = useState(true)
  const [crmVisitorPing, setCrmVisitorPing] = useState(0)

  const displayRoles = useMemo(() => sortRolesForDisplay(user?.roles), [user?.roles])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api('/navigation')
        const rows = (res.data || []).filter((r) => {
          const p = r.path || r.to || ''
          return (
            p &&
            p !== '/admin/cms' &&
            p !== '/admin/notifications' &&
            !String(p).includes('/admin/cms') &&
            !RETIRED_ADMIN_PATHS.has(p)
          )
        })
        if (!cancelled) {
          if (rows.length) setNavGroups(mergeApiNav(rows, can))
          else setNavGroups(buildGroupedNavFromConfig(can))
        }
      } catch {
        if (!cancelled) setNavGroups(buildGroupedNavFromConfig(can))
      } finally {
        if (!cancelled) setNavLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [can])

  useEffect(() => {
    if (!location.pathname.startsWith('/admin/chat-crm')) return
    setCrmVisitorPing(0)
  }, [location.pathname])

  useEffect(() => {
    if (!user) return undefined
    let disposed = false
    let currentSocket = null
    let scheduleId = null
    const targets = adminSocketUrls()

    const onVisitorMessage = (payload) => {
      const msg = payload?.message
      if (!msg) return
      const sender = String(msg.sender || '').toLowerCase()
      const isVisitorMsg =
        sender === 'user' ||
        sender === 'customer' ||
        sender === 'visitor' ||
        String(msg.sender_type || '').toLowerCase() === 'customer'
      if (!isVisitorMsg) return

      const raw = payload?.conversationId
      const cid =
        typeof raw === 'string' ? raw.trim() : String(raw || '').trim()
      if (!cid) return

      window.dispatchEvent(new CustomEvent('admin:statsRefresh'))

      if (location.pathname.startsWith('/admin/chat-crm')) {
        window.dispatchEvent(
          new CustomEvent('admin:focusChatConversation', {
            detail: { conversationId: cid },
          }),
        )
        return
      }

      setCrmVisitorPing((n) => Math.min(n + 1, 99))
      const sp = new URLSearchParams()
      sp.set('view', 'chats')
      sp.set('conversation', cid)
      navigate(`/admin/chat-crm?${sp.toString()}`, { replace: true })
    }

    const connectWithFallback = (index) => {
      if (disposed || index >= targets.length) return
      const target = targets[index]
      const socket = io(target, {
        transports: ['websocket', 'polling'],
        timeout: 8000,
        reconnectionAttempts: 2,
        reconnectionDelay: 800,
      })
      currentSocket = socket
      socket.on('connect', () => {
        if (disposed) return
        socket.emit('admin:join', { token: getAdminToken() || '', secret: getLendingChatSecret() || '' })
      })
      socket.on('chat:newMessage', onVisitorMessage)
      socket.on('feedback:refresh', () => {
        window.dispatchEvent(new CustomEvent('admin-notifications-changed'))
      })
      socket.on('connect_error', () => {
        if (disposed) return
        socket.removeAllListeners()
        socket.disconnect()
        connectWithFallback(index + 1)
      })
    }

    let usedIdleCallback = false
    const startSocket = () => {
      if (disposed) return
      connectWithFallback(0)
    }

    if (typeof window.requestIdleCallback === 'function') {
      scheduleId = window.requestIdleCallback(startSocket, { timeout: 4000 })
      usedIdleCallback = true
    } else {
      scheduleId = window.setTimeout(startSocket, 1200)
    }

    return () => {
      disposed = true
      if (scheduleId != null) {
        if (usedIdleCallback && typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(scheduleId)
        } else {
          window.clearTimeout(scheduleId)
        }
      }
      currentSocket?.off('chat:newMessage', onVisitorMessage)
      currentSocket?.off('feedback:refresh')
      currentSocket?.removeAllListeners()
      if (currentSocket?.connected) currentSocket.disconnect()
    }
  }, [user, navigate, location.pathname])

  const [notifUnread, setNotifUnread] = useState(null)
  const [notifModalOpen, setNotifModalOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const notifWrapRef = useRef(null)
  const profileWrapRef = useRef(null)

  useEffect(() => {
    if (!user || !can('notifications.view')) return undefined
    let cancelled = false
    const fetchCount = async () => {
      try {
        const res = await api('/notifications/unread-count')
        if (!cancelled) setNotifUnread(typeof res.count === 'number' ? res.count : 0)
      } catch {
        if (!cancelled) setNotifUnread(null)
      }
    }
    fetchCount()
    const id = setInterval(fetchCount, 60_000)
    const onChange = () => fetchCount()
    const onStatsSync = () => fetchCount()
    window.addEventListener('admin-notifications-changed', onChange)
    window.addEventListener('admin:statsRefresh', onStatsSync)
    return () => {
      cancelled = true
      clearInterval(id)
      window.removeEventListener('admin-notifications-changed', onChange)
      window.removeEventListener('admin:statsRefresh', onStatsSync)
    }
  }, [user, can])

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

  useEffect(() => {
    if (!profileMenuOpen) return undefined
    const onDocClick = (e) => {
      if (!profileWrapRef.current) return
      if (!profileWrapRef.current.contains(e.target)) setProfileMenuOpen(false)
    }
    const onEsc = (e) => {
      if (e.key === 'Escape') setProfileMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [profileMenuOpen])

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      writeSidebarCollapsed(next)
      return next
    })
  }

  const navInactive =
    'border-transparent text-[#475569] hover:scale-[1.01] hover:bg-white hover:text-[#0F172A] hover:shadow-sm hover:shadow-rose-900/5'
  const navActive =
    'border-[#F8B4C3] bg-[#FCE7EF] text-[#E11D48] shadow-sm shadow-rose-900/10 before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-[#E11D48]'
  const sidebarTransform = mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
  const asideWidthClass = sidebarCollapsed ? 'w-[240px] lg:w-[72px]' : 'w-[240px]'
  const mainPlClass = sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[240px]'

  return (
    <div className={`${shell} portal-page`}>
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
          <div
            className={`shrink-0 ${sidebarCollapsed ? 'lg:flex lg:flex-col lg:items-center' : ''}`}
          >
            <div
              className={`flex items-center justify-between gap-3 ${sidebarCollapsed ? 'lg:flex-col lg:items-center' : ''}`}
            >
              <div
                className={`flex min-w-0 flex-1 items-center gap-3 ${sidebarCollapsed ? 'lg:flex-col lg:items-center' : ''}`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm shadow-rose-900/10 ring-1 ring-[#E5E7EB]">
                  <img
                    src={amalgatedLogo}
                    alt="Amalgated Lending Inc."
                    className="h-full w-full object-contain p-0.5"
                    loading="eager"
                    decoding="async"
                  />
                </div>
                <div className={`min-w-0 flex-1 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                  <p className="truncate text-[10px] font-semibold uppercase leading-tight tracking-[0.18em] text-[#E11D48]">
                    Amalgated Lending Inc.
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="shrink-0 text-base font-semibold leading-tight tracking-tight text-[#0F172A]">Admin</p>
                    {user && displayRoles.length > 0 ? (
                      <div className="flex min-w-0 flex-wrap gap-1" aria-label="Your roles">
                        {displayRoles.map((r) => (
                          <span
                            key={r.id ?? r.slug}
                            className={`inline-flex max-w-full truncate rounded-full px-1.5 py-px text-[10px] font-semibold leading-tight ring-1 ${ADMIN_ROLE_BADGE[r.slug] || ADMIN_ROLE_BADGE_FALLBACK}`}
                            title={r.slug}
                          >
                            {r.name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleSidebarCollapsed}
                className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#64748B] shadow-sm transition hover:scale-105 hover:text-[#0F172A] lg:inline-flex"
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!sidebarCollapsed}
              >
                <Menu className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          <nav className="scrollbar-thin scrollbar-thumb-[#D8D8D8] scrollbar-track-transparent min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth py-2 [scrollbar-color:#D8D8D8_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#D8D8D8] [&::-webkit-scrollbar-track]:bg-transparent">
            {navLoading && navGroups.length === 0 ? (
              <p className="px-2 text-sm text-gray-500">Loading menu…</p>
            ) : (
              navGroups.map((group) => {
                const isOverview = group.id === 'overview'
                return (
                  <div key={group.id} className={isOverview ? 'space-y-1.5' : 'mt-5 space-y-1.5 first:mt-0'}>
                    {!isOverview ? (
                      <p
                        className={`mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] ${sidebarCollapsed ? 'lg:hidden' : ''}`}
                      >
                        {group.label}
                      </p>
                    ) : null}
                    <div className="space-y-1.5">
                      {group.items.map((item) => (
                        <div key={item.id ?? item.path} className="group relative">
                          <NavLink
                            to={item.path}
                            end={Boolean(item.match_end)}
                            title={sidebarCollapsed ? item.label : undefined}
                            onClick={() => setMobileOpen(false)}
                            className={({ isActive }) =>
                              [
                                'relative flex h-[52px] w-full items-center gap-3 overflow-hidden rounded-xl border border-transparent border-l-4 px-3 py-2 text-[15px] font-medium transition-all duration-200 ease-in-out',
                                sidebarCollapsed ? 'lg:justify-center lg:gap-0 lg:border lg:p-0' : '',
                                isActive ? navActive : navInactive,
                              ].join(' ')
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <span className="relative inline-flex shrink-0">
                                  <NavIcon item={item} active={isActive} />
                                  {item.path === '/admin/notifications' && notifUnread != null && notifUnread > 0 && sidebarCollapsed ? (
                                    <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                                      {notifUnread > 99 ? '99+' : notifUnread}
                                    </span>
                                  ) : null}
                                  {item.path === '/admin/chat-crm' && crmVisitorPing > 0 && sidebarCollapsed ? (
                                    <span
                                      className="absolute -right-0.5 -top-1 h-2 w-2 rounded-full bg-red-600 ring-2 ring-white"
                                      title="Unread visitor chats"
                                      aria-label="CRM has live visitor activity"
                                    />
                                  ) : null}
                                </span>
                                <span className={`min-w-0 flex-1 leading-snug ${isActive ? 'font-semibold' : ''} ${sidebarCollapsed ? 'lg:sr-only' : ''}`}>{item.label}</span>
                                {item.path === '/admin/notifications' && notifUnread != null && notifUnread > 0 && !sidebarCollapsed ? (
                                  <span className="ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold leading-none text-white">
                                    {notifUnread > 99 ? '99+' : notifUnread}
                                  </span>
                                ) : null}
                                {item.path === '/admin/chat-crm' && crmVisitorPing > 0 && !sidebarCollapsed ? (
                                  <span
                                    className="ml-auto inline-flex h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white"
                                    title="Unread visitor chats"
                                    aria-label="CRM live"
                                  />
                                ) : null}
                              </>
                            )}
                          </NavLink>
                          {sidebarCollapsed ? <SidebarTooltip>{item.label}</SidebarTooltip> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </nav>

          <div className="shrink-0">
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              title="Public site"
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[15px] font-medium text-[#475569] transition hover:bg-white hover:text-[#0F172A] hover:shadow-sm ${sidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}`}
            >
              <Menu className="h-4 w-4 shrink-0" aria-hidden />
              <span className={sidebarCollapsed ? 'lg:sr-only' : ''}>Public site</span>
            </Link>
          </div>
        </div>
      </aside>

      <div className={`flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col ${mainPlClass}`}>
        <header
          className={`sticky top-0 z-30 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200/80 bg-white/90 px-4 shadow-sm backdrop-blur-md sm:px-6 ${
            chatFullBleed
              ? 'pb-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))]'
              : 'pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))]'
          }`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="touch-target rounded-xl border border-gray-200/80 bg-white text-gray-800 shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100 lg:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <div className="min-w-0 lg:hidden">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-primary">ALI Admin</p>
            </div>
            <div className="hidden min-w-0 flex-1 lg:block">
              <p className="text-xs text-gray-500">You are in</p>
              <p className="truncate text-sm font-semibold text-gray-900">
                {location.pathname === '/admin' || location.pathname === '/admin/dashboard'
                  ? 'Dashboard'
                  : location.pathname.replace('/admin/', '').replace(/-/g, ' ') || 'Admin'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-row flex-nowrap items-center justify-end gap-2 sm:gap-2.5">
            {user ? <AdminHeaderClock /> : null}
            {user && can('notifications.view') ? (
              <div className="relative shrink-0" ref={notifWrapRef}>
                <button
                  type="button"
                  onClick={() => setNotifModalOpen((v) => !v)}
                  className="touch-target relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200/90 text-gray-700 transition hover:bg-gray-100 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                  aria-label="Notifications"
                  aria-expanded={notifModalOpen}
                >
                  <NavIcon name="bell" className="h-5 w-5" />
                  {notifUnread != null && notifUnread > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                      {notifUnread > 99 ? '99+' : notifUnread}
                    </span>
                  ) : null}
                </button>
                <div
                  className={`absolute right-0 top-[calc(100%+10px)] z-[80] w-[min(92vw,30rem)] origin-top-right rounded-2xl border border-gray-200 bg-white shadow-2xl transition-all duration-200 dark:border-[#1F2937] dark:bg-[#111827] ${
                    notifModalOpen ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-[#1F2937]">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</h2>
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 dark:border-[#374151] dark:text-gray-200 dark:hover:bg-white/10"
                      onClick={() => setNotifModalOpen(false)}
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
                      <NotificationsPage embedded onNavigate={() => setNotifModalOpen(false)} />
                    </Suspense>
                  </div>
                </div>
              </div>
            ) : null}
            {user ? (
              <div className="relative shrink-0" ref={profileWrapRef}>
                <button
                  type="button"
                  onClick={() => {
                    setNotifModalOpen(false)
                    setProfileMenuOpen((v) => !v)
                  }}
                  className="touch-target flex h-10 max-w-[9rem] items-center gap-2 rounded-lg border border-gray-200/90 bg-white px-2 text-left text-gray-800 transition hover:bg-gray-50 sm:max-w-[12rem]"
                  aria-label="Account menu"
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-semibold text-red-700">
                    {(user.username || user.email || 'A').charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden min-w-0 truncate text-sm font-medium sm:inline">
                    {user.username || user.email}
                  </span>
                  <svg className="hidden h-4 w-4 shrink-0 text-gray-500 sm:block" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                <div
                  role="menu"
                  className={`absolute right-0 top-[calc(100%+10px)] z-[80] w-56 origin-top-right rounded-2xl border border-gray-200 bg-white py-1 shadow-2xl transition-all duration-200 ${
                    profileMenuOpen ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
                  }`}
                >
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-gray-900">{user.username || user.email}</p>
                    <p className="mt-0.5 text-xs text-gray-500">Admin account</p>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false)
                      openLogoutModal('admin')
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Log out
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        <main
          className={`flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] ${
            chatFullBleed ? 'p-0 sm:p-1 lg:p-2' : 'p-3 sm:p-5 lg:px-8 lg:py-6'
          }`}
        >
          <div
            className={
              chatFullBleed
                ? 'flex min-h-0 min-w-0 max-w-full flex-1 flex-col gap-0'
                : `flex min-h-0 min-w-0 max-w-full flex-col gap-4 ${admin.pageContainer} mx-auto w-full max-w-[min(100%,var(--width-content-wide))] 2xl:max-w-[min(100%,var(--width-content-ultra))]`
            }
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
