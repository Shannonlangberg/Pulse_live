import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const DatabaseViewer = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [campusFilter, setCampusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [campuses, setCampuses] = useState([]);
  const navigate = useNavigate();

  // Load campuses for filter
  useEffect(() => {
    fetch('/api/v2/campuses', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.campuses) {
          setCampuses(data.campuses);
        }
      })
      .catch(err => console.error('Error loading campuses:', err));
  }, []);

  // Load database records
  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (campusFilter) params.append('campus', campusFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      params.append('limit', '100');
      
      const response = await fetch(`/api/database_viewer?${params}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied - Admin only');
        }
        throw new Error('Failed to load database records');
      }
      
      const data = await response.json();
      setRecords(data.records || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleRefresh = () => {
    loadRecords();
  };

  const handleDelete = async (recordId) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    
    try {
      const response = await fetch(`/api/attendance_records/${recordId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        alert('Record deleted successfully');
        loadRecords();
      } else {
        alert('Failed to delete record');
      }
    } catch (err) {
      alert('Error deleting record: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/portal')}
            className="text-slate-300 hover:text-white mb-4 flex items-center gap-2"
          >
            ← Back to Portal
          </button>
          <h1 className="text-4xl font-bold text-white mb-2">📊 Database Viewer</h1>
          <p className="text-slate-300">View and manage attendance records in the database</p>
        </div>

        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6 border border-white/20">
          <h3 className="text-white font-semibold mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-slate-300 text-sm mb-2 block">Campus</label>
              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
                className="w-full bg-slate-800 text-white border border-slate-600 rounded-lg px-4 py-2"
              >
                <option value="">All Campuses</option>
                {campuses.map(campus => (
                  <option key={campus.id} value={campus.campus_id}>
                    {campus.display_name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-slate-300 text-sm mb-2 block">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-800 text-white border border-slate-600 rounded-lg px-4 py-2"
              />
            </div>
            
            <div>
              <label className="text-slate-300 text-sm mb-2 block">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-800 text-white border border-slate-600 rounded-lg px-4 py-2"
              />
            </div>
            
            <div className="flex items-end">
              <button
                onClick={handleRefresh}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold transition-all"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-slate-300">Loading database records...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <p className="text-red-400 mb-4">❌ {error}</p>
              <button
                onClick={handleRefresh}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
              >
                Try Again
              </button>
            </div>
          ) : records.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-300 text-lg mb-2">No records found</p>
              <p className="text-slate-400 text-sm">The database is empty or no records match your filters</p>
            </div>
          ) : (
            <>
              <div className="p-4 bg-white/5 border-b border-white/10">
                <p className="text-white font-semibold">
                  📊 Showing {records.length} records
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 text-left text-slate-300 font-semibold text-sm">Date</th>
                      <th className="px-4 py-3 text-left text-slate-300 font-semibold text-sm">Campus</th>
                      <th className="px-4 py-3 text-right text-slate-300 font-semibold text-sm">Attendance</th>
                      <th className="px-4 py-3 text-right text-slate-300 font-semibold text-sm">Kids</th>
                      <th className="px-4 py-3 text-right text-slate-300 font-semibold text-sm">Youth</th>
                      <th className="px-4 py-3 text-right text-slate-300 font-semibold text-sm">New People</th>
                      <th className="px-4 py-3 text-right text-slate-300 font-semibold text-sm">Salvations</th>
                      <th className="px-4 py-3 text-right text-slate-300 font-semibold text-sm">Tithe</th>
                      <th className="px-4 py-3 text-center text-slate-300 font-semibold text-sm">Synced</th>
                      <th className="px-4 py-3 text-center text-slate-300 font-semibold text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record, index) => (
                      <tr key={record.id} className={`border-b border-white/5 ${index % 2 === 0 ? 'bg-white/5' : ''} hover:bg-white/10 transition-colors`}>
                        <td className="px-4 py-3 text-white text-sm">{record.date}</td>
                        <td className="px-4 py-3 text-slate-300 text-sm">{record.campus}</td>
                        <td className="px-4 py-3 text-right text-white font-semibold">{record.total_attendance}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{record.kids_attendance}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{record.youth_attendance}</td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {(record.first_time_visitors || 0) + (record.visitors || 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {(record.first_time_christians || 0) + (record.rededications || 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          ${(record.tithe || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {record.synced_to_sheets ? (
                            <span className="text-green-400">✓</span>
                          ) : (
                            <span className="text-yellow-400">⏳</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDelete(record.id)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Summary Stats */}
        {!loading && !error && records.length > 0 && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
              <p className="text-slate-300 text-sm mb-1">Total Records</p>
              <p className="text-white text-2xl font-bold">{records.length}</p>
            </div>
            <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-4">
              <p className="text-slate-300 text-sm mb-1">Total Attendance</p>
              <p className="text-white text-2xl font-bold">
                {records.reduce((sum, r) => sum + (r.total_attendance || 0), 0)}
              </p>
            </div>
            <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
              <p className="text-slate-300 text-sm mb-1">Synced to Sheets</p>
              <p className="text-white text-2xl font-bold">
                {records.filter(r => r.synced_to_sheets).length}
              </p>
            </div>
            <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-4">
              <p className="text-slate-300 text-sm mb-1">Pending Sync</p>
              <p className="text-white text-2xl font-bold">
                {records.filter(r => !r.synced_to_sheets).length}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseViewer;

