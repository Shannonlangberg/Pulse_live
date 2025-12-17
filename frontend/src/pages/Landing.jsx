import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowTopRightOnSquareIcon,
  LifebuoyIcon,
  MegaphoneIcon,
  SparklesIcon,
  ShieldCheckIcon,
  ClipboardIcon,
  UserGroupIcon,
  HeartIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  BookOpenIcon,
  PlayIcon,
  EnvelopeIcon,
  ChartBarIcon,
  UserPlusIcon,
  HandRaisedIcon,
  BuildingOfficeIcon,
  DocumentChartBarIcon,
  BoltIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';

const gradientBackground = 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950';

const getTimeOfDayGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

// Role-based quick actions
const getQuickActions = (role) => {
  const allRoles = [
    { name: 'My Profile', href: '/profile', icon: UserCircleIcon, color: 'blue' },
    { name: 'Pulse TV', href: '/tv', icon: PlayIcon, color: 'purple' },
    { name: 'Events', href: '/events', icon: CalendarIcon, color: 'cyan' },
  ];

  const roleActions = {
    admin: [
      { name: 'Users', href: '/users', icon: UserGroupIcon, color: 'blue' },
      { name: 'Campuses', href: '/campuses', icon: BuildingOfficeIcon, color: 'purple' },
      { name: 'Resources', href: '/resources/manage', icon: BookOpenIcon, color: 'teal' },
      { name: 'Data Export', href: '/export', icon: DocumentChartBarIcon, color: 'orange' },
    ],
    senior_leadership: [
      { name: 'Users', href: '/users', icon: UserGroupIcon, color: 'blue' },
      { name: 'Campuses', href: '/campuses', icon: BuildingOfficeIcon, color: 'purple' },
      { name: 'Resources', href: '/resources/manage', icon: BookOpenIcon, color: 'teal' },
      { name: 'Giving', href: '/giving-analytics', icon: CurrencyDollarIcon, color: 'green' },
    ],
    senior_pastor: [
      { name: 'People', href: '/people', icon: UserGroupIcon, color: 'blue' },
      { name: 'Giving', href: '/giving-analytics', icon: CurrencyDollarIcon, color: 'green' },
      { name: 'Heartbeat', href: '/people/heartbeat', icon: HeartIcon, color: 'red' },
      { name: 'Communications', href: '/communication', icon: EnvelopeIcon, color: 'purple' },
    ],
    lead_pastor: [
      { name: 'People', href: '/people', icon: UserGroupIcon, color: 'blue' },
      { name: 'Giving', href: '/giving-analytics', icon: CurrencyDollarIcon, color: 'green' },
      { name: 'Heartbeat', href: '/people/heartbeat', icon: HeartIcon, color: 'red' },
      { name: 'Communications', href: '/communication', icon: EnvelopeIcon, color: 'purple' },
    ],
    campus_pastor: [
      { name: 'Weekly Input', href: '/stats', icon: ClipboardIcon, color: 'blue' },
      { name: 'People', href: '/people', icon: UserGroupIcon, color: 'purple' },
      { name: 'New People', href: '/people/new-people', icon: UserPlusIcon, color: 'cyan' },
      { name: 'Pastoral Care', href: '/people/pastoral-care', icon: HandRaisedIcon, color: 'orange' },
      { name: 'Groups', href: '/groups', icon: UserGroupIcon, color: 'teal' },
    ],
    staff: [
      { name: 'People', href: '/people', icon: UserGroupIcon, color: 'blue' },
      { name: 'Groups', href: '/groups', icon: UserGroupIcon, color: 'purple' },
      { name: 'Serving', href: '/serving', icon: UserGroupIcon, color: 'cyan' },
    ],
    connect_group_leader: [
      { name: 'My Groups', href: '/groups', icon: UserGroupIcon, color: 'blue' },
      { name: 'Mark Attendance', href: '/groups', icon: ClipboardIcon, color: 'green' },
    ],
    member: [
      { name: 'Prayer', href: '/prayer', icon: HeartIcon, color: 'purple' },
      { name: 'My Groups', href: '/groups', icon: UserGroupIcon, color: 'blue' },
      { name: 'Serving', href: '/serving', icon: UserGroupIcon, color: 'cyan' },
    ],
  };

  const specificActions = roleActions[role] || [];
  return [...allRoles, ...specificActions].slice(0, 6);
};

