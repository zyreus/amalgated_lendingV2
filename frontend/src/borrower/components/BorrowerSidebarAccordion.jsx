import { useEffect, useId, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  ChevronDown,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  UserRound,
} from 'lucide-react'

const SIDEBAR_EXPANDED_SECTION_KEY = 'al-borrower-sidebar-expanded-section'

const SECTION_META = {
  overview: { Icon: LayoutDashboard, accent: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300' },
  loans: { Icon: ClipboardList, accent: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/40 dark:text-violet-300' },
  money: { Icon: CreditCard, accent: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/40 dark:text-sky-300' },
  support: { Icon: LifeBuoy, accent: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300' },
  account: { Icon: UserRound, accent: 'text-pink-600', bg: 'bg-pink-50 dark:bg-pink-950/40 dark:text-pink-300' },
}

function readExpandedSection() {
  try {
    return window.localStorage.getItem(SIDEBAR_EXPANDED_SECTION_KEY) || null
  } catch {
    return null
  }
}

function writeExpandedSection(value) {
  try {
    if (value) window.localStorage.setItem(SIDEBAR_EXPANDED_SECTION_KEY, value)
    else window.localStorage.removeItem(SIDEBAR_EXPANDED_SECTION_KEY)
  } catch {
    /* ignore */
  }
}

function isNavItemActive(item, pathname) {
  const path = item?.path
  if (!path) return false
  if (item.match_end) return pathname === path
  if (pathname === path) return true
  return pathname.startsWith(`${path}/`)
}

function findActiveSectionId(groups, pathname) {
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

function NavIcon({ item, iconConfig, active = false }) {
  const key = item?.icon_key || 'dashboard'
  const config = iconConfig[key] || iconConfig.dashboard
  const Icon = config.Icon
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ease-in-out group-hover:scale-[1.03] ${config.wrapper} ${active ? 'ring-2 ring-[#E11D48]/20 dark:ring-red-400/30' : ''}`}
    >
      <Icon className="size-[17px] stroke-[2]" aria-hidden />
    </span>
  )
}

function NavItemLink({ item, iconConfig, sidebarCollapsed, onNavigate, pathname }) {
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
              ? 'bg-[#FEECEC] font-semibold text-[#BE123C] before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-[#E11D48] dark:bg-red-950/40 dark:text-red-200 dark:before:bg-red-400'
              : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A] dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-gray-100',
          ].join(' ')
        }}
      >
        {({ isActive }) => {
          const active = isActive || isNavItemActive(item, pathname)
          return (
            <>
              <NavIcon item={item} iconConfig={iconConfig} active={active} />
              <span className={`min-w-0 flex-1 leading-snug ${sidebarCollapsed ? 'lg:sr-only' : ''}`}>{item.label}</span>
            </>
          )
        }}
      </NavLink>
      {sidebarCollapsed ? <SidebarTooltip>{item.label}</SidebarTooltip> : null}
    </div>
  )
}

function AccordionSection({ group, expanded, onToggle, sidebarCollapsed, iconConfig, onNavigate, pathname }) {
  const contentId = useId()
  const flyoutRef = useRef(null)
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const meta = SECTION_META[group.id] || SECTION_META.overview
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
            ? 'bg-[#FFF5F5] text-[#BE123C] dark:bg-red-950/25 dark:text-red-200'
            : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-100',
        ].join(' ')}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.bg} ${meta.accent} transition-transform duration-200 group-hover:scale-[1.03]`}
        >
          <SectionIcon className="size-[17px] stroke-[2]" aria-hidden />
        </span>
        <span className={`min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.14em] ${sidebarCollapsed ? 'lg:sr-only' : ''}`}>
          {group.label}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-[#94A3B8] transition-transform duration-300 ease-in-out dark:text-gray-500 ${expanded && !sidebarCollapsed ? 'rotate-180' : ''} ${sidebarCollapsed ? 'lg:hidden' : ''}`}
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
          className="absolute left-[calc(100%+0.5rem)] top-0 z-[85] w-56 rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-xl dark:border-[#1F2937] dark:bg-[#111827]"
        >
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8] dark:text-gray-500">{group.label}</p>
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
                pathname={pathname}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function BorrowerSidebarAccordion({ groups, topItems = [], sidebarCollapsed, pathname, onNavigate, iconConfig }) {
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

  return (
    <div className={`space-y-1 ${sidebarCollapsed ? 'lg:space-y-2' : ''}`}>
      {topItems.length > 0 ? (
        <div className={`space-y-0.5 ${groups.length > 0 ? 'mb-2 border-b border-[#E5E7EB] pb-2 dark:border-[#1F2937]' : ''}`}>
          {topItems.map((item) => (
            <NavItemLink
              key={item.id ?? item.path}
              item={item}
              iconConfig={iconConfig}
              sidebarCollapsed={sidebarCollapsed}
              onNavigate={onNavigate}
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
          pathname={pathname}
        />
      ))}
    </div>
  )
}
