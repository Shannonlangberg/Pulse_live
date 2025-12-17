import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  Cog6ToothIcon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  ChevronRightIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline';

// Simplified main sections for left sidebar
const MAIN_SECTIONS = {
  home: {
    id: 'home',
    name: 'Home',
    icon: HomeIcon,
    href: '/',
    roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff', 'finance']
  },
  portal: {
    id: 'portal',
    name: 'Portal',
    icon: Squares2X2Icon,
    roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff', 'finance'],
    hasSubPages: true
  },
  settings: {
    id: 'settings',
    name: 'Settings',
    icon: Cog6ToothIcon,
    roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff', 'finance'],
    hasSubPages: true
  }
};

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
               path.startsWith('/notifications') || path.startsWith('/export')) {
      setActiveSection('settings');
    }
  }, [location.pathname, setActiveSection]);

  // Filter sections based on role
  const getFilteredSections = () => {
    return Object.values(MAIN_SECTIONS).filter(section => {
      return section.roles.includes(userRole);
    });
  };

  const filteredSections = useMemo(() => getFilteredSections(), [userRole]);

  const handleSectionClick = (section) => {
    if (section.href) {
      // Direct navigation (like Home)
      navigate(section.href);
      setActiveSection(section.id);
      setSidebarOpen(false);
    } else if (section.hasSubPages) {
      // Just activate the section, top nav will handle sub-pages
      setActiveSection(section.id);
      
      // Default navigation for portal
      if (section.id === 'portal') {
        navigate('/stats');
      } else if (section.id === 'settings') {
        navigate('/profile');
      }
      
      setSidebarOpen(false);
    }
  };

  const getRoleDisplayName = (role) => {
    const names = {
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

          {/* View Mode Toggle */}
          <div className="px-4 py-3 border-b border-slate-700/50 flex-shrink-0">
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grouped')}
                className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-all ${
                  viewMode === 'grouped'
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800'
                }`}
                title="Grouped view"
              >
                <FunnelIcon className="h-3 w-3 inline mr-1" />
                Grouped
              </button>
              <button
                onClick={() => setViewMode('flat')}
                className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-all ${
                  viewMode === 'flat'
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800'
                }`}
                title="Flat view"
              >
                <ListBulletIcon className="h-3 w-3 inline mr-1" />
                Flat
              </button>
            </div>
          </div>

          {/* Navigation - Scrollable */}
          <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto min-h-0 pb-4 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
            {viewMode === 'grouped' ? (
              // Grouped View
              Object.entries(groupedItems).map(([groupName, items]) => {
                const groupInfo = Object.values(NAVIGATION_GROUPS).find(g => g.name === groupName);
                const isExpanded = expandedGroups[groupName] === true; // Default to collapsed, only expand if explicitly set
                const GroupIcon = groupInfo?.icon || Squares2X2Icon;
                
                return (
                  <div key={groupName} className="mb-2">
                    <button
                      onClick={() => toggleGroup(groupName)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-300 transition-colors uppercase tracking-wider"
                    >
                      <div className="flex items-center gap-2">
                        <GroupIcon className="h-4 w-4" />
                        <span>{groupName}</span>
                        <span className="text-slate-600">({items.length})</span>
                      </div>
                      <ChevronDownIcon className={`h-4 w-4 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                    </button>
                    
                    {isExpanded && (
                      <div className="mt-1 space-y-1">
                        {items.map((item) => {
                          const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
                          const isDisabled = item.disabled === true;
                          
                          if (isDisabled) {
                            return (
                              <div
                                key={item.name}
                                className="flex items-center px-4 py-2.5 text-sm font-medium rounded-lg text-slate-500/50 cursor-not-allowed opacity-50"
                                title="Coming soon"
                              >
                                <item.icon className="mr-3 h-5 w-5" />
                                {item.name}
                                <span className="ml-auto text-xs bg-slate-700/50 px-2 py-0.5 rounded">Soon</span>
                              </div>
                            );
                          }
                          
                          return (
                            <Link
                              key={item.name}
                              to={item.href}
                              className={`
                                flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                                ${isActive 
                                  ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-blue-500/30 shadow-lg shadow-blue-500/20' 
                                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                                }
                              `}
                              onClick={() => setSidebarOpen(false)}
                            >
                              <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                              {item.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              // Flat View
              <>
                {filteredItems.map((item) => {
                  const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
                  const isDisabled = item.disabled === true;
                  
                  if (isDisabled) {
                    return (
                      <div
                        key={item.name}
                        className="flex items-center px-4 py-2.5 text-sm font-medium rounded-lg text-slate-500/50 cursor-not-allowed opacity-50"
                        title="Coming soon"
                      >
                        <item.icon className="mr-3 h-5 w-5" />
                        {item.name}
                        <span className="ml-auto text-xs bg-slate-700/50 px-2 py-0.5 rounded">Soon</span>
                      </div>
                    );
                  }
                  
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`
                        flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                        ${isActive 
                          ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-blue-500/30 shadow-lg shadow-blue-500/20' 
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                        }
                      `}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                      {item.name}
                    </Link>
                  );
                })}
              </>
            )}

          </nav>

          {/* Footer with User Info and Logout */}
          <div className="p-4 border-t border-slate-700/50 space-y-3 flex-shrink-0 bg-slate-900">
            <div className="px-4 py-2 bg-slate-800/50 rounded-lg">
              <div className="text-sm text-slate-300 font-medium truncate">{userName}</div>
              <div className="text-xs text-slate-500">{getRoleDisplayName(userRole)}</div>
            </div>
            
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

