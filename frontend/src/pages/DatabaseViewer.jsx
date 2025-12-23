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
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
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
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedRecord(record);
                                setShowDetailsModal(true);
                              }}
                              className="text-blue-400 hover:text-blue-300 text-sm"
                            >
                              View
                            </button>
                            <span className="text-slate-600">|</span>
                            <button
                              onClick={() => handleDelete(record.id)}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              Delete
                            </button>
                          </div>
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

      {/* Details Modal */}
      {showDetailsModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-white/20 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between border-b border-white/20">
              <div>
                <h2 className="text-2xl font-bold text-white">Attendance Record Details</h2>
                <p className="text-blue-100 text-sm mt-1">
                  {selectedRecord.campus} - {selectedRecord.date}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedRecord(null);
                }}
                className="text-white hover:text-red-300 transition-colors text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <span className="mr-2">📋</span> Basic Information
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Record ID</p>
                    <p className="text-white font-semibold">{selectedRecord.id}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Campus</p>
                    <p className="text-white font-semibold">{selectedRecord.campus}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Region</p>
                    <p className="text-white font-semibold">{selectedRecord.region || 'N/A'}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Date</p>
                    <p className="text-white font-semibold">{selectedRecord.date}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Synced to Sheets</p>
                    <p className="text-white font-semibold">
                      {selectedRecord.synced_to_sheets ? '✓ Yes' : '⏳ Pending'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Attendance Stats */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <span className="mr-2">👥</span> Attendance
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3">
                    <p className="text-slate-300 text-xs mb-1">Total Attendance</p>
                    <p className="text-white text-2xl font-bold">{selectedRecord.total_attendance || 0}</p>
                  </div>
                  <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-3">
                    <p className="text-slate-300 text-xs mb-1">Total People in Campus</p>
                    <p className="text-white text-2xl font-bold">{selectedRecord.total_people_in_campus || 0}</p>
                  </div>
                  <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3">
                    <p className="text-slate-300 text-xs mb-1">Kids Attendance</p>
                    <p className="text-white text-2xl font-bold">{selectedRecord.kids_attendance || 0}</p>
                  </div>
                  <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-3">
                    <p className="text-slate-300 text-xs mb-1">Youth Attendance</p>
                    <p className="text-white text-2xl font-bold">{selectedRecord.youth_attendance || 0}</p>
                  </div>
                </div>
              </div>

              {/* Service Breakdowns */}
              {(selectedRecord.adult_service_breakdown || selectedRecord.kids_service_breakdown) && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <span className="mr-2">⏰</span> Service Breakdowns
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedRecord.adult_service_breakdown && Object.keys(selectedRecord.adult_service_breakdown).length > 0 && (
                      <div className="bg-white/5 rounded-lg p-4">
                        <p className="text-slate-300 font-semibold mb-2">Adult Services</p>
                        <div className="space-y-2">
                          {Object.entries(selectedRecord.adult_service_breakdown).map(([time, count]) => (
                            <div key={time} className="flex justify-between">
                              <span className="text-slate-400">{time}</span>
                              <span className="text-white font-semibold">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedRecord.kids_service_breakdown && Object.keys(selectedRecord.kids_service_breakdown).length > 0 && (
                      <div className="bg-white/5 rounded-lg p-4">
                        <p className="text-slate-300 font-semibold mb-2">Kids Services</p>
                        <div className="space-y-2">
                          {Object.entries(selectedRecord.kids_service_breakdown).map(([time, count]) => (
                            <div key={time} className="flex justify-between">
                              <span className="text-slate-400">{time}</span>
                              <span className="text-white font-semibold">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Kids Ministry */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <span className="mr-2">🧒</span> Kids Ministry
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Kids Leaders</p>
                    <p className="text-white font-semibold">{selectedRecord.kids_leaders || 0}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">New Kids</p>
                    <p className="text-white font-semibold">{selectedRecord.new_kids || 0}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Kids Salvations</p>
                    <p className="text-white font-semibold">{selectedRecord.new_kids_salvations || 0}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Packs Out</p>
                    <p className="text-white font-semibold">{selectedRecord.packs_out || 0}</p>
                  </div>
                </div>
              </div>

              {/* Youth Ministry */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <span className="mr-2">🎸</span> Youth Ministry
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Youth Leaders</p>
                    <p className="text-white font-semibold">{selectedRecord.youth_leaders || 0}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Youth Salvations</p>
                    <p className="text-white font-semibold">{selectedRecord.youth_salvations || 0}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Youth New People</p>
                    <p className="text-white font-semibold">{selectedRecord.youth_new_people || 0}</p>
                  </div>
                </div>
              </div>

              {/* Visitors & Salvations */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <span className="mr-2">🌟</span> Visitors & Salvations
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">First Time Visitors</p>
                    <p className="text-white font-semibold">{selectedRecord.first_time_visitors || 0}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Visitors</p>
                    <p className="text-white font-semibold">{selectedRecord.visitors || 0}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Hands Up</p>
                    <p className="text-white font-semibold">{selectedRecord.hands_up || 0}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">First Time Christians</p>
                    <p className="text-white font-semibold">{selectedRecord.first_time_christians || 0}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Rededications</p>
                    <p className="text-white font-semibold">{selectedRecord.rededications || 0}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Salvation Cards</p>
                    <p className="text-white font-semibold">{selectedRecord.salvation_cards_returned || 0}</p>
                  </div>
                </div>
              </div>

              {/* Church Life */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <span className="mr-2">⛪</span> Church Life
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Baptisms</p>
                    <p className="text-white font-semibold">{selectedRecord.baptisms || 0}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Child Dedications</p>
                    <p className="text-white font-semibold">{selectedRecord.child_dedications || 0}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Connect Groups</p>
                    <p className="text-white font-semibold">{selectedRecord.connect_groups || 0}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Dream Team</p>
                    <p className="text-white font-semibold">{selectedRecord.dream_team || 0}</p>
                  </div>
                </div>
              </div>

              {/* Financial */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <span className="mr-2">💰</span> Financial
                </h3>
                <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                  <p className="text-slate-300 text-sm mb-1">Tithe</p>
                  <p className="text-white text-3xl font-bold">${(selectedRecord.tithe || 0).toFixed(2)}</p>
                </div>
              </div>

              {/* Timestamps */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <span className="mr-2">🕐</span> Timestamps
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedRecord.created_at && (
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-slate-400 text-xs mb-1">Created At</p>
                      <p className="text-white text-sm">{new Date(selectedRecord.created_at).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedRecord.updated_at && (
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-slate-400 text-xs mb-1">Last Updated</p>
                      <p className="text-white text-sm">{new Date(selectedRecord.updated_at).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-slate-900 border-t border-white/20 px-6 py-4 flex justify-end">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedRecord(null);
                }}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseViewer;

