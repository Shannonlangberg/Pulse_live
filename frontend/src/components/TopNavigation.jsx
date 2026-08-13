import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ClipboardIcon,
  DocumentChartBarIcon,
  BookOpenIcon,
  UserCircleIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  ShieldCheckIcon,
  TableCellsIcon,
  MegaphoneIcon,
  PresentationChartLineIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { useSession } from '../lib/useSession';

// Visibility is driven ONLY by the server-resolved `permissions` object
// from /api/session. Omitted gate = always visible.
const TOP_NAV_PORTAL_ITEMS = [
  {
    name: 'Input',
    href: '/stats',
    icon: ClipboardIcon,
    gate: (p) => p.log_stats
  },
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: DocumentChartBarIcon,
    gate: (p) => p.dashboard_access
  },
  {
    name: 'Ministry stats',
    href: '/ministry-stats',
    icon: PresentationChartLineIcon,
    gate: (p) => p.dashboard_access || p.data_export
  },
  {
    name: 'Resources',
    href: '/resources',
    icon: BookOpenIcon
    // Always visible — backend gates the content
  }
];

const TOP_NAV_SETTINGS_ITEMS = [
  {
    name: 'My Profile',
    href: '/profile',
    icon: UserCircleIcon
    // Always visible
  },
  {
    name: 'Users',
    href: '/users',
    icon: UserGroupIcon,
    gate: (p) => p.manage_users
  },
  {
    name: 'Role Manager',
    href: '/role-manager',
    icon: ShieldCheckIcon,
    gate: (p) => p.manage_users
  },
  {
    name: 'Database Viewer',
    href: '/database-viewer',
    icon: TableCellsIcon,
    gate: (p) => p.database_viewer
  },
  {
    name: 'Homepage Manager',
    href: '/homepage-manager',
    icon: MegaphoneIcon,
    gate: (p) => p.homepage_manager
  },
  {
    name: 'Campuses',
    href: '/campuses',
    icon: BuildingOfficeIcon,
    gate: (p) => p.manage_campuses
  },
  /* Hidden until operational: Beacons, TV Manager, Events Manager, Notifications */
  {
    name: 'Resource Manager',
    href: '/resources/manage',
    icon: BookOpenIcon,
    gate: (p) => p.resource_manager
  },
  {
    name: 'Attendance Data',
    href: '/attendance-data',
    icon: DocumentChartBarIcon,
    gate: (p) => p.database_viewer
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: PresentationChartLineIcon,
    gate: (p) => p.data_export || p.dashboard_access
  }
];

function filterTopNavItems(items, permissions) {
  return items.filter((item) => !item.gate || item.gate(permissions) === true);
}

const TopNavigation = ({ activeSection }) => {
  const location = useLocation();
  const { permissions } = useSession();
  const scrollRef = useRef(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const filteredItems = useMemo(() => {
    if (activeSection === 'portal') {
      return filterTopNavItems(TOP_NAV_PORTAL_ITEMS, permissions);
    }
    if (activeSection === 'settings') {
      return filterTopNavItems(TOP_NAV_SETTINGS_ITEMS, permissions);
    }
    return [];
  }, [activeSection, permissions]);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const overflow = maxScroll > 4;
    setHasOverflow(overflow);
    setCanScrollLeft(overflow && el.scrollLeft > 4);
    setCanScrollRight(overflow && el.scrollLeft < maxScroll - 4);
  }, []);

  useLayoutEffect(() => {
    updateScrollState();
  }, [activeSection, location.pathname, filteredItems.length, updateScrollState]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(updateScrollState);
    });
    ro.observe(el);
    window.addEventListener('resize', updateScrollState);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState]);

  // Vertical mouse wheel scrolls the tab strip horizontally (no trackpad-only reliance).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
      requestAnimationFrame(updateScrollState);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [updateScrollState, hasOverflow]);

  const scrollTabsBy = (delta) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
    requestAnimationFrame(() => requestAnimationFrame(updateScrollState));
  };

  if (activeSection === 'home' || !activeSection || filteredItems.length === 0) {
    return null;
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 lg:block hidden"
      aria-label="Section pages"
    >
      <div className="lg:pl-64">
        <div className="flex items-stretch h-16 min-w-0 px-1 sm:px-2 lg:px-3 gap-0.5">
          {hasOverflow && (
            <button
              type="button"
              aria-label="Scroll tabs left"
              disabled={!canScrollLeft}
              onClick={() => scrollTabsBy(-280)}
              className="flex-shrink-0 self-center w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800/70 disabled:opacity-25 disabled:pointer-events-none disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeftIcon className="h-5 w-5" aria-hidden />
            </button>
          )}
          <div
            ref={scrollRef}
            onScroll={updateScrollState}
            className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden top-nav-tabs-scroll smooth-scroll pb-0.5"
          >
            <div className="flex items-center space-x-1 h-full min-h-[3.5rem] pr-2">
              {filteredItems.map((item) => {
                const isActive =
                  location.pathname === item.href ||
                  (item.href !== '/' && location.pathname.startsWith(item.href + '/'));

                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`
                      flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0
                      ${isActive
                        ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-blue-500/30 shadow-lg shadow-blue-500/20'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                      }
                    `}
                  >
                    <item.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
          {hasOverflow && (
            <button
              type="button"
              aria-label="Scroll tabs right"
              disabled={!canScrollRight}
              onClick={() => scrollTabsBy(280)}
              className="flex-shrink-0 self-center w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800/70 disabled:opacity-25 disabled:pointer-events-none disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRightIcon className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>
        {hasOverflow && (
          <p className="sr-only">
            This bar has more tabs than fit on screen. Use the arrow buttons, the scrollbar below the
            tabs, or your mouse wheel to see them all.
          </p>
        )}
      </div>
    </nav>
  );
};

export default TopNavigation;
