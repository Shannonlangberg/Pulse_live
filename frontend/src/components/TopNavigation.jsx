import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
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

const TopNavigation = ({ userRole, customPermissions, activeSection }) => {
  const location = useLocation();

  // Portal sub-pages (when Portal section is active)
  const portalItems = [
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
      roles: ['superadmin', 'admin', 'finance'],
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

  // Settings sub-pages (when Settings section is active)
  const settingsItems = [
    { 
      name: 'My Profile', 
      href: '/profile', 
      icon: UserCircleIcon, 
      roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff', 'finance'],
      featureKey: null
    },
    { 
      name: 'Users', 
      href: '/users', 
      icon: UserGroupIcon, 
      roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'],
      featureKey: 'user_management'
    },
    { 
      name: 'Role Manager', 
      href: '/role-manager', 
      icon: ShieldCheckIcon, 
      roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'],
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
      roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'],
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
      roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'],
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

  // Determine which items to show based on active section
  const getCurrentItems = () => {
    if (activeSection === 'portal') {
      return getFilteredItems(portalItems);
    } else if (activeSection === 'settings') {
      return getFilteredItems(settingsItems);
    }
    return [];
  };

  const filteredItems = getCurrentItems();

  // Don't show top nav when on home section
  if (activeSection === 'home' || !activeSection || filteredItems.length === 0) {
    return null;
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 lg:block hidden">
      <div className="lg:pl-64">
        <div className="flex items-center justify-between h-16 px-4 lg:px-6">
          {/* Sub-page Navigation Items */}
          <div className="flex items-center space-x-1 overflow-x-auto scrollbar-hide">
            {filteredItems.map((item) => {
              const isActive = location.pathname === item.href || 
                               (item.href !== '/' && location.pathname.startsWith(item.href + '/'));
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
                    ${isActive
                      ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-blue-500/30 shadow-lg shadow-blue-500/20'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                    }
                  `}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default TopNavigation;

