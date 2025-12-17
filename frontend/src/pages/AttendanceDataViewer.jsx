import React, { useState, useEffect } from 'react';
import { DownloadIcon, CalendarIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import DynamicBackground from '../components/DynamicBackground';

const AttendanceDataViewer = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    region: '',
    campus_id: '',
    start_date: '',
    end_date: ''
  });
  const [regions, setRegions] = useState([]);
  const [campuses, setCampuses] = useState([]);

  useEffect(() => {
    // Load regions
    fetch('/api/v2/regions', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.regions) {
          setRegions(data.regions.filter(r => r.active));
        }
      });

    // Load campuses
    fetch('/api/campuses', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.campuses) {
          setCampuses(data.campuses.filter(c => c.id !== 'all_campuses'));
        }
      });
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.region) params.append('region', filters.region);
      if (filters.campus_id) params.append('campus_id', filters.campus_id);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);

      const response = await fetch(`/api/admin/attendance/all?${params}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setRecords(data.records || []);
      } else {
        alert('Error loading attendance records. Make sure you have admin access.');
      }
    } catch (error) {
      console.error('Error loading records:', error);
      alert('Error loading attendance records');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.region) params.append('region', filters.region);
      if (filters.campus_id) params.append('campus_id', filters.campus_id);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      params.append('format', 'csv');

      const response = await fetch(`/api/admin/attendance/all?${params}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_records_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Error exporting CSV');
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Error exporting CSV');
    }
  };

  return (
    <div className="relative">
      <DynamicBackground />
      
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">📊</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Attendance Data Viewer</h1>
          <p className="text-slate-400 text-lg">View and export all attendance records from the database</p>
        </div>

        {/* Filters */}
        <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-3xl p-6 border border-white/20 shadow-2xl mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Region</label>
              <select
                value={filters.region}
                onChange={(e) => setFilters({...filters, region: e.target.value})}
                className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white w-full"
              >
                <option value="">All Regions</option>
                {regions.map(r => (
                  <option key={r.code} value={r.code}>{r.display_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Campus</label>
              <select
                value={filters.campus_id}
                onChange={(e) => setFilters({...filters, campus_id: e.target.value})}
                className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white w-full"
              >
                <option value="">All Campuses</option>
                {campuses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Start Date</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({...filters, start_date: e.target.value})}
                className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-white mb-2">End Date</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({...filters, end_date: e.target.value})}
                className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white w-full"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={loadRecords}
              disabled={loading}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold px-6 py-3 rounded-xl transition-all"
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
              {loading ? 'Loading...' : 'Load Records'}
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold px-6 py-3 rounded-xl transition-all"
            >
              <DownloadIcon className="w-5 h-5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-3xl p-6 border border-white/20 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-4">
            Records ({records.length})
          </h2>
          
          {records.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-slate-400">No records found. Use filters above and click "Load Records"</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-white">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Campus</th>
                    <th className="text-left p-3">Region</th>
                    <th className="text-right p-3">Total Attendance</th>
                    <th className="text-right p-3">Kids</th>
                    <th className="text-right p-3">Youth</th>
                    <th className="text-right p-3">Visitors</th>
                    <th className="text-right p-3">Salvations</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b border-white/10 hover:bg-white/5">
                      <td className="p-3">{record.date}</td>
                      <td className="p-3">{record.campus}</td>
                      <td className="p-3">{record.region}</td>
                      <td className="p-3 text-right">{record.total_attendance || 0}</td>
                      <td className="p-3 text-right">{record.kids_attendance || 0}</td>
                      <td className="p-3 text-right">{record.youth_attendance || 0}</td>
                      <td className="p-3 text-right">{(record.first_time_visitors || 0) + (record.visitors || 0)}</td>
                      <td className="p-3 text-right">{(record.first_time_christians || 0) + (record.rededications || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceDataViewer;

