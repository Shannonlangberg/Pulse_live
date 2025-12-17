import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserGroupIcon,
  PlusIcon,
  PencilIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  MapPinIcon,
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

const ConnectGroups = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [campusFilter, setCampusFilter] = useState('all_campuses');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    campus: 'all_campuses',
    leader_id: '',
    co_leader_id: '',
    leader_emails: [], // Array of additional leader emails
    meeting_day: '',
    meeting_time: '',
    meeting_frequency: 'weekly',
    location: '',
    leader_access_code: ''
  });
  const [newLeaderEmail, setNewLeaderEmail] = useState('');
  const [leaderSearch, setLeaderSearch] = useState('');
  const [coLeaderSearch, setCoLeaderSearch] = useState('');
  const [showLeaderDropdown, setShowLeaderDropdown] = useState(false);
  const [showCoLeaderDropdown, setShowCoLeaderDropdown] = useState(false);
  const leaderDropdownRef = useRef(null);
  const coLeaderDropdownRef = useRef(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const memberDropdownRef = useRef(null);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [selectedGroupForHealth, setSelectedGroupForHealth] = useState(null);

  useEffect(() => {
    loadCampuses();
    loadPeople();
    loadGroups();
  }, [campusFilter]);

  useEffect(() => {
    if (showHealthModal && selectedGroupForHealth) {
      loadHealthData(selectedGroupForHealth.id);
    }
  }, [showHealthModal, selectedGroupForHealth]);

  const loadHealthData = async (groupId) => {
    try {
      setLoadingHealth(true);
      const response = await fetch(`/api/connect-groups/${groupId}/health`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setHealthData(data);
      } else {
        console.error('Failed to load health data');
        setHealthData(null);
      }
    } catch (err) {
      console.error('Error loading health data:', err);
      setHealthData(null);
    } finally {
      setLoadingHealth(false);
    }
  };

  const handleOpenHealthModal = (group) => {
    setSelectedGroupForHealth(group);
    setShowHealthModal(true);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (leaderDropdownRef.current && !leaderDropdownRef.current.contains(event.target)) {
        setShowLeaderDropdown(false);
      }
      if (coLeaderDropdownRef.current && !coLeaderDropdownRef.current.contains(event.target)) {
        setShowCoLeaderDropdown(false);
      }
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(event.target)) {
        setShowMemberDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadCampuses = async () => {
    try {
      const response = await fetch('/api/campuses/public');
      if (response.ok) {
        const data = await response.json();
        setCampuses(data.campuses || []);
      }
    } catch (err) {
      console.error('Error loading campuses:', err);
    }
  };

  const loadPeople = async () => {
    try {
      const response = await fetch('/api/persons?page_size=1000', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setPeople(data.persons || []);
      }
    } catch (err) {
      console.error('Error loading people:', err);
    }
  };

  const loadGroups = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (campusFilter && campusFilter !== 'all_campuses') {
        params.append('campus', campusFilter);
      }
      params.append('is_active', 'true');

      const response = await fetch(`/api/connect-groups?${params.toString()}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
        setError('');
      } else if (response.status === 403) {
        setError('You do not have permission to view connect groups');
      } else {
        setError('Failed to load connect groups');
      }
    } catch (err) {
      console.error('Error loading groups:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (group = null) => {
    if (group) {
      setEditingGroup(group);
      setFormData({
        name: group.name || '',
        campus: group.campus || 'all_campuses',
        leader_id: group.leader_id || '',
        co_leader_id: group.co_leader_id || '',
        leader_emails: group.leader_emails || [],
        meeting_day: group.meeting_day || '',
        meeting_time: group.meeting_time || '',
        meeting_frequency: group.meeting_frequency || 'weekly',
        location: group.location || '',
        leader_access_code: group.leader_access_code || ''
      });
    } else {
      setEditingGroup(null);
      setFormData({
        name: '',
        campus: campusFilter !== 'all_campuses' ? campusFilter : 'all_campuses',
        leader_id: '',
        co_leader_id: '',
        leader_emails: [],
        meeting_day: '',
        meeting_time: '',
        meeting_frequency: 'weekly',
        location: '',
        leader_access_code: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingGroup(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = editingGroup
        ? `/api/connect-groups/${editingGroup.id}`
        : '/api/connect-groups';
      
      const method = editingGroup ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        await loadGroups();
        handleCloseModal();
        alert(editingGroup ? 'Connect group updated successfully' : 'Connect group created successfully');
      } else {
        alert(data.error || 'Failed to save connect group');
      }
    } catch (err) {
      console.error('Error saving connect group:', err);
      alert('Failed to save connect group');
    }
  };

  const handleViewGroup = async (group) => {
    try {
      const response = await fetch(`/api/connect-groups/${group.id}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedGroup(data);
      }
    } catch (err) {
      console.error('Error loading group details:', err);
    }
  };

  const handleArchiveGroup = async (group) => {
    if (!confirm(`Are you sure you want to archive "${group.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/connect-groups/${group.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ is_active: false })
      });

      if (response.ok) {
        await loadGroups();
        alert('Group archived successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to archive group');
      }
    } catch (err) {
      console.error('Error archiving group:', err);
      alert('Failed to archive group');
    }
  };

  const filteredGroups = groups.filter(group => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        group.name.toLowerCase().includes(search) ||
        (group.leader_name && group.leader_name.toLowerCase().includes(search)) ||
        group.campus.toLowerCase().includes(search)
      );
    }
    return true;
  });

  if (loading && groups.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-white text-xl">Loading connect groups...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 flex items-center">
                <UserGroupIcon className="w-10 h-10 mr-3 text-blue-500" />
                Connect Groups
              </h1>
              <p className="text-slate-400">Manage connect groups and their members</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                Create Group
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Search
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search groups..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Campus Filter */}
            <div className="min-w-[180px]">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Campus
              </label>
              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all_campuses">All Campuses</option>
                {campuses.map(campus => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Groups List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map(group => (
            <div
              key={group.id}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-blue-500/50 transition-colors cursor-pointer"
              onClick={() => handleViewGroup(group)}
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">{group.name}</h3>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  group.is_active
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-slate-500/20 text-slate-400'
                }`}>
                  {group.is_active ? 'Active' : 'Archived'}
                </span>
              </div>

              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4 text-slate-400" />
                  <span>{group.campus}</span>
                </div>
                {group.leader_name && (
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-slate-400" />
                    <span>Leader: {group.leader_name}</span>
                  </div>
                )}
                {group.meeting_day && group.meeting_time && (
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-slate-400" />
                    <span>{group.meeting_day} {group.meeting_time}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <UserGroupIcon className="w-4 h-4 text-slate-400" />
                  <span>{group.member_count || 0} members</span>
                </div>
              </div>

              <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleOpenHealthModal(group)}
                  className="flex-1 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg transition-colors text-sm"
                >
                  <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Health
                </button>
                <button
                  onClick={() => handleOpenModal(group)}
                  className="px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-colors text-sm"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleArchiveGroup(group)}
                  className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors text-sm"
                >
                  <XCircleIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredGroups.length === 0 && !loading && (
          <div className="text-center py-12 text-slate-400">
            {searchTerm ? 'No groups found matching your search' : 'No connect groups yet. Create one to get started!'}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">
                    {editingGroup ? 'Edit Connect Group' : 'Create Connect Group'}
                  </h2>
                  <button
                    onClick={handleCloseModal}
                    className="text-slate-400 hover:text-white"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Group Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g., Copper Coast Young Adults"
                  />
                </div>

                {/* Campus */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Campus <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={formData.campus}
                    onChange={(e) => setFormData({ ...formData, campus: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="all_campuses">Select Campus</option>
                    {campuses.map(campus => (
                      <option key={campus.id} value={campus.id}>
                        {campus.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Leader */}
                <div className="relative" ref={leaderDropdownRef}>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Leader <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowLeaderDropdown(!showLeaderDropdown);
                        setShowCoLeaderDropdown(false);
                      }}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 flex items-center justify-between"
                    >
                      <span className={formData.leader_id ? 'text-white' : 'text-slate-400'}>
                        {formData.leader_id
                          ? people.find(p => p.id === formData.leader_id)?.full_name || 'Select Leader'
                          : 'Select Leader'}
                      </span>
                      <ChevronDownIcon className="w-5 h-5 text-slate-400" />
                    </button>
                    
                    {showLeaderDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-80 overflow-hidden">
                        {/* Search Input */}
                        <div className="p-2 border-b border-slate-600">
                          <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search by name or email..."
                              value={leaderSearch}
                              onChange={(e) => setLeaderSearch(e.target.value)}
                              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                              autoFocus
                            />
                          </div>
                        </div>
                        
                        {/* Options List */}
                        <div className="max-h-64 overflow-y-auto">
                          {people
                            .filter(p => {
                              const campusMatch = !formData.campus || formData.campus === 'all_campuses' || p.campus === formData.campus;
                              const searchMatch = !leaderSearch || 
                                p.full_name.toLowerCase().includes(leaderSearch.toLowerCase()) ||
                                (p.email && p.email.toLowerCase().includes(leaderSearch.toLowerCase()));
                              return campusMatch && searchMatch;
                            })
                            .map(person => (
                              <button
                                key={person.id}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, leader_id: person.id });
                                  setShowLeaderDropdown(false);
                                  setLeaderSearch('');
                                }}
                                className="w-full px-4 py-2 text-left text-white hover:bg-slate-700 focus:bg-slate-700 focus:outline-none"
                              >
                                <div className="font-medium">{person.full_name}</div>
                                {person.email && (
                                  <div className="text-sm text-slate-400">{person.email}</div>
                                )}
                              </button>
                            ))}
                          {people.filter(p => {
                            const campusMatch = !formData.campus || formData.campus === 'all_campuses' || p.campus === formData.campus;
                            const searchMatch = !leaderSearch || 
                              p.full_name.toLowerCase().includes(leaderSearch.toLowerCase()) ||
                              (p.email && p.email.toLowerCase().includes(leaderSearch.toLowerCase()));
                            return campusMatch && searchMatch;
                          }).length === 0 && (
                            <div className="px-4 py-3 text-slate-400 text-sm text-center">
                              No people found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Co-Leader */}
                <div className="relative" ref={coLeaderDropdownRef}>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Co-Leader (Optional)
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCoLeaderDropdown(!showCoLeaderDropdown);
                        setShowLeaderDropdown(false);
                      }}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 flex items-center justify-between"
                    >
                      <span className={formData.co_leader_id ? 'text-white' : 'text-slate-400'}>
                        {formData.co_leader_id
                          ? people.find(p => p.id === formData.co_leader_id)?.full_name || 'No Co-Leader'
                          : 'No Co-Leader'}
                      </span>
                      <ChevronDownIcon className="w-5 h-5 text-slate-400" />
                    </button>
                    
                    {showCoLeaderDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-80 overflow-hidden">
                        {/* Search Input */}
                        <div className="p-2 border-b border-slate-600">
                          <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search by name or email..."
                              value={coLeaderSearch}
                              onChange={(e) => setCoLeaderSearch(e.target.value)}
                              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                              autoFocus
                            />
                          </div>
                        </div>
                        
                        {/* Options List */}
                        <div className="max-h-64 overflow-y-auto">
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, co_leader_id: '' });
                              setShowCoLeaderDropdown(false);
                              setCoLeaderSearch('');
                            }}
                            className="w-full px-4 py-2 text-left text-slate-400 hover:bg-slate-700 focus:bg-slate-700 focus:outline-none"
                          >
                            No Co-Leader
                          </button>
                          {people
                            .filter(p => {
                              const notLeader = p.id !== formData.leader_id;
                              const campusMatch = !formData.campus || formData.campus === 'all_campuses' || p.campus === formData.campus;
                              const searchMatch = !coLeaderSearch || 
                                p.full_name.toLowerCase().includes(coLeaderSearch.toLowerCase()) ||
                                (p.email && p.email.toLowerCase().includes(coLeaderSearch.toLowerCase()));
                              return notLeader && campusMatch && searchMatch;
                            })
                            .map(person => (
                              <button
                                key={person.id}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, co_leader_id: person.id });
                                  setShowCoLeaderDropdown(false);
                                  setCoLeaderSearch('');
                                }}
                                className="w-full px-4 py-2 text-left text-white hover:bg-slate-700 focus:bg-slate-700 focus:outline-none"
                              >
                                <div className="font-medium">{person.full_name}</div>
                                {person.email && (
                                  <div className="text-sm text-slate-400">{person.email}</div>
                                )}
                              </button>
                            ))}
                          {people.filter(p => {
                            const notLeader = p.id !== formData.leader_id;
                            const campusMatch = !formData.campus || formData.campus === 'all_campuses' || p.campus === formData.campus;
                            const searchMatch = !coLeaderSearch || 
                              p.full_name.toLowerCase().includes(coLeaderSearch.toLowerCase()) ||
                              (p.email && p.email.toLowerCase().includes(coLeaderSearch.toLowerCase()));
                            return notLeader && campusMatch && searchMatch;
                          }).length === 0 && (
                            <div className="px-4 py-3 text-slate-400 text-sm text-center">
                              No people found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Leader Emails */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Additional Leader Emails (Optional)
                  </label>
                  <p className="text-xs text-slate-400 mb-2">
                    Add email addresses of additional leaders who can access the portal
                  </p>
                  
                  {/* List of added emails */}
                  {formData.leader_emails.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {formData.leader_emails.map((email, index) => (
                        <div key={index} className="flex items-center justify-between px-3 py-2 bg-slate-700 rounded-lg">
                          <span className="text-white text-sm">{email}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = formData.leader_emails.filter((_, i) => i !== index);
                              setFormData({ ...formData, leader_emails: updated });
                            }}
                            className="text-red-400 hover:text-red-300"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Add email input */}
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newLeaderEmail}
                      onChange={(e) => setNewLeaderEmail(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newLeaderEmail.trim() && !formData.leader_emails.includes(newLeaderEmail.trim())) {
                            setFormData({
                              ...formData,
                              leader_emails: [...formData.leader_emails, newLeaderEmail.trim()]
                            });
                            setNewLeaderEmail('');
                          }
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      placeholder="Enter email address"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newLeaderEmail.trim() && !formData.leader_emails.includes(newLeaderEmail.trim())) {
                          setFormData({
                            ...formData,
                            leader_emails: [...formData.leader_emails, newLeaderEmail.trim()]
                          });
                          setNewLeaderEmail('');
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg focus:outline-none"
                    >
                      <PlusIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Meeting Day */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Meeting Day
                  </label>
                  <select
                    value={formData.meeting_day}
                    onChange={(e) => setFormData({ ...formData, meeting_day: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select Day</option>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>

                {/* Meeting Time */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Meeting Time
                  </label>
                  <input
                    type="text"
                    value={formData.meeting_time}
                    onChange={(e) => setFormData({ ...formData, meeting_time: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g., 7:00 PM"
                  />
                </div>

                {/* Meeting Frequency */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Meeting Frequency
                  </label>
                  <select
                    value={formData.meeting_frequency}
                    onChange={(e) => setFormData({ ...formData, meeting_frequency: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="bi-weekly">Bi-Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="Address or location name"
                  />
                </div>

                {/* Leader Access Code */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Leader Access Code (for leader portal login)
                  </label>
                  <input
                    type="text"
                    value={formData.leader_access_code}
                    onChange={(e) => setFormData({ ...formData, leader_access_code: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="Simple password for leader login"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    This will be used by the leader to log into the leader portal
                  </p>
                </div>

                {/* Submit Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    {editingGroup ? 'Update Group' : 'Create Group'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Group Details Modal */}
        {selectedGroup && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">{selectedGroup.name}</h2>
                  <button
                    onClick={() => setSelectedGroup(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Group Info */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400">Campus</label>
                    <p className="text-white">{selectedGroup.campus}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Leader</label>
                    <p className="text-white">{selectedGroup.leader_name || 'N/A'}</p>
                  </div>
                  {selectedGroup.co_leader_name && (
                    <div>
                      <label className="text-sm text-slate-400">Co-Leader</label>
                      <p className="text-white">{selectedGroup.co_leader_name}</p>
                    </div>
                  )}
                  {selectedGroup.meeting_day && (
                    <div>
                      <label className="text-sm text-slate-400">Meeting Schedule</label>
                      <p className="text-white">
                        {selectedGroup.meeting_day} {selectedGroup.meeting_time || ''} ({selectedGroup.meeting_frequency || 'weekly'})
                      </p>
                    </div>
                  )}
                  {selectedGroup.location && (
                    <div>
                      <label className="text-sm text-slate-400">Location</label>
                      <p className="text-white">{selectedGroup.location}</p>
                    </div>
                  )}
                </div>

                {/* Members */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">
                      Members ({selectedGroup.members?.length || 0})
                    </h3>
                    <button
                      onClick={() => setShowAddMember(!showAddMember)}
                      className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                    >
                      <PlusIcon className="w-4 h-4 mr-2" />
                      Add Member
                    </button>
                  </div>

                  {/* Add Member Section */}
                  {showAddMember && (
                    <div className="mb-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                      <div className="relative" ref={memberDropdownRef}>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Search and Select Person
                        </label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setShowMemberDropdown(!showMemberDropdown);
                            }}
                            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 flex items-center justify-between"
                          >
                            <span className={memberSearch ? 'text-white' : 'text-slate-400'}>
                              {memberSearch || 'Search for a person...'}
                            </span>
                            <ChevronDownIcon className="w-5 h-5 text-slate-400" />
                          </button>
                          
                          {showMemberDropdown && (
                            <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-80 overflow-hidden">
                              {/* Search Input */}
                              <div className="p-2 border-b border-slate-600">
                                <div className="relative">
                                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                                  <input
                                    type="text"
                                    placeholder="Search by name or email..."
                                    value={memberSearch}
                                    onChange={(e) => setMemberSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                                    autoFocus
                                  />
                                </div>
                              </div>
                              
                              {/* Options List */}
                              <div className="max-h-64 overflow-y-auto">
                                {people
                                  .filter(p => {
                                    const notInGroup = !selectedGroup.members?.some(m => m.id === p.id);
                                    const campusMatch = !selectedGroup.campus || selectedGroup.campus === 'all_campuses' || p.campus === selectedGroup.campus;
                                    const searchMatch = !memberSearch || 
                                      p.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                                      (p.email && p.email.toLowerCase().includes(memberSearch.toLowerCase()));
                                    return notInGroup && campusMatch && searchMatch;
                                  })
                                  .map(person => (
                                    <button
                                      key={person.id}
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          const response = await fetch(
                                            `/api/connect-groups/${selectedGroup.id}/members`,
                                            {
                                              method: 'POST',
                                              headers: {
                                                'Content-Type': 'application/json'
                                              },
                                              credentials: 'include',
                                              body: JSON.stringify({ person_id: person.id })
                                            }
                                          );
                                          if (response.ok) {
                                            await handleViewGroup(selectedGroup);
                                            await loadGroups();
                                            setShowAddMember(false);
                                            setMemberSearch('');
                                            setShowMemberDropdown(false);
                                          } else {
                                            const data = await response.json();
                                            alert(data.error || 'Failed to add member');
                                          }
                                        } catch (err) {
                                          console.error('Error adding member:', err);
                                          alert('Failed to add member');
                                        }
                                      }}
                                      className="w-full px-4 py-2 text-left text-white hover:bg-slate-700 focus:bg-slate-700 focus:outline-none"
                                    >
                                      <div className="font-medium">{person.full_name}</div>
                                      {person.email && (
                                        <div className="text-sm text-slate-400">{person.email}</div>
                                      )}
                                    </button>
                                  ))}
                                {people.filter(p => {
                                  const notInGroup = !selectedGroup.members?.some(m => m.id === p.id);
                                  const campusMatch = !selectedGroup.campus || selectedGroup.campus === 'all_campuses' || p.campus === selectedGroup.campus;
                                  const searchMatch = !memberSearch || 
                                    p.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                                    (p.email && p.email.toLowerCase().includes(memberSearch.toLowerCase()));
                                  return notInGroup && campusMatch && searchMatch;
                                }).length === 0 && (
                                  <div className="px-4 py-3 text-slate-400 text-sm text-center">
                                    No people found
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedGroup.members && selectedGroup.members.length > 0 ? (
                    <div className="space-y-2">
                      {selectedGroup.members.map(member => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                        >
                          <div>
                            <p className="text-white font-medium">{member.full_name}</p>
                            {member.email && (
                              <p className="text-sm text-slate-400">{member.email}</p>
                            )}
                          </div>
                          <button
                            onClick={async () => {
                              if (confirm(`Remove ${member.full_name} from this group?`)) {
                                try {
                                  const response = await fetch(
                                    `/api/connect-groups/${selectedGroup.id}/members/${member.id}`,
                                    {
                                      method: 'DELETE',
                                      credentials: 'include'
                                    }
                                  );
                                  if (response.ok) {
                                    await handleViewGroup(selectedGroup);
                                    await loadGroups();
                                  }
                                } catch (err) {
                                  console.error('Error removing member:', err);
                                }
                              }
                            }}
                            className="text-red-400 hover:text-red-300"
                          >
                            <XMarkIcon className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400">No members yet. Click "Add Member" to get started!</p>
                  )}
                </div>

                {/* Leader Portal Link */}
                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-semibold mb-1">Connect Group Leader Portal</h4>
                      <p className="text-sm text-slate-400">
                        Leaders can access their group portal at <span className="text-blue-400">/connect-group-leader</span> to manage meetings and mark attendance.
                      </p>
                    </div>
                    <a
                      href="/connect-group-leader"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm whitespace-nowrap"
                    >
                      Open Portal
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Connect Health Modal */}
        {showHealthModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    {selectedGroupForHealth ? `${selectedGroupForHealth.name} - Connect Health` : 'Connect Health Dashboard'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowHealthModal(false);
                      setSelectedGroupForHealth(null);
                      setHealthData(null);
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {loadingHealth ? (
                  <div className="text-center py-12">
                    <div className="inline-block w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 mt-4">Loading health data...</p>
                  </div>
                ) : healthData ? (
                  <>
                    {/* Connect Heartbeat Section */}
                    {healthData.heartbeat && (
                      <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/40 rounded-xl p-6">
                        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                          <span>❤️</span>
                          Connect Heartbeat
                          {healthData.heartbeat.member_count > 0 && (
                            <span className="text-sm text-purple-300 font-normal">
                              (Average of {healthData.heartbeat.member_count} {healthData.heartbeat.member_count === 1 ? 'member' : 'members'})
                            </span>
                          )}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div className="bg-slate-800/50 rounded-lg p-4 border border-purple-500/30">
                            <div className="text-xs text-purple-300 mb-1">Total Score</div>
                            <div className="text-2xl font-bold text-white">
                              {healthData.heartbeat.average_total_score.toFixed(1)}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">out of 100</div>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-4 border border-blue-500/30">
                            <div className="text-xs text-blue-300 mb-1">Engagement</div>
                            <div className="text-2xl font-bold text-white">
                              {healthData.heartbeat.average_engagement_score.toFixed(1)}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">out of 25</div>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-4 border border-green-500/30">
                            <div className="text-xs text-green-300 mb-1">Gather</div>
                            <div className="text-2xl font-bold text-white">
                              {healthData.heartbeat.average_gather_score.toFixed(1)}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">out of 25</div>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-4 border border-yellow-500/30">
                            <div className="text-xs text-yellow-300 mb-1">Spiritual</div>
                            <div className="text-2xl font-bold text-white">
                              {healthData.heartbeat.average_spiritual_score.toFixed(1)}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">out of 25</div>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-4 border border-pink-500/30">
                            <div className="text-xs text-pink-300 mb-1">Care</div>
                            <div className="text-2xl font-bold text-white">
                              {healthData.heartbeat.average_care_score.toFixed(1)}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">out of 25</div>
                          </div>
                        </div>
                        {healthData.heartbeat.status_breakdown && Object.keys(healthData.heartbeat.status_breakdown).length > 0 && (
                          <div className="mt-4 pt-4 border-t border-purple-500/30">
                            <div className="text-sm text-purple-300 mb-2">Status Breakdown:</div>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(healthData.heartbeat.status_breakdown).map(([status, count]) => (
                                <div key={status} className="px-3 py-1 bg-slate-800/50 rounded-lg border border-purple-500/30">
                                  <span className="text-white font-medium capitalize">{status}:</span>
                                  <span className="text-purple-300 ml-1">{count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/30 border border-purple-500/40 rounded-xl p-4">
                        <div className="text-sm text-purple-300 mb-1">Attendance Rate</div>
                        <div className="text-3xl font-bold text-white">
                          {healthData.summary.attendance_rate.toFixed(1)}%
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-green-900/30 to-green-800/30 border border-green-500/40 rounded-xl p-4">
                        <div className="text-sm text-green-300 mb-1">Total Present</div>
                        <div className="text-3xl font-bold text-white">
                          {healthData.summary.total_present.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-red-900/30 to-red-800/30 border border-red-500/40 rounded-xl p-4">
                        <div className="text-sm text-red-300 mb-1">Total Absent</div>
                        <div className="text-3xl font-bold text-white">
                          {healthData.summary.total_absent.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/30 border border-blue-500/40 rounded-xl p-4">
                        <div className="text-sm text-blue-300 mb-1">Total Meetings</div>
                        <div className="text-3xl font-bold text-white">
                          {healthData.summary.total_meetings}
                        </div>
                      </div>
                    </div>

                    {/* Attendance Chart - Last 3 Months */}
                    <div className="bg-slate-700/30 border border-slate-600/50 rounded-xl p-6">
                      <h3 className="text-xl font-semibold text-white mb-4">Attendance Trend (Last 3 Months)</h3>
                      <div className="space-y-2">
                        {/* Chart */}
                        <div className="relative h-64 bg-slate-800/50 rounded-lg p-4 overflow-x-auto">
                          <div className="flex items-end gap-1 h-full min-w-full" style={{ minWidth: `${healthData.daily_attendance.length * 4}px` }}>
                            {healthData.daily_attendance
                              .filter(d => d.total > 0) // Only show days with meetings
                              .map((day, idx) => {
                                const maxTotal = Math.max(...healthData.daily_attendance.map(d => d.total), 1);
                                const presentHeight = (day.present / maxTotal) * 100;
                                const absentHeight = (day.absent / maxTotal) * 100;
                                
                                return (
                                  <div
                                    key={idx}
                                    className="flex flex-col items-center group relative"
                                    style={{ flex: '0 0 auto', width: '4px' }}
                                    title={`${new Date(day.date).toLocaleDateString()}: ${day.present} present, ${day.absent} absent`}
                                  >
                                    <div className="w-full flex flex-col-reverse" style={{ height: '200px' }}>
                                      {day.absent > 0 && (
                                        <div
                                          className="w-full bg-red-500/60 hover:bg-red-500 transition-colors"
                                          style={{ height: `${absentHeight}%` }}
                                        />
                                      )}
                                      {day.present > 0 && (
                                        <div
                                          className="w-full bg-green-500/60 hover:bg-green-500 transition-colors"
                                          style={{ height: `${presentHeight}%` }}
                                        />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                        {/* Legend */}
                        <div className="flex items-center gap-6 mt-4 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-green-500/60 rounded"></div>
                            <span className="text-slate-300">Present</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-red-500/60 rounded"></div>
                            <span className="text-slate-300">Absent</span>
                          </div>
                          <div className="text-slate-400 text-xs ml-auto">
                            {new Date(healthData.date_range.start).toLocaleDateString()} - {new Date(healthData.date_range.end).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Attendance Breakdown */}
                    {healthData.detailed_attendance && healthData.detailed_attendance.length > 0 && (
                      <div className="bg-slate-700/30 border border-slate-600/50 rounded-xl p-6">
                        <h3 className="text-xl font-semibold text-white mb-4">Attendance Breakdown by Meeting</h3>
                        <div className="space-y-4">
                          {healthData.detailed_attendance.map((meeting, idx) => (
                            <div
                              key={idx}
                              className="bg-slate-800/50 border border-slate-600/50 rounded-lg p-4"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="text-lg font-semibold text-white">
                                    {new Date(meeting.date).toLocaleDateString('en-US', {
                                      weekday: 'long',
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    })}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded">
                                      {meeting.total_present} present
                                    </span>
                                    {meeting.total_absent > 0 && (
                                      <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded">
                                        {meeting.total_absent} absent
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Present */}
                                {meeting.present.length > 0 && (
                                  <div>
                                    <div className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
                                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                      Present ({meeting.present.length})
                                    </div>
                                    <div className="space-y-1">
                                      {meeting.present.map((person, pIdx) => (
                                        <div
                                          key={pIdx}
                                          className="text-sm text-slate-300 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded"
                                        >
                                          {person.person_name}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Absent */}
                                {meeting.absent.length > 0 && (
                                  <div>
                                    <div className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                      Absent ({meeting.absent.length})
                                    </div>
                                    <div className="space-y-1">
                                      {meeting.absent.map((person, pIdx) => (
                                        <div
                                          key={pIdx}
                                          className="text-sm text-slate-300 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded"
                                        >
                                          {person.person_name}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* If no absent, show message */}
                                {meeting.absent.length === 0 && (
                                  <div>
                                    <div className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
                                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                      Absent (0)
                                    </div>
                                    <div className="text-sm text-slate-400 italic px-3 py-1.5 bg-slate-700/30 rounded">
                                      Everyone attended! 🎉
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    No health data available
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectGroups;

