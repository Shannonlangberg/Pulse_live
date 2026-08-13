import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowTopRightOnSquareIcon,
  LifebuoyIcon,
  MegaphoneIcon,
  ShieldCheckIcon,
  ClipboardIcon,
  UserGroupIcon,
  BookOpenIcon,
  ChartBarIcon,
  PresentationChartLineIcon,
  BuildingOfficeIcon,
  BoltIcon,
  UserCircleIcon,
  PlayCircleIcon,
  AcademicCapIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';

const getTimeOfDayGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

/** API role strings sometimes differ; normalize so quick-action filters match. */
const normalizeRoleForLanding = (raw) => {
  if (raw == null || raw === '') return 'user';
  const s = String(raw).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (s === 'super_administrator' || s === 'super_admin') return 'superadmin';
  if (s === 'leadership' || s === 'seniorleadership') return 'senior_leadership';
  return s;
};

const MINISTRY_STATS_ACTION = {
  name: 'Ministry stats',
  href: '/ministry-stats',
  icon: PresentationChartLineIcon,
  color: 'emerald',
};

// Quick actions filtered by role
const getQuickActions = (userRole) => {
  const allActions = [
    { name: 'My Profile', href: '/profile', icon: UserCircleIcon, color: 'blue', roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff', 'finance'] },
    { name: 'Input', href: '/stats', icon: ClipboardIcon, color: 'purple', roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'campus_pastor'] },
    { name: 'Dashboard', href: '/dashboard', icon: ChartBarIcon, color: 'cyan', roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'campus_pastor'] },
    {
      ...MINISTRY_STATS_ACTION,
      roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff', 'finance'],
    },
    { name: 'Resources', href: '/resources', icon: BookOpenIcon, color: 'teal', roles: ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'staff', 'finance'] },
  ];

  return allActions.filter((action) => action.roles.includes(userRole));
};

/** If role matched oddly, still show Ministry stats when user clearly has Input or Dashboard. */
const MINISTRY_STATS_ELIGIBLE_ROLES = new Set([
  'superadmin',
  'admin',
  'senior_leadership',
  'senior_leader',
  'senior_pastor',
  'lead_pastor',
  'campus_pastor',
  'pastor',
  'user',
  'staff',
  'finance',
]);

const ensureMinistryStatsQuickAction = (actions, canonicalRole) => {
  if (actions.some((a) => a.href === '/ministry-stats')) return actions;
  const hasInput = actions.some((a) => a.href === '/stats');
  const hasDashboard = actions.some((a) => a.href === '/dashboard');
  if (!hasInput && !hasDashboard) return actions;
  if (!MINISTRY_STATS_ELIGIBLE_ROLES.has(canonicalRole)) return actions;
  const idx = actions.findIndex((a) => a.href === '/dashboard');
  const next = [...actions];
  const insertAt = idx >= 0 ? idx + 1 : actions.length;
  next.splice(insertAt, 0, { ...MINISTRY_STATS_ACTION });
  return next;
};

