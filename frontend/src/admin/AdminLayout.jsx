import { useEffect, useMemo, useState, useRef, lazy, Suspense } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { adminSocketUrls, getLendingChatSecret } from '../utils/adminChatApi.js'
import { api, getToken as getAdminToken } from './api/client.js'
import { useAdminApiAuth } from './context/useAdminApiAuth.js'
import { admin } from './components/AdminUi.jsx'
import AdminHeaderClock from './components/AdminHeaderClock.jsx'
import { ADMIN_NAV_GROUPS } from './adminNavConfig.js'
import { ADMIN_ROLE_BADGE, ADMIN_ROLE_BADGE_FALLBACK, sortRolesForDisplay } from './utils/roleBadges.js'
import amalgatedLogo from '../assets/amalgated-lending-logo.png'

/**
 * NotificationsPage is mounted only inside the bell-icon modal. Lazy loading
 * keeps it out of the initial admin layout chunk so the dashboard paints faster.
 */
const NotificationsPage = lazy(() => import('./pages/NotificationsPage.jsx'))

function NavIcon({ name, className }) {
  const c = className || 'h-5 w-5 shrink-0'
  if (name === 'dash') return <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12h7V3H3v9zm11 9h7V12h-7v9zM3 21h7v-7H3v7zm11-9h7V3h-7v9z" /></svg>
  if (name === 'users') return <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
  if (name === 'roles') return <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
  if (name === 'loans') return <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  if (name === 'pay') return <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
  if (name === 'settings') return <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
  if (name === 'activity') return <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  if (name === 'bell') return <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
  if (name === 'chat') return <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
  if (name === 'borrowers') return <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
  if (name === 'report') return <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
  if (name === 'products') return <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
  if (name === 'forms') return <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
  return <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>
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
    .filter((r) => r.path && r.path !== '/admin/cms' && r.path !== '/admin/notifications')

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
      const row = pathToItem.get(def.to)
      if (row) {
        items.push(row)
        used.add(row.path)
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

const shell = 'flex h-[100dvh] min-h-0 w-full max-w-full flex-col overflow-hidden bg-[#f1f3f5] text-gray-900'
const asideBase =
  'fixed inset-y-0 left-0 z-50 flex h-[100dvh] flex-col border-r border-gray-200/90 bg-white shadow-[4px_0_24px_rgba(15,23,42,0.06)] transition-[transform,width] duration-300 ease-out lg:translate-x-0'

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
  const { logout, user, can } = useAdminApiAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const chatFullBleed = location.pathname.startsWith('/admin/chat-crm')
  const [mobileOpen, setMobileOpen] = useState(false)
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
          return p && p !== '/admin/cms' && p !== '/admin/notifications' && !String(p).includes('/admin/cms')
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
    if (!user) return
    let disposed = false
    let currentSocket = null
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
      const socket = io(target, { transports: ['websocket', 'polling'] })
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

    connectWithFallback(0)
    return () => {
      disposed = true
      currentSocket?.off('chat:newMessage', onVisitorMessage)
      currentSocket?.off('feedback:refresh')
      currentSocket?.removeAllListeners()
      if (currentSocket?.connected) currentSocket.disconnect()
    }
  }, [user, navigate, location.pathname])

  const [notifUnread, setNotifUnread] = useState(null)
  const [notifModalOpen, setNotifModalOpen] = useState(false)
  const notifWrapRef = useRef(null)

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

  const handleLogout = () => {
    logout()
    navigate('/admin/login', { replace: true })
  }

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      writeSidebarCollapsed(next)
      return next
    })
  }

  const navInactive =
    'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
  const navActive =
    'border-[#DC2626] bg-red-50 text-[#b91c1c] shadow-[inset_0_0_0_1px_rgba(220,38,38,0.1)]'
  const sidebarTransform = mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
  const asideWidthClass = sidebarCollapsed ? 'w-[17.5rem] lg:w-[4.75rem]' : 'w-[17.5rem]'
  const mainPlClass = sidebarCollapsed ? 'lg:pl-[4.75rem]' : 'lg:pl-[17.5rem]'

  return (
    <div className={shell}>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside className={`${asideBase} ${asideWidthClass} ${sidebarTransform}`}>
        <div className="flex h-full min-h-0 flex-col">
          <div
            className={`shrink-0 border-b border-gray-100 bg-gradient-to-br from-white to-gray-50/80 px-4 py-5 ${sidebarCollapsed ? 'lg:px-2 lg:py-4' : ''}`}
          >
            <div
              className={`flex items-start justify-between gap-2 ${sidebarCollapsed ? 'lg:flex-col lg:items-center lg:justify-start lg:gap-3' : ''}`}
            >
              <div
                className={`flex min-w-0 items-center gap-3 ${sidebarCollapsed ? 'lg:flex-col lg:items-center' : ''}`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md shadow-red-500/10 ring-1 ring-black/5">
                  <img
                    src={amalgatedLogo}
                    alt="Amalgated Lending"
                    className="h-full w-full object-contain p-0.5"
                    loading="eager"
                    decoding="async"
                  />
                </div>
                <div className={`min-w-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#DC2626]">Amalgated Lending</p>
                  <p className="truncate text-base font-semibold tracking-tight text-gray-900">Admin</p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleSidebarCollapsed}
                className="hidden shrink-0 rounded-lg border border-gray-200/80 p-1.5 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 lg:inline-flex"
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!sidebarCollapsed}
              >
                {sidebarCollapsed ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                )}
              </button>
            </div>
            {user && (
              <div
                className={`mt-3 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-600 dark:bg-[#0F172A]/50 dark:text-gray-400 ${sidebarCollapsed ? 'lg:hidden' : ''}`}
              >
                <p className="truncate">
                  Signed in as{' '}
                  <span className="font-medium text-gray-900 dark:text-gray-100">{user.username || user.email}</span>
                </p>
                {displayRoles.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1" aria-label="Your roles">
                    {displayRoles.map((r) => (
                      <span
                        key={r.id ?? r.slug}
                        className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${ADMIN_ROLE_BADGE[r.slug] || ADMIN_ROLE_BADGE_FALLBACK}`}
                        title={r.slug}
                      >
                        {r.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-4">
            {navLoading && navGroups.length === 0 ? (
              <p className="px-2 text-sm text-gray-500">Loading menu…</p>
            ) : (
              navGroups.map((group) => (
                <div key={group.id}>
                  <p
                    className={`mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 ${sidebarCollapsed ? 'lg:hidden' : ''}`}
                  >
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.id ?? item.path}
                        to={item.path}
                        end={Boolean(item.match_end)}
                        title={sidebarCollapsed ? item.label : undefined}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          [
                            'relative flex items-center gap-3 rounded-lg border-l-[3px] px-2.5 py-2 text-sm font-medium transition-colors duration-150',
                            sidebarCollapsed ? 'lg:justify-center lg:gap-0 lg:px-2' : '',
                            isActive ? navActive : navInactive,
                          ].join(' ')
                        }
                      >
                        <span className="relative inline-flex shrink-0">
                          <NavIcon name={item.icon_key || 'dash'} />
                          {item.path === '/admin/notifications' && notifUnread != null && notifUnread > 0 && sidebarCollapsed ? (
                            <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
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
                        <span className={`min-w-0 flex-1 leading-snug ${sidebarCollapsed ? 'lg:sr-only' : ''}`}>{item.label}</span>
                        {item.path === '/admin/notifications' && notifUnread != null && notifUnread > 0 && !sidebarCollapsed ? (
                          <span className="ml-auto inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                            {notifUnread > 99 ? '99+' : notifUnread}
                          </span>
                        ) : null}
                        {item.path === '/admin/chat-crm' && crmVisitorPing > 0 && !sidebarCollapsed ? (
                          <span
                            className="ml-auto inline-flex h-2 w-2 rounded-full bg-red-600 ring-2 ring-white"
                            title="Unread visitor chats"
                            aria-label="CRM live"
                          />
                        ) : null}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))
            )}
          </nav>

          <div className={`shrink-0 space-y-1 border-t border-gray-100 bg-gray-50/50 p-3 ${sidebarCollapsed ? 'lg:px-2' : ''}`}>
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              title="Public site"
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-sm text-gray-700 transition hover:bg-white hover:text-gray-900 ${sidebarCollapsed ? 'lg:justify-center' : ''}`}
            >
              <span aria-hidden>←</span>
              <span className={sidebarCollapsed ? 'lg:sr-only' : ''}>Public site</span>
            </Link>
            <button
              type="button"
              title="Log out"
              onClick={() => {
                setMobileOpen(false)
                handleLogout()
              }}
              className={`flex w-full items-center rounded-lg px-2.5 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 ${sidebarCollapsed ? 'lg:justify-center' : 'text-left'}`}
            >
              <span className={sidebarCollapsed ? 'lg:sr-only' : ''}>Log out</span>
              <svg
                className={`hidden h-5 w-5 shrink-0 text-red-600 ${sidebarCollapsed ? 'lg:block' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <div className={`flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col ${mainPlClass}`}>
        <header
          className={`sticky top-0 z-30 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200/80 bg-white/90 px-4 shadow-sm backdrop-blur-md sm:px-6 ${chatFullBleed ? 'py-2' : 'py-3'}`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 lg:hidden"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <div className="min-w-0 lg:hidden">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#DC2626]">ALI Admin</p>
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
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {user && can('notifications.view') ? (
              <div className="relative" ref={notifWrapRef}>
                <button
                  type="button"
                  onClick={() => setNotifModalOpen((v) => !v)}
                  className="relative rounded-lg border border-gray-200/90 p-2 text-gray-700 transition hover:bg-gray-100 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
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
            {user ? <AdminHeaderClock /> : null}
          </div>
        </header>

        <main
          className={`flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch] ${
            chatFullBleed ? 'p-0 sm:p-1 lg:p-2' : 'p-4 sm:p-5 lg:px-8 lg:py-6'
          }`}
        >
          <div
            className={
              chatFullBleed
                ? 'flex min-h-0 min-w-0 max-w-full flex-1 flex-col gap-0'
                : `flex min-h-0 min-w-0 max-w-full flex-col gap-4 ${admin.pageContainer} mx-auto max-w-[1600px]`
            }
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
