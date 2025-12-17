import React from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  UserGroupIcon,
  HeartIcon,
  UserCircleIcon,
  CalendarIcon,
  StarIcon,
  UserPlusIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

const PeopleLayout = () => {
  const location = useLocation();

  const navigationItems = [
    { name: 'People', href: '/people', icon: UserGroupIcon, exact: true },
    { name: 'Families', href: '/people/families', icon: UserGroupIcon },
    { name: 'Heartbeat', href: '/people/heartbeat', icon: HeartIcon },
    { name: 'Pastoral Care', href: '/people/pastoral-care', icon: UserCircleIcon },
    { name: 'New People', href: '/people/new-people', icon: UserPlusIcon },
    { name: 'New Christians', href: '/people/new-christians', icon: StarIcon },
    { name: 'Attendance', href: '/people/attendance', icon: CalendarIcon },
    { name: 'Groups', href: '/connect-groups', icon: UserGroupIcon }
  ];

  const isActive = (href, exact = false) => {
    if (exact) {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-slate-900 border-r border-slate-700/50 flex flex-col flex-shrink-0">
          {/* Header */}
          <div className="p-6 border-b border-slate-700/50">
            <h1 className="text-2xl font-bold text-white mb-1">People</h1>
            <p className="text-sm text-slate-400">Complete spiritual health overview</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
            {navigationItems.map((item) => {
              const active = isActive(item.href, item.exact);
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                    ${active
                      ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-blue-500/30 shadow-lg shadow-blue-500/20'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                    }
                  `}
                >
                  <Icon className={`h-5 w-5 ${active ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default PeopleLayout;

