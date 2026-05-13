import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserGroupIcon, PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';

const UserManagement = () => {
  const navigate = useNavigate();
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

  const roles = [
    { value: 'superadmin', label: 'Super Admin' },
    { value: 'admin', label: 'Admin' },
    { value: 'senior_leader', label: 'Senior Leader' },
    { value: 'campus_pastor', label: 'Campus Pastor' },
    { value: 'finance', label: 'Finance' },
    { value: 'staff', label: 'Staff' }
  ];

  // Check user authorization first
  useEffect(() => {
    checkAuthorization();
  }, []);

  useEffect(() => {
    if (userRole && !checkingAuth) {
      loadUsers();
      loadCampuses();
      loadRegions();
    }
  }, [userRole, checkingAuth]);

  const checkAuthorization = async () => {
    try {
      const response = await fetch('/api/session', {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const role = data.role || 'member';
        
        // Only allow admin and leadership roles to access User Management
        const allowedRoles = ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'];
        
        if (!allowedRoles.includes(role)) {
          // Redirect unauthorized users to their profile
          console.warn('[UserManagement] Unauthorized access attempt by role:', role);
          navigate('/profile', { replace: true });
          return;
        }
        
        setUserRole(role);
        setCheckingAuth(false);
      } else {
        // Session failed - redirect to login
        navigate('/login', { replace: true });
      }
    } catch (err) {
      console.error('[UserManagement] Authorization check failed:', err);
      navigate('/profile', { replace: true });
    }
  };

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

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
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
    setFormData({
      username: '',
      password: '',
      full_name: '',
      email: '',
      role: 'staff',
      campus: 'all_campuses'
    });
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

  const getRoleBadgeColor = (role) => {
    const colors = {
      'superadmin': 'bg-red-600/20 text-red-300 border-red-600/30',
      'admin': 'bg-red-500/20 text-red-400 border-red-500/30',
      'senior_leadership': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'senior_leader': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'senior_pastor': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      'lead_pastor': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      'campus_pastor': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'pastor': 'bg-green-500/20 text-green-400 border-green-500/30',
      'finance': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'staff': 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    };
    return colors[role] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
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

  // Show loading while checking authorization
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <UserGroupIcon className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-pulse" />
          <div className="text-white text-xl">Checking authorization...</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-white text-xl">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 flex items-center">
                <UserGroupIcon className="w-8 h-8 sm:w-10 sm:h-10 mr-2 sm:mr-3 text-blue-500" />
                User Management
              </h1>
              <p className="text-slate-400 text-sm sm:text-base">Manage user accounts and permissions</p>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center justify-center px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm sm:text-base whitespace-nowrap"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Add User
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Mobile Scroll Hint */}
        <div className="lg:hidden mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-center">
          <p className="text-sm text-blue-300">
            👆 <strong>Swipe left/right</strong> to see all user details
          </p>
        </div>

        {/* Users Table */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Username</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Role</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Campus</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Region</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Last Login</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-12 text-center text-slate-400">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4 text-white font-medium">{user.full_name}</td>
                      <td className="px-6 py-4 text-slate-300">{user.username}</td>
                      <td className="px-6 py-4 text-slate-300">{user.email || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(user.role)}`}>
                          {getRoleDisplayName(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {user.campus === 'all_campuses' ? 'All Campuses' : user.campus}
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {user.region_id ? regions.find(r => r.id === user.region_id)?.display_name || 'Unknown' : 'Global'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${
                          user.active 
                            ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                            : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                        }`}>
                          {user.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-300 text-sm">
                        {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(user)}
                            title="Edit User"
                            className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                          >
                            <PencilIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            title="Delete User"
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
            <div className="text-slate-400 text-sm mb-1">Total Users</div>
            <div className="text-3xl font-bold text-white">{users.length}</div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
            <div className="text-slate-400 text-sm mb-1">Active Users</div>
            <div className="text-3xl font-bold text-green-400">
              {users.filter(u => u.active).length}
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
            <div className="text-slate-400 text-sm mb-1">Administrators</div>
            <div className="text-3xl font-bold text-red-400">
              {users.filter(u => u.role === 'superadmin' || u.role === 'admin').length}
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
            <div className="text-slate-400 text-sm mb-1">Campus Pastors</div>
            <div className="text-3xl font-bold text-blue-400">
              {users.filter(u => u.role === 'campus_pastor').length}
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800 z-10">
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors touch-manipulation"
              >
                <XMarkIcon className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Username <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="john.smith"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="John Smith"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email
                </label>
                <input
                  type="text"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="john.smith@futures.church"
                />
                {formData.email && formData.email.includes(' ') && (
                  <p className="mt-1 text-xs text-yellow-400">
                    Note: Email contains spaces. Standard email format uses dots instead (e.g., tony.corbridge@futures.church)
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Password {!editingUser && <span className="text-red-400">*</span>}
                  {editingUser && <span className="text-slate-500 text-xs ml-2">(leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="••••••••"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Role <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  {roles.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
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
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Region <span className="text-slate-500 text-xs ml-2">(optional - leave blank for global access)</span>
                </label>
                <select
                  value={formData.region_id || ''}
                  onChange={(e) => setFormData({ ...formData, region_id: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">All Regions (Global Access)</option>
                  {regions.filter(r => r.active).map(region => (
                    <option key={region.id} value={region.id}>
                      {region.display_name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  Regional users can only see data from their assigned region. Leave blank for superadmin/admin with global access.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 sm:px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors touch-manipulation text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 sm:px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors touch-manipulation text-sm sm:text-base font-medium"
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
