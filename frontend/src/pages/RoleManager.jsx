import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheckIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import { useSession } from '../lib/useSession';

// The ONLY custom_permissions keys the backend honors.
// Everything else was dead weight and has been removed.
const FEATURES = [
  { key: 'input', label: 'Stats input', icon: '✍️', description: 'Log weekly attendance stats' },
  { key: 'dashboard', label: 'Dashboards', icon: '📊', description: 'View campus dashboards' },
  { key: 'data_export', label: 'Reports & exports', icon: '📥', description: 'Reports page and data exports' },
  { key: 'database_viewer', label: 'Database viewer', icon: '🗄️', description: 'Raw attendance records and Attendance Data page' },
  { key: 'finance', label: 'Finance', icon: '💰', description: 'Finance features' },
  { key: 'user_management', label: 'User management', icon: '👤', description: 'Users page and this Role Manager' },
  { key: 'campus_management', label: 'Campus management', icon: '🏢', description: 'Add/edit campuses' },
  { key: 'resource_manager', label: 'Resource manager', icon: '📦', description: 'Manage team resources' },
  { key: 'homepage_manager', label: 'Homepage manager', icon: '📢', description: 'Homepage announcements' },
  { key: 'query', label: 'AI/voice queries', icon: '🎙️', description: 'Ask questions of the stats data' },
  { key: 'edit', label: 'Edit stat entries', icon: '✏️', description: 'Edit previously submitted stats' }
];

