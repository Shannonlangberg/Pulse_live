import React, { useState, useEffect } from 'react';
import { UserGroupIcon, StarIcon, CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';

const ServingTeams = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/serving/teams', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch teams');
      }
      
      const data = await response.json();
      setTeams(data.teams);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-slate-700 rounded-lg"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Error Loading Teams</h3>
        <p className="text-red-300">{error}</p>
        <button 
          onClick={fetchTeams}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="text-center py-12">
        <UserGroupIcon className="h-16 w-16 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-400 mb-2">No teams yet</h3>
        <p className="text-slate-500">You haven't joined any serving teams yet.</p>
        <p className="text-slate-500 mt-2">Contact a team leader to get involved!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Teams Overview */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">My Serving Teams</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <div key={team.id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-medium text-white">{team.name}</h4>
                {team.membership?.is_leader && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    <StarIcon className="h-3 w-3 mr-1" />
                    Leader
                  </span>
                )}
              </div>
              
              <p className="text-sm text-slate-400 mb-3">{team.description}</p>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Campus:</span>
                  <span className="text-white">{team.campus}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Department:</span>
                  <span className="text-white">{team.department}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Members:</span>
                  <span className="text-white">{team.member_count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Roles:</span>
                  <span className="text-white">{team.active_roles_count}</span>
                </div>
              </div>
              
              {team.membership && (
                <div className="mt-4 pt-3 border-t border-slate-600">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Joined:</span>
                      <span className="text-white">
                        {new Date(team.membership.joined_date).toLocaleDateString()}
                      </span>
                    </div>
                    {team.membership.primary_role_name && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Primary Role:</span>
                        <span className="text-white">{team.membership.primary_role_name}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Permissions:</span>
                      <div className="flex space-x-2">
                        {team.membership.can_schedule && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Schedule
                          </span>
                        )}
                        {team.membership.can_approve_requests && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Approve
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Team Stats */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Team Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="p-3 bg-blue-500/20 rounded-lg inline-block mb-3">
              <UserGroupIcon className="h-8 w-8 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-white">{teams.length}</p>
            <p className="text-slate-400">Total Teams</p>
          </div>
          
          <div className="text-center">
            <div className="p-3 bg-green-500/20 rounded-lg inline-block mb-3">
              <StarIcon className="h-8 w-8 text-green-400" />
            </div>
            <p className="text-2xl font-bold text-white">
              {teams.filter(t => t.membership?.is_leader).length}
            </p>
            <p className="text-slate-400">Leadership Roles</p>
          </div>
          
          <div className="text-center">
            <div className="p-3 bg-purple-500/20 rounded-lg inline-block mb-3">
              <CalendarIcon className="h-8 w-8 text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-white">
              {teams.reduce((sum, team) => sum + (team.active_roles_count || 0), 0)}
            </p>
            <p className="text-slate-400">Total Roles</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="flex items-center justify-center space-x-2 p-4 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
            <UserGroupIcon className="h-5 w-5 text-white" />
            <span className="text-white font-medium">Join New Team</span>
          </button>
          <button className="flex items-center justify-center space-x-2 p-4 bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
            <CalendarIcon className="h-5 w-5 text-white" />
            <span className="text-white font-medium">View Team Schedule</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServingTeams;
