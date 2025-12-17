import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  ClipboardIcon,
  HeartIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  MapPinIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  BellIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  EnvelopeIcon,
  BookOpenIcon,
  SignalIcon,
  DocumentChartBarIcon,
  CalendarIcon,
  AcademicCapIcon,
  PlayIcon,
  ListBulletIcon,
  FunnelIcon,
  Squares2X2Icon,
  UsersIcon,
  HandRaisedIcon,
  SparklesIcon,
  UserPlusIcon,
  StarIcon
} from '@heroicons/react/24/outline';

// Navigation groups for better organization
const NAVIGATION_GROUPS = {
  home: {
    name: 'HOME',
    icon: HomeIcon,
    items: [
      { name: 'Home', href: '/', icon: HomeIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user'], featureKey: 'home' },
      { name: 'Dashboard', href: '/dashboard', icon: DocumentChartBarIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user'], featureKey: 'dashboard' },
    ]
  },
  people: {
    name: 'PEOPLE',
    icon: UserGroupIcon,
    items: [
      { name: 'People', href: '/people', icon: UserGroupIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'staff'], featureKey: 'people' },
      { name: 'Families', href: '/people/families', icon: UsersIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'staff'], featureKey: 'people' },
      { name: 'Heartbeat', href: '/people/heartbeat', icon: HeartIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'staff'], featureKey: 'people' },
      { name: 'Pastoral Care', href: '/people/pastoral-care', icon: HandRaisedIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'staff'], featureKey: 'people' },
      { name: 'New People', href: '/people/new-people', icon: UserPlusIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'staff'], featureKey: 'people' },
      { name: 'New Christians', href: '/people/new-christians', icon: SparklesIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'staff'], featureKey: 'people' },
      { name: 'Groups', href: '/groups', icon: UserGroupIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'staff', 'connect_group_leader'], featureKey: 'connect_groups' },
    ]
  },
  ministry: {
    name: 'MINISTRY',
    icon: PlayIcon,
    items: [
      { name: 'Pulse TV', href: '/tv', icon: PlayIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff', 'finance'], featureKey: 'pulse_tv' },
      { name: 'Devotions', href: '/devotions', icon: BookOpenIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff'], featureKey: 'devotions' },
      { name: 'Pathways', href: '/journeys', icon: AcademicCapIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff'], featureKey: 'pathway_manager' },
      { name: 'Events', href: '/events', icon: CalendarIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff'], featureKey: 'events' },
      { name: 'Serving', href: '/serving', icon: UserGroupIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'staff'], featureKey: 'serving' },
      { name: 'Prayer', href: '/prayer', icon: HeartIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff'], featureKey: 'prayer' },
      { name: 'Training', href: '#', icon: AcademicCapIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'], featureKey: 'training', disabled: true },
    ]
  },
  operations: {
    name: 'OPERATIONS',
    icon: ClipboardIcon,
    items: [
      { name: 'Weekly Input', href: '/stats', icon: ClipboardIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user'], featureKey: 'input' },
      { name: 'Giving', href: '/giving-analytics', icon: ChartBarIcon, roles: ['admin', 'finance', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'], featureKey: 'giving' },
      { name: 'Finance', href: '/finance', icon: CurrencyDollarIcon, roles: ['admin', 'finance', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'], featureKey: 'finance' },
      { name: 'Communications', href: '/communication', icon: EnvelopeIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor'], featureKey: 'communication' },
      { name: 'Resources', href: '/resources', icon: BookOpenIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'], featureKey: 'resources' },
      { name: 'Reports', href: '#', icon: DocumentChartBarIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'], featureKey: 'reports', disabled: true },
    ]
  },
  admin: {
    name: 'ADMIN',
    icon: ShieldCheckIcon,
    items: [
      { name: 'My Profile', href: '/profile', icon: UserCircleIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff'], featureKey: null },
      { name: 'Data Export', href: '/export', icon: DocumentChartBarIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'], featureKey: 'data_export' },
      { name: 'Users', href: '/users', icon: UserGroupIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'], featureKey: 'user_management' },
      { name: 'Role Manager', href: '/role-manager', icon: ShieldCheckIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'], featureKey: 'user_management' },
      { name: 'Campuses', href: '/campuses', icon: BuildingOfficeIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'], featureKey: 'campus_management' },
      { name: 'Beacon Management', href: '/beacons', icon: SignalIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'], featureKey: 'beacon_management' },
      { name: 'Resource Manager', href: '/resources/manage', icon: BookOpenIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'], featureKey: 'resource_manager' },
      { name: 'TV Manager', href: '/tv/manage', icon: PlayIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'], featureKey: 'tv_manager' },
      { name: 'Events Manager', href: '/events/manage', icon: CalendarIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'], featureKey: 'events_manager' },
      { name: 'Push Notifications', href: '/notifications', icon: BellIcon, roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'], featureKey: 'notifications' },
    ]
  }
};

const EnhancedNavigation = ({ 
  userRole, 
  customPermissions, 
  userName, 
  onLogout,
  sidebarOpen,
  setSidebarOpen,
  settingsOpen,
  setSettingsOpen
}) => {
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState({});
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' or 'flat'

  // Auto-expand the group that contains the current page
  useEffect(() => {
    const currentPath = location.pathname;
    
    // Find which group contains the current page
    let currentGroupName = null;
    Object.values(NAVIGATION_GROUPS).forEach(group => {
      const hasCurrentPage = group.items.some(item => {
        if (item.href === '/') {
          return currentPath === '/';
        }
        // Special handling for /groups routes - they should all highlight the Groups nav item
        if (item.href === '/groups') {
          return currentPath === '/groups' || currentPath.startsWith('/groups/') || currentPath === '/connect-groups';
        }
        return currentPath === item.href || currentPath.startsWith(item.href + '/');
      });
      
      if (hasCurrentPage) {
        currentGroupName = group.name;
      }
    });
    
    // Only expand the current page's group, preserve manually expanded groups
    if (currentGroupName) {
      setExpandedGroups(prev => ({
        ...prev,
        [currentGroupName]: true
      }));
    }
  }, [location.pathname]);

  // Filter and get navigation items
  const getFilteredItems = () => {
    const allItems = [];
    
    Object.values(NAVIGATION_GROUPS).forEach(group => {
      const filteredGroupItems = group.items.filter(item => {
        // Pulse TV is visible to all authenticated users (unless explicitly denied)
        if (item.name === 'Pulse TV') {
          if (item.featureKey && customPermissions[item.featureKey] === false) {
            return false;
          }
          return true;
        }
        
        // Check custom permissions first (overrides role defaults)
        // If featureKey is null, skip permission check (always show based on role)
        if (item.featureKey === null) {
          // No feature key means always show if role matches (legacy items)
          return item.roles.includes(userRole);
        }
        
        // If featureKey exists, check custom permissions first
        if (item.featureKey && customPermissions.hasOwnProperty(item.featureKey)) {
          return customPermissions[item.featureKey] === true;
        }
        
        // Then check role permission
        if (!item.roles.includes(userRole)) {
          return false;
        }
        
        return true;
      });
      
      if (filteredGroupItems.length > 0) {
        allItems.push(...filteredGroupItems.map(item => ({ ...item, group: group.name })));
      }
    });
    
    return allItems;
  };

  const allItems = useMemo(() => getFilteredItems(), [userRole, customPermissions]);

  // Use all items (no search filtering for now)
  const filteredItems = allItems;

  // Group items for grouped view
  const groupedItems = useMemo(() => {
    if (viewMode === 'flat') return { 'All': filteredItems };
    
    const grouped = {};
    filteredItems.forEach(item => {
      const groupName = item.group || 'Other';
      if (!grouped[groupName]) {
        grouped[groupName] = [];
      }
      grouped[groupName].push(item);
    });
    return grouped;
  }, [filteredItems, viewMode]);

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  // Settings menu items - Now empty since admin items are in main nav
  const getSettingsItems = () => {
    return [];
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
      'finance': 'Finance'
    };
    return names[role] || role;
  };

  const settingsItems = getSettingsItems();

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

