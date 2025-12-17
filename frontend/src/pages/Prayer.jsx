import React, { useState, useEffect } from 'react';
import { HeartIcon, LinkIcon, QrCodeIcon, MapPinIcon, PlusIcon, TrashIcon, PencilIcon, CheckCircleIcon, XCircleIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

const Prayer = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('requests'); // 'requests', 'praise', 'links'
  const [prayerRequests, setPrayerRequests] = useState([]);
  const [praiseReports, setPraiseReports] = useState([]);
  const [prayerLinks, setPrayerLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateLink, setShowCreateLink] = useState(false);
  const [campusFilter, setCampusFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [newLink, setNewLink] = useState({
    link_type: 'both',
    campus: '',
    department: '',
    location: '',
    description: '',
    code_type: 'qr'
  });

  useEffect(() => {
    if (activeTab === 'links') {
      fetchPrayerLinks();
    } else {
      fetchCareCases();
    }
  }, [activeTab, campusFilter, statusFilter]);

  const fetchCareCases = async () => {
    try {
      setLoading(true);
      // Fetch prayer and praise submissions from prayer API
      const response = await fetch('/api/prayer/submissions', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch prayer/praise data');
      }

      const data = await response.json();
      
      // Filter by type, campus, and status
      let prayers = data.submissions?.filter(c => c.type === 'prayer_request') || [];
      let praise = data.submissions?.filter(c => c.type === 'praise_report') || [];
      
      // Apply campus filter
      if (campusFilter !== 'all') {
        prayers = prayers.filter(p => p.campus === campusFilter);
        praise = praise.filter(p => p.campus === campusFilter);
      }
      
      // Apply status filter
      if (statusFilter !== 'all') {
        prayers = prayers.filter(p => p.status === statusFilter);
        praise = praise.filter(p => p.status === statusFilter);
      }
      
      setPrayerRequests(prayers);
      setPraiseReports(praise);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrayerLinks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/prayer/links', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch prayer links');
      }

      const data = await response.json();
      setPrayerLinks(data.links || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createPrayerLink = async () => {
    try {
      const response = await fetch('/api/prayer/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newLink)
      });

      if (!response.ok) {
        throw new Error('Failed to create prayer link');
      }

      const data = await response.json();
      
      // Add new links to the list
      setPrayerLinks([...data.links, ...prayerLinks]);
      setShowCreateLink(false);
      
      // Reset form
      setNewLink({
        link_type: 'both',
        campus: '',
        department: '',
        location: '',
        description: '',
        code_type: 'qr'
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleLinkActive = async (linkId, isActive) => {
    try {
      const response = await fetch(`/api/prayer/links/${linkId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ is_active: !isActive })
      });

      if (!response.ok) {
        throw new Error('Failed to update link');
      }

      // Refresh links
      fetchPrayerLinks();
    } catch (err) {
      setError(err.message);
    }
  };

  const copyLinkToClipboard = (link) => {
    const url = `${window.location.origin}/prayer/link/${link.link_id}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  const updateCaseStatus = async (caseId, newStatus) => {
    try {
      const response = await fetch(`/api/prayer/submissions/${caseId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      // Refresh the list
      fetchCareCases();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderCareCases = (cases, type) => {
    if (loading) {
      return <div className="text-center py-12 text-gray-400">Loading...</div>;
    }

    if (cases.length === 0) {
      return (
        <div className="text-center py-12 text-gray-400">
          <div className="text-6xl mb-4">{type === 'prayer' ? '🙏' : '🎉'}</div>
          <p>No {type === 'prayer' ? 'prayer requests' : 'praise reports'} yet</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {cases.map((item) => (
          <div
            key={item.id}
            className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl p-6 hover:border-purple-500/30 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                  item.priority === 'high' ? 'bg-red-500/20' : 
                  item.priority === 'medium' ? 'bg-yellow-500/20' : 
                  'bg-green-500/20'
                }`}>
                  {type === 'prayer' ? '🙏' : '🎉'}
                </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-semibold">{item.person_name || 'Anonymous'}</h3>
                  {item.person_id && (
                    <button
                      onClick={() => navigate(`/persons/${item.person_id}`)}
                      className="p-1 hover:bg-purple-500/20 rounded transition-colors"
                      title="View Heartbeat Profile"
                    >
                      <HeartIcon className="h-4 w-4 text-purple-400" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-400">
                  {new Date(item.created_at).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                item.status === 'open' ? 'bg-blue-500/20 text-blue-300' :
                item.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-300' :
                'bg-green-500/20 text-green-300'
              }`}>
                {item.status}
              </span>
            </div>
            
            <p className="text-gray-300 mb-3">{item.summary}</p>
            
            {item.details && item.details !== item.summary && (
              <p className="text-sm text-gray-400 border-l-2 border-purple-500/30 pl-3 mb-3">
                {item.details}
              </p>
            )}
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-gray-400">
                {item.campus && (
                  <div className="flex items-center gap-1">
                    <MapPinIcon className="h-4 w-4" />
                    <span className="capitalize">{item.campus.replace('_', ' ')}</span>
                  </div>
                )}
                {item.priority && (
                  <span className={`px-2 py-1 rounded text-xs ${
                    item.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                    item.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                    'bg-green-500/20 text-green-300'
                  }`}>
                    {item.priority} priority
                  </span>
                )}
              </div>
              
              {/* Status Actions */}
              <div className="flex items-center gap-2">
                {item.status === 'open' && (
                  <>
                    <button
                      onClick={() => updateCaseStatus(item.id, 'in_progress')}
                      className="px-3 py-1 text-xs bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30 transition-colors"
                    >
                      Mark In Progress
                    </button>
                    <button
                      onClick={() => updateCaseStatus(item.id, 'closed')}
                      className="px-3 py-1 text-xs bg-green-500/20 text-green-300 rounded hover:bg-green-500/30 transition-colors"
                    >
                      Resolve
                    </button>
                  </>
                )}
                {item.status === 'in_progress' && (
                  <button
                    onClick={() => updateCaseStatus(item.id, 'closed')}
                    className="px-3 py-1 text-xs bg-green-500/20 text-green-300 rounded hover:bg-green-500/30 transition-colors"
                  >
                    Resolve
                  </button>
                )}
                {item.status === 'closed' && (
                  <button
                    onClick={() => updateCaseStatus(item.id, 'open')}
                    className="px-3 py-1 text-xs bg-gray-500/20 text-gray-300 rounded hover:bg-gray-500/30 transition-colors"
                  >
                    Reopen
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderLinks = () => {
    if (loading) {
      return <div className="text-center py-12 text-gray-400">Loading...</div>;
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold text-white">Prayer Links</h3>
            <p className="text-sm text-gray-400">Create QR codes, NFC tags, and shareable links for prayer submissions</p>
          </div>
          <button
            onClick={() => setShowCreateLink(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all"
          >
            <PlusIcon className="h-5 w-5" />
            Create Link
          </button>
        </div>

        {showCreateLink && (
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl p-6">
            <h4 className="text-lg font-semibold text-white mb-4">Create New Prayer Link</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Link Type</label>
                <select
                  value={newLink.link_type}
                  onChange={(e) => setNewLink({ ...newLink, link_type: e.target.value })}
                  className="w-full bg-slate-700 border border-white/10 rounded-lg px-3 py-2 text-white"
                >
                  <option value="both">Both (Prayer & Praise)</option>
                  <option value="prayer">Prayer Only</option>
                  <option value="praise">Praise Only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Code Type</label>
                <select
                  value={newLink.code_type}
                  onChange={(e) => setNewLink({ ...newLink, code_type: e.target.value })}
                  className="w-full bg-slate-700 border border-white/10 rounded-lg px-3 py-2 text-white"
                >
                  <option value="qr">QR Code</option>
                  <option value="nfc">NFC Tag</option>
                  <option value="link">Web Link</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Campus (optional)</label>
                <select
                  value={newLink.campus}
                  onChange={(e) => setNewLink({ ...newLink, campus: e.target.value })}
                  className="w-full bg-slate-700 border border-white/10 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">All Campuses</option>
                  <option value="paradise">Paradise</option>
                  <option value="south">South</option>
                  <option value="salisbury">Salisbury</option>
                  <option value="adelaide_city">Adelaide City</option>
                  <option value="mount_barker">Mount Barker</option>
                  <option value="copper_coast">Copper Coast</option>
                  <option value="clare_valley">Clare Valley</option>
                  <option value="victor_harbour">Victor Harbour</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Department (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Youth, Kids, Adults"
                  value={newLink.department}
                  onChange={(e) => setNewLink({ ...newLink, department: e.target.value })}
                  className="w-full bg-slate-700 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
                <input
                  type="text"
                  placeholder="e.g., Main Entrance, Youth Room"
                  value={newLink.location}
                  onChange={(e) => setNewLink({ ...newLink, location: e.target.value })}
                  className="w-full bg-slate-700 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <input
                  type="text"
                  placeholder="e.g., Paradise Campus Prayer Wall"
                  value={newLink.description}
                  onChange={(e) => setNewLink({ ...newLink, description: e.target.value })}
                  className="w-full bg-slate-700 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={createPrayerLink}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600"
              >
                Create Link
              </button>
              <button
                onClick={() => setShowCreateLink(false)}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {prayerLinks.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <QrCodeIcon className="h-16 w-16 mx-auto mb-4 text-gray-600" />
            <p>No prayer links created yet</p>
            <p className="text-sm mt-2">Create links for QR codes, NFC tags, or social media</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {prayerLinks.map((link) => (
              <div
                key={link.id}
                className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-2xl">
                      {link.code_type === 'nfc' ? '📡' : link.code_type === 'qr' ? '📱' : '🔗'}
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">{link.location || 'Unnamed Link'}</h4>
                      <p className="text-sm text-gray-400">{link.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      link.is_active 
                        ? 'bg-green-500/20 text-green-300' 
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {link.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={() => toggleLinkActive(link.id, link.is_active)}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                      title={link.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {link.is_active ? (
                        <XCircleIcon className="h-5 w-5 text-red-400" />
                      ) : (
                        <CheckCircleIcon className="h-5 w-5 text-green-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Type</p>
                    <p className="text-white">{link.link_type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Campus</p>
                    <p className="text-white">{link.campus || 'All'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Scans</p>
                    <p className="text-white">{link.scan_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Submissions</p>
                    <p className="text-white">{link.submission_count || 0}</p>
                  </div>
                </div>

                <div className="bg-slate-700/50 rounded-lg p-3 font-mono text-sm text-gray-300 break-all">
                  {window.location.origin}/prayer/link/{link.link_id}
                </div>

                <button
                  onClick={() => copyLinkToClipboard(link)}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                >
                  <LinkIcon className="h-4 w-4" />
                  Copy Link
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-2xl">
                🙏
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Prayer & Praise</h1>
                <p className="text-gray-400">Central prayer management system - linked to mobile app & Heartbeat</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30">
                    📱 Mobile App
                  </span>
                  <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
                    💗 Heartbeat
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-900/30 border border-red-500/40 text-red-200 rounded-lg p-4">
            {error}
          </div>
        )}

        {/* Filters */}
        {(activeTab === 'requests' || activeTab === 'praise') && (
          <div className="mb-6 flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Campus</label>
              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-white"
              >
                <option value="all">All Campuses</option>
                <option value="paradise">Paradise</option>
                <option value="south">South</option>
                <option value="salisbury">Salisbury</option>
                <option value="adelaide_city">Adelaide City</option>
                <option value="mount_barker">Mount Barker</option>
                <option value="copper_coast">Copper Coast</option>
                <option value="clare_valley">Clare Valley</option>
                <option value="victor_harbour">Victor Harbour</option>
              </select>
            </div>
            
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-white"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="closed">Resolved</option>
              </select>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-slate-800/50 rounded-xl p-2">
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'requests'
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            🙏 Prayer Requests ({prayerRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('praise')}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'praise'
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            🎉 Praise Reports ({praiseReports.length})
          </button>
          <button
            onClick={() => setActiveTab('links')}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'links'
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            🔗 Prayer Links ({prayerLinks.length})
          </button>
        </div>

        {/* Content */}
        {activeTab === 'requests' && renderCareCases(prayerRequests, 'prayer')}
        {activeTab === 'praise' && renderCareCases(praiseReports, 'praise')}
        {activeTab === 'links' && renderLinks()}
      </div>
    </div>
  );
};

export default Prayer;

