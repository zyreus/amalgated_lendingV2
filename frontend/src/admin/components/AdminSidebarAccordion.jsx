import { useEffect, useId, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Archive,
  ChevronDown,
  FolderArchive,
  Landmark,
  LineChart,
  Server,
} from 'lucide-react'

const SIDEBAR_EXPANDED_SECTION_KEY = 'al-admin-sidebar-expanded-section'

const SECTION_META = {
  lending: { Icon: Landmark, accent: 'text-rose-600', bg: 'bg-rose-50' },
  operations: { Icon: LineChart, accent: 'text-sky-600', bg: 'bg-sky-50' },
  system: { Icon: Server, accent: 'text-violet-600', bg: 'bg-violet-50' },
  archive: { Icon: FolderArchive, accent: 'text-slate-600', bg: 'bg-slate-100' },
}

export function readExpandedSection() {
  try {
    return window.localStorage.getItem(SIDEBAR_EXPANDED_SECTION_KEY) || null
  } catch {
    return null
  }
}

export function writeExpandedSection(value) {
  try {
    if (value) window.localStorage.setItem(SIDEBAR_EXPANDED_SECTION_KEY, value)
    else window.localStorage.removeItem(SIDEBAR_EXPANDED_SECTION_KEY)
  } catch {
    /* ignore */
  }
}

export function isNavItemActive(item, pathname) {
  const path = item?.path
  if (!path) return false
  if (path === '/admin/dashboard' && (pathname === '/admin' || pathname === '/admin/dashboard')) return true
  if (item.match_end) return pathname === path
  if (pathname === path) return true
  if (!pathname.startsWith(`${path}/`)) return false
  if (path === '/admin/borrowers' && pathname.startsWith('/admin/borrowers/archived')) return false
  if (path === '/admin/applications' && pathname.startsWith('/admin/applications/archived')) return false
  return true
}

export function findActiveSectionId(groups, pathname) {
  for (const group of groups) {
    for (const item of group.items) {
      if (isNavItemActive(item, pathname)) return group.id
    }
  }
  return null
}

function SidebarTooltip({ children }) {
  return (
    <span className="pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-[90] hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#0F172A] px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-lg transition-all duration-200 ease-in-out group-hover:translate-x-1 group-hover:opacity-100 lg:block">
      {children}
    </span>
  )
}

