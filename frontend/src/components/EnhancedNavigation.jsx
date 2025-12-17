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
    roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff', 'finance']
  },
  portal: {
    id: 'portal',
    name: 'Portal',
    icon: Squares2X2Icon,
    roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'finance'],
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
               path.startsWith('/notifications') || path.startsWith('/export') ||
               path.startsWith('/homepage-manager')) {
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

