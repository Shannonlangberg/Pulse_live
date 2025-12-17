import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  DocumentChartBarIcon,
  UserGroupIcon,
  PlayIcon,
  ClipboardIcon,
  ChartBarIcon,
  UserCircleIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline';

const TopNavigation = ({ userRole, customPermissions }) => {
  const location = useLocation();

  // Primary navigation items for top bar
  const primaryItems = [
    { 
      name: 'Home', 
      href: '/', 
      icon: HomeIcon, 
      roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user'],
      featureKey: 'home'
    },
    { 
      name: 'Dashboard', 
      href: '/dashboard', 
      icon: DocumentChartBarIcon, 
      roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user'],
      featureKey: 'dashboard'
    },
    { 
      name: 'People', 
      href: '/people', 
      icon: UserGroupIcon, 
      roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'staff'],
      featureKey: 'people'
    },
    { 
      name: 'Pulse TV', 
      href: '/tv', 
      icon: PlayIcon, 
      roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff', 'finance'],
      featureKey: 'pulse_tv'
    },
    { 
      name: 'Weekly Input', 
      href: '/stats', 
      icon: ClipboardIcon, 
      roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user'],
      featureKey: 'input'
    },
    { 
      name: 'Giving', 
      href: '/giving-analytics', 
      icon: ChartBarIcon, 
      roles: ['admin', 'finance', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'],
      featureKey: 'giving'
    },
    { 
      name: 'My Profile', 
      href: '/profile', 
      icon: UserCircleIcon, 
      roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff'],
      featureKey: null
    },
    { 
      name: 'Communications', 
      href: '/communication', 
      icon: EnvelopeIcon, 
      roles: ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor'],
      featureKey: 'communication'
    }
  ];

  // Filter items based on role and permissions
  const getFilteredItems = () => {
    return primaryItems.filter(item => {
      // Pulse TV is visible to all authenticated users (unless explicitly denied)
      if (item.name === 'Pulse TV') {
        if (item.featureKey && customPermissions[item.featureKey] === false) {
          return false;
        }
        return true;
      }
      
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

  const filteredItems = getFilteredItems();

  return (
    <nav className="fixed top-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50">
      <div className="lg:pl-64">
        <div className="flex items-center justify-between h-16 px-4 lg:px-6">
          {/* Primary Navigation Items */}
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
                  <span className="hidden sm:inline">{item.name}</span>
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

