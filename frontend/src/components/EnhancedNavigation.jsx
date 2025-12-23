import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
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
  SignalIcon,
  BellIcon,
  PlayIcon,
  CalendarIcon,
  TableCellsIcon,
  MegaphoneIcon
} from '@heroicons/react/24/outline';

// Simplified main sections for left sidebar
const MAIN_SECTIONS = {
  home: {
    id: 'home',
    name: 'Home',
    icon: HomeIcon,
    href: '/',
    roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff', 'finance']
  },
  portal: {
    id: 'portal',
    name: 'Portal',
    icon: Squares2X2Icon,
    roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff', 'finance'],
    hasSubPages: true
  },
  settings: {
    id: 'settings',
    name: 'Settings',
    icon: Cog6ToothIcon,
    roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff', 'finance'],
    hasSubPages: true
  }
};

// Portal sub-pages
const PORTAL_ITEMS = [
  { 
    name: 'Input', 
    href: '/stats', 
    icon: ClipboardIcon, 
    roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user'],
    featureKey: 'input'
  },
  { 
    name: 'Dashboard', 
    href: '/dashboard', 
    icon: DocumentChartBarIcon, 
    roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user'],
    featureKey: 'dashboard'
  },
  { 
    name: 'Finance Input', 
    href: '/finance', 
    icon: ClipboardIcon, 
    roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'finance'],
    featureKey: 'finance'
  },
  { 
    name: 'Resources', 
    href: '/resources', 
    icon: BookOpenIcon, 
    roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff', 'finance'],
    featureKey: 'resources'
  }
];

// Settings sub-pages
// IMPORTANT: Campus Pastors and Staff should ONLY see "My Profile" by default
// All other settings pages require admin/leadership roles OR custom permissions override
const SETTINGS_ITEMS = [
  { 
    name: 'My Profile', 
    href: '/profile', 
    icon: UserCircleIcon, 
    roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff', 'finance'],
    featureKey: null  // Always visible for all roles - cannot be overridden
  },
  { 
    name: 'Users', 
    href: '/users', 
    icon: UserGroupIcon, 
    roles: ['superadmin', 'admin'],
    featureKey: 'user_management'
  },
  { 
    name: 'Role Manager', 
    href: '/role-manager', 
    icon: ShieldCheckIcon, 
    roles: ['superadmin', 'admin'],
    featureKey: 'user_management'
  },
  { 
    name: 'Database Viewer', 
    href: '/database-viewer', 
    icon: TableCellsIcon, 
    roles: ['superadmin', 'admin'],
    featureKey: 'database_viewer'
  },
  { 
    name: 'Homepage Manager', 
    href: '/homepage-manager', 
    icon: MegaphoneIcon, 
    roles: ['superadmin', 'admin'],
    featureKey: null
  },
  { 
    name: 'Campuses', 
    href: '/campuses', 
    icon: BuildingOfficeIcon, 
    roles: ['superadmin', 'admin'],
    featureKey: 'campus_management'
  },
  { 
    name: 'Beacons', 
    href: '/beacons', 
    icon: SignalIcon, 
    roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'],
    featureKey: 'beacon_management'
  },
  { 
    name: 'Resource Manager', 
    href: '/resources/manage', 
    icon: BookOpenIcon, 
    roles: ['superadmin', 'admin'],
    featureKey: 'resource_manager'
  },
  { 
    name: 'TV Manager', 
    href: '/tv/manage', 
    icon: PlayIcon, 
    roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'],
    featureKey: 'tv_manager'
  },
  { 
    name: 'Events Manager', 
    href: '/events/manage', 
    icon: CalendarIcon, 
    roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'],
    featureKey: 'events_manager'
  },
  { 
    name: 'Notifications', 
    href: '/notifications', 
    icon: BellIcon, 
    roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'],
    featureKey: 'notifications'
  },
  { 
    name: 'Attendance Data', 
    href: '/attendance-data', 
    icon: DocumentChartBarIcon, 
    roles: ['superadmin', 'admin'],
    featureKey: null
  }
];

