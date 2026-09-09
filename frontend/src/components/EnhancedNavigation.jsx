import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ClockIcon,
  HomeIcon,
  Cog6ToothIcon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  ChevronRightIcon,
  Squares2X2Icon,
  ClipboardIcon,
  DocumentChartBarIcon,
  BookOpenIcon,
  UserCircleIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  ShieldCheckIcon,
  TableCellsIcon,
  MegaphoneIcon,
  PresentationChartLineIcon
} from '@heroicons/react/24/outline';
import { useSession } from '../lib/useSession';

// Simplified main sections for left sidebar.
// Visibility is driven ONLY by the server-resolved `permissions` object
// from /api/session — never by role names.
const MAIN_SECTIONS = {
  home: {
    id: 'home',
    name: 'Home',
    icon: HomeIcon,
    href: '/'
    // Always visible
  },
  portal: {
    id: 'portal',
    name: 'Portal',
    icon: Squares2X2Icon,
    hasSubPages: true
    // Always visible (contains Resources which everyone can see)
  },
  settings: {
    id: 'settings',
    name: 'Settings',
    icon: Cog6ToothIcon,
    hasSubPages: true
    // Always visible (contains My Profile which everyone can see)
  }
};

// Portal sub-pages — `gate` receives the resolved permissions object.
// Omitted gate = always visible.
const PORTAL_ITEMS = [
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

// Settings sub-pages
const SETTINGS_ITEMS = [
  {
    name: 'My Profile',
    href: '/profile',
    icon: UserCircleIcon
    // Always visible for all users
  },
  {
    name: 'Service Times',
    href: '/service-times',
    icon: ClockIcon,
    gate: (p) => p.log_stats
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
    name: 'Ministry stats',
    href: '/ministry-stats',
    icon: PresentationChartLineIcon,
    gate: (p) => p.dashboard_access || p.data_export
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

const EnhancedNavigation = ({
  userName,
  onLogout,
  sidebarOpen,
  setSidebarOpen,
  activeSection,
  setActiveSection
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, permissions } = useSession();
  const [showMobileSubMenu, setShowMobileSubMenu] = useState(false);
  const [mobileSubMenuSection, setMobileSubMenuSection] = useState(null);

  // Determine active section based on current path
  useEffect(() => {
    const path = location.pathname;
    if (path === '/') {
      setActiveSection('home');
    } else if (path === '/stats' || path === '/dashboard' || path === '/resources') {
      setActiveSection('portal');
    } else if (path.startsWith('/users') || path.startsWith('/role-manager') ||
               path.startsWith('/campuses') || path.startsWith('/profile') ||
               path.startsWith('/service-times') ||
               path.startsWith('/beacons') || path.startsWith('/resources/manage') ||
               path.startsWith('/tv/manage') || path.startsWith('/events/manage') ||
               path.startsWith('/notifications') || path.startsWith('/export') || path.startsWith('/reports') || path.startsWith('/ministry-stats') || path.startsWith('/attendance-data') ||
               path.startsWith('/homepage-manager')) {
      setActiveSection('settings');
    }
  }, [location.pathname, setActiveSection]);

  // Close mobile submenu on window resize to desktop size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && showMobileSubMenu) {
        setShowMobileSubMenu(false);
        setMobileSubMenuSection(null);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showMobileSubMenu]);

  // Main sections are always visible
  const filteredSections = useMemo(() => Object.values(MAIN_SECTIONS), []);

  // Filter items on server-resolved permissions only
  const getFilteredItems = (items) => {
    return items.filter((item) => !item.gate || item.gate(permissions) === true);
  };

  // Get subpages for a section
  const getSubPages = (sectionId) => {
    if (sectionId === 'portal') {
      return getFilteredItems(PORTAL_ITEMS);
    } else if (sectionId === 'settings') {
      return getFilteredItems(SETTINGS_ITEMS);
    }
    return [];
  };

  const handleSectionClick = (section) => {
    if (section.href) {
      // Direct navigation (like Home)
      navigate(section.href);
      setActiveSection(section.id);
      setSidebarOpen(false);
    } else if (section.hasSubPages) {
      // On mobile: show submenu modal
      // On desktop: activate section and navigate
      const isMobile = window.innerWidth < 1024; // lg breakpoint

      if (isMobile) {
        setMobileSubMenuSection(section);
        setShowMobileSubMenu(true);
        setSidebarOpen(false);
      } else {
        // Desktop behavior
        setActiveSection(section.id);

        // Default navigation - navigate to first item the user can see
        if (section.id === 'portal') {
          const portalItems = getFilteredItems(PORTAL_ITEMS);
          // Navigate to first available portal item, or resources as fallback
          if (portalItems.length > 0) {
            navigate(portalItems[0].href);
          } else {
            navigate('/resources');
          }
        } else if (section.id === 'settings') {
          navigate('/profile');
        }

        setSidebarOpen(false);
      }
    }
  };

  const handleMobileSubPageClick = (href) => {
    navigate(href);
    setShowMobileSubMenu(false);
    setMobileSubMenuSection(null);
  };

  // Purely cosmetic role label — never used for gating
  const getRoleDisplayName = (roleName) => {
    const names = {
      'superadmin': 'Super Administrator',
      'admin': 'Administrator',
      'senior_leadership': 'Senior Leadership',
      'senior_leader': 'Senior Leader',
      'senior_pastor': 'Senior Pastor',
      'lead_pastor': 'Lead Pastor',
      'campus_pastor': 'Campus Pastor',
      'pastor': 'Pastor',
      'finance': 'Finance',
      'staff': 'Staff',
      'user': 'User'
    };
    return names[roleName] || roleName || '';
  };

  return (
    <>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sub-Menu Modal */}
      {showMobileSubMenu && mobileSubMenuSection && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 lg:hidden"
          onClick={() => {
            setShowMobileSubMenu(false);
            setMobileSubMenuSection(null);
          }}
        >
          <div
            className="bg-fc-midnight border border-white/10 rounded-2xl shadow-pop max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-fc-olive/15 flex items-center justify-center border border-fc-olive/30">
                  <mobileSubMenuSection.icon className="h-6 w-6 text-fc-olive" />
                </div>
                <h2 className="text-xl font-semibold text-fc-dark-text">
                  {mobileSubMenuSection.name}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowMobileSubMenu(false);
                  setMobileSubMenuSection(null);
                }}
                className="p-2 rounded-lg text-fc-dark-text/50 hover:text-fc-dark-text hover:bg-white/5 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Content - Subpages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 modal-scroll">
              {getSubPages(mobileSubMenuSection.id).map((item) => {
                const ItemIcon = item.icon;
                const isActive = location.pathname === item.href ||
                                (item.href !== '/' && location.pathname.startsWith(item.href + '/'));

                return (
                  <button
                    key={item.name}
                    onClick={() => handleMobileSubPageClick(item.href)}
                    className={`
                      w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-200 border-l-2
                      ${isActive
                        ? 'bg-fc-olive/15 text-fc-dark-text border-fc-olive'
                        : 'text-fc-dark-text/55 hover:text-fc-dark-text hover:bg-white/5 border-transparent'
                      }
                    `}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ItemIcon className={`h-5 w-5 ${isActive ? 'text-fc-olive' : 'text-fc-thistle/40'}`} />
                    </div>
                    <span className="text-base font-medium">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-56 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        bg-fc-midnight flex flex-col
      `}>
        <div className="flex h-full flex-col min-h-0">
          {/* Logo/Brand */}
          <div className="px-5 pt-5 pb-4 border-b border-white/[0.08] flex-shrink-0">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity mb-2.5">
                <img
                  src="/static/logo.png?v=3"
                  alt="Futures Church"
                  className="h-4 w-auto object-contain opacity-70"
                />
                <span className="text-[10px] font-bold tracking-[3px] uppercase text-fc-thistle/45">Futures</span>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1 rounded-md text-fc-thistle/50 hover:text-fc-dark-text hover:bg-white/5"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
              <img src="/assets/pulse-mark.svg" alt="" className="w-6 h-6 flex-shrink-0" />
              <span className="font-display italic font-light text-[26px] text-fc-dark-text leading-none tracking-tight">Pulse</span>
            </Link>
          </div>

          {/* Main Navigation Sections */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto min-h-0">
            {filteredSections.map((section) => {
              const isActive = activeSection === section.id;
              const SectionIcon = section.icon;

              return (
                <button
                  key={section.id}
                  onClick={() => handleSectionClick(section)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2.5 text-[13px] rounded-lg transition-all duration-150 border-l-2
                    ${isActive
                      ? 'bg-fc-olive/[0.14] text-fc-dark-text font-medium border-fc-olive'
                      : 'text-fc-dark-text/55 hover:text-fc-dark-text hover:bg-white/5 font-normal border-transparent'
                    }
                  `}
                >
                  <div className="flex items-center gap-2.5">
                    <SectionIcon className={`h-[18px] w-[18px] ${isActive ? 'text-fc-olive' : 'text-fc-thistle/35'}`} />
                    <span>{section.name}</span>
                  </div>
                  {section.hasSubPages && (
                    <ChevronRightIcon className={`h-4 w-4 ${isActive ? 'text-fc-olive' : 'text-fc-thistle/25'}`} />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Footer with User Info and Logout */}
          <div className="px-3 py-3.5 border-t border-white/[0.08] flex-shrink-0">
            <div className="flex items-center gap-2.5 px-3 py-2">
              <div className="w-7 h-7 rounded-full bg-fc-olive/20 border border-fc-olive/40 text-fc-dark-text flex items-center justify-center text-[11px] font-semibold flex-shrink-0">
                {userName ? userName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() : ''}
              </div>
              <Link to="/profile" className="min-w-0 flex-1 hover:opacity-80 transition-opacity">
                <div className="text-xs text-fc-dark-text font-medium truncate">{userName}</div>
                <div className="text-[11px] text-fc-dark-text/40 truncate">{getRoleDisplayName(role)}</div>
              </Link>
              <button
                onClick={onLogout}
                title="Sign out"
                className="p-1 text-fc-thistle/35 hover:text-fc-dark-text transition-colors flex-shrink-0"
              >
                <ArrowRightOnRectangleIcon className="h-[15px] w-[15px]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EnhancedNavigation;
