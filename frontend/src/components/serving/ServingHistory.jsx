import React, { useState, useEffect } from 'react';
import { ClockIcon, CalendarIcon, UserGroupIcon, ChartBarIcon } from '@heroicons/react/24/outline';

const ServingHistory = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Start of year
    endDate: new Date().toISOString().split('T')[0],
    teamId: ''
  });

  useEffect(() => {
    fetchRecords();
  }, [filters]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        start_date: filters.startDate,
        end_date: filters.endDate
      });
      
      if (filters.teamId) {
        params.append('team_id', filters.teamId);
      }
      
      const response = await fetch(`/api/serving/records?${params}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch serving records');
      }
      
      const data = await response.json();
      setRecords(data.records);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'no_show':
        return 'bg-red-100 text-red-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'no_show':
        return 'No Show';
      case 'partial':
        return 'Partial';
      default:
        return status;
    }
  };

  const calculateStats = () => {
    if (!records.length) return {};
    
    const totalHours = records.reduce((sum, record) => sum + (record.actual_duration_hours || 0), 0);
    const completedRecords = records.filter(r => r.status === 'completed');
    const teamsServed = new Set(records.map(r => r.team_id)).size;
    
    return {
      totalServings: records.length,
      completedServings: completedRecords.length,
      totalHours: totalHours.toFixed(1),
      teamsServed,
      avgDuration: totalHours / records.length
    };
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-slate-700 rounded w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-700 rounded"></div>
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-700 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Error Loading History</h3>
        <p className="text-red-300">{error}</p>
        <button 
          onClick={fetchRecords}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const stats = calculateStats();

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Filter History</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-slate-400 mb-1">
              Start Date
            </label>
            <input
              type="date"
              id="start-date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-slate-400 mb-1">
              End Date
            </label>
            <input
              type="date"
              id="end-date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label htmlFor="team-filter" className="block text-sm font-medium text-slate-400 mb-1">
              Team (Optional)
            </label>
            <select
              id="team-filter"
              value={filters.teamId}
              onChange={(e) => setFilters(prev => ({ ...prev, teamId: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Teams</option>
              {/* Team options would be populated from API */}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 text-center">
          <div className="p-3 bg-blue-500/20 rounded-lg inline-block mb-3">
            <ClockIcon className="h-8 w-8 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalServings}</p>
          <p className="text-slate-400">Total Servings</p>
        </div>
        
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 text-center">
          <div className="p-3 bg-green-500/20 rounded-lg inline-block mb-3">
            <ChartBarIcon className="h-8 w-8 text-green-400" />
          </div>
          <p className="text-2xl font-bold text-white">{stats.completedServings}</p>
          <p className="text-slate-400">Completed</p>
        </div>
        
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 text-center">
          <div className="p-3 bg-purple-500/20 rounded-lg inline-block mb-3">
            <CalendarIcon className="h-8 w-8 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalHours}</p>
          <p className="text-slate-400">Total Hours</p>
        </div>
        
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 text-center">
          <div className="p-3 bg-yellow-500/20 rounded-lg inline-block mb-3">
            <UserGroupIcon className="h-8 w-8 text-yellow-400" />
          </div>
          <p className="text-2xl font-bold text-white">{stats.teamsServed}</p>
          <p className="text-slate-400">Teams Served</p>
        </div>
      </div>

      {/* Records List */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Serving Records</h3>
          <p className="text-sm text-slate-400">
            {records.length} records found for the selected period
          </p>
        </div>
        
        <div className="p-6">
          {records.length > 0 ? (
            <div className="space-y-4">
              {records.map((record) => (
                <div key={record.id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <UserGroupIcon className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{record.role_name}</p>
                        <p className="text-sm text-slate-400">{record.team_name}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          <CalendarIcon className="h-4 w-4 text-slate-400" />
                          <span className="text-sm text-slate-300">
                            {new Date(record.served_date).toLocaleDateString()}
                          </span>
                        </div>
                        {record.start_time && record.end_time && (
                          <p className="text-sm text-slate-400 mt-1">
                            {record.start_time} - {record.end_time}
                          </p>
                        )}
                        {record.actual_duration_hours && (
                          <p className="text-sm text-slate-400 mt-1">
                            Duration: {record.actual_duration_hours}h
                          </p>
                        )}
                      </div>
                      
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                        {getStatusText(record.status)}
                      </span>
                    </div>
                  </div>
                  
                  {record.notes && (
                    <div className="mt-3 pt-3 border-t border-slate-600">
                      <p className="text-sm text-slate-400">{record.notes}</p>
                    </div>
                  )}
                  
                  {record.checked_in_at && (
                    <div className="mt-3 pt-3 border-t border-slate-600">
                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <span>Checked in: {new Date(record.checked_in_at).toLocaleString()}</span>
                        {record.checked_out_at && (
                          <span>Checked out: {new Date(record.checked_out_at).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <ClockIcon className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-400 mb-2">No records found</h3>
              <p className="text-slate-500">No serving records found for the selected period.</p>
              <p className="text-slate-500 mt-2">Try adjusting your filters or serving more to build your history.</p>
            </div>
          )}
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Export Options</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="flex items-center justify-center space-x-2 p-4 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
            <ChartBarIcon className="h-5 w-5 text-white" />
            <span className="text-white font-medium">Export to CSV</span>
          </button>
          <button className="flex items-center justify-center space-x-2 p-4 bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
            <CalendarIcon className="h-5 w-5 text-white" />
            <span className="text-white font-medium">Generate Report</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServingHistory;
