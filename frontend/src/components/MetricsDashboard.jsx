import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  UserPlusIcon,
  HeartIcon,
  UserGroupIcon,
  CalendarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

const MetricsDashboard = ({ userRole, userCampus, session }) => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // Determine if user can see weekend stats (campus_pastor and above, NOT staff)
  const canSeeWeekendStats = ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor'].includes(userRole);
  
  // Determine if user can see giving/finance
  const canSeeGiving = ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'finance'].includes(userRole);
  
  // Determine if user can see heartbeat
  const canSeeHeartbeat = ['admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'staff'].includes(userRole);

  useEffect(() => {
    fetchMetrics();
    fetchUpcomingEvents();
  }, [userRole, userCampus]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const campus = userCampus || 'all_campuses';
      
      // Fetch dashboard data
      const dashboardResponse = await fetch(`/api/dashboard/data?campus=${campus}&date_filter=last_12_months`, {
        credentials: 'include'
      });
      
      if (dashboardResponse.ok) {
        const dashboardData = await dashboardResponse.json();
        const stats = dashboardData.stats || {};
        
        // Fetch heartbeat data if user has access
        let heartbeatData = null;
        if (canSeeHeartbeat) {
          try {
            const heartbeatResponse = await fetch('/api/heartbeat/dashboard', {
              credentials: 'include'
            });
            if (heartbeatResponse.ok) {
              heartbeatData = await heartbeatResponse.json();
            }
          } catch (error) {
            console.error('Error fetching heartbeat:', error);
          }
        }
        
        // Calculate trends (simplified - compare last week to previous week)
        const currentWeekAttendance = stats.total_attendance || 0;
        const previousWeekAttendance = stats.previous_week_attendance || currentWeekAttendance;
        const attendanceTrend = currentWeekAttendance > previousWeekAttendance ? 'up' : 
                               currentWeekAttendance < previousWeekAttendance ? 'down' : 'neutral';
        
        setMetrics({
          weekendAttendance: canSeeWeekendStats ? {
            value: currentWeekAttendance,
            previous: previousWeekAttendance,
            trend: attendanceTrend,
            change: Math.abs(((currentWeekAttendance - previousWeekAttendance) / (previousWeekAttendance || 1)) * 100).toFixed(1)
          } : null,
          giving: canSeeGiving ? {
            value: stats.total_giving || 0,
            weekly: stats.weekly_giving || 0,
            monthly: stats.monthly_giving || 0
          } : null,
          newPeople: {
            value: stats.new_people_this_week || 0,
            thisWeek: stats.new_people_this_week || 0
          },
          heartbeat: canSeeHeartbeat && heartbeatData ? {
            healthy: heartbeatData.health_overview?.healthy || 0,
            watch: heartbeatData.health_overview?.watch || 0,
            atRisk: heartbeatData.health_overview?.at_risk || 0,
            critical: heartbeatData.health_overview?.critical || 0,
            total: (heartbeatData.health_overview?.healthy || 0) + 
                   (heartbeatData.health_overview?.watch || 0) + 
                   (heartbeatData.health_overview?.at_risk || 0) + 
                   (heartbeatData.health_overview?.critical || 0)
          } : null,
          connectGroups: {
            active: stats.connect_groups || 0
          }
        });
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingEvents = async () => {
    setEventsLoading(true);
    try {
      const campus = userCampus || 'all_campuses';
      const response = await fetch(`/api/events?campus=${campus}&upcoming=true&status=all&limit=5`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUpcomingEvents(Array.isArray(data.events) ? data.events.slice(0, 5) : []);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setEventsLoading(false);
    }
  };

  const getHealthScore = () => {
    if (!metrics?.heartbeat) return null;
    const { healthy, total } = metrics.heartbeat;
    if (total === 0) return null;
    return Math.round((healthy / total) * 100);
  };

  const MetricCard = ({ title, value, subtitle, icon: Icon, color, trend, onClick, href }) => {
    const content = (
      <div 
        className={`
          bg-gradient-to-br from-white/5 to-white/5 border rounded-2xl p-6 transition-all duration-300
          ${onClick || href ? 'cursor-pointer hover:scale-105 hover:shadow-xl hover:border-blue-400/40' : ''}
          ${color === 'blue' ? 'border-blue-400/30' : color === 'green' ? 'border-green-400/30' : color === 'red' ? 'border-red-400/30' : color === 'purple' ? 'border-purple-400/30' : 'border-white/10'}
        `}
        onClick={() => {
          if (onClick) onClick();
          else if (href) navigate(href);
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            color === 'blue' ? 'bg-blue-500/20 text-blue-300' :
            color === 'green' ? 'bg-green-500/20 text-green-300' :
            color === 'red' ? 'bg-red-500/20 text-red-300' :
            color === 'purple' ? 'bg-purple-500/20 text-purple-300' :
            'bg-white/10 text-white/70'
          }`}>
            <Icon className="h-6 w-6" />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 ${
              trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-white/40'
            }`}>
              {trend === 'up' ? <ArrowTrendingUpIcon className="h-5 w-5" /> : 
               trend === 'down' ? <ArrowTrendingDownIcon className="h-5 w-5" /> : null}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <div className="text-3xl font-bold text-white">{value}</div>
          <div className="text-sm text-white/60">{title}</div>
          {subtitle && <div className="text-xs text-white/40 mt-1">{subtitle}</div>}
        </div>
      </div>
    );
    
    return content;
  };

  if (loading) {
    return (
      <section className="space-y-5 sm:space-y-6">
        <div className="text-white/60">Loading metrics...</div>
      </section>
    );
  }

  const healthScore = getHealthScore();

  return (
    <section className="space-y-8">
      {/* Metrics Grid */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold">Metrics Overview</h2>
            <p className="text-white/60 text-sm sm:text-base mt-1">
              {userCampus && userCampus !== 'all_campuses' 
                ? `Key metrics for your campus` 
                : 'Key metrics across all campuses'}
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Weekend Attendance - Only for campus_pastor and above */}
          {canSeeWeekendStats && metrics?.weekendAttendance && (
            <MetricCard
              title="Weekend Attendance"
              value={metrics.weekendAttendance.value.toLocaleString()}
              subtitle={metrics.weekendAttendance.trend !== 'neutral' 
                ? `${metrics.weekendAttendance.trend === 'up' ? '+' : '-'}${metrics.weekendAttendance.change}% vs last week`
                : 'No change from last week'}
              icon={ChartBarIcon}
              color="blue"
              trend={metrics.weekendAttendance.trend}
              href="/dashboard"
            />
          )}
          
          {/* Giving - Only for authorized roles */}
          {canSeeGiving && metrics?.giving && (
            <MetricCard
              title="Giving"
              value={`$${metrics.giving.weekly.toLocaleString()}`}
              subtitle={`$${metrics.giving.monthly.toLocaleString()} this month`}
              icon={CurrencyDollarIcon}
              color="green"
              href="/giving-analytics"
            />
          )}
          
          {/* New People - All roles can see */}
          {metrics?.newPeople && (
            <MetricCard
              title="New People"
              value={metrics.newPeople.thisWeek}
              subtitle="This week"
              icon={UserPlusIcon}
              color="purple"
              href="/people/new-people"
            />
          )}
          
          {/* Heartbeat Health - For authorized roles */}
          {canSeeHeartbeat && metrics?.heartbeat && healthScore !== null && (
            <MetricCard
              title="Heartbeat Health"
              value={`${healthScore}%`}
              subtitle={`${metrics.heartbeat.healthy} healthy, ${metrics.heartbeat.atRisk + metrics.heartbeat.critical} need attention`}
              icon={HeartIcon}
              color="red"
              href="/people/heartbeat"
            />
          )}
          
          {/* Connect Groups - All roles can see */}
          {metrics?.connectGroups && (
            <MetricCard
              title="Active Connect Groups"
              value={metrics.connectGroups.active}
              subtitle="Currently active"
              icon={UserGroupIcon}
              color="blue"
              href="/connect-groups"
            />
          )}
        </div>
      </div>

      {/* Upcoming Events */}
      {!eventsLoading && upcomingEvents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold">Upcoming Events</h2>
              <p className="text-white/60 text-sm sm:text-base mt-1">What's happening next</p>
            </div>
            <button
              onClick={() => navigate('/events')}
              className="text-sm text-blue-300 hover:text-blue-200 flex items-center gap-1 transition-colors"
            >
              View all
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => navigate(`/events`)}
                className="bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5 cursor-pointer hover:scale-105 hover:shadow-xl hover:border-blue-400/40 transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-300">
                    <CalendarIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{event.name}</h3>
                    <p className="text-xs text-white/60">
                      {event.start_date ? new Date(event.start_date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      }) : 'Date TBD'}
                    </p>
                  </div>
                </div>
                {event.description && (
                  <p className="text-sm text-white/60 line-clamp-2">{event.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default MetricsDashboard;











