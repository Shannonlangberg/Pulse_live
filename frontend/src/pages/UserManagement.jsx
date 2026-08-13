import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserGroupIcon, PlusIcon, PencilIcon, TrashIcon, XMarkIcon, CheckIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useSession } from '../lib/useSession';

const UserManagement = () => {
  const navigate = useNavigate();
  const session = useSession();
  const [users, setUsers] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    role: 'staff',
    campus: 'all_campuses',
    region_id: null
  });
  // null = no restriction (all campuses); array = only these campus ids
  const [allowedCampuses, setAllowedCampuses] = useState(null);
  const [restrictCampusAccess, setRestrictCampusAccess] = useState(false);
  // Display-only filters (no API impact) — search by name/username/email/campus, filter by role
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const roles = [
    { value: 'superadmin', label: 'Super Admin' },
    { value: 'admin', label: 'Admin' },
    { value: 'senior_leadership', label: 'Senior Leadership' },
    { value: 'campus_pastor', label: 'Campus Pastor' },
    { value: 'finance', label: 'Finance' },
    { value: 'staff', label: 'Staff' }
  ];

  // Authorization is driven by the server-resolved permissions object
  // from /api/session (via the shared hook) — never by role names.
  useEffect(() => {
    if (session.loading) return;
    if (!session.authenticated) {
      navigate('/login', { replace: true });
      return;
    }
    if (!session.permissions.manage_users) {
      console.warn('[UserManagement] Unauthorized access attempt (no manage_users permission)');
      navigate('/profile', { replace: true });
      return;
    }
    setUserRole(session.role || 'member');
    setCheckingAuth(false);
  }, [session.loading, session.authenticated, session.permissions.manage_users, session.role, navigate]);

  useEffect(() => {
    if (userRole && !checkingAuth) {
      loadUsers();
      loadCampuses();
      loadRegions();
    }
  }, [userRole, checkingAuth]);

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

  const loadRegions = async () => {
    try {
      const response = await fetch('/api/v2/regions', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setRegions(data.regions || []);
      }
    } catch (err) {
      console.error('Error loading regions:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users', {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        setError('Failed to load users');
      }
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const realCampuses = campuses.filter((c) => c.id && c.id !== 'all_campuses');

  const campusesForRegion = (region) =>
    realCampuses.filter(
      (c) =>
        c.region_id === region.id ||
        (c.region_code || '').toUpperCase() === (region.code || '').toUpperCase()
    );

  const isCampusAllowed = (campusId) => {
    if (!restrictCampusAccess || !allowedCampuses) return false;
    return allowedCampuses.includes(campusId);
  };

  const toggleCampusAccess = (campusId) => {
    setAllowedCampuses((prev) => {
      const list = prev || [];
      if (list.includes(campusId)) {
        const next = list.filter((id) => id !== campusId);
        return next.length ? next : [];
      }
      return [...list, campusId];
    });
  };

  const selectAllInRegion = (region) => {
    const ids = campusesForRegion(region).map((c) => c.id);
    if (!ids.length) return;
    setRestrictCampusAccess(true);
    setAllowedCampuses((prev) => {
      const set = new Set([...(prev || []), ...ids]);
      return Array.from(set);
    });
  };

  const clearAllInRegion = (region) => {
    const ids = new Set(campusesForRegion(region).map((c) => c.id));
    setAllowedCampuses((prev) => {
      if (!prev) return [];
      const next = prev.filter((id) => !ids.has(id));
      return next.length ? next : [];
    });
  };

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      const perms = user.custom_permissions || {};
      const ac = perms.allowed_campuses;
      const hasRestriction = Array.isArray(ac) && ac.length > 0;
      setRestrictCampusAccess(hasRestriction);
      setAllowedCampuses(hasRestriction ? [...ac] : null);
      setFormData({
        username: user.username,
        password: '', // Leave empty for edit
        full_name: user.full_name || '',
        email: user.email || '',
        role: user.role,
        campus: user.campus || 'all_campuses',
        region_id: user.region_id || null
      });
    } else {
      setEditingUser(null);
      setRestrictCampusAccess(false);
      setAllowedCampuses(null);
      setFormData({
        username: '',
        password: '',
        full_name: '',
        email: '',
        role: 'staff',
        campus: 'all_campuses',
        region_id: null
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setRestrictCampusAccess(false);
    setAllowedCampuses(null);
    setFormData({
      username: '',
      password: '',
      full_name: '',
      email: '',
      role: 'staff',
      campus: 'all_campuses',
      region_id: null
    });
  };

  // Saves allowed_campuses by MERGING into the user's existing
  // custom_permissions object — feature overrides set in Role Manager
  // (input, dashboard, edit, ...) are preserved, never clobbered.
  const saveCampusPermissions = async (userId, existingPermissions = {}) => {
    let existing = existingPermissions;
    if (typeof existing === 'string') {
      try {
        existing = JSON.parse(existing);
      } catch {
        existing = {};
      }
    }
    if (!existing || typeof existing !== 'object') {
      existing = {};
    }
    const perms = { ...existing };
    if (restrictCampusAccess && allowedCampuses && allowedCampuses.length > 0) {
      perms.allowed_campuses = [...allowedCampuses];
    } else {
      delete perms.allowed_campuses;
    }
    const response = await fetch(`/api/users/${userId}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ permissions: perms }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to save campus access');
    }
    return data;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.username) {
      alert('Username is required');
      return;
    }

    if (!editingUser && !formData.password) {
      alert('Password is required for new users');
      return;
    }

    if (restrictCampusAccess && (!allowedCampuses || allowedCampuses.length === 0)) {
      alert('Select at least one campus under "What can this user see?", or choose "All campuses".');
      return;
    }

    try {
      const url = editingUser
        ? `/api/users/${editingUser.id}/edit`
        : '/api/users/create';

      // Build payload — only include region_id if it has been explicitly set
      // to avoid silently wiping it on every save when the field is undefined
      const payload = { ...formData };
      if (payload.region_id === undefined) {
        delete payload.region_id;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        const userId = editingUser?.id ?? data.id;
        const hadCampusRestrictions =
          Array.isArray(editingUser?.custom_permissions?.allowed_campuses) &&
          editingUser.custom_permissions.allowed_campuses.length > 0;
        if (userId && (restrictCampusAccess || hadCampusRestrictions)) {
          await saveCampusPermissions(userId, editingUser?.custom_permissions || {});
        }
        await loadUsers();
        handleCloseModal();
        alert((data.message || 'User saved successfully') + '\n\n⚠️ The affected user must log out and log back in for changes to take effect.');
      } else {
        alert(data.error || `Failed to save user (HTTP ${response.status}). Check you are still logged in and try again.`);
      }
    } catch (err) {
      console.error('Error saving user:', err);
      alert('Failed to save user — could not reach the server. Please refresh the page and try again.');
    }
  };

  const handleDelete = async (user) => {
    if (!confirm(`Are you sure you want to delete user "${user.full_name || user.username}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${user.id}/delete`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        loadUsers();
        alert(data.message || 'User deleted successfully');
      } else {
        alert(data.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Failed to delete user');
    }
  };

  const getRoleDisplayName = (role) => {
    const names = {
      'superadmin': 'Super Administrator',
      'admin': 'Administrator',
      'senior_leadership': 'Senior Leadership',
      'senior_leader': 'Senior Leader',
      'senior_pastor': 'Senior Pastor',
      'lead_pastor': 'Lead Pastor',
      'campus_pastor': 'Campus Pastor',
      'pastor': 'Pastor',
      'finance': 'Finance'
    };
    return names[role] || role;
  };

  // Tint used for the avatar ring, keyed by role. Full static class strings
  // (not template-built) so Tailwind's content scanner can find them.
  const AVATAR_ACCENTS = {
    'superadmin': 'bg-fc-copper/15 border border-fc-copper/30 text-fc-copper',
    'admin': 'bg-fc-copper/15 border border-fc-copper/30 text-fc-copper',
    'senior_leadership': 'bg-fc-violet/15 border border-fc-violet/30 text-fc-violet',
    'senior_leader': 'bg-fc-violet/15 border border-fc-violet/30 text-fc-violet',
    'senior_pastor': 'bg-fc-violet/15 border border-fc-violet/30 text-fc-violet',
    'lead_pastor': 'bg-fc-teal/15 border border-fc-teal/30 text-fc-teal',
    'campus_pastor': 'bg-fc-teal/15 border border-fc-teal/30 text-fc-teal',
    'pastor': 'bg-fc-olive/15 border border-fc-olive/30 text-fc-olive',
    'finance': 'bg-fc-gold/15 border border-fc-gold/30 text-fc-gold',
    'staff': 'bg-fc-brown/15 border border-fc-brown/30 text-fc-brown'
  };
  const getRoleAccent = (role) => AVATAR_ACCENTS[role] || AVATAR_ACCENTS.staff;

  const getInitials = (name, username) => {
    const source = (name || username || '?').trim();
    if (!source) return '?';
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const filteredUsers = users.filter((user) => {
    if (roleFilter && user.role !== roleFilter) return false;
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const campusName = user.campus === 'all_campuses' ? 'all campuses' : (user.campus || '');
    return (
      (user.full_name || '').toLowerCase().includes(search) ||
      (user.username || '').toLowerCase().includes(search) ||
      (user.email || '').toLowerCase().includes(search) ||
      campusName.toLowerCase().includes(search) ||
      getRoleDisplayName(user.role).toLowerCase().includes(search)
    );
  });

  // Show loading while checking authorization
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-fc-cream p-6 flex items-center justify-center">
        <div className="text-center">
          <UserGroupIcon className="w-16 h-16 text-fc-copper mx-auto mb-4 animate-pulse" />
          <div className="fc-display fc-display-sm text-fc-midnight">Checking authorization…</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-fc-cream p-6 flex items-center justify-center">
        <div className="fc-display fc-display-sm text-fc-midnight">Loading users…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fc-cream p-4 sm:p-6 lg:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-7 flex-wrap">
          <div>
            <div className="fc-label mb-2.5">Settings</div>
            <h1 className="fc-display fc-display-md mb-2">People with access</h1>
            <p className="text-[15px] text-fc-brown">Who can log a weekend, who can read the numbers, and where.</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="fc-btn-primary whitespace-nowrap"
          >
            <PlusIcon className="w-4 h-4" />
            Invite someone
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-fc-wash-peach border border-fc-wash-peach-border rounded-lg text-fc-copper">
            {error}
          </div>
        )}

        {/* Search + Role filter */}
        <div className="flex gap-2.5 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fc-thistle pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, campus or role"
              className="fc-input pl-10"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="fc-input w-auto"
          >
            <option value="">All roles</option>
            {roles.map((role) => (
              <option key={role.value} value={role.value}>{role.label}</option>
            ))}
          </select>
        </div>

        {/* Mobile Scroll Hint */}
        <div className="lg:hidden mb-4 p-3 bg-fc-wash-sky border border-fc-wash-sky-border rounded-lg text-center">
          <p className="text-sm text-fc-brown">
            👆 <strong>Swipe left/right</strong> to see all user details
          </p>
        </div>

        {/* Users Table */}
        <div className="fc-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-fc-cream">
                  <th className="text-left px-6 py-2.5 fc-label whitespace-nowrap">Name</th>
                  <th className="text-left px-4 py-2.5 fc-label whitespace-nowrap">Role</th>
                  <th className="text-left px-4 py-2.5 fc-label whitespace-nowrap">Campus</th>
                  <th className="text-left px-4 py-2.5 fc-label whitespace-nowrap">Region</th>
                  <th className="text-left px-4 py-2.5 fc-label whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-2.5 fc-label whitespace-nowrap">Last login</th>
                  <th className="px-6 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-fc-brown">
                      {searchTerm || roleFilter ? 'No users match your search' : 'No users found'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const accentClasses = getRoleAccent(user.role);
                    return (
                      <tr key={user.id} className="border-t border-fc-cream2 hover:bg-fc-cream/60 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 ${accentClasses}`}
                            >
                              {getInitials(user.full_name, user.username)}
                            </div>
                            <div>
                              <div className="text-sm text-fc-midnight">{user.full_name || user.username}</div>
                              <div className="text-xs text-fc-brown">{user.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-fc-cream2 text-fc-brown">
                            {getRoleDisplayName(user.role)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-fc-brown">
                          {user.campus === 'all_campuses' ? 'All Campuses' : user.campus}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-fc-brown">
                          {user.region_id ? regions.find(r => r.id === user.region_id)?.display_name || 'Unknown' : 'Global'}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                            user.active
                              ? 'bg-fc-wash-mint text-fc-olive'
                              : 'bg-fc-cream2 text-fc-brown'
                          }`}>
                            {user.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-fc-brown">
                          {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => handleOpenModal(user)}
                              title="Edit User"
                              className="text-fc-copper text-[13px] font-medium hover:underline inline-flex items-center gap-1"
                            >
                              <PencilIcon className="w-3.5 h-3.5" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(user)}
                              title="Delete User"
                              className="p-1.5 text-fc-brown hover:text-fc-copper rounded-lg transition-colors"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mt-7">
          <div className="fc-card p-5">
            <div className="text-fc-brown text-sm mb-1">Total Users</div>
            <div className="text-3xl fc-display text-fc-midnight">{users.length}</div>
          </div>
          <div className="fc-card p-5">
            <div className="text-fc-brown text-sm mb-1">Active Users</div>
            <div className="text-3xl fc-display text-fc-olive">
              {users.filter(u => u.active).length}
            </div>
          </div>
          <div className="fc-card p-5">
            <div className="text-fc-brown text-sm mb-1">Administrators</div>
            <div className="text-3xl fc-display text-fc-copper">
              {users.filter(u => u.role === 'superadmin' || u.role === 'admin').length}
            </div>
          </div>
          <div className="fc-card p-5">
            <div className="text-fc-brown text-sm mb-1">Campus Pastors</div>
            <div className="text-3xl fc-display text-fc-teal">
              {users.filter(u => u.role === 'campus_pastor').length}
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-fc-midnight/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl shadow-pop max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-fc-cream2 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="fc-display fc-display-sm text-fc-midnight">
                {editingUser ? 'Edit user' : 'Add new user'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-fc-cream rounded-lg transition-colors touch-manipulation"
              >
                <XMarkIcon className="w-5 h-5 text-fc-brown" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-fc-midnight mb-2">
                  Username <span className="text-fc-copper">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="fc-input"
                  placeholder="john.smith"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-fc-midnight mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="fc-input"
                  placeholder="John Smith"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-fc-midnight mb-2">
                  Email
                </label>
                <input
                  type="text"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="fc-input"
                  placeholder="john.smith@futures.church"
                />
                {formData.email && formData.email.includes(' ') && (
                  <p className="mt-1 text-xs text-fc-gold">
                    Note: Email contains spaces. Standard email format uses dots instead (e.g., tony.corbridge@futures.church)
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-fc-midnight mb-2">
                  Password {!editingUser && <span className="text-fc-copper">*</span>}
                  {editingUser && <span className="text-fc-brown text-xs ml-2">(leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="fc-input"
                  placeholder="••••••••"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-fc-midnight mb-2">
                  Role <span className="text-fc-copper">*</span>
                </label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="fc-input"
                >
                  {roles.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-fc-brown">
                  Staff have no stats access by default - grant via Role Manager or campus access.
                </p>
              </div>

              {/* Campus */}
              <div>
                <label className="block text-sm font-medium text-fc-midnight mb-2">
                  Campus <span className="text-fc-copper">*</span>
                </label>
                <select
                  required
                  value={formData.campus}
                  onChange={(e) => setFormData({ ...formData, campus: e.target.value })}
                  className="fc-input"
                >
                  <option value="all_campuses">All Campuses</option>
                  {campuses.map(campus => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Region */}
              <div>
                <label className="block text-sm font-medium text-fc-midnight mb-2">
                  Region <span className="text-fc-brown text-xs ml-2">(optional - leave blank for global access)</span>
                </label>
                <select
                  value={formData.region_id || ''}
                  onChange={(e) => setFormData({ ...formData, region_id: e.target.value ? parseInt(e.target.value) : null })}
                  className="fc-input"
                >
                  <option value="">All Regions (Global Access)</option>
                  {regions.filter(r => r.active).map(region => (
                    <option key={region.id} value={region.id}>
                      {region.display_name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-fc-brown">
                  Optional reporting scope. For mixed access (e.g. one AU campus + all Indonesia), leave Global and use campus visibility below.
                </p>
              </div>

              {/* Campus access — cross-region (saved as custom_permissions.allowed_campuses) */}
              <div className="rounded-lg border border-fc-cream2 bg-fc-cream p-4">
                <label className="block text-sm font-medium text-fc-midnight mb-1">
                  Campus access
                </label>
                <p className="text-xs text-fc-brown mb-3">
                  Which campuses this user can input stats and view dashboards for.
                </p>
                <div className="flex flex-col gap-2 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="campusAccess"
                      checked={!restrictCampusAccess}
                      onChange={() => {
                        setRestrictCampusAccess(false);
                        setAllowedCampuses(null);
                      }}
                      className="text-fc-olive"
                    />
                    <span className="text-fc-midnight text-sm">All campuses (role default)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="campusAccess"
                      checked={restrictCampusAccess}
                      onChange={() => {
                        setRestrictCampusAccess(true);
                        setAllowedCampuses((prev) => (prev && prev.length ? prev : []));
                      }}
                      className="text-fc-olive"
                    />
                    <span className="text-fc-midnight text-sm">Only selected campuses (can mix regions)</span>
                  </label>
                </div>

                {restrictCampusAccess && (
                  <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
                    {regions.filter((r) => r.active !== false).map((region) => {
                      const regionCampuses = campusesForRegion(region);
                      if (!regionCampuses.length) return null;
                      const allSelected = regionCampuses.every((c) => isCampusAllowed(c.id));
                      return (
                        <div key={region.id} className="border border-fc-cream2 rounded-lg p-3 bg-white">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <span className="text-sm font-medium text-fc-midnight">
                              {region.display_name || region.name}
                            </span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => selectAllInRegion(region)}
                                className="text-xs px-2 py-1 rounded bg-fc-wash-sky text-fc-teal hover:brightness-95"
                              >
                                {allSelected ? 'All selected' : 'Select all'}
                              </button>
                              <button
                                type="button"
                                onClick={() => clearAllInRegion(region)}
                                className="text-xs px-2 py-1 rounded bg-fc-cream2 text-fc-brown hover:brightness-95"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {regionCampuses.map((campus) => {
                              const on = isCampusAllowed(campus.id);
                              return (
                                <button
                                  key={campus.id}
                                  type="button"
                                  onClick={() => toggleCampusAccess(campus.id)}
                                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                                    on
                                      ? 'bg-fc-wash-mint text-fc-olive border-fc-wash-mint-border'
                                      : 'bg-fc-cream text-fc-brown border-fc-cream2 hover:border-fc-thistle'
                                  }`}
                                >
                                  <span className="inline-flex items-center gap-1">
                                    {on && <CheckIcon className="w-3.5 h-3.5" />}
                                    {campus.name || campus.id}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-xs text-fc-brown">
                      Example: tick Adelaide City under Australia, then &quot;Select all&quot; under Indonesia so they keep one AU campus but see every Indo campus.
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-fc-cream2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="fc-btn-secondary flex-1 justify-center touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="fc-btn-primary flex-1 justify-center touch-manipulation"
                >
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