const EnhancedNavigation = ({ 
  userRole, 
  customPermissions, 
  userName, 
  onLogout,
  sidebarOpen,
  setSidebarOpen,
  activeSection,
  setActiveSection
}) => {
  const location = useLocation();
  const navigate = useNavigate();
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
               path.startsWith('/beacons') || path.startsWith('/resources/manage') ||
               path.startsWith('/tv/manage') || path.startsWith('/events/manage') ||
               path.startsWith('/notifications') || path.startsWith('/export') || path.startsWith('/attendance-data') ||
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

  // Filter sections based on role
  const getFilteredSections = () => {
    return Object.values(MAIN_SECTIONS).filter(section => {
      return section.roles.includes(userRole);
    });
  };

  const filteredSections = useMemo(() => getFilteredSections(), [userRole]);

  // Filter items based on role and permissions
  const getFilteredItems = (items) => {
    return items.filter(item => {
      // Check custom permissions first (overrides role defaults)
      if (item.featureKey && customPermissions.hasOwnProperty(item.featureKey)) {
        return customPermissions[item.featureKey] === true;
      }
      
      // Then check role permission
      if (!item.roles.includes(userRole)) {
        return false;
      }
      
      return true;
    });
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
        
        // Default navigation - check available items for user's role
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

  const getRoleDisplayName = (role) => {
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
    return names[role] || role;
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
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 lg:hidden"
          onClick={() => {
            setShowMobileSubMenu(false);
            setMobileSubMenuSection(null);
          }}
        >
          <div 
            className="bg-slate-900 border border-slate-700/50 rounded-3xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center border border-blue-500/30">
                  <mobileSubMenuSection.icon className="h-6 w-6 text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">
                  {mobileSubMenuSection.name}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowMobileSubMenu(false);
                  setMobileSubMenuSection(null);
                }}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
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
                      w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-200
                      ${isActive
                        ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-blue-500/30 shadow-lg shadow-blue-500/20'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50 border border-transparent'
                      }
                    `}
                  >
                    <div className={`
                      w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                      ${isActive ? 'bg-blue-500/20' : 'bg-slate-800/50'}
                    `}>
                      <ItemIcon className={`h-5 w-5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
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
        fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        bg-slate-900 border-r border-slate-700/50 flex flex-col
      `}>
        <div className="flex h-full flex-col min-h-0">
          {/* Logo/Brand */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-slate-700/50 flex-shrink-0">
            <Link to="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
              <img 
                src="/static/logo.png?v=3" 
                alt="Futures PULSE Logo" 
                className="h-8 w-auto object-contain"
              />
              <span className="text-white font-semibold text-lg">Futures PULSE</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Main Navigation Sections */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto min-h-0">
            {filteredSections.map((section) => {
              const isActive = activeSection === section.id;
              const SectionIcon = section.icon;
              
              return (
                <button
                  key={section.id}
                  onClick={() => handleSectionClick(section)}
                  className={`
                    w-full flex items-center justify-between px-4 py-4 text-base font-medium rounded-xl transition-all duration-200
                    ${isActive 
                      ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-blue-500/30 shadow-lg shadow-blue-500/20' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50 border border-transparent'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <SectionIcon className={`h-6 w-6 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span>{section.name}</span>
                  </div>
                  {section.hasSubPages && (
                    <ChevronRightIcon className={`h-5 w-5 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Footer with User Info and Logout */}
          <div className="p-4 border-t border-slate-700/50 space-y-3 flex-shrink-0 bg-slate-900">
            <Link 
              to="/profile"
              className="block px-4 py-2 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <div className="text-sm text-slate-300 font-medium truncate">{userName}</div>
              <div className="text-xs text-slate-500">{getRoleDisplayName(userRole)}</div>
            </Link>
            
            <button
              onClick={onLogout}
              className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 text-red-300 hover:text-red-200 hover:bg-red-900/20"
            >
              <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default EnhancedNavigation;

