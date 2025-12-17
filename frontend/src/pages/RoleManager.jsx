import React, { useState, useEffect } from 'react';
import { 
  ShieldCheckIcon, 
  CheckIcon, 
  XMarkIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  UserGroupIcon,
  MapPinIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';

const RoleManager = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [permissions, setPermissions] = useState({}); // { userId: { feature: true/false } }
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPermissions, setOriginalPermissions] = useState({});
  const [campuses, setCampuses] = useState([]);
  const [expandedUsers, setExpandedUsers] = useState({}); // { userId: true/false } for campus selection

  // Define all features grouped by category (matching EnhancedNavigation groups)
  const pageFeatures = {
    core: {
      name: 'Core',
      items: [
    { key: 'home', label: 'Home', icon: '🏠' },
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'input', label: 'Input/Stats', icon: '✍️' },
      ]
    },
    engagement: {
      name: 'Engagement',
      items: [
    { key: 'people', label: 'People', icon: '👥' },
    { key: 'heartbeat', label: 'Heartbeat', icon: '💓' },
    { key: 'connect_groups', label: 'Connect Groups', icon: '👨‍👩‍👧‍👦' },
    { key: 'prayer', label: 'Prayer & Praise', icon: '🙏' },
        { key: 'serving', label: 'Serving', icon: '🤝' },
      ]
    },
    content: {
      name: 'Content',
      items: [
    { key: 'pulse_tv', label: 'Pulse TV', icon: '📺' },
    { key: 'events', label: 'Events', icon: '📅' },
        { key: 'resources', label: 'Resources', icon: '📚' },
        { key: 'devotions', label: 'Devotions', icon: '📖' }
      ]
    },
    finance: {
      name: 'Finance',
      items: [
        { key: 'finance', label: 'Finance', icon: '💰' },
        { key: 'giving', label: 'Giving Analytics', icon: '📈' },
      ]
    },
    communications: {
      name: 'Communications',
      items: [
    { key: 'communication', label: 'Communications', icon: '📧' },
      ]
    }
  };

  // Flatten for backward compatibility
  const allPageFeatures = Object.values(pageFeatures).flatMap(group => group.items);

  const settingsFeatures = [
    { key: 'data_export', label: 'Data Export', icon: '📥' },
    { key: 'user_management', label: 'User Management', icon: '👤' },
    { key: 'campus_management', label: 'Campus Management', icon: '🏢' },
    { key: 'beacon_management', label: 'Beacon Management', icon: '📡' },
    { key: 'pathway_manager', label: 'Journey Manager', icon: '🛤️' },
    { key: 'resource_manager', label: 'Resource Manager', icon: '📦' },
    { key: 'tv_manager', label: 'TV Manager', icon: '🎬' },
    { key: 'events_manager', label: 'Events Manager', icon: '🎪' },
    { key: 'notifications', label: 'Push Notifications', icon: '🔔' }
  ];

  const allFeatures = [...allPageFeatures, ...settingsFeatures];

  // Role default permissions mapping (based on MainLayout navigation roles)
  const roleDefaults = {
    'admin': {
      home: true, dashboard: true, input: true, finance: true, giving: true,
      people: true, heartbeat: true, connect_groups: true, prayer: true,
      resources: true, pulse_tv: true, events: true, serving: true,
      communication: true, devotions: true,
      data_export: true, user_management: true, campus_management: true,
      beacon_management: true, pathway_manager: true, resource_manager: true,
      tv_manager: true, events_manager: true, notifications: true
    },
    'senior_leadership': {
      home: true, dashboard: true, input: true, finance: true, giving: true,
      people: true, heartbeat: true, connect_groups: true, prayer: true,
      resources: true, pulse_tv: true, events: true, serving: true,
      communication: true, devotions: true,
      data_export: true, user_management: true, campus_management: true,
      beacon_management: true, pathway_manager: true, resource_manager: true,
      tv_manager: true, events_manager: true, notifications: true
    },
    'senior_leader': {
      home: true, dashboard: true, input: true, finance: true, giving: true,
      people: true, heartbeat: true, connect_groups: true, prayer: true,
      resources: true, pulse_tv: true, events: true, serving: true,
      communication: true, devotions: true,
      data_export: true, user_management: true, campus_management: true,
      beacon_management: true, pathway_manager: true, resource_manager: true,
      tv_manager: true, events_manager: true, notifications: true
    },
    'senior_pastor': {
      home: true, dashboard: true, input: true, finance: true, giving: true,
      people: true, heartbeat: true, connect_groups: true, prayer: true,
      resources: true, pulse_tv: true, events: true, serving: true,
      communication: true, devotions: true,
      data_export: true, user_management: true, campus_management: true,
      beacon_management: true, pathway_manager: true, resource_manager: true,
      tv_manager: true, events_manager: true, notifications: true
    },
    'lead_pastor': {
      home: true, dashboard: true, input: true, finance: true, giving: true,
      people: true, heartbeat: true, connect_groups: true, prayer: true,
      resources: true, pulse_tv: true, events: true, serving: true,
      communication: true, devotions: true,
      data_export: true, user_management: true, campus_management: true,
      beacon_management: true, pathway_manager: true, resource_manager: true,
      tv_manager: true, events_manager: true, notifications: true
    },
    'campus_pastor': {
      home: true, dashboard: true, input: true, finance: false, giving: false,
      people: true, heartbeat: true, connect_groups: true, prayer: true,
      resources: false, pulse_tv: true, events: true, serving: true,
      communication: true, devotions: true,
      data_export: false, user_management: false, campus_management: false,
      beacon_management: false, pathway_manager: false, resource_manager: false,
      tv_manager: false, events_manager: false, notifications: false
    },
    'pastor': {
      home: true, dashboard: true, input: true, finance: false, giving: false,
      people: false, heartbeat: false, connect_groups: false, prayer: true,
      resources: false, pulse_tv: true, events: true, serving: true,
      communication: false, devotions: true,
      data_export: false, user_management: false, campus_management: false,
      beacon_management: false, pathway_manager: false, resource_manager: false,
      tv_manager: false, events_manager: false, notifications: false
    },
    'finance': {
      home: false, dashboard: false, input: false, finance: true, giving: true,
      people: false, heartbeat: false, connect_groups: false, prayer: false,
      resources: false, pulse_tv: true, events: false, serving: false,
      communication: false, devotions: false,
      data_export: false, user_management: false, campus_management: false,
      beacon_management: false, pathway_manager: false, resource_manager: false,
      tv_manager: false, events_manager: false, notifications: false
    },
    'staff': {
      home: true, dashboard: true, input: true, finance: false, giving: false,
      people: true, heartbeat: true, connect_groups: true, prayer: true,
      resources: false, pulse_tv: true, events: true, serving: true,
      communication: false, devotions: true,
      data_export: false, user_management: false, campus_management: false,
      beacon_management: false, pathway_manager: false, resource_manager: false,
      tv_manager: false, events_manager: false, notifications: false
    },
    'connect_group_leader': {
      home: true, dashboard: false, input: false, finance: false, giving: false,
      people: false, heartbeat: false, connect_groups: true, prayer: false,
      resources: false, pulse_tv: true, events: true, serving: false,
      communication: false, devotions: false,
      data_export: false, user_management: false, campus_management: false,
      beacon_management: false, pathway_manager: false, resource_manager: false,
      tv_manager: false, events_manager: false, notifications: false
    },
    'member': {
      home: true, dashboard: true, input: true, finance: false, giving: false,
      people: false, heartbeat: false, connect_groups: false, prayer: false,
      resources: false, pulse_tv: true, events: true, serving: false,
      communication: false, devotions: true,
      data_export: false, user_management: false, campus_management: false,
      beacon_management: false, pathway_manager: false, resource_manager: false,
      tv_manager: false, events_manager: false, notifications: false
    }
  };

  useEffect(() => {
    loadUsers();
    loadCampuses();
  }, []);

  const loadCampuses = async () => {
    try {
      const response = await fetch('/api/campuses/public', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        const campusesList = data.campuses || [];
        setCampuses(campusesList);
        console.log('[RoleManager] Loaded campuses:', campusesList.length, campusesList);
      } else {
        console.error('[RoleManager] Failed to load campuses:', response.status, response.statusText);
      }
    } catch (err) {
      console.error('[RoleManager] Error loading campuses:', err);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/users/permissions', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load users');
      }

      const data = await response.json();
      setUsers(data.users || []);

      // Initialize permissions state
      const perms = {};
      const original = {};
      data.users.forEach(user => {
        perms[user.id] = user.custom_permissions || {};
        original[user.id] = JSON.parse(JSON.stringify(user.custom_permissions || {}));
      });
      setPermissions(perms);
      setOriginalPermissions(original);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load users. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (userId, feature) => {
    setPermissions(prev => {
      const newPerms = { ...prev };
      if (!newPerms[userId]) {
        newPerms[userId] = {};
      }
      
      // Toggle the permission
      const currentValue = newPerms[userId][feature];
      newPerms[userId][feature] = currentValue !== true;
      
      // Check if there are changes
      const hasChanges = JSON.stringify(newPerms) !== JSON.stringify(originalPermissions);
      setHasChanges(hasChanges);
      
      return newPerms;
    });
  };

  const savePermissions = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // Save permissions for each user that has changes
      const savePromises = users.map(async (user) => {
        const userPerms = permissions[user.id] || {};
        const originalPerms = originalPermissions[user.id] || {};
        
        // Only save if permissions changed
        if (JSON.stringify(userPerms) !== JSON.stringify(originalPerms)) {
          const response = await fetch(`/api/users/${user.id}/permissions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ permissions: userPerms }),
          });

          if (!response.ok) {
            throw new Error(`Failed to save permissions for ${user.full_name || user.username}`);
          }
        }
      });

      await Promise.all(savePromises);

      // Update original permissions
      setOriginalPermissions(JSON.parse(JSON.stringify(permissions)));
      setHasChanges(false);
      setSuccess('Permissions saved successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving permissions:', err);
      setError(err.message || 'Failed to save permissions. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const resetChanges = () => {
    setPermissions(JSON.parse(JSON.stringify(originalPermissions)));
    setHasChanges(false);
    setError('');
    setSuccess('');
  };

  const getPermissionValue = (userId, feature) => {
    const userPerms = permissions[userId] || {};
    // If custom permission is set, use it; otherwise check role default
    if (userPerms.hasOwnProperty(feature)) {
      return userPerms[feature] === true;
    }
    // Check role default
    const user = users.find(u => u.id === userId);
    if (user && roleDefaults[user.role]) {
      return roleDefaults[user.role][feature] === true;
    }
    return false;
  };

  const getRoleDefault = (role, feature) => {
    return roleDefaults[role] && roleDefaults[role][feature] === true;
  };

  const bulkEnableForRole = (role, features) => {
    setPermissions(prev => {
      const newPerms = { ...prev };
      const roleUsers = users.filter(u => u.role === role);
      
      roleUsers.forEach(user => {
        if (!newPerms[user.id]) {
          newPerms[user.id] = {};
        }
        features.forEach(feature => {
          newPerms[user.id][feature] = true;
        });
      });
      
      const hasChanges = JSON.stringify(newPerms) !== JSON.stringify(originalPermissions);
      setHasChanges(hasChanges);
      return newPerms;
    });
  };

  const bulkDisableForRole = (role, features) => {
    setPermissions(prev => {
      const newPerms = { ...prev };
      const roleUsers = users.filter(u => u.role === role);
      
      roleUsers.forEach(user => {
        if (!newPerms[user.id]) {
          newPerms[user.id] = {};
        }
        features.forEach(feature => {
          newPerms[user.id][feature] = false;
        });
      });
      
      const hasChanges = JSON.stringify(newPerms) !== JSON.stringify(originalPermissions);
      setHasChanges(hasChanges);
      return newPerms;
    });
  };

  const clearCustomPermissions = (userId) => {
    setPermissions(prev => {
      const newPerms = { ...prev };
      newPerms[userId] = {};
      
      const hasChanges = JSON.stringify(newPerms) !== JSON.stringify(originalPermissions);
      setHasChanges(hasChanges);
      return newPerms;
    });
  };

  const toggleCampusSelection = (userId) => {
    setExpandedUsers(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const toggleCampusAccess = (userId, campusId) => {
    setPermissions(prev => {
      const newPerms = { ...prev };
      if (!newPerms[userId]) {
        newPerms[userId] = {};
      }
      
      // Get current allowed campuses
      const currentAllowed = newPerms[userId].allowed_campuses || [];
      const isAllowed = currentAllowed.includes(campusId);
      
      // Toggle campus access
      if (isAllowed) {
        newPerms[userId].allowed_campuses = currentAllowed.filter(id => id !== campusId);
      } else {
        newPerms[userId].allowed_campuses = [...currentAllowed, campusId];
      }
      
      // If empty array, remove the key
      if (newPerms[userId].allowed_campuses.length === 0) {
        delete newPerms[userId].allowed_campuses;
      }
      
      const hasChanges = JSON.stringify(newPerms) !== JSON.stringify(originalPermissions);
      setHasChanges(hasChanges);
      
      return newPerms;
    });
  };

  const getAllowedCampuses = (userId) => {
    const userPerms = permissions[userId] || {};
    return userPerms.allowed_campuses || null; // null means all campuses (no restriction)
  };

  const isCampusAllowed = (userId, campusId) => {
    const allowed = getAllowedCampuses(userId);
    if (allowed === null) return true; // No restriction = all campuses allowed
    return allowed.includes(campusId);
  };

  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (user.full_name || '').toLowerCase().includes(search) ||
      (user.username || '').toLowerCase().includes(search) ||
      (user.email || '').toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-white text-xl">Loading users and permissions...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-[95vw] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 flex items-center">
                <ShieldCheckIcon className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 mr-2 sm:mr-3 text-blue-500" />
                Role Manager
              </h1>
              <p className="text-slate-400 text-sm sm:text-base">
                Manage custom permissions for each user. Toggle features on/off to override role defaults.
              </p>
            </div>
            <div className="flex gap-2 sm:gap-3 flex-wrap">
              {hasChanges && (
                <button
                  onClick={resetChanges}
                  className="flex items-center px-3 sm:px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm sm:text-base"
                >
                  <ArrowPathIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                  Reset
                </button>
              )}
              <button
                onClick={savePermissions}
                disabled={!hasChanges || saving}
                className={`flex items-center px-4 sm:px-6 py-2 rounded-lg transition-colors text-sm sm:text-base ${
                  hasChanges && !saving
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Bulk Operations */}
          <div className="mb-4 p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-slate-300 text-sm font-medium">Bulk Operations:</span>
              <select
                onChange={(e) => {
                  const role = e.target.value;
                  if (role) {
                    const roleUsers = users.filter(u => u.role === role);
                    if (roleUsers.length > 0) {
                      if (confirm(`Enable all page features for all ${role} users?`)) {
                        bulkEnableForRole(role, allPageFeatures.map(f => f.key));
                      }
                    }
                  }
                  e.target.value = '';
                }}
                className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
              >
                <option value="">Enable Pages for Role...</option>
                {[...new Set(users.map(u => u.role))].map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <select
                onChange={(e) => {
                  const role = e.target.value;
                  if (role) {
                    const roleUsers = users.filter(u => u.role === role);
                    if (roleUsers.length > 0) {
                      if (confirm(`Enable all settings features for all ${role} users?`)) {
                        bulkEnableForRole(role, settingsFeatures.map(f => f.key));
                      }
                    }
                  }
                  e.target.value = '';
                }}
                className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
              >
                <option value="">Enable Settings for Role...</option>
                {[...new Set(users.map(u => u.role))].map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400">
            {success}
          </div>
        )}

        {/* Permission Matrix */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-slate-300 sticky left-0 bg-slate-700/50 z-20 min-w-[200px]">
                    User
                  </th>
                  {/* Page Features Headers by Group */}
                  {Object.entries(pageFeatures).map(([groupKey, group]) => (
                  <th 
                      key={groupKey}
                      colSpan={group.items.length} 
                    className="px-4 py-3 text-center text-xs font-semibold text-slate-400 bg-slate-700/70 border-l border-r border-slate-600"
                  >
                      {group.name}
                  </th>
                  ))}
                  {/* Settings Features Header */}
                  <th 
                    colSpan={settingsFeatures.length} 
                    className="px-4 py-3 text-center text-xs font-semibold text-slate-400 bg-slate-700/70 border-r border-slate-600"
                  >
                    ⚙️ Settings
                  </th>
                </tr>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 sticky left-0 bg-slate-700/50 z-20">
                    Name / Username / Role
                  </th>
                  {allFeatures.map(feature => (
                    <th
                      key={feature.key}
                      className="px-2 py-3 text-center text-xs font-semibold text-slate-400 min-w-[100px]"
                      title={feature.label}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-lg">{feature.icon}</span>
                        <span className="text-[10px] leading-tight">{feature.label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={allFeatures.length + 1} className="px-6 py-12 text-center text-slate-400">
                      {searchTerm ? 'No users found matching your search' : 'No users found'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <React.Fragment key={user.id}>
                      <tr className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-4 sticky left-0 bg-slate-800/95 z-10 min-w-[200px]">
                          <div className="flex flex-col">
                            <div className="text-white font-medium">{user.full_name || user.username}</div>
                            <div className="text-slate-400 text-sm">{user.username}</div>
                          <div className="text-slate-500 text-xs mt-1 flex items-center gap-2 flex-wrap">
                            <span className="inline-flex px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
                              {user.role}
                            </span>
                            <button
                              onClick={() => toggleCampusSelection(user.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/50 hover:bg-purple-500/30 hover:border-purple-400/70 transition-colors shadow-sm"
                              title="Manage campus access - Click to select which campuses this user can view"
                            >
                              <MapPinIcon className="w-3.5 h-3.5" />
                              <span className="text-[10px]">Campuses</span>
                              {expandedUsers[user.id] ? (
                                <ChevronUpIcon className="w-3 h-3" />
                              ) : (
                                <ChevronDownIcon className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          </div>
                        </td>
                        {allFeatures.map((feature) => {
                          const hasAccess = getPermissionValue(user.id, feature.key);
                          const isCustom = permissions[user.id] && permissions[user.id].hasOwnProperty(feature.key);
                          const roleDefault = getRoleDefault(user.role, feature.key);
                          return (
                            <td key={feature.key} className="px-2 py-4 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <button
                                  onClick={() => togglePermission(user.id, feature.key)}
                                  className={`inline-flex items-center justify-center w-10 h-10 rounded-lg transition-all relative ${
                                    hasAccess
                                      ? 'bg-green-500/20 text-green-400 border-2 border-green-500/50 hover:bg-green-500/30'
                                      : 'bg-slate-700/50 text-slate-500 border-2 border-slate-600 hover:bg-slate-700/70'
                                  }`}
                                  title={`${hasAccess ? 'Disable' : 'Enable'} ${feature.label} for ${user.full_name || user.username}${!isCustom ? ` (Role default: ${roleDefault ? 'enabled' : 'disabled'})` : ' (Custom)'}`}
                                >
                                  {hasAccess ? (
                                    <CheckIcon className="w-5 h-5" />
                                  ) : (
                                    <XMarkIcon className="w-5 h-5" />
                                  )}
                                  {isCustom && (
                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-slate-800" title="Custom permission"></span>
                                  )}
                                </button>
                                {!isCustom && (
                                  <span className={`text-[8px] ${roleDefault ? 'text-green-400' : 'text-slate-600'}`} title="Role default">
                                    {roleDefault ? '✓' : '✗'}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                      {/* Campus Selection Row */}
                      {expandedUsers[user.id] && (
                        <tr key={`${user.id}-campuses`} className="bg-slate-750/30">
                          <td colSpan={allFeatures.length + 1} className="px-4 py-4">
                            <div className="bg-slate-800/80 border border-slate-700/50 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <MapPinIcon className="w-5 h-5 text-purple-400" />
                                <h3 className="text-white font-medium">Campus Access for {user.full_name || user.username}</h3>
                              </div>
                              <p className="text-slate-400 text-sm mb-4">
                                Select which campuses this user can view data for. Leave all unchecked to allow access to all campuses.
                              </p>
                              {campuses.length === 0 ? (
                                <div className="text-yellow-400 text-sm py-4">
                                  ⚠️ No campuses loaded. Please refresh the page or check the console for errors.
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {campuses.map(campus => {
                                  const isAllowed = isCampusAllowed(user.id, campus.id);
                                  const allowedCampuses = getAllowedCampuses(user.id);
                                  const hasRestriction = allowedCampuses !== null;
                                  
                                  return (
                                    <button
                                      key={campus.id}
                                      onClick={() => toggleCampusAccess(user.id, campus.id)}
                                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                                        isAllowed
                                          ? 'bg-green-500/20 text-green-400 border-green-500/50 hover:bg-green-500/30'
                                          : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700/70'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        {isAllowed ? (
                                          <CheckIcon className="w-4 h-4" />
                                        ) : (
                                          <XMarkIcon className="w-4 h-4" />
                                        )}
                                        <span>{campus.name || campus.display_name || campus.id}</span>
                                      </div>
                                    </button>
                                  );
                                })}
                                {getAllowedCampuses(user.id) !== null && (
                                  <button
                                    onClick={() => {
                                      setPermissions(prev => {
                                        const newPerms = { ...prev };
                                        if (!newPerms[user.id]) {
                                          newPerms[user.id] = {};
                                        }
                                        delete newPerms[user.id].allowed_campuses;
                                        if (Object.keys(newPerms[user.id]).length === 0) {
                                          delete newPerms[user.id];
                                        }
                                        const hasChanges = JSON.stringify(newPerms) !== JSON.stringify(originalPermissions);
                                        setHasChanges(hasChanges);
                                        return newPerms;
                                      });
                                    }}
                                    className="px-4 py-2 rounded-lg border-2 border-blue-500/50 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all"
                                  >
                                    Clear Restrictions (Allow All)
                                  </button>
                                )}
                                </div>
                              )}
                              {getAllowedCampuses(user.id) !== null && (
                                <div className="mt-3 text-xs text-slate-400">
                                  <span className="text-purple-400">⚠️</span> Campus restriction active: User can only view data from selected campuses.
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
          <div className="flex items-center gap-6 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center">
                <CheckIcon className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-slate-300">Has Access</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-700/50 border-2 border-slate-600 flex items-center justify-center">
                <XMarkIcon className="w-5 h-5 text-slate-500" />
              </div>
              <span className="text-slate-300">No Access</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center relative">
                <CheckIcon className="w-5 h-5 text-green-400" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-slate-800"></span>
              </div>
              <span className="text-slate-300">Custom Permission</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-700/50 border-2 border-slate-600 flex items-center justify-center">
                <span className="text-[8px] text-green-400">✓</span>
              </div>
              <span className="text-slate-300">Role Default</span>
            </div>
            <div className="text-slate-400 text-xs ml-auto">
              💡 Custom permissions override role defaults. Blue dot = custom override.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleManager;