const Landing = () => {
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [homepageMessages, setHomepageMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);

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

    const fetchHomepageMessages = async () => {
      setMessagesLoading(true);
      try {
        const response = await fetch('/api/homepage-messages', { credentials: 'include' });
        if (!response.ok) {
          throw new Error('Homepage messages fetch failed');
        }
        const data = await response.json();
        setHomepageMessages(data.messages || []);
      } catch (error) {
        console.error('Unable to load homepage messages:', error);
        setHomepageMessages([]);
      } finally {
        setMessagesLoading(false);
      }
    };

    fetchSession();
    fetchCategoryPreview();
    fetchHomepageMessages();
  }, []);

  const navigate = useNavigate();

  const getFirstName = (fullName) => {
    if (!fullName) return 'team';
    return fullName.split(' ')[0];
  };

  const featuredCategories = categories.filter(Boolean);
  const actualRole = normalizeRoleForLanding(session?.role || 'user');
  const isAdmin = actualRole === 'superadmin' || actualRole === 'admin';
  const quickActions = ensureMinistryStatsQuickAction(getQuickActions(actualRole), actualRole);

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
    blue: { bg: 'bg-fc-wash-thistle', border: 'border-fc-wash-thistle-border', icon: 'text-fc-brown', iconBg: 'bg-white' },
    purple: { bg: 'bg-fc-wash-mint', border: 'border-fc-wash-mint-border', icon: 'text-fc-olive', iconBg: 'bg-white' },
    green: { bg: 'bg-fc-wash-mint', border: 'border-fc-wash-mint-border', icon: 'text-fc-olive', iconBg: 'bg-white' },
    red: { bg: 'bg-fc-wash-peach', border: 'border-fc-wash-peach-border', icon: 'text-fc-copper', iconBg: 'bg-white' },
    cyan: { bg: 'bg-fc-wash-sky', border: 'border-fc-wash-sky-border', icon: 'text-fc-teal', iconBg: 'bg-white' },
    teal: { bg: 'bg-fc-wash-peach', border: 'border-fc-wash-peach-border', icon: 'text-fc-copper', iconBg: 'bg-white' },
    orange: { bg: 'bg-fc-wash-butter', border: 'border-fc-wash-butter-border', icon: 'text-fc-gold', iconBg: 'bg-white' },
    emerald: { bg: 'bg-fc-wash-butter', border: 'border-fc-wash-butter-border', icon: 'text-fc-gold', iconBg: 'bg-white' },
  };

  return (
    <div className="min-h-screen bg-fc-cream">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 md:py-10 space-y-8 sm:space-y-9 md:space-y-10">
        {/* Header Section */}
        <header>
          <div className="fc-label mb-2.5">
            {sessionLoading ? 'Loading…' : (isAdmin ? 'Admin Dashboard' : 'Futures Pulse')}
          </div>
          <h1 className="fc-display fc-display-md mb-2.5">
            {sessionLoading ? 'Loading…' : `${greeting}, ${firstName}.`}
          </h1>
          <p className="m-0 text-sm sm:text-base text-fc-brown max-w-2xl leading-relaxed">
            {isAdmin
              ? 'Your command center for managing Futures PULSE—oversee users, campuses, resources, and data across the entire platform.'
              : 'Your launchpad for the week ahead—track key metrics, share weekend stories, and access the resources your teams rely on.'
            }
          </p>
          {isAdmin && (
            <div className="flex items-center gap-2 pt-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-fc-cream2 rounded-lg shadow-card">
                <ShieldCheckIcon className="h-4 w-4 text-fc-copper" />
                <span className="text-xs font-medium text-fc-midnight">Administrator Access</span>
              </div>
            </div>
          )}
        </header>

        {/* Homepage Messages Section */}
        {!messagesLoading && homepageMessages.length > 0 && (
          <section className="space-y-3 sm:space-y-4">
            {homepageMessages.map((msg) => (
              <div
                key={msg.id}
                className="bg-fc-wash-butter border border-fc-wash-butter-border rounded-xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4"
              >
                <MegaphoneIcon className="h-[18px] w-[18px] text-fc-copper flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-fc-midnight mb-1.5">{msg.heading}</h3>
                  <p className="text-sm text-fc-brown leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Training & Help Section */}
        <section className="space-y-3 sm:space-y-4">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-fc-midnight flex items-center gap-2 mb-1">
              <AcademicCapIcon className="h-5 w-5 text-fc-olive" />
              Training & Help
            </h2>
            <p className="text-fc-brown text-xs sm:text-sm">
              Learn how to use Pulse with our training resources
            </p>
          </div>

          <a
            href="/videos/pulse-training.mp4"
            target="_blank"
            rel="noopener noreferrer"
            className="group block bg-fc-wash-mint border border-fc-wash-mint-border rounded-xl p-4 sm:p-5 md:p-6 transition-all duration-200 active:scale-[0.98] touch-manipulation"
          >
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
                <PlayCircleIcon className="h-6 w-6 text-fc-olive" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <h3 className="text-base sm:text-lg font-semibold text-fc-midnight">
                    Pulse Training Video
                  </h3>
                  <ArrowTopRightOnSquareIcon className="h-4 w-4 text-fc-olive/70 group-hover:text-fc-olive transition-colors" />
                </div>
                <p className="text-sm text-fc-brown leading-relaxed">
                  Watch this comprehensive tutorial to learn how to navigate Pulse, input your weekly stats, and make the most of all the features available to you.
                </p>
                <div className="mt-3 inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-fc-olive">
                  <PlayCircleIcon className="h-4 w-4" />
                  <span>Click to watch video</span>
                </div>
              </div>
            </div>
          </a>
        </section>

        {/* Quick Actions Section */}
        {quickActions.length > 0 && (
          <section className="space-y-4 sm:space-y-5">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-fc-midnight flex items-center gap-2 mb-1">
                <BoltIcon className="h-5 w-5 text-fc-gold" />
                Quick Actions
              </h2>
              <p className="text-fc-brown text-xs sm:text-sm">
                Jump to your most-used features
              </p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
              {quickActions.map((action) => {
                const Icon = action.icon;
                const colors = colorClasses[action.color] || colorClasses.blue;
                return (
                  <button
                    key={action.name}
                    onClick={() => navigate(action.href)}
                    className={`
                      group relative ${colors.bg} ${colors.border}
                      rounded-xl p-4 sm:p-[18px] transition-all duration-200
                      active:scale-95 border
                      flex flex-col items-start justify-start gap-1.5
                      min-h-[100px] sm:min-h-[110px]
                      touch-manipulation text-left
                    `}
                  >
                    <Icon className={`h-5 w-5 mb-1 ${colors.icon}`} />
                    <span className="text-sm font-medium text-fc-midnight">
                      {action.name}
                    </span>
                    <ArrowTopRightOnSquareIcon className={`absolute top-3 right-3 h-3.5 w-3.5 ${colors.icon} opacity-0 group-hover:opacity-100 transition-opacity duration-200`} />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Resource Spotlight - Only for non-admin */}
        {!isAdmin && (
          <section className="space-y-4 sm:space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-fc-midnight mb-1">Resource Spotlight</h2>
                <p className="text-fc-brown text-xs sm:text-sm">
                  Recently added folders from the Futures resource library
                </p>
              </div>
              <a
                href="/resources"
                className="inline-flex items-center gap-2 text-xs sm:text-sm text-fc-copper hover:text-fc-brown transition-colors duration-200 touch-manipulation"
              >
                Browse full library
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              {categoriesLoading && (
                <div className="col-span-full fc-card p-4 sm:p-6 text-fc-brown text-center text-sm">
                  Loading featured folders...
                </div>
              )}
              {!categoriesLoading && featuredCategories.length === 0 && (
                <div className="col-span-full fc-card p-4 sm:p-6 text-fc-brown text-center text-xs sm:text-sm">
                  No shared folders yet—check back soon or reach out to the Ops team.
                </div>
              )}
              {featuredCategories.map((category) => (
                <a
                  key={category.id}
                  href="/resources"
                  className="group fc-card p-4 sm:p-5 transition-all duration-200 active:scale-95 hover:shadow-card-hover touch-manipulation"
                >
                  <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-fc-wash-sky flex items-center justify-center text-xl sm:text-2xl">
                      📁
                    </div>
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-fc-thistle group-hover:text-fc-copper transition-colors" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-fc-midnight group-hover:text-fc-copper transition-colors duration-200 mb-1.5">
                    {category.displayName || category.name}
                  </h3>
                  {category.description && (
                    <p className="text-xs sm:text-sm text-fc-brown leading-relaxed line-clamp-3">
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
          <section className="space-y-4 sm:space-y-5">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-fc-midnight flex items-center gap-2 mb-1">
                <ShieldCheckIcon className="h-5 w-5 text-fc-copper" />
                Admin Quick Access
              </h2>
              <p className="text-fc-brown text-xs sm:text-sm">
                Key management tools and system overview
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
              <button
                onClick={() => navigate('/users')}
                className="fc-card p-4 sm:p-5 active:scale-95 hover:shadow-card-hover transition-all duration-200 text-left group touch-manipulation"
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <UserGroupIcon className="h-6 w-6 sm:h-7 sm:w-7 text-fc-teal" />
                  <ArrowTopRightOnSquareIcon className="h-4 w-4 text-fc-thistle group-hover:text-fc-teal transition-colors" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-fc-midnight mb-1">User Management</h3>
                <p className="text-xs sm:text-sm text-fc-brown">Manage all users and permissions</p>
              </button>
              <button
                onClick={() => navigate('/campuses')}
                className="fc-card p-4 sm:p-5 active:scale-95 hover:shadow-card-hover transition-all duration-200 text-left group touch-manipulation"
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <BuildingOfficeIcon className="h-6 w-6 sm:h-7 sm:w-7 text-fc-copper" />
                  <ArrowTopRightOnSquareIcon className="h-4 w-4 text-fc-thistle group-hover:text-fc-copper transition-colors" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-fc-midnight mb-1">Campus Management</h3>
                <p className="text-xs sm:text-sm text-fc-brown">Configure campus settings</p>
              </button>
              <button
                onClick={() => navigate('/resources/manage')}
                className="fc-card p-4 sm:p-5 active:scale-95 hover:shadow-card-hover transition-all duration-200 text-left group touch-manipulation"
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <BookOpenIcon className="h-6 w-6 sm:h-7 sm:w-7 text-fc-olive" />
                  <ArrowTopRightOnSquareIcon className="h-4 w-4 text-fc-thistle group-hover:text-fc-olive transition-colors" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-fc-midnight mb-1">Resource Manager</h3>
                <p className="text-xs sm:text-sm text-fc-brown">Organize and manage resources</p>
              </button>
              <button
                onClick={() => navigate('/ministry-stats')}
                className="fc-card p-4 sm:p-5 active:scale-95 hover:shadow-card-hover transition-all duration-200 text-left group touch-manipulation"
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <PresentationChartLineIcon className="h-6 w-6 sm:h-7 sm:w-7 text-fc-gold" />
                  <ArrowTopRightOnSquareIcon className="h-4 w-4 text-fc-thistle group-hover:text-fc-gold transition-colors" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-fc-midnight mb-1">Ministry stats</h3>
                <p className="text-xs sm:text-sm text-fc-brown">Baptisms &amp; totals by campus and date</p>
              </button>
              <button
                onClick={() => navigate('/platform-settings')}
                className="fc-card p-4 sm:p-5 active:scale-95 hover:shadow-card-hover transition-all duration-200 text-left group touch-manipulation"
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <Cog6ToothIcon className="h-6 w-6 sm:h-7 sm:w-7 text-fc-brown" />
                  <ArrowTopRightOnSquareIcon className="h-4 w-4 text-fc-thistle group-hover:text-fc-brown transition-colors" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-fc-midnight mb-1">Platform Settings</h3>
                <p className="text-xs sm:text-sm text-fc-brown">Upload training videos</p>
              </button>
            </div>
          </section>
        )}

        {/* Support & Feedback */}
        <section className="space-y-4 sm:space-y-5">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-fc-midnight mb-1">Support & Feedback</h2>
            <p className="text-fc-brown text-xs sm:text-sm">
              We're here to help keep things moving smoothly for your campus
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {supportItems.map((item) => (
              <div
                key={item.title}
                className="fc-card p-4 sm:p-5 space-y-2 sm:space-y-3"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <LifebuoyIcon className="h-5 w-5 text-fc-copper flex-shrink-0" />
                  <h3 className="text-base sm:text-lg font-semibold text-fc-midnight">{item.title}</h3>
                </div>
                <p className="text-xs sm:text-sm text-fc-brown leading-relaxed">
                  {item.description}
                </p>
                <a
                  href={`mailto:${item.action}`}
                  className="inline-flex items-center gap-2 text-xs sm:text-sm text-fc-copper hover:text-fc-brown transition-colors duration-200 touch-manipulation break-all"
                >
                  {item.action}
                  <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 flex-shrink-0" />
                </a>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Landing;