function NavIcon({ item, iconConfig, name, active = false }) {
  const key = name || item?.icon_key || 'dash'
  const config = iconConfig[key] || iconConfig.dash
  const Icon = config.Icon
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ease-in-out group-hover:scale-[1.03] ${config.wrapper} ${active ? 'ring-2 ring-[#E11D48]/20' : ''}`}
    >
      <Icon className="size-[17px] stroke-[2]" aria-hidden />
    </span>
  )
}

function NavItemLink({
  item,
  iconConfig,
  sidebarCollapsed,
  onNavigate,
  notifUnread,
  crmVisitorPing,
  pathname,
}) {
  return (
    <div className="group relative">
      <NavLink
        to={item.path}
        end={Boolean(item.match_end)}
        title={sidebarCollapsed ? item.label : undefined}
        onClick={onNavigate}
        className={({ isActive }) => {
          const active = isActive || isNavItemActive(item, pathname)
          return [
            'relative flex min-h-[44px] w-full items-center gap-2.5 overflow-hidden rounded-[10px] border border-transparent px-2.5 py-2 text-[14px] font-medium transition-all duration-200 ease-in-out',
            sidebarCollapsed ? 'lg:justify-center lg:gap-0 lg:px-2' : '',
            active
              ? 'bg-[#FEECEC] font-semibold text-[#BE123C] before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-[#E11D48]'
              : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]',
          ].join(' ')
        }}
      >
        {({ isActive }) => {
          const active = isActive || isNavItemActive(item, pathname)
          return (
            <>
              <span className="relative inline-flex shrink-0">
                <NavIcon item={item} iconConfig={iconConfig} active={active} />
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
              <span className={`min-w-0 flex-1 leading-snug ${sidebarCollapsed ? 'lg:sr-only' : ''}`}>{item.label}</span>
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
          )
        }}
      </NavLink>
      {sidebarCollapsed ? <SidebarTooltip>{item.label}</SidebarTooltip> : null}
    </div>
  )
}

function AccordionSection({
  group,
  expanded,
  onToggle,
  sidebarCollapsed,
  iconConfig,
  onNavigate,
  notifUnread,
  crmVisitorPing,
  pathname,
}) {
  const contentId = useId()
  const flyoutRef = useRef(null)
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const meta = SECTION_META[group.id] || { Icon: Archive, accent: 'text-gray-600', bg: 'bg-gray-100' }
  const SectionIcon = meta.Icon
  const hasActiveChild = group.items.some((item) => isNavItemActive(item, pathname))

  useEffect(() => {
    if (!sidebarCollapsed) setFlyoutOpen(false)
  }, [sidebarCollapsed])

  useEffect(() => {
    if (!flyoutOpen) return undefined
    const onDocClick = (e) => {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target)) setFlyoutOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [flyoutOpen])

  const handleSectionClick = () => {
    if (sidebarCollapsed) {
      setFlyoutOpen((v) => !v)
      return
    }
    onToggle(group.id)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleSectionClick}
        aria-expanded={sidebarCollapsed ? flyoutOpen : expanded}
        aria-controls={contentId}
        className={[
          'group flex w-full items-center gap-2 rounded-[10px] px-2 py-2.5 text-left transition-all duration-200 ease-in-out',
          sidebarCollapsed ? 'lg:justify-center lg:px-1.5' : '',
          hasActiveChild && !expanded && !sidebarCollapsed
            ? 'bg-[#FFF5F5] text-[#BE123C]'
            : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]',
        ].join(' ')}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.bg} ${meta.accent} transition-transform duration-200 group-hover:scale-[1.03] ${sidebarCollapsed ? '' : ''}`}
        >
          <SectionIcon className="size-[17px] stroke-[2]" aria-hidden />
        </span>
        <span className={`min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.14em] ${sidebarCollapsed ? 'lg:sr-only' : ''}`}>
          {group.label}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-[#94A3B8] transition-transform duration-300 ease-in-out ${expanded && !sidebarCollapsed ? 'rotate-180' : ''} ${sidebarCollapsed ? 'lg:hidden' : ''}`}
          aria-hidden
        />
        {sidebarCollapsed ? <SidebarTooltip>{group.label}</SidebarTooltip> : null}
      </button>

      {!sidebarCollapsed ? (
        <div
          id={contentId}
          className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        >
          <div className="overflow-hidden">
            <div className="space-y-0.5 py-1 pl-1 pr-0.5">
              {group.items.map((item) => (
                <NavItemLink
                  key={item.id ?? item.path}
                  item={item}
                  iconConfig={iconConfig}
                  sidebarCollapsed={sidebarCollapsed}
                  onNavigate={onNavigate}
                  notifUnread={notifUnread}
                  crmVisitorPing={crmVisitorPing}
                  pathname={pathname}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {sidebarCollapsed && flyoutOpen ? (
        <div
          ref={flyoutRef}
          className="absolute left-[calc(100%+0.5rem)] top-0 z-[85] w-56 rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-xl"
        >
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">{group.label}</p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavItemLink
                key={item.id ?? item.path}
                item={item}
                iconConfig={iconConfig}
                sidebarCollapsed={false}
                onNavigate={() => {
                  setFlyoutOpen(false)
                  onNavigate?.()
                }}
                notifUnread={notifUnread}
                crmVisitorPing={crmVisitorPing}
                pathname={pathname}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function AdminSidebarAccordion({
  groups,
  topItems = [],
  sidebarCollapsed,
  pathname,
  onNavigate,
  iconConfig,
  notifUnread,
  crmVisitorPing,
  loading,
}) {
  const [expandedSection, setExpandedSection] = useState(() =>
    typeof window !== 'undefined' ? readExpandedSection() : null,
  )

  useEffect(() => {
    const activeId = findActiveSectionId(groups, pathname)
    if (activeId) {
      setExpandedSection(activeId)
      writeExpandedSection(activeId)
    }
  }, [pathname, groups])

  const toggleSection = (id) => {
    setExpandedSection((prev) => {
      const next = prev === id ? null : id
      writeExpandedSection(next)
      return next
    })
  }

  if (loading && groups.length === 0) {
    return <p className="px-2 text-sm text-gray-500">Loading menu…</p>
  }

  return (
    <div className={`space-y-1 ${sidebarCollapsed ? 'lg:space-y-2' : ''}`}>
      {topItems.length > 0 ? (
        <div className={`space-y-0.5 ${groups.length > 0 ? 'mb-2 pb-2 border-b border-[#E5E7EB]' : ''}`}>
          {topItems.map((item) => (
            <NavItemLink
              key={item.id ?? item.path}
              item={item}
              iconConfig={iconConfig}
              sidebarCollapsed={sidebarCollapsed}
              onNavigate={onNavigate}
              notifUnread={notifUnread}
              crmVisitorPing={crmVisitorPing}
              pathname={pathname}
            />
          ))}
        </div>
      ) : null}
      {groups.map((group) => (
        <AccordionSection
          key={group.id}
          group={group}
          expanded={expandedSection === group.id}
          onToggle={toggleSection}
          sidebarCollapsed={sidebarCollapsed}
          iconConfig={iconConfig}
          onNavigate={onNavigate}
          notifUnread={notifUnread}
          crmVisitorPing={crmVisitorPing}
          pathname={pathname}
        />
      ))}
    </div>
  )
}
