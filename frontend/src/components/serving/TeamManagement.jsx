import React, { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, UserPlusIcon, EyeIcon, Cog6ToothIcon, UsersIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';

const TeamManagement = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    campus: '',
    department: '',
    team_type: 'ministry',
    requires_background_check: false,
    min_age: '',
    max_age: '',
    leader_id: '',
    co_leader_id: '',
    ministry_group: '',
    meeting_schedule: '',
    max_members: '',
    is_active: true
  });

  // Campus options - will be fetched from API
  const [campusOptions, setCampusOptions] = useState([]);

  // Enhanced team types with ministry groups
  const teamTypes = [
    { value: 'ministry', label: 'Ministry', icon: '🙏' },
    { value: 'operations', label: 'Operations', icon: '⚙️' },
    { value: 'outreach', label: 'Outreach', icon: '🌍' },
    { value: 'worship', label: 'Worship', icon: '🎵' },
    { value: 'youth', label: 'Youth', icon: '👥' },
    { value: 'children', label: 'Children', icon: '👶' },
    { value: 'hospitality', label: 'Hospitality', icon: '🤝' },
    { value: 'technical', label: 'Technical', icon: '💻' },
    { value: 'creative', label: 'Creative', icon: '🎨' },
    { value: 'prayer', label: 'Prayer', icon: '🙌' },
    { value: 'missions', label: 'Missions', icon: '✈️' },
    { value: 'education', label: 'Education', icon: '📚' }
  ];

  // Ministry group options
  const ministryGroups = [
    'Children & Youth',
    'Worship & Creative',
    'Outreach & Missions',
    'Pastoral Care',
    'Technical & Media',
    'Hospitality & Events',
    'Prayer & Intercession',
    'Education & Discipleship',
    'Administration & Finance',
    'Facilities & Operations',
    'Community & Small Groups',
    'Special Needs Ministry'
  ];

  useEffect(() => {
    fetchTeams();
    fetchCampuses();
  }, []);

  const fetchCampuses = async () => {
    try {
      const response = await fetch('/api/campuses');
      if (response.ok) {
        const data = await response.json();
        const campuses = data.campuses.map(campus => campus.display_name || campus.name);
        setCampusOptions(campuses);
      } else {
        // Fallback to basic campuses if API fails
        setCampusOptions(['Copper Coast', 'Mt Barker']);
      }
    } catch (err) {
      console.error('Error fetching campuses:', err);
      // Fallback to basic campuses if API fails
      setCampusOptions(['Copper Coast', 'Mt Barker']);
    }
  };

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
      setTeams(data.teams || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/serving/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to create team');
      }

      setShowCreateForm(false);
      setFormData({
        name: '',
        description: '',
        campus: '',
        department: '',
        team_type: 'ministry',
        requires_background_check: false,
        min_age: '',
        max_age: '',
        leader_id: '',
        co_leader_id: '',
        ministry_group: '',
        meeting_schedule: '',
        max_members: '',
        is_active: true
      });
      fetchTeams();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditTeam = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/serving/teams/${selectedTeam.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to update team');
      }

      setShowEditForm(false);
      setSelectedTeam(null);
      setFormData({
        name: '',
        description: '',
        campus: '',
        department: '',
        team_type: 'ministry',
        requires_background_check: false,
        min_age: '',
        max_age: '',
        leader_id: '',
        co_leader_id: '',
        ministry_group: '',
        meeting_schedule: '',
        max_members: '',
        is_active: true
      });
      fetchTeams();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/serving/teams/${teamId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete team');
      }

      fetchTeams();
    } catch (err) {
      setError(err.message);
    }
  };

  const openEditForm = (team) => {
    setSelectedTeam(team);
    setFormData({
      name: team.name,
      description: team.description || '',
      campus: team.campus,
      department: team.department || '',
      team_type: team.team_type || 'ministry',
      requires_background_check: team.requires_background_check || false,
      min_age: team.min_age || '',
      max_age: team.max_age || '',
      leader_id: team.leader_id || '',
      co_leader_id: team.co_leader_id || '',
      ministry_group: team.ministry_group || '',
      meeting_schedule: team.meeting_schedule || '',
      max_members: team.max_members || '',
      is_active: team.is_active !== false
    });
    setShowEditForm(true);
  };

  const getTeamTypeIcon = (type) => {
    const teamType = teamTypes.find(t => t.value === type);
    return teamType ? teamType.icon : '👥';
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

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Team Management</h2>
          <p className="text-slate-400">Create and manage serving teams across your ministry</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <PlusIcon className="h-5 w-5 text-white" />
          <span className="text-white font-medium">Create Team</span>
        </button>
      </div>

      {/* Teams List */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">All Teams ({teams.length})</h3>
        </div>
        <div className="divide-y divide-slate-700">
          {teams.map((team) => (
            <div key={team.id} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-2xl">{getTeamTypeIcon(team.team_type)}</span>
                    <h4 className="text-lg font-medium text-white">{team.name}</h4>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      team.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {team.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-slate-400 mb-3">{team.description}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Campus:</span>
                      <span className="text-white ml-2">{team.campus}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Department:</span>
                      <span className="text-white ml-2">{team.department || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Type:</span>
                      <span className="text-white ml-2 capitalize">{team.team_type}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Ministry Group:</span>
                      <span className="text-white ml-2">{team.ministry_group || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-6">
                  <button
                    onClick={() => openEditForm(team)}
                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                    title="Edit Team"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteTeam(team.id)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    title="Delete Team"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Team Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-white mb-4">Create New Team</h3>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Team Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Campus</label>
                  <select
                    value={formData.campus}
                    onChange={(e) => setFormData({...formData, campus: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Campus</option>
                    {campusOptions.map(campus => (
                      <option key={campus} value={campus}>{campus}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Children, Youth, Worship"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Team Type</label>
                  <select
                    value={formData.team_type}
                    onChange={(e) => setFormData({...formData, team_type: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {teamTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.icon} {type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Ministry Group</label>
                  <select
                    value={formData.ministry_group}
                    onChange={(e) => setFormData({...formData, ministry_group: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Ministry Group</option>
                    {ministryGroups.map(group => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Meeting Schedule</label>
                  <input
                    type="text"
                    value={formData.meeting_schedule}
                    onChange={(e) => setFormData({...formData, meeting_schedule: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Sunday 9AM, Tuesday 7PM"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Maximum Members</label>
                  <input
                    type="number"
                    value={formData.max_members}
                    onChange={(e) => setFormData({...formData, max_members: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Team Status</label>
                  <select
                    value={formData.is_active ? 'true' : 'false'}
                    onChange={(e) => setFormData({...formData, is_active: e.target.value === 'true'})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.requires_background_check}
                    onChange={(e) => setFormData({...formData, requires_background_check: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm text-slate-300">Requires Background Check</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Minimum Age</label>
                  <input
                    type="number"
                    value={formData.min_age}
                    onChange={(e) => setFormData({...formData, min_age: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 16"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Maximum Age</label>
                  <input
                    type="number"
                    value={formData.max_age}
                    onChange={(e) => setFormData({...formData, max_age: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 65"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
                >
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {showEditForm && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-white mb-4">Edit Team: {selectedTeam.name}</h3>
            <form onSubmit={handleEditTeam} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Team Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Campus</label>
                  <select
                    value={formData.campus}
                    onChange={(e) => setFormData({...formData, campus: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Campus</option>
                    {campusOptions.map(campus => (
                      <option key={campus} value={campus}>{campus}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Children, Youth, Worship"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Team Type</label>
                  <select
                    value={formData.team_type}
                    onChange={(e) => setFormData({...formData, team_type: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {teamTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.icon} {type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Ministry Group</label>
                  <select
                    value={formData.ministry_group}
                    onChange={(e) => setFormData({...formData, ministry_group: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Ministry Group</option>
                    {ministryGroups.map(group => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Meeting Schedule</label>
                  <input
                    type="text"
                    value={formData.meeting_schedule}
                    onChange={(e) => setFormData({...formData, meeting_schedule: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Sunday 9AM, Tuesday 7PM"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Maximum Members</label>
                  <input
                    type="number"
                    value={formData.max_members}
                    onChange={(e) => setFormData({...formData, max_members: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Team Status</label>
                  <select
                    value={formData.is_active ? 'true' : 'false'}
                    onChange={(e) => setFormData({...formData, is_active: e.target.value === 'true'})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.requires_background_check}
                    onChange={(e) => setFormData({...formData, requires_background_check: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm text-slate-300">Requires Background Check</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Minimum Age</label>
                  <input
                    type="number"
                    value={formData.min_age}
                    onChange={(e) => setFormData({...formData, min_age: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 16"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Maximum Age</label>
                  <input
                    type="number"
                    value={formData.max_age}
                    onChange={(e) => setFormData({...formData, max_age: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 65"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditForm(false);
                    setSelectedTeam(null);
                  }}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
                >
                  Update Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
