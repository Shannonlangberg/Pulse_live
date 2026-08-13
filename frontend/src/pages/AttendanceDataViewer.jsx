import React, { useState, useEffect } from 'react';
import { ArrowDownTrayIcon, CalendarIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

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
    <div className="min-h-screen bg-fc-cream">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="fc-label mb-2">Admin</div>
          <h1 className="fc-display fc-display-md mb-2">Attendance Data Viewer</h1>
          <p className="text-fc-brown text-[15px]">View and export all attendance records from the database</p>
        </div>

        {/* Filters */}
        <div className="fc-card p-6 mb-6">
          <div className="fc-label mb-4">Filters</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-fc-brown mb-2">Region</label>
              <select
                value={filters.region}
                onChange={(e) => setFilters({...filters, region: e.target.value})}
                className="fc-input"
              >
                <option value="">All Regions</option>
                {regions.map(r => (
                  <option key={r.code} value={r.code}>{r.display_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-fc-brown mb-2">Campus</label>
              <select
                value={filters.campus_id}
                onChange={(e) => setFilters({...filters, campus_id: e.target.value})}
                className="fc-input"
              >
                <option value="">All Campuses</option>
                {campuses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-fc-brown mb-2">Start Date</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({...filters, start_date: e.target.value})}
                className="fc-input"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-fc-brown mb-2">End Date</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({...filters, end_date: e.target.value})}
                className="fc-input"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadRecords}
              disabled={loading}
              className="fc-btn-primary"
            >
              <MagnifyingGlassIcon className="w-4 h-4" />
              {loading ? 'Loading...' : 'Load Records'}
            </button>
            <button
              onClick={exportCSV}
              className="fc-btn-secondary"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Records Table */}
        <div className="fc-card overflow-hidden">
          <div className="px-6 py-4 border-b border-fc-cream2">
            <div className="fc-label">
              Records ({records.length})
            </div>
          </div>

          {records.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-fc-brown text-sm">No records found. Use filters above and click "Load Records"</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-fc-cream">
                    <th className="text-left px-6 py-2.5 text-[10px] font-bold uppercase tracking-[3px] text-fc-brown">Date</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-[3px] text-fc-brown">Campus</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-[3px] text-fc-brown">Region</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-[3px] text-fc-brown">Total Attendance</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-[3px] text-fc-brown">Kids</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-[3px] text-fc-brown">Youth</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-[3px] text-fc-brown">Visitors</th>
                    <th className="text-right px-6 py-2.5 text-[10px] font-bold uppercase tracking-[3px] text-fc-brown">Salvations</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-t border-fc-cream2 hover:bg-fc-cream/60 transition-colors">
                      <td className="px-6 py-3 text-sm text-fc-midnight font-mono">{record.date}</td>
                      <td className="px-4 py-3 text-sm text-fc-midnight">{record.campus}</td>
                      <td className="px-4 py-3 text-sm text-fc-brown">{record.region}</td>
                      <td className="px-4 py-3 text-right text-sm font-mono text-fc-midnight">{record.total_attendance || 0}</td>
                      <td className="px-4 py-3 text-right text-sm font-mono text-fc-brown">{record.kids_attendance || 0}</td>
                      <td className="px-4 py-3 text-right text-sm font-mono text-fc-brown">{record.youth_attendance || 0}</td>
                      <td className="px-4 py-3 text-right text-sm font-mono text-fc-brown">{(record.first_time_visitors || 0) + (record.visitors || 0)}</td>
                      <td className="px-6 py-3 text-right text-sm font-mono text-fc-brown">{(record.first_time_christians || 0) + (record.rededications || 0)}</td>
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
