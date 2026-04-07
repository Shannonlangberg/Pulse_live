import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const DatabaseViewer = () => {
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' or 'finance'
  const [records, setRecords] = useState([]);
  const [financeRecords, setFinanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [campusFilter, setCampusFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [campuses, setCampuses] = useState([]);
  const [regions, setRegions] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedRecord, setEditedRecord] = useState(null);
  const [savingRecord, setSavingRecord] = useState(false);
  const [editingFinanceRecord, setEditingFinanceRecord] = useState(null);
  const [showFinanceEditModal, setShowFinanceEditModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userCampus, setUserCampus] = useState(null);
  const navigate = useNavigate();

  // Fetch user session to get role and campus
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch('/api/session', {
          credentials: 'include',
          cache: 'no-store'
        });
        const data = await response.json();
        if (data.authenticated) {
          setUserRole(data.role || 'user');
          setUserCampus(data.campus || 'all_campuses');
          
          // Auto-set campus filter for campus pastors
          if (data.role === 'campus_pastor' && data.campus && data.campus !== 'all_campuses') {
            setCampusFilter(data.campus);
          }
        }
      } catch (err) {
        console.error('Error fetching session:', err);
      }
    };
    fetchSession();
  }, []);

  // Load campuses and regions for filter
  useEffect(() => {
    fetch('/api/v2/campuses', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.campuses) {
          setCampuses(data.campuses);
        }
      })
      .catch(err => console.error('Error loading campuses:', err));
    
    fetch('/api/v2/regions', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.regions) {
          setRegions(data.regions.filter(r => r.active));
        }
      })
      .catch(err => console.error('Error loading regions:', err));
  }, []);

  // Load attendance database records
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

  // Load finance records
  const loadFinanceRecords = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (campusFilter) params.append('campus', campusFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      params.append('limit', '100');
      
      const response = await fetch(`/api/finance/records?${params}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied - Finance access required');
        }
        throw new Error('Failed to load finance records');
      }
      
      const data = await response.json();
      setFinanceRecords(data.records || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'attendance') {
      loadRecords();
    } else if (activeTab === 'finance') {
      loadFinanceRecords();
    }
  }, [activeTab, regionFilter, campusFilter, startDate, endDate]);

  const handleRefresh = () => {
    if (activeTab === 'attendance') {
      loadRecords();
    } else if (activeTab === 'finance') {
      loadFinanceRecords();
    }
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

  const handleDeleteFinanceRecord = async (recordId) => {
    if (!confirm('Are you sure you want to delete this finance record? This action cannot be undone.')) return;
    
    try {
      const response = await fetch(`/api/finance/records/${recordId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        alert('Finance record deleted successfully');
        loadFinanceRecords();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete record');
      }
    } catch (err) {
      alert('Error deleting record: ' + err.message);
    }
  };

  const handleEditFinanceRecord = (record) => {
    setEditingFinanceRecord({...record});
    setShowFinanceEditModal(true);
  };

  const handleSaveFinanceRecord = async () => {
    if (!editingFinanceRecord) return;
    
    try {
      const response = await fetch(`/api/finance/records/${editingFinanceRecord.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          general: editingFinanceRecord.general,
          trust: editingFinanceRecord.trust,
          online: editingFinanceRecord.online,
          text: editingFinanceRecord.text
        })
      });
      
      if (response.ok) {
        alert('Finance record updated successfully');
        setShowFinanceEditModal(false);
        setEditingFinanceRecord(null);
        loadFinanceRecords();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update record');
      }
    } catch (err) {
      alert('Error updating record: ' + err.message);
    }
  };

  const handleSaveRecord = async () => {
    if (!editedRecord || !selectedRecord) return;
    
    setSavingRecord(true);
    try {
      const response = await fetch(`/api/attendance_records/${selectedRecord.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(editedRecord)
      });
      
      if (response.ok) {
        const result = await response.json();
        alert('Record updated successfully!');
        // Update the record in the list
        setRecords(prev => prev.map(r => 
          r.id === selectedRecord.id ? {...r, ...editedRecord, synced_to_sheets: false} : r
        ));
        // Update selected record
        setSelectedRecord({...selectedRecord, ...editedRecord, synced_to_sheets: false});
        setIsEditing(false);
      } else {
        const error = await response.json();
        alert('Failed to update record: ' + (error.error || response.statusText));
      }
    } catch (err) {
      alert('Error updating record: ' + err.message);
    } finally {
      setSavingRecord(false);
    }
  };

  const handleSyncPending = async () => {
    if (!confirm('This will sync all pending attendance records to Google Sheets. Continue?')) {
      return;
    }
    
    setSyncing(true);
    setSyncResult(null);
    
    try {
      const response = await fetch('/api/sync/pending', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSyncResult({
          success: true,
          message: data.message,
          synced: data.synced,
          failed: data.failed
        });
        // Reload records to show updated sync status
        setTimeout(() => {
          loadRecords();
        }, 1000);
      } else {
        setSyncResult({
          success: false,
          message: data.error || 'Sync failed'
        });
      }
    } catch (err) {
      setSyncResult({
        success: false,
        message: 'Error: ' + err.message
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleImportFromSheets = async () => {
    if (!confirm('Import from your configured Google Sheet: new campus+date rows are added; existing rows are updated from the sheet (including New People and Salvations columns). Continue?')) {
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const response = await fetch('/api/attendance/import-from-sheets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        setImportResult({
          success: true,
          message: data.message,
          imported: data.imported,
          updated: data.updated,
          skipped: data.skipped,
          errors: data.errors,
          sheet_name: data.sheet_name
        });
        setTimeout(() => { loadRecords(); }, 1000);
      } else {
        setImportResult({
          success: false,
          message: data.error || 'Import failed'
        });
      }
    } catch (err) {
      setImportResult({
        success: false,
        message: 'Error: ' + err.message
      });
    } finally {
      setImporting(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (campusFilter) params.append('campus', campusFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      
      const url = `/api/database_viewer/export?${params}`;
      
      // Fetch the CSV with credentials
      const response = await fetch(url, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to export CSV');
      }
      
      // Get the filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'attendance_records.csv';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      // Get the CSV blob and create download link
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert('Error exporting CSV: ' + err.message);
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
          <p className="text-slate-300">View and manage records in the database</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'attendance'
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-slate-300 hover:bg-white/20'
            }`}
          >
            👥 Attendance Records
          </button>
          <button
            onClick={() => setActiveTab('finance')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'finance'
                ? 'bg-green-500 text-white'
                : 'bg-white/10 text-slate-300 hover:bg-white/20'
            }`}
          >
            💰 Finance Records
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6 border border-white/20">
          <h3 className="text-white font-semibold mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="text-slate-300 text-sm mb-2 block">Region</label>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="w-full bg-slate-800 text-white border border-slate-600 rounded-lg px-4 py-2"
              >
                <option value="">All Regions</option>
                {regions.map(region => (
                  <option key={region.id} value={region.code}>
                    {region.display_name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-slate-300 text-sm mb-2 block">Campus</label>
              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
                disabled={userRole === 'campus_pastor'}
                className={`w-full bg-slate-800 text-white border border-slate-600 rounded-lg px-4 py-2 ${
                  userRole === 'campus_pastor' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title={userRole === 'campus_pastor' ? 'You can only view your own campus' : ''}
              >
                <option value="">All Campuses</option>
                {campuses.map(campus => (
                  <option key={campus.id} value={campus.campus_id}>
                    {campus.display_name}
                  </option>
                ))}
              </select>
              {userRole === 'campus_pastor' && (
                <p className="text-slate-400 text-xs mt-1">Campus filtered to your campus only</p>
              )}
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
            
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/10 md:col-span-4">
              <button
                onClick={handleRefresh}
                className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold transition-all"
              >
                Apply Filters
              </button>
              {activeTab === 'attendance' && (
                <>
                  <button
                    onClick={handleExportCSV}
                    className="bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-semibold transition-all flex items-center gap-2"
                    disabled={loading || records.length === 0}
                  >
                    📥 Export CSV
                  </button>
                  <button
                    onClick={handleSyncPending}
                    disabled={syncing}
                    className="bg-green-500 hover:bg-green-600 disabled:bg-green-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-semibold transition-all flex items-center gap-2"
                  >
                    {syncing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Syncing...
                      </>
                    ) : (
                      <>🔄 Sync Pending</>
                    )}
                  </button>
                  <button
                    onClick={handleImportFromSheets}
                    disabled={importing}
                    className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-semibold transition-all flex items-center gap-2"
                  >
                    {importing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Importing...
                      </>
                    ) : (
                      <>📥 Import from Sheet</>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-slate-300">Loading {activeTab} records...</p>
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
          ) : activeTab === 'attendance' && records.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-300 text-lg mb-2">No attendance records found</p>
              <p className="text-slate-400 text-sm">The database is empty or no records match your filters</p>
            </div>
          ) : activeTab === 'finance' && financeRecords.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-300 text-lg mb-2">No finance records found</p>
              <p className="text-slate-400 text-sm">The database is empty or no records match your filters</p>
            </div>
          ) : (
            <>
              <div className="p-4 bg-white/5 border-b border-white/10">
                <p className="text-white font-semibold">
                  📊 Showing {activeTab === 'attendance' ? records.length : financeRecords.length} {activeTab} records
                </p>
              </div>
              
              <div className="overflow-x-auto">
                {activeTab === 'attendance' ? (
                  <table className="w-full">
                    <thead className="bg-white/5 border-b border-white/10">
                      <tr>
                        <th className="px-4 py-3 text-left text-slate-300 font-semibold text-sm">Date</th>
                        <th className="px-4 py-3 text-left text-slate-300 font-semibold text-sm">Campus</th>
                        <th className="px-4 py-3 text-right text-slate-300 font-semibold text-sm">Attendance</th>
                        <th className="px-4 py-3 text-right text-slate-300 font-semibold text-sm">Kids</th>
                        <th className="px-4 py-3 text-right text-slate-300 font-semibold text-sm">Youth</th>
                        <th className="px-4 py-3 text-right text-slate-300 font-semibold text-sm">Saints</th>
                        <th className="px-4 py-3 text-right text-slate-300 font-semibold text-sm">New People</th>
                        <th className="px-4 py-3 text-right text-slate-300 font-semibold text-sm">Salvations</th>
                        <th className="px-4 py-3 text-right text-slate-300 font-semibold text-sm">Tithe</th>
                        <th className="px-4 py-3 text-center text-slate-300 font-semibold text-sm">In rollups</th>
                        <th className="px-4 py-3 text-left text-slate-300 font-semibold text-sm max-w-[140px]">Service label</th>
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
                        <td className="px-4 py-3 text-right text-slate-300">{record.saints || 0}</td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {(record.first_time_visitors || 0) + (record.visitors || 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {(record.first_time_christians || 0) + (record.rededications || 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          ${(record.tithe || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-300 text-sm">
                          {record.include_in_rollup_metrics !== false ? 'Yes' : 'No'}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs max-w-[140px] truncate" title={record.special_service_label || ''}>
                          {record.special_service_label || '—'}
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
                                setEditedRecord({...record});
                                setIsEditing(false);
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
                ) : (
                  <table className="w-full">
                    <thead className="bg-white/5 border-b border-white/10">
                      <tr>
                        <th className="px-4 py-3 text-left text-slate-300 font-semibold text-sm">Date</th>
                        <th className="px-4 py-3 text-left text-slate-300 font-semibold text-sm">Campus</th>
                        <th className="px-4 py-3 text-right text-slate-300 font-semibold text-sm">General</th>
                        <th className="px-4 py-3 text-right text-slate-300 font-semibold text-sm">Trust</th>
                        <th className="px-4 py-3 text-right text-slate-300 font-semibold text-sm">Online</th>
                        <th className="px-4 py-3 text-right text-slate-300 font-semibold text-sm">Text</th>
                        <th className="px-4 py-3 text-right text-slate-300 font-semibold text-sm">Total</th>
                        <th className="px-4 py-3 text-center text-slate-300 font-semibold text-sm">Synced</th>
                        <th className="px-4 py-3 text-center text-slate-300 font-semibold text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financeRecords.map((record, index) => (
                        <tr key={record.id} className={`border-b border-white/5 ${index % 2 === 0 ? 'bg-white/5' : ''} hover:bg-white/10 transition-colors`}>
                          <td className="px-4 py-3 text-white text-sm">{record.date}</td>
                          <td className="px-4 py-3 text-slate-300 text-sm">{record.campus_name}</td>
                          <td className="px-4 py-3 text-right text-slate-300">${(record.general || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-slate-300">${(record.trust || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-slate-300">${(record.online || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-slate-300">${(record.text || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-white font-semibold">${(record.total || 0).toFixed(2)}</td>
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
                                onClick={() => handleEditFinanceRecord(record)}
                                className="text-blue-400 hover:text-blue-300 text-sm"
                              >
                                Edit
                              </button>
                              <span className="text-slate-600">|</span>
                              <button
                                onClick={() => handleDeleteFinanceRecord(record.id)}
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
                )}
              </div>
            </>
          )}
        </div>

        {/* Import Result Message */}
        {importResult && (
          <div className={`mb-6 p-4 rounded-xl border ${importResult.success ? 'bg-green-500/20 border-green-500/50' : 'bg-red-500/20 border-red-500/50'}`}>
            <div className={`font-semibold ${importResult.success ? 'text-green-300' : 'text-red-300'}`}>
              {importResult.success ? '✓' : '✗'} {importResult.message}
            </div>
            {importResult.success && importResult.imported !== undefined && (
              <p className="text-slate-300 text-sm mt-1">
                {importResult.imported} new, {importResult.updated ?? 0} updated, {importResult.skipped} skipped,{' '}
                {importResult.errors} errors
                {importResult.sheet_name && ` (from "${importResult.sheet_name}")`}
              </p>
            )}
            <button
              onClick={() => setImportResult(null)}
              className="text-slate-400 hover:text-white text-sm mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Sync Result Message */}
        {syncResult && (
          <div className={`mt-4 p-4 rounded-lg border ${
            syncResult.success 
              ? 'bg-green-500/20 border-green-500/30' 
              : 'bg-red-500/20 border-red-500/30'
          }`}>
            <p className={`font-semibold ${
              syncResult.success ? 'text-green-300' : 'text-red-300'
            }`}>
              {syncResult.success ? '✓' : '✗'} {syncResult.message}
            </p>
            {syncResult.success && (
              <p className="text-slate-300 text-sm mt-1">
                {syncResult.synced} synced successfully, {syncResult.failed} failed
              </p>
            )}
            <button
              onClick={() => setSyncResult(null)}
              className="mt-2 text-slate-400 hover:text-slate-300 text-sm"
            >
              Dismiss
            </button>
          </div>
        )}

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
                <h2 className="text-2xl font-bold text-white">
                  {isEditing ? '✏️ Edit Attendance Record' : 'Attendance Record Details'}
                </h2>
                <p className="text-blue-100 text-sm mt-1">
                  {selectedRecord.campus} - {selectedRecord.date}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {!isEditing ? (
                  <button
                    onClick={() => {
                      setEditedRecord({...selectedRecord});
                      setIsEditing(true);
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all text-sm font-semibold"
                  >
                    ✏️ Edit
                  </button>
                ) : null}
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedRecord(null);
                    setEditedRecord(null);
                    setIsEditing(false);
                  }}
                  className="text-white hover:text-red-300 transition-colors text-2xl"
                >
                  ✕
                </button>
              </div>
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
                  <div className="bg-white/5 rounded-lg p-3 col-span-2 md:col-span-1">
                    <p className="text-slate-400 text-xs mb-1">Include in annual / dashboard rollups</p>
                    {isEditing ? (
                      <label className="flex cursor-pointer items-center gap-2 text-white">
                        <input
                          type="checkbox"
                          checked={editedRecord?.include_in_rollup_metrics !== false}
                          onChange={(e) =>
                            setEditedRecord({ ...editedRecord, include_in_rollup_metrics: e.target.checked })
                          }
                          className="rounded border-white/20 bg-slate-800"
                        />
                        <span className="text-sm font-semibold">Yes</span>
                      </label>
                    ) : (
                      <p className="text-white font-semibold">
                        {selectedRecord.include_in_rollup_metrics !== false ? 'Yes' : 'No'}
                      </p>
                    )}
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 col-span-2">
                    <p className="text-slate-400 text-xs mb-1">Special service name (optional)</p>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedRecord?.special_service_label ?? ''}
                        onChange={(e) =>
                          setEditedRecord({ ...editedRecord, special_service_label: e.target.value })
                        }
                        placeholder="e.g. Good Friday, Christmas Eve"
                        className="mt-1 w-full rounded border border-white/20 bg-slate-800 px-3 py-2 text-white text-sm"
                        maxLength={200}
                      />
                    ) : (
                      <p className="text-white font-semibold">{selectedRecord.special_service_label || '—'}</p>
                    )}
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
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.total_attendance || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, total_attendance: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white text-2xl font-bold">{selectedRecord.total_attendance || 0}</p>
                    )}
                  </div>
                  <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-3">
                    <p className="text-slate-300 text-xs mb-1">Total People in Campus</p>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.total_people_in_campus || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, total_people_in_campus: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white text-2xl font-bold">{selectedRecord.total_people_in_campus || 0}</p>
                    )}
                  </div>
                  <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3">
                    <p className="text-slate-300 text-xs mb-1">Kids Attendance</p>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.kids_attendance || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, kids_attendance: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white text-2xl font-bold">{selectedRecord.kids_attendance || 0}</p>
                    )}
                  </div>
                  <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-3">
                    <p className="text-slate-300 text-xs mb-1">Youth Attendance</p>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.youth_attendance || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, youth_attendance: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white text-2xl font-bold">{selectedRecord.youth_attendance || 0}</p>
                    )}
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
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.kids_leaders || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, kids_leaders: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white font-semibold">{selectedRecord.kids_leaders || 0}</p>
                    )}
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">New Kids</p>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.new_kids || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, new_kids: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white font-semibold">{selectedRecord.new_kids || 0}</p>
                    )}
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Kids Salvations</p>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.new_kids_salvations || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, new_kids_salvations: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white font-semibold">{selectedRecord.new_kids_salvations || 0}</p>
                    )}
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Packs Out</p>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.packs_out || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, packs_out: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white font-semibold">{selectedRecord.packs_out || 0}</p>
                    )}
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
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.youth_leaders || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, youth_leaders: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white font-semibold">{selectedRecord.youth_leaders || 0}</p>
                    )}
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Youth Salvations</p>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.youth_salvations || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, youth_salvations: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white font-semibold">{selectedRecord.youth_salvations || 0}</p>
                    )}
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Youth New People</p>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.youth_new_people || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, youth_new_people: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white font-semibold">{selectedRecord.youth_new_people || 0}</p>
                    )}
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
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.first_time_visitors || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, first_time_visitors: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white font-semibold">{selectedRecord.first_time_visitors || 0}</p>
                    )}
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Visitors</p>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.visitors || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, visitors: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white font-semibold">{selectedRecord.visitors || 0}</p>
                    )}
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Hands Up</p>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.hands_up || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, hands_up: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white font-semibold">{selectedRecord.hands_up || 0}</p>
                    )}
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Cards Returned</p>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.cards_back || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, cards_back: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white font-semibold">{selectedRecord.cards_back || 0}</p>
                    )}
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">First Time Christians</p>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.first_time_christians || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, first_time_christians: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white font-semibold">{selectedRecord.first_time_christians || 0}</p>
                    )}
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Rededications</p>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.rededications || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, rededications: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white font-semibold">{selectedRecord.rededications || 0}</p>
                    )}
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Salvation Cards</p>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.salvation_cards_returned || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, salvation_cards_returned: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white font-semibold">{selectedRecord.salvation_cards_returned || 0}</p>
                    )}
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
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.baptisms || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, baptisms: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white font-semibold">{selectedRecord.baptisms || 0}</p>
                    )}
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Child Dedications</p>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.child_dedications || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, child_dedications: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white font-semibold">{selectedRecord.child_dedications || 0}</p>
                    )}
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Connect Groups</p>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.connect_groups || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, connect_groups: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white font-semibold">{selectedRecord.connect_groups || 0}</p>
                    )}
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Dream Team</p>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedRecord?.dream_team || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, dream_team: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-white font-semibold">{selectedRecord.dream_team || 0}</p>
                    )}
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
                  {isEditing ? (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white text-2xl">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={editedRecord?.tithe || 0}
                        onChange={(e) => setEditedRecord({...editedRecord, tithe: parseFloat(e.target.value) || 0})}
                        className="w-full pl-8 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-3xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ) : (
                    <p className="text-white text-3xl font-bold">${(selectedRecord.tithe || 0).toFixed(2)}</p>
                  )}
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
            <div className="sticky bottom-0 bg-slate-900 border-t border-white/20 px-6 py-4 flex justify-end gap-3">
              {isEditing ? (
                <>
                  <button
                    onClick={() => {
                      setEditedRecord({...selectedRecord});
                      setIsEditing(false);
                    }}
                    disabled={savingRecord}
                    className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveRecord}
                    disabled={savingRecord}
                    className="px-6 py-2 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingRecord ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Saving...
                      </>
                    ) : (
                      '💾 Save Changes'
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedRecord(null);
                    setEditedRecord(null);
                    setIsEditing(false);
                  }}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Finance Edit Modal */}
      {showFinanceEditModal && editingFinanceRecord && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-white/20 shadow-2xl max-w-2xl w-full">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-green-600 to-blue-600 px-6 py-4 flex items-center justify-between border-b border-white/20">
              <div>
                <h2 className="text-2xl font-bold text-white">Edit Finance Record</h2>
                <p className="text-blue-100 text-sm mt-1">
                  {editingFinanceRecord.campus_name} - {editingFinanceRecord.date}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowFinanceEditModal(false);
                  setEditingFinanceRecord(null);
                }}
                className="text-white hover:text-red-300 transition-colors text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {/* General */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    General
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingFinanceRecord.general || ''}
                      onChange={(e) => setEditingFinanceRecord({
                        ...editingFinanceRecord,
                        general: parseFloat(e.target.value) || 0
                      })}
                      className="w-full pl-8 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Trust */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Trust
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingFinanceRecord.trust || ''}
                      onChange={(e) => setEditingFinanceRecord({
                        ...editingFinanceRecord,
                        trust: parseFloat(e.target.value) || 0
                      })}
                      className="w-full pl-8 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Online */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Online
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingFinanceRecord.online || ''}
                      onChange={(e) => setEditingFinanceRecord({
                        ...editingFinanceRecord,
                        online: parseFloat(e.target.value) || 0
                      })}
                      className="w-full pl-8 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Text */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Text
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingFinanceRecord.text || ''}
                      onChange={(e) => setEditingFinanceRecord({
                        ...editingFinanceRecord,
                        text: parseFloat(e.target.value) || 0
                      })}
                      className="w-full pl-8 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Total Display */}
              <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                <p className="text-slate-300 text-sm mb-1">Total</p>
                <p className="text-white text-3xl font-bold">
                  ${((editingFinanceRecord.general || 0) + (editingFinanceRecord.trust || 0) + (editingFinanceRecord.online || 0) + (editingFinanceRecord.text || 0)).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-slate-900 border-t border-white/20 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowFinanceEditModal(false);
                  setEditingFinanceRecord(null);
                }}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFinanceRecord}
                className="px-6 py-2 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseViewer;

