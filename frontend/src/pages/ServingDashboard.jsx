import React, { useState, useEffect } from 'react';
import { CalendarIcon, ClockIcon, UserGroupIcon, ChartBarIcon, PlusIcon, Cog6ToothIcon, UserPlusIcon, ClipboardDocumentListIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import ServingSchedule from '../components/serving/ServingSchedule';
import ServingTeams from '../components/serving/ServingTeams';
import ServingHistory from '../components/serving/ServingHistory';
import ServingRequests from '../components/serving/ServingRequests';
import AvailabilityForm from '../components/serving/AvailabilityForm';
import TeamManagement from '../components/serving/TeamManagement';
import ServingManagement from '../components/serving/ServingManagement';
import ServicePlanningNew from '../components/serving/ServicePlanningNew';

const ServingDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState('member');
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showCreateRole, setShowCreateRole] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    fetchUserRole();
  }, []);

  const fetchUserRole = async () => {
    try {
      const response = await fetch('/api/session', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setUserRole(data.role || 'member');
      }
    } catch (err) {
      console.error('Error fetching user role:', err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/serving/dashboard', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      
      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Different tabs based on user role
  const getTabs = () => {
    if (userRole === 'admin' || userRole === 'senior_leader' || userRole === 'campus_pastor' || userRole === 'team_leader') {
      return [
        { id: 'dashboard', name: 'Overview', icon: ChartBarIcon },
        { id: 'service-planning', name: 'Service Planning', icon: DocumentDuplicateIcon },
        { id: 'teams', name: 'Team Management', icon: UserGroupIcon },
        { id: 'schedule', name: 'Schedule Management', icon: CalendarIcon },
        { id: 'requests', name: 'Request Management', icon: ClipboardDocumentListIcon },
        { id: 'reports', name: 'Reports & Analytics', icon: ChartBarIcon },
        { id: 'settings', name: 'Settings', icon: Cog6ToothIcon }
      ];
    } else {
      return [
        { id: 'dashboard', name: 'Dashboard', icon: ChartBarIcon },
        { id: 'schedule', name: 'My Schedule', icon: CalendarIcon },
        { id: 'teams', name: 'My Teams', icon: UserGroupIcon },
        { id: 'history', name: 'Serving History', icon: ClockIcon },
        { id: 'requests', name: 'My Requests', icon: PlusIcon }
      ];
    }
  };

  const tabs = getTabs();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-700 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-slate-700 rounded"></div>
              ))}
            </div>
            <div className="h-64 bg-slate-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-400 mb-2">Error Loading Dashboard</h2>
            <p className="text-red-300">{error}</p>
            <button 
              onClick={fetchDashboardData}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderLeaderDashboard = () => (
    <div className="space-y-6">
      {/* Leader Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <UserGroupIcon className="h-6 w-6 text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-400">Total Teams</p>
              <p className="text-2xl font-bold text-white">{dashboardData?.stats?.total_teams || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <ClockIcon className="h-6 w-6 text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-400">Active Members</p>
              <p className="text-2xl font-bold text-white">{dashboardData?.stats?.active_members || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <CalendarIcon className="h-6 w-6 text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-400">Open Positions</p>
              <p className="text-2xl font-bold text-white">{dashboardData?.stats?.open_positions || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <ClipboardDocumentListIcon className="h-6 w-6 text-yellow-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-400">Pending Requests</p>
              <p className="text-2xl font-bold text-white">{dashboardData?.stats?.pending_requests || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <DocumentDuplicateIcon className="h-6 w-6 text-orange-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-400">Service Plans</p>
              <p className="text-2xl font-bold text-white">{dashboardData?.stats?.service_plans || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <DocumentDuplicateIcon className="h-6 w-6 text-indigo-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-400">Templates</p>
              <p className="text-2xl font-bold text-white">{dashboardData?.stats?.service_templates || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions for Leaders */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button 
            onClick={() => setShowCreateTeam(true)}
            className="flex items-center justify-center space-x-2 p-4 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <PlusIcon className="h-5 w-5 text-white" />
            <span className="text-white font-medium">Create New Team</span>
          </button>
          
          <button 
            onClick={() => setShowCreateRole(true)}
            className="flex items-center justify-center space-x-2 p-4 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
          >
            <UserPlusIcon className="h-5 w-5 text-white" />
            <span className="text-white font-medium">Add New Role</span>
          </button>
          
          <button className="flex items-center justify-center space-x-2 p-4 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">
            <CalendarIcon className="h-5 w-5 text-white" />
            <span className="text-white font-medium">Manage Schedule</span>
          </button>

          <button 
            onClick={() => setActiveTab('service-planning')}
            className="flex items-center justify-center space-x-2 p-4 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
          >
            <DocumentDuplicateIcon className="h-5 w-5 text-white" />
            <span className="text-white font-medium">Service Planning</span>
          </button>
        </div>
      </div>

      {/* Team Overview */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Team Overview</h3>
        <div className="space-y-4">
          {dashboardData?.teams?.map((team) => (
            <div key={team.id} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
              <div>
                <h4 className="font-medium text-white">{team.name}</h4>
                <p className="text-sm text-slate-400">{team.campus} • {team.department}</p>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-slate-400">{team.member_count} members</span>
                <span className="text-sm text-slate-400">{team.active_roles_count} active roles</span>
                <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white">
                  Manage
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {dashboardData?.recent_activity?.map((activity, index) => (
            <div key={index} className="flex items-center space-x-3 p-3 bg-slate-700/30 rounded-lg">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="text-sm text-slate-300">{activity.description}</span>
              <span className="text-xs text-slate-500 ml-auto">{activity.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMemberDashboard = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <UserGroupIcon className="h-6 w-6 text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-400">Active Teams</p>
              <p className="text-2xl font-bold text-white">{dashboardData?.stats?.active_teams || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <ClockIcon className="h-6 w-6 text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-400">Total Servings</p>
              <p className="text-2xl font-bold text-white">{dashboardData?.stats?.total_servings || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <CalendarIcon className="h-6 w-6 text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-400">This Month</p>
              <p className="text-2xl font-bold text-white">{dashboardData?.stats?.monthly_servings || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Schedule */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Upcoming Schedule</h3>
        {dashboardData?.upcoming_schedule?.length > 0 ? (
          <div className="space-y-3">
            {dashboardData.upcoming_schedule.map((schedule) => (
              <div key={schedule.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                <div>
                  <p className="font-medium text-white">{schedule.role_name}</p>
                  <p className="text-sm text-slate-400">{schedule.team_name} • {schedule.scheduled_date}</p>
                </div>
                <span className="text-sm text-slate-400">{schedule.start_time} - {schedule.end_time}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <CalendarIcon className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-400 mb-2">No upcoming serving assignments</h3>
            <p className="text-slate-500">Check back later or contact your team leader.</p>
          </div>
        )}
      </div>

      {/* Recent Serving Activity */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Serving Activity</h3>
        {dashboardData?.recent_activity?.length > 0 ? (
          <div className="space-y-3">
            {dashboardData.recent_activity.map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-slate-700/30 rounded-lg">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-sm text-slate-300">{activity.description}</span>
                <span className="text-xs text-slate-500 ml-auto">{activity.time}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <ClockIcon className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-400 mb-2">No recent activity</h3>
            <p className="text-slate-500">Your serving activity will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderTabContent = () => {
    if (activeTab === 'dashboard') {
      return userRole === 'admin' || userRole === 'senior_leader' || userRole === 'campus_pastor' || userRole === 'team_leader' 
        ? renderLeaderDashboard() 
        : renderMemberDashboard();
    }
    
    switch (activeTab) {
      case 'service-planning':
        return <ServicePlanningNew />;
      case 'schedule':
        return <ServingSchedule />;
      case 'teams':
        return userRole === 'admin' || userRole === 'senior_leader' || userRole === 'campus_pastor' || userRole === 'team_leader' 
          ? <ServingManagement /> 
          : <ServingTeams />;
      case 'history':
        return <ServingHistory />;
      case 'requests':
        return <ServingRequests />;
      case 'reports':
        return <div className="text-center py-12">
          <ChartBarIcon className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-400 mb-2">Reports & Analytics</h3>
          <p className="text-slate-500">Detailed serving reports and analytics coming soon.</p>
        </div>;
      case 'settings':
        return <div className="text-center py-12">
          <Cog6ToothIcon className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-400 mb-2">Serving Settings</h3>
          <p className="text-slate-500">Configure serving preferences and team settings.</p>
        </div>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            {userRole === 'admin' || userRole === 'senior_leader' || userRole === 'campus_pastor' || userRole === 'team_leader' 
              ? 'Serving Leader Dashboard' 
              : 'Serving Dashboard'
            }
          </h1>
          <p className="text-slate-400">
            {userRole === 'admin' || userRole === 'senior_leader' || userRole === 'campus_pastor' || userRole === 'team_leader'
              ? 'Manage teams, schedules, and serving opportunities across your ministry.'
              : 'Manage your serving commitments and track your ministry journey.'
            }
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-slate-700 mb-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-h-[600px]">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default ServingDashboard;
