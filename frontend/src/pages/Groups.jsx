import React, { useState, useEffect } from 'react';
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

const Groups = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [campusFilter, setCampusFilter] = useState('all_campuses');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    campus: 'all_campuses',
    leader_id: '',
    description: '',
    status: 'active'
  });
  const [leaderSearch, setLeaderSearch] = useState('');
  const [showLeaderDropdown, setShowLeaderDropdown] = useState(false);
  const leaderDropdownRef = React.useRef(null);

  useEffect(() => {
    fetchGroups();
    fetchCampuses();
    fetchPeople();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (leaderDropdownRef.current && !leaderDropdownRef.current.contains(event.target)) {
        setShowLeaderDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      } else {
        setError('Failed to load groups');
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
      setError('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const fetchCampuses = async () => {
    try {
      const response = await fetch('/api/campuses', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setCampuses(data.campuses || []);
      }
    } catch (err) {
      console.error('Error fetching campuses:', err);
    }
  };

  const fetchPeople = async () => {
    try {
      const response = await fetch('/api/people', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setPeople(data.people || []);
      }
    } catch (err) {
      console.error('Error fetching people:', err);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchGroups();
        setShowModal(false);
        setFormData({
          name: '',
          campus: 'all_campuses',
          leader_id: '',
          description: '',
          status: 'active'
        });
        setLeaderSearch('');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create group');
      }
    } catch (err) {
      console.error('Error creating group:', err);
      setError('Failed to create group');
    }
  };

  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/groups/${editingGroup.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchGroups();
        setShowModal(false);
        setEditingGroup(null);
        setFormData({
          name: '',
          campus: 'all_campuses',
          leader_id: '',
          description: '',
          status: 'active'
        });
        setLeaderSearch('');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update group');
      }
    } catch (err) {
      console.error('Error updating group:', err);
      setError('Failed to update group');
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to delete this group?')) {
      return;
    }

    try {
      const response = await fetch(`/api/groups/${groupId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        await fetchGroups();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete group');
      }
    } catch (err) {
      console.error('Error deleting group:', err);
      setError('Failed to delete group');
    }
  };

  const handleEditGroup = (group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name || '',
      campus: group.campus || 'all_campuses',
      leader_id: group.leader_id || '',
      description: group.description || '',
      status: group.status || 'active'
    });
    const leader = people.find(p => p.id === group.leader_id);
    setLeaderSearch(leader ? leader.full_name : '');
    setShowModal(true);
  };

  const filteredGroups = groups.filter(group => {
    const matchesSearch = !searchTerm || 
      group.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCampus = campusFilter === 'all_campuses' || group.campus === campusFilter;
    return matchesSearch && matchesCampus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading groups...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <UserGroupIcon className="w-8 h-8 text-blue-500" />
            Groups
          </h1>
          <p className="text-slate-400 mt-1">Manage regular groups and their members</p>
        </div>
        <button
          onClick={() => {
            setEditingGroup(null);
            setFormData({
              name: '',
              campus: 'all_campuses',
              leader_id: '',
              description: '',
              status: 'active'
            });
            setLeaderSearch('');
            setShowModal(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Create Group
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="relative" ref={leaderDropdownRef}>
          <select
            value={campusFilter}
            onChange={(e) => setCampusFilter(e.target.value)}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-10"
          >
            <option value="all_campuses">All Campuses</option>
            {campuses.map(campus => (
              <option key={campus.id} value={campus.id}>
                {campus.name}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/30 border border-red-500/40 text-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Groups Grid */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <UserGroupIcon className="w-16 h-16 mx-auto mb-4 text-slate-600" />
          <p>No groups found. Create your first group to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map(group => (
            <div
              key={group.id}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-blue-500/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white mb-2">{group.name}</h3>
                  <span className={`inline-block px-2 py-1 text-xs rounded ${
                    group.status === 'active' 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-slate-500/20 text-slate-400'
                  }`}>
                    {group.status || 'active'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditGroup(group)}
                    className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                  >
                    <PencilIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(group.id)}
                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-slate-300">
                {group.campus && (
                  <div className="flex items-center gap-2">
                    <MapPinIcon className="w-4 h-4 text-slate-400" />
                    <span>{group.campus}</span>
                  </div>
                )}
                {group.leader_name && (
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-slate-400" />
                    <span>{group.leader_name}</span>
                  </div>
                )}
                {group.description && (
                  <p className="text-slate-400 text-xs mt-2 line-clamp-2">{group.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4">
              {editingGroup ? 'Edit Group' : 'Create Group'}
            </h2>
            <form onSubmit={editingGroup ? handleUpdateGroup : handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Group Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Campus
                </label>
                <select
                  value={formData.campus}
                  onChange={(e) => setFormData({ ...formData, campus: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all_campuses">All Campuses</option>
                  {campuses.map(campus => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Leader
                </label>
                <div className="relative" ref={leaderDropdownRef}>
                  <input
                    type="text"
                    placeholder="Search for a leader..."
                    value={leaderSearch}
                    onChange={(e) => {
                      setLeaderSearch(e.target.value);
                      setShowLeaderDropdown(true);
                    }}
                    onFocus={() => setShowLeaderDropdown(true)}
                    className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                  {showLeaderDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, leader_id: '' });
                          setLeaderSearch('');
                          setShowLeaderDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-white hover:bg-slate-600 focus:bg-slate-600 focus:outline-none"
                      >
                        None
                      </button>
                      {people
                        .filter(p => 
                          !leaderSearch || 
                          p.full_name?.toLowerCase().includes(leaderSearch.toLowerCase()) ||
                          p.email?.toLowerCase().includes(leaderSearch.toLowerCase())
                        )
                        .slice(0, 20)
                        .map(person => (
                          <button
                            key={person.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, leader_id: person.id });
                              setLeaderSearch(person.full_name);
                              setShowLeaderDropdown(false);
                            }}
                            className="w-full px-4 py-2 text-left text-white hover:bg-slate-600 focus:bg-slate-600 focus:outline-none"
                          >
                            <div className="font-medium">{person.full_name}</div>
                            {person.email && (
                              <div className="text-sm text-slate-400">{person.email}</div>
                            )}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {editingGroup ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingGroup(null);
                    setFormData({
                      name: '',
                      campus: 'all_campuses',
                      leader_id: '',
                      description: '',
                      status: 'active'
                    });
                    setLeaderSearch('');
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;