const RoleManager = () => {
  const navigate = useNavigate();
  const session = useSession();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [permissions, setPermissions] = useState({}); // { userId: { feature: true/false, allowed_campuses?: [...] } }
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPermissions, setOriginalPermissions] = useState({});
  const [campuses, setCampuses] = useState([]);
  const [regions, setRegions] = useState([]);
  const [expandedUsers, setExpandedUsers] = useState({}); // { userId: true/false } for campus selection
  const [authorized, setAuthorized] = useState(false);

  // Authorization is driven by the server-resolved permissions object,
  // never by role names.
  useEffect(() => {
    if (session.loading) return;
    if (!session.authenticated) {
      navigate('/login', { replace: true });
      return;
    }
    if (!session.permissions.manage_users) {
      console.warn('[RoleManager] Unauthorized access attempt (no manage_users permission)');
      navigate('/profile', { replace: true });
      return;
    }
    setAuthorized(true);
  }, [session.loading, session.authenticated, session.permissions.manage_users, navigate]);

  useEffect(() => {
    if (authorized) {
      loadUsers();
      loadCampuses();
      loadRegions();
    }
  }, [authorized]);

  const loadRegions = async () => {
    try {
      const response = await fetch('/api/v2/regions', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        const regionsList = data.regions || [];
        setRegions(regionsList);
      } else {
        console.error('[RoleManager] Failed to load regions:', response.status);
      }
    } catch (err) {
      console.error('[RoleManager] Error loading regions:', err);
    }
  };

  const loadCampuses = async () => {
    try {
      const response = await fetch('/api/campuses/public', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setCampuses(data.campuses || []);
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
        // Ensure custom_permissions is always an object, not null or undefined
        let userPerms = user.custom_permissions;
        if (typeof userPerms === 'string') {
          try {
            userPerms = JSON.parse(userPerms);
          } catch {
            userPerms = {};
          }
        }
        if (!userPerms || typeof userPerms !== 'object') {
          userPerms = {};
        }
        perms[user.id] = userPerms;
        original[user.id] = JSON.parse(JSON.stringify(userPerms));
      });
      setPermissions(perms);
      setOriginalPermissions(original);
      setHasChanges(false);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load users. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle cycles: (role default / unset) -> true -> false -> true -> ...
  // CRITICAL: we ALWAYS write the explicit boolean into custom_permissions.
  // Keys are never deleted for "matching a role default" — that behaviour
  // silently no-op'ed grants. The only way back to "role default" is the
  // per-user "Clear overrides" button.
  const togglePermission = (userId, feature) => {
    setPermissions(prev => {
      const newPerms = { ...prev, [userId]: { ...(prev[userId] || {}) } };
      const current = newPerms[userId][feature];

      if (current === true) {
        newPerms[userId][feature] = false;
      } else {
        // unset or explicitly false -> explicit true
        newPerms[userId][feature] = true;
      }

      setHasChanges(JSON.stringify(newPerms) !== JSON.stringify(originalPermissions));
      return newPerms;
    });
  };

  // Reset a user to role defaults: save {} — but ALWAYS preserve
  // allowed_campuses if present (campus scoping is not a feature override).
  const clearOverrides = (userId) => {
    setPermissions(prev => {
      const newPerms = { ...prev };
      const existing = prev[userId] || {};
      newPerms[userId] = existing.allowed_campuses
        ? { allowed_campuses: existing.allowed_campuses }
        : {};

      setHasChanges(JSON.stringify(newPerms) !== JSON.stringify(originalPermissions));
      return newPerms;
    });
  };

  const savePermissions = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // Save permissions for each user that has changes.
      // The whole custom_permissions object is POSTed, so allowed_campuses
      // (kept in the same object) always travels with it unchanged.
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
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to save permissions for ${user.full_name || user.username}: ${errorData.error || response.statusText}`);
          }

          await response.json();
        }
      });

      await Promise.all(savePromises);

      // Reload users to get the latest permissions from database
      await loadUsers();
      setSuccess('✅ Permissions saved successfully! Users must REFRESH their browser (Cmd/Ctrl + Shift + R) to see changes.');

      // Clear success message after 8 seconds (longer to give time to read)
      setTimeout(() => setSuccess(''), 8000);
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

  // Returns true / false for an explicit override, or null when unset
  // (i.e. the backend resolves it from the user's role default — the
  // per-user effective value is not available from this API, so we show
  // "role default" honestly instead of pretending to know).
  const getOverrideValue = (userId, feature) => {
    const userPerms = permissions[userId] || {};
    if (Object.prototype.hasOwnProperty.call(userPerms, feature)) {
      return userPerms[feature] === true;
    }
    return null;
  };

  const hasFeatureOverrides = (userId) => {
    const userPerms = permissions[userId] || {};
    return Object.keys(userPerms).some(k => k !== 'allowed_campuses');
  };

  const bulkSetForRole = (role, value) => {
    setPermissions(prev => {
      const newPerms = { ...prev };
      const roleUsers = users.filter(u => u.role === role);

      roleUsers.forEach(user => {
        newPerms[user.id] = { ...(newPerms[user.id] || {}) };
        FEATURES.forEach(feature => {
          newPerms[user.id][feature.key] = value;
        });
      });

      setHasChanges(JSON.stringify(newPerms) !== JSON.stringify(originalPermissions));
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
      const newPerms = { ...prev, [userId]: { ...(prev[userId] || {}) } };

      // Get current allowed campuses
      const currentAllowed = newPerms[userId].allowed_campuses || [];
      const isAllowed = currentAllowed.includes(campusId);

      // Toggle campus access
      if (isAllowed) {
        newPerms[userId].allowed_campuses = currentAllowed.filter(id => id !== campusId);
      } else {
        newPerms[userId].allowed_campuses = [...currentAllowed, campusId];
      }

      // Empty array = no restriction, so remove the key entirely
      if (newPerms[userId].allowed_campuses.length === 0) {
        delete newPerms[userId].allowed_campuses;
      }

      setHasChanges(JSON.stringify(newPerms) !== JSON.stringify(originalPermissions));
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

  // Show loading while checking authorization
  if (session.loading || !authorized) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <ShieldCheckIcon className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-pulse" />
          <div className="text-white text-xl">Checking authorization...</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-white text-xl">Loading users and permissions...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6">
      <div className="max-w-[95vw] sm:max-w-[98vw] mx-auto overflow-x-hidden">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 flex items-center">
                <ShieldCheckIcon className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 mr-2 sm:mr-3 text-blue-500" />
                Role Manager
              </h1>
              <p className="text-slate-400 text-sm sm:text-base">
                Grant or revoke features per user. Every toggle saves an explicit override on top of the user's role defaults.
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
                      if (confirm(`Grant ALL features (explicit overrides) to every ${role} user?`)) {
                        bulkSetForRole(role, true);
                      }
                    }
                  }
                  e.target.value = '';
                }}
                className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
              >
                <option value="">Grant all features for role...</option>
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
                      if (confirm(`Revoke ALL features (explicit overrides) from every ${role} user?`)) {
                        bulkSetForRole(role, false);
                      }
                    }
                  }
                  e.target.value = '';
                }}
                className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
              >
                <option value="">Revoke all features for role...</option>
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

        {/* Important Info Box */}
        <div className="mb-6 p-5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <ShieldCheckIcon className="w-7 h-7 text-blue-400" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">How the Role Manager Works</h3>
              <div className="space-y-2 text-sm text-slate-300">
                <p>• <strong>Em-dash (—)</strong>: no override — the user gets their role's default for that feature</p>
                <p>• <strong>Click a cell</strong> to set an explicit grant (✓), click again for an explicit deny (✗)</p>
                <p>• <strong>Blue dot</strong> marks an explicit override. Overrides always win over role defaults</p>
                <p>• <strong>Clear overrides</strong> returns a user to pure role defaults (campus access is kept)</p>
                <p className="pt-2 text-yellow-300">⚠️ <strong>IMPORTANT:</strong> After saving, users must refresh their browser (Cmd/Ctrl + Shift + R) to see changes!</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Scroll Hint */}
        <div className="lg:hidden mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-center">
          <p className="text-sm text-blue-300">
            👆 <strong>Swipe left/right</strong> to see all permission columns
          </p>
        </div>

        {/* Permission Matrix */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
            <table className="w-full">
              <thead className="bg-slate-700/50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 sticky left-0 bg-slate-700/50 z-20 min-w-[200px]">
                    Name / Username / Role
                  </th>
                  {FEATURES.map(feature => (
                    <th
                      key={feature.key}
                      className="px-2 py-3 text-center text-xs font-semibold text-slate-400 min-w-[100px]"
                      title={feature.description}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-lg">{feature.icon}</span>
                        <span className="text-[10px] leading-tight">{feature.label}</span>
                      </div>
                    </th>
                  ))}
                  <th className="px-2 py-3 text-center text-xs font-semibold text-slate-400 min-w-[100px]">
                    Reset
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={FEATURES.length + 2} className="px-6 py-12 text-center text-slate-400">
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
                        {FEATURES.map((feature) => {
                          const override = getOverrideValue(user.id, feature.key);
                          const isCustom = override !== null;
                          return (
                            <td key={feature.key} className="px-2 py-4 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <button
                                  onClick={() => togglePermission(user.id, feature.key)}
                                  className={`inline-flex items-center justify-center w-10 h-10 rounded-lg transition-all relative ${
                                    override === true
                                      ? 'bg-green-500/20 text-green-400 border-2 border-green-500/50 hover:bg-green-500/30'
                                      : override === false
                                        ? 'bg-red-500/10 text-red-400 border-2 border-red-500/40 hover:bg-red-500/20'
                                        : 'bg-slate-700/50 text-slate-500 border-2 border-slate-600 hover:bg-slate-700/70'
                                  }`}
                                  title={
                                    isCustom
                                      ? `${feature.label}: explicit ${override ? 'grant' : 'deny'} for ${user.full_name || user.username}. Click to change.`
                                      : `${feature.label}: no override — using ${user.role} role default. Click to grant.`
                                  }
                                >
                                  {override === true ? (
                                    <CheckIcon className="w-5 h-5" />
                                  ) : override === false ? (
                                    <XMarkIcon className="w-5 h-5" />
                                  ) : (
                                    <span className="text-lg leading-none">—</span>
                                  )}
                                  {isCustom && (
                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-slate-800" title="Explicit override"></span>
                                  )}
                                </button>
                                {!isCustom && (
                                  <span className="text-[8px] text-slate-500" title="No override — backend applies this user's role default">
                                    role default
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-2 py-4 text-center">
                          <button
                            onClick={() => clearOverrides(user.id)}
                            disabled={!hasFeatureOverrides(user.id)}
                            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                              hasFeatureOverrides(user.id)
                                ? 'bg-slate-700 text-slate-200 border-slate-500 hover:bg-slate-600'
                                : 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
                            }`}
                            title="Remove every feature override so this user gets pure role defaults. Campus access restrictions are preserved. Remember to Save."
                          >
                            Clear overrides
                          </button>
                        </td>
                      </tr>
                      {/* Campus and Region Selection Row */}
                      {expandedUsers[user.id] && (
                        <tr key={`${user.id}-campuses`} className="bg-slate-750/30">
                          <td colSpan={FEATURES.length + 2} className="px-3 sm:px-4 py-4">
                            <div className="space-y-4 sm:space-y-5">
                              {/* Region Selection - responsive card */}
                              <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl p-4 sm:p-5">
                                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                                  <span className="text-xl" aria-hidden>🌍</span>
                                  <h3 className="text-white font-medium text-base sm:text-lg">Region for {user.full_name || user.username}</h3>
                                </div>
                                <p className="text-slate-400 text-xs sm:text-sm mb-3 sm:mb-4">
                                  Select which region this user belongs to. This determines which regional data and campuses they can access.
                                </p>
                                {regions.length === 0 ? (
                                  <div className="text-yellow-400 text-sm py-4">
                                    ⚠️ No regions loaded. Please refresh the page.
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-2 sm:gap-3">
                                    {regions.map(region => {
                                      const userRegion = user.region_code || (regions[0] && regions[0].code) || 'AU';
                                      const isSelected = userRegion === region.code;

                                      return (
                                        <button
                                          key={region.code}
                                          type="button"
                                          onClick={async () => {
                                            if (isSelected) return;
                                            setError('');
                                            try {
                                              const response = await fetch(`/api/users/${user.id}`, {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                credentials: 'include',
                                                body: JSON.stringify({ region_code: region.code })
                                              });
                                              const data = await response.json().catch(() => ({}));
                                              if (response.ok) {
                                                setUsers(prev => prev.map(u => u.id === user.id ? { ...u, region_code: region.code } : u));
                                                await loadUsers();
                                                setSuccess(`Updated ${user.full_name || user.username}'s region to ${region.name || region.code}`);
                                                setTimeout(() => setSuccess(''), 4000);
                                              } else {
                                                setError(data.error || `Failed to update region: ${response.statusText}`);
                                                setTimeout(() => setError(''), 5000);
                                              }
                                            } catch (err) {
                                              console.error('Error updating region:', err);
                                              setError('Failed to update region. Please try again.');
                                              setTimeout(() => setError(''), 5000);
                                            }
                                          }}
                                          className={`min-h-[44px] sm:min-h-0 px-4 py-3 sm:py-2 rounded-xl border-2 transition-all cursor-pointer touch-manipulation ${
                                            isSelected
                                              ? 'bg-blue-500/20 text-blue-400 border-blue-500/50 ring-2 ring-blue-400/30'
                                              : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700/70 hover:border-blue-400/30 active:scale-[0.98]'
                                          }`}
                                          title={isSelected ? `Current region: ${region.name}` : `Click to change to ${region.name}`}
                                        >
                                          <div className="flex items-center justify-center gap-2">
                                            {isSelected && <CheckIcon className="w-4 h-4 flex-shrink-0" />}
                                            <span className="text-sm sm:text-base">{region.code} – {region.name}</span>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                <p className="mt-3 text-xs text-slate-400">
                                  <span className="text-blue-400">💡</span> Tap a region to assign the user. Affects regional data and campus list below.
                                </p>
                              </div>

                              {/* Campus Selection - responsive, filter by user region on small screens */}
                              <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl p-4 sm:p-5">
                                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                                  <MapPinIcon className="w-5 h-5 text-purple-400 flex-shrink-0" />
                                  <h3 className="text-white font-medium text-base sm:text-lg">Campus Access for {user.full_name || user.username}</h3>
                                </div>
                                <p className="text-slate-400 text-xs sm:text-sm mb-3 sm:mb-4">
                                  Select which campuses this user can view and edit. Leave all unchecked to allow all campuses.
                                </p>
                                {campuses.length === 0 ? (
                                  <div className="text-yellow-400 text-sm py-4">
                                    ⚠️ No campuses loaded. Please refresh the page or check the console for errors.
                                  </div>
                                ) : (
                                  <>
                                    {(() => {
                                      const realCampuses = campuses.filter(c => c.id !== 'all_campuses');
                                      const userRegionCode = user.region_code || (regions[0] && regions[0].code);
                                      let campusesToShow = userRegionCode
                                        ? realCampuses.filter(c => (c.region_code || '').toUpperCase() === (userRegionCode || '').toUpperCase())
                                        : realCampuses;
                                      if (campusesToShow.length === 0 && realCampuses.length > 0) {
                                        campusesToShow = realCampuses;
                                      }
                                      const hasFilter = userRegionCode && realCampuses.some(c => (c.region_code || '').toUpperCase() !== (userRegionCode || '').toUpperCase());
                                      return (
                                        <div className="flex flex-wrap gap-2 sm:gap-3">
                                          {campusesToShow.map(campus => {
                                            const isAllowed = isCampusAllowed(user.id, campus.id);
                                            return (
                                              <button
                                                key={campus.id}
                                                type="button"
                                                onClick={() => toggleCampusAccess(user.id, campus.id)}
                                                className={`min-h-[44px] sm:min-h-0 px-4 py-3 sm:py-2 rounded-xl border-2 transition-all touch-manipulation ${
                                                  isAllowed
                                                    ? 'bg-green-500/20 text-green-400 border-green-500/50 hover:bg-green-500/30 active:scale-[0.98]'
                                                    : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700/70 active:scale-[0.98]'
                                                }`}
                                              >
                                                <div className="flex items-center justify-center gap-2">
                                                  {isAllowed ? <CheckIcon className="w-4 h-4 flex-shrink-0" /> : <XMarkIcon className="w-4 h-4 flex-shrink-0" />}
                                                  <span className="text-sm sm:text-base">{campus.name || campus.display_name || campus.id}</span>
                                                </div>
                                              </button>
                                            );
                                          })}
                                          {hasFilter && (
                                            <p className="w-full text-xs text-slate-500 mt-1">
                                              Showing campuses for {user.region_code || 'selected region'} only.
                                            </p>
                                          )}
                                          {getAllowedCampuses(user.id) !== null && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setPermissions(prev => {
                                                  const newPerms = { ...prev, [user.id]: { ...(prev[user.id] || {}) } };
                                                  delete newPerms[user.id].allowed_campuses;
                                                  setHasChanges(JSON.stringify(newPerms) !== JSON.stringify(originalPermissions));
                                                  return newPerms;
                                                });
                                              }}
                                              className="min-h-[44px] sm:min-h-0 px-4 py-3 sm:py-2 rounded-xl border-2 border-blue-500/50 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all touch-manipulation"
                                            >
                                              Clear restrictions (allow all)
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </>
                                )}
                                {getAllowedCampuses(user.id) !== null && (
                                  <p className="mt-3 text-xs text-slate-400">
                                    <span className="text-purple-400">⚠️</span> Campus restriction active: user can only view/edit selected campuses.
                                  </p>
                                )}
                              </div>
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
              <span className="text-slate-300">Explicit grant</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border-2 border-red-500/40 flex items-center justify-center">
                <XMarkIcon className="w-5 h-5 text-red-400" />
              </div>
              <span className="text-slate-300">Explicit deny</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-700/50 border-2 border-slate-600 flex items-center justify-center">
                <span className="text-slate-500">—</span>
              </div>
              <span className="text-slate-300">Role default (no override)</span>
            </div>
            <div className="text-slate-400 text-xs ml-auto">
              💡 Overrides are always saved explicitly. Use "Clear overrides" to return a user to role defaults.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleManager;