const Landing = () => {
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      setSessionLoading(true);
      try {
        const response = await fetch('/api/session', { 
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          }
        });
        if (!response.ok) {
          throw new Error('Session fetch failed');
        }
        const data = await response.json();
        setSession(data || {});
      } catch (error) {
        console.error('Unable to load session data:', error);
        setSession(null);
      } finally {
        setSessionLoading(false);
      }
    };

    const fetchCategoryPreview = async () => {
      setCategoriesLoading(true);
      try {
        const response = await fetch('/api/resources/categories', { credentials: 'include' });
        if (!response.ok) {
          if (response.status === 403) {
            setCategories([]);
            return;
          }
          throw new Error('Categories fetch failed');
        }
        const data = await response.json();
        const categoryList = Array.isArray(data.categories) ? data.categories : [];
        setCategories(categoryList.slice(0, 3));
      } catch (error) {
        console.error('Unable to load resource categories:', error);
        setCategories([]);
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchSession();
    fetchCategoryPreview();
  }, []);

  const navigate = useNavigate();

  const getFirstName = (fullName) => {
    if (!fullName) return 'team';
    return fullName.split(' ')[0];
  };

  const featuredCategories = categories.filter(Boolean);
  const actualRole = session?.role || 'user';
  const isAdmin = actualRole === 'admin';
  const quickActions = getQuickActions(actualRole);

  const announcements = [
    {
      title: 'New volunteer onboarding kit',
      description: 'Download the refreshed onboarding guide for campus teams.',
      href: '/resources',
      type: 'update'
    },
    {
      title: 'Weekend pulse refresher',
      description: 'Watch the 5-minute walkthrough on capturing post-service highlights.',
      href: '/resources',
      type: 'training'
    }
  ];

  const supportItems = [
    {
      title: 'Need help?',
      description: 'Email the Ops team for assistance with access or data questions.',
      action: 'ops@futures.church'
    },
    {
      title: 'Share feedback',
      description: 'Suggest new resources or features to keep PULSE moving forward.',
      action: 'feedback@futures.church'
    }
  ];

  const greeting = getTimeOfDayGreeting();
  const firstName = getFirstName(session?.full_name) || session?.username || 'team';

  const colorClasses = {
    blue: { bg: 'from-blue-500/20 to-blue-600/20', border: 'border-blue-400/30', icon: 'text-blue-300', iconBg: 'bg-blue-500/30' },
    purple: { bg: 'from-purple-500/20 to-purple-600/20', border: 'border-purple-400/30', icon: 'text-purple-300', iconBg: 'bg-purple-500/30' },
    green: { bg: 'from-green-500/20 to-green-600/20', border: 'border-green-400/30', icon: 'text-green-300', iconBg: 'bg-green-500/30' },
    red: { bg: 'from-red-500/20 to-red-600/20', border: 'border-red-400/30', icon: 'text-red-300', iconBg: 'bg-red-500/30' },
    cyan: { bg: 'from-cyan-500/20 to-cyan-600/20', border: 'border-cyan-400/30', icon: 'text-cyan-300', iconBg: 'bg-cyan-500/30' },
    teal: { bg: 'from-teal-500/20 to-teal-600/20', border: 'border-teal-400/30', icon: 'text-teal-300', iconBg: 'bg-teal-500/30' },
    orange: { bg: 'from-orange-500/20 to-orange-600/20', border: 'border-orange-400/30', icon: 'text-orange-300', iconBg: 'bg-orange-500/30' },
  };

  return (
    <div className={`min-h-screen ${gradientBackground} text-white`}>
      <div className="relative">
        {/* Animated background gradients */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-700" />
          <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl animate-pulse delay-[1200ms]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8 sm:space-y-10">
          {/* Header Section */}
          <header className="bg-gradient-to-br from-white/5 via-white/5 to-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 md:p-10 backdrop-blur-md shadow-xl shadow-blue-500/10 relative overflow-hidden">
            {isAdmin && (
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full blur-3xl -mr-32 -mt-32 animate-pulse" />
            )}
            <div className="absolute top-0 left-0 w-32 h-1 bg-gradient-to-r from-red-600 via-red-500 to-transparent rounded-tl-3xl" />
            
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 lg:gap-8 relative z-10">
              <div className="space-y-4 flex-1">
                <div className="inline-flex items-center gap-2 text-blue-300 text-sm font-medium bg-blue-500/10 border border-blue-400/40 rounded-full px-3 py-1.5">
                  <SparklesIcon className="h-4 w-4" />
                  {sessionLoading ? 'Loading...' : (isAdmin ? 'Admin Dashboard' : 'Welcome to Futures PULSE')}
                </div>
                <div className="space-y-3">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
                    {sessionLoading ? 'Loading...' : `${greeting}, ${firstName}!`}
                  </h1>
                  <p className="text-white/70 text-base sm:text-lg max-w-2xl leading-relaxed">
                    {isAdmin 
                      ? 'Your command center for managing Futures PULSE—oversee users, campuses, resources, and data across the entire platform.'
                      : 'Your launchpad for the week ahead—track key metrics, share weekend stories, and access the resources your teams rely on.'
                    }
                  </p>
                  {isAdmin && (
                    <div className="flex items-center gap-2 pt-2">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-400/40 rounded-lg">
                        <ShieldCheckIcon className="h-4 w-4 text-purple-300" />
                        <span className="text-xs font-medium text-purple-200">Administrator Access</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Announcements */}
              <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/10 rounded-2xl p-5 sm:p-6 w-full lg:w-auto lg:min-w-[320px]">
                <div className="flex items-center gap-3 text-white/80 text-sm mb-4">
                  <MegaphoneIcon className="h-5 w-5 text-blue-300" />
                  <span className="font-medium">Platform Updates</span>
                </div>
                <div className="space-y-3">
                  {announcements.map((item) => (
                    <a
                      key={item.title}
                      href={item.href}
                      className="block bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-all duration-200 group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white group-hover:text-blue-200 truncate">{item.title}</p>
                          <p className="text-xs text-white/50 leading-snug mt-1 line-clamp-2">{item.description}</p>
                        </div>
                        <ArrowTopRightOnSquareIcon className="h-4 w-4 text-white/40 group-hover:text-blue-200 flex-shrink-0 ml-2" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </header>

          {/* Quick Actions Section */}
          {quickActions.length > 0 && (
            <section className="space-y-5">
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold flex items-center gap-2 mb-1">
                  <BoltIcon className="h-6 w-6 text-yellow-400" />
                  Quick Actions
                </h2>
                <p className="text-white/60 text-sm sm:text-base">
                  Jump to your most-used features
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  const colors = colorClasses[action.color] || colorClasses.blue;
                  return (
                    <button
                      key={action.name}
                      onClick={() => navigate(action.href)}
                      className={`
                        group relative bg-gradient-to-br ${colors.bg} ${colors.border}
                        rounded-2xl p-5 transition-all duration-300
                        hover:scale-105 hover:shadow-xl
                        border backdrop-blur-sm
                        flex flex-col items-center justify-center gap-3
                        min-h-[120px]
                      `}
                    >
                      <div className={`w-12 h-12 rounded-xl ${colors.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className={`h-6 w-6 ${colors.icon}`} />
                      </div>
                      <span className="text-sm font-semibold text-white text-center leading-tight">
                        {action.name}
                      </span>
                      <ArrowTopRightOnSquareIcon className={`absolute top-2 right-2 h-4 w-4 ${colors.icon} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Resource Spotlight - Only for non-admin */}
          {!isAdmin && (
            <section className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold mb-1">Resource Spotlight</h2>
                  <p className="text-white/60 text-sm sm:text-base">
                    Recently added folders from the Futures resource library
                  </p>
                </div>
                <a
                  href="/resources"
                  className="inline-flex items-center gap-2 text-sm text-blue-200 hover:text-blue-100 transition-colors duration-200"
                >
                  Browse full library
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                </a>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {categoriesLoading && (
                  <div className="col-span-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white/60 text-center">
                    Loading featured folders...
                  </div>
                )}
                {!categoriesLoading && featuredCategories.length === 0 && (
                  <div className="col-span-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white/60 text-center">
                    No shared folders yet—check back soon or reach out to the Ops team.
                  </div>
                )}
                {featuredCategories.map((category) => (
                  <a
                    key={category.id}
                    href="/resources"
                    className="group bg-gradient-to-br from-slate-900/60 to-slate-900/30 border border-white/10 rounded-2xl p-6 transition-all duration-200 hover:border-blue-400/40 hover:-translate-y-1"
                  >
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center text-2xl">
                        📁
                      </div>
                      <ArrowTopRightOnSquareIcon className="h-4 w-4 text-white/30 group-hover:text-blue-200 transition-colors" />
                    </div>
                    <h3 className="text-lg font-semibold text-white group-hover:text-blue-200 transition-colors duration-200 mb-2">
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="text-sm text-white/60 leading-relaxed line-clamp-3">
                        {category.description}
                      </p>
                    )}
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Admin Quick Access */}
          {isAdmin && (
            <section className="space-y-5">
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold flex items-center gap-2 mb-1">
                  <ShieldCheckIcon className="h-6 w-6 text-purple-400" />
                  Admin Quick Access
                </h2>
                <p className="text-white/60 text-sm sm:text-base">
                  Key management tools and system overview
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                <button
                  onClick={() => navigate('/users')}
                  className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-400/30 rounded-2xl p-6 hover:scale-105 transition-all duration-300 text-left group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <UserGroupIcon className="h-8 w-8 text-blue-300 group-hover:scale-110 transition-transform" />
                    <ArrowTopRightOnSquareIcon className="h-5 w-5 text-blue-300/50 group-hover:text-blue-300 group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">User Management</h3>
                  <p className="text-sm text-white/60">Manage all users and permissions</p>
                </button>
                <button
                  onClick={() => navigate('/campuses')}
                  className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-400/30 rounded-2xl p-6 hover:scale-105 transition-all duration-300 text-left group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <BuildingOfficeIcon className="h-8 w-8 text-purple-300 group-hover:scale-110 transition-transform" />
                    <ArrowTopRightOnSquareIcon className="h-5 w-5 text-purple-300/50 group-hover:text-purple-300 group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">Campus Management</h3>
                  <p className="text-sm text-white/60">Configure campus settings</p>
                </button>
                <button
                  onClick={() => navigate('/resources/manage')}
                  className="bg-gradient-to-br from-teal-500/10 to-cyan-500/10 border border-teal-400/30 rounded-2xl p-6 hover:scale-105 transition-all duration-300 text-left group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <BookOpenIcon className="h-8 w-8 text-teal-300 group-hover:scale-110 transition-transform" />
                    <ArrowTopRightOnSquareIcon className="h-5 w-5 text-teal-300/50 group-hover:text-teal-300 group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">Resource Manager</h3>
                  <p className="text-sm text-white/60">Organize and manage resources</p>
                </button>
              </div>
            </section>
          )}

          {/* Support & Feedback */}
          <section className="space-y-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold mb-1">Support & Feedback</h2>
              <p className="text-white/60 text-sm sm:text-base">
                We're here to help keep things moving smoothly for your campus
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {supportItems.map((item) => (
                <div
                  key={item.title}
                  className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <LifebuoyIcon className="h-6 w-6 text-blue-300" />
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed">
                    {item.description}
                  </p>
                  <a
                    href={`mailto:${item.action}`}
                    className="inline-flex items-center gap-2 text-sm text-blue-200 hover:text-blue-100 transition-colors duration-200"
                  >
                    {item.action}
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Landing;
