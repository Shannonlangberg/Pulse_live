import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
  const [regions, setRegions] = useState([]);
  const [expandedUsers, setExpandedUsers] = useState({}); // { userId: true/false } for campus selection
  const [userRole, setUserRole] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

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

  // Settings/Admin pages (not part of main navigation)
  const settingsFeatures = [
    { key: 'user_management', label: 'Users', icon: '👤', description: 'User management page' },
    { key: 'user_management', label: 'Role Manager', icon: '🛡️', description: 'Role & permissions matrix' },
    { key: 'database_viewer', label: 'Database Viewer', icon: '🗄️', description: 'View attendance records database' },
    { key: 'homepage_manager', label: 'Homepage Manager', icon: '📢', description: 'Homepage announcements' },
    { key: 'campus_management', label: 'Campuses', icon: '🏢', description: 'Campus management' },
    { key: 'beacon_management', label: 'Beacons', icon: '📡', description: 'Bluetooth beacons' },
    { key: 'resource_manager', label: 'Resource Manager', icon: '📦', description: 'Team resources' },
    { key: 'tv_manager', label: 'TV Manager', icon: '🎬', description: 'Pulse TV content' },
    { key: 'events_manager', label: 'Events Manager', icon: '🎪', description: 'Events admin' },
    { key: 'notifications', label: 'Notifications', icon: '🔔', description: 'Push notifications' },
    { key: 'data_export', label: 'Data Export', icon: '📥', description: 'Export data' },
    { key: 'region_access', label: 'Region Access', icon: '🌍', description: 'Regional settings' },
    { key: 'pathway_manager', label: 'Journey Manager', icon: '🛤️', description: 'Discipleship pathways' }
  ];

  const allFeatures = [...allPageFeatures, ...settingsFeatures];

  // Role default permissions mapping (based on MainLayout navigation roles)
  const roleDefaults = {
    'superadmin': {
      // All pages accessible
      home: true, dashboard: true, input: true, finance: true, giving: true,
      people: true, heartbeat: true, connect_groups: true, prayer: true,
      resources: true, pulse_tv: true, events: true, serving: true,
      communication: true, devotions: true,
      // All settings accessible
      data_export: true, user_management: true, campus_management: true,
      region_access: true, homepage_manager: true, beacon_management: true, 
      pathway_manager: true, resource_manager: true,
      tv_manager: true, events_manager: true, notifications: true
    },
    'admin': {
      // All pages accessible
      home: true, dashboard: true, input: true, finance: true, giving: true,
      people: true, heartbeat: true, connect_groups: true, prayer: true,
      resources: true, pulse_tv: true, events: true, serving: true,
      communication: true, devotions: true,
      // All settings accessible
      data_export: true, user_management: true, campus_management: true,
      region_access: true, homepage_manager: true, beacon_management: true, 
      pathway_manager: true, resource_manager: true,
      tv_manager: true, events_manager: true, notifications: true
    },
    'senior_leadership': {
      // All pages accessible
      home: true, dashboard: true, input: true, finance: true, giving: true,
      people: true, heartbeat: true, connect_groups: true, prayer: true,
      resources: true, pulse_tv: true, events: true, serving: true,
      communication: true, devotions: true,
      // Most settings accessible (not homepage_manager)
      data_export: true, user_management: true, campus_management: true,
      region_access: true, beacon_management: true, pathway_manager: true, 
      resource_manager: true, homepage_manager: false,
      tv_manager: true, events_manager: true, notifications: true
    },
    'senior_leader': {
      // All pages accessible
      home: true, dashboard: true, input: true, finance: true, giving: true,
      people: true, heartbeat: true, connect_groups: true, prayer: true,
      resources: true, pulse_tv: true, events: true, serving: true,
      communication: true, devotions: true,
      // Most settings accessible (not homepage_manager)
      data_export: true, user_management: true, campus_management: true,
      region_access: true, beacon_management: true, pathway_manager: true, 
      resource_manager: true, homepage_manager: false,
      tv_manager: true, events_manager: true, notifications: true
    },
    'senior_pastor': {
      // All pages accessible
      home: true, dashboard: true, input: true, finance: true, giving: true,
      people: true, heartbeat: true, connect_groups: true, prayer: true,
      resources: true, pulse_tv: true, events: true, serving: true,
      communication: true, devotions: true,
      // All settings accessible
      data_export: true, user_management: true, campus_management: true,
      region_access: true, beacon_management: true, pathway_manager: true, 
      resource_manager: true, homepage_manager: true,
      tv_manager: true, events_manager: true, notifications: true
    },
    'lead_pastor': {
      // All pages accessible
      home: true, dashboard: true, input: true, finance: true, giving: true,
      people: true, heartbeat: true, connect_groups: true, prayer: true,
      resources: true, pulse_tv: true, events: true, serving: true,
      communication: true, devotions: true,
      // All settings accessible
      data_export: true, user_management: true, campus_management: true,
      region_access: true, beacon_management: true, pathway_manager: true, 
      resource_manager: true, homepage_manager: true,
      tv_manager: true, events_manager: true, notifications: true
    },
    'campus_pastor': {
      // Pages they CAN see
      home: true, dashboard: true, input: true, 
      people: true, heartbeat: true, connect_groups: true, prayer: true,
      resources: true, pulse_tv: true, events: true, serving: true,
      communication: true, devotions: true,
      // Pages they CANNOT see
      finance: false, giving: false,
      // Settings pages they CANNOT see (only My Profile)
      data_export: false, user_management: false, campus_management: false,
      region_access: false, homepage_manager: false, beacon_management: false, 
      pathway_manager: false, resource_manager: false,
      tv_manager: false, events_manager: false, notifications: false
    },
    'pastor': {
      // Limited page access
      home: true, dashboard: true, input: true,
      people: false, heartbeat: false, connect_groups: false, prayer: true,
      resources: false, pulse_tv: true, events: true, serving: true,
      communication: false, devotions: true,
      finance: false, giving: false,
      // No settings access (only My Profile)
      data_export: false, user_management: false, campus_management: false,
      region_access: false, beacon_management: false, pathway_manager: false, 
      resource_manager: false, homepage_manager: false,
      tv_manager: false, events_manager: false, notifications: false
    },
    'finance': {
      // Finance-specific access
      home: true, finance: true, giving: true, resources: true,
      // Limited other access
      dashboard: false, input: false,
      people: false, heartbeat: false, connect_groups: false, prayer: false,
      pulse_tv: false, events: false, serving: false,
      communication: false, devotions: false,
      // No settings access (only My Profile)
      data_export: false, user_management: false, campus_management: false,
      region_access: false, beacon_management: false, pathway_manager: false, 
      resource_manager: false, homepage_manager: false,
      tv_manager: false, events_manager: false, notifications: false
    },
    'staff': {
      // Minimal access - Home and Resources only
      home: true, resources: true,
      dashboard: false, input: false, finance: false, giving: false,
      people: false, heartbeat: false, connect_groups: false, prayer: false,
      pulse_tv: false, events: false, serving: false,
      communication: false, devotions: false,
      // No settings access (only My Profile)
      data_export: false, user_management: false, campus_management: false,
      region_access: false, beacon_management: false, pathway_manager: false, 
      resource_manager: false, homepage_manager: false,
      tv_manager: false, events_manager: false, notifications: false
    },
    'connect_group_leader': {
      // Limited access - home, groups, events
      home: true, connect_groups: true, pulse_tv: true, events: true,
      dashboard: false, input: false, finance: false, giving: false,
      people: false, heartbeat: false, prayer: false,
      resources: false, serving: false,
      communication: false, devotions: false,
      // No settings access (only My Profile)
      data_export: false, user_management: false, campus_management: false,
      region_access: false, beacon_management: false, pathway_manager: false, 
      resource_manager: false, homepage_manager: false,
      tv_manager: false, events_manager: false, notifications: false
    },
    'member': {
      // Basic member access
      home: true, dashboard: true, input: true, pulse_tv: true, events: true, devotions: true,
      finance: false, giving: false,
      people: false, heartbeat: false, connect_groups: false, prayer: false,
      resources: false, serving: false,
      communication: false,
      // No settings access (only My Profile)
      data_export: false, user_management: false, campus_management: false,
      region_access: false, beacon_management: false, pathway_manager: false, 
      resource_manager: false, homepage_manager: false,
      tv_manager: false, events_manager: false, notifications: false
    },
    'user': {
      // Alias for member - same defaults (used in nav roles)
      home: true, dashboard: true, input: true, pulse_tv: true, events: true, devotions: true,
      finance: false, giving: false,
      people: false, heartbeat: false, connect_groups: false, prayer: false,
      resources: false, serving: false,
      communication: false,
      data_export: false, user_management: false, campus_management: false,
      region_access: false, beacon_management: false, pathway_manager: false,
      resource_manager: false, homepage_manager: false,
      tv_manager: false, events_manager: false, notifications: false
    }
  };

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
        
        // Only allow admin and leadership roles to access Role Manager
        const allowedRoles = ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'];
        
        if (!allowedRoles.includes(role)) {
          // Redirect unauthorized users to their profile
          console.warn('[RoleManager] Unauthorized access attempt by role:', role);
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
      console.error('[RoleManager] Authorization check failed:', err);
      navigate('/profile', { replace: true });
    }
  };

  const loadRegions = async () => {
    try {
      const response = await fetch('/api/v2/regions', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        const regionsList = data.regions || [];
        setRegions(regionsList);
        console.log('[RoleManager] Loaded regions:', regionsList.length, regionsList);
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
        // Ensure custom_permissions is always an object, not null or undefined
        let userPerms = user.custom_permissions;
        if (!userPerms || typeof userPerms !== 'object') {
          userPerms = {};
        }
        // Handle if it's a string (shouldn't happen but be safe)
        if (typeof userPerms === 'string') {
          try {
            userPerms = JSON.parse(userPerms);
          } catch {
            userPerms = {};
          }
        }
        perms[user.id] = userPerms;
        original[user.id] = JSON.parse(JSON.stringify(userPerms));
        console.log(`[RoleManager] Loaded permissions for ${user.full_name || user.username}:`, userPerms);
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
      
      // Get the effective current value (custom permission or role default)
      const effectiveValue = getPermissionValue(userId, feature);
      
      // If there's already a custom permission set, toggle it
      // If not, we need to set the opposite of the role default
      const hasCustomPermission = newPerms[userId].hasOwnProperty(feature);
      
      if (hasCustomPermission) {
        // Toggle existing custom permission
        newPerms[userId][feature] = !effectiveValue;
      } else {
        // Set custom permission to opposite of role default
        newPerms[userId][feature] = !effectiveValue;
      }
      
      // If setting to the same as role default, remove the custom permission
      const user = users.find(u => u.id === userId);
      const roleDefault = user && roleDefaults[user.role] ? roleDefaults[user.role][feature] === true : false;
      if (newPerms[userId][feature] === roleDefault) {
        delete newPerms[userId][feature];
        // Clean up empty objects
        if (Object.keys(newPerms[userId]).length === 0) {
          delete newPerms[userId];
        }
      }
      
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
          console.log(`[RoleManager] Saving permissions for ${user.full_name || user.username}:`, userPerms);
          
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
          
          const result = await response.json();
          console.log(`[RoleManager] Successfully saved permissions for ${user.full_name || user.username}:`, result);
        }
      });

      await Promise.all(savePromises);

      // Reload users to get the latest permissions from database
      console.log('[RoleManager] Reloading users after save...');
      await loadUsers();
      
      // Update original permissions to match what was just saved
      setOriginalPermissions(JSON.parse(JSON.stringify(permissions)));
      setHasChanges(false);
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

  // Show loading while checking authorization
  if (checkingAuth) {
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
                <p>• <strong>Main Pages</strong>: Core app navigation pages (Home, Dashboard, People, etc.)</p>
                <p>• <strong>Settings Sub-Pages</strong>: Admin tools visible in Settings section (Users, Role Manager, Campuses, etc.)</p>
                <p>• <strong>Toggle any cell</strong> to grant or revoke access for a specific user - overrides their role defaults</p>
                <p>• <strong>Blue dot</strong> indicates a custom permission override</p>
                <p className="pt-2 text-yellow-300">⚠️ <strong>IMPORTANT:</strong> After saving, users must refresh their browser (Cmd/Ctrl + Shift + R) to see changes!</p>
                <p className="text-blue-300"><strong>Note:</strong> Campus Pastors should typically only see "My Profile" in Settings by default.</p>
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
                  <th className="px-4 py-4 text-left text-sm font-semibold text-slate-300 sticky left-0 bg-slate-700/50 z-20 min-w-[200px]">
                    User
                  </th>
                  {/* Page Features Headers by Group */}
                  {Object.entries(pageFeatures).map(([groupKey, group]) => (
                  <th 
                      key={groupKey}
                      colSpan={group.items.length} 
                    className="px-4 py-3 text-center text-xs font-semibold text-slate-300 bg-gradient-to-r from-blue-600/20 to-blue-500/20 border-l border-r border-slate-600"
                  >
                      📱 {group.name}
                  </th>
                  ))}
                  {/* Settings Features Header */}
                  <th 
                    colSpan={settingsFeatures.length} 
                    className="px-4 py-3 text-center text-xs font-semibold text-slate-300 bg-gradient-to-r from-purple-600/20 to-purple-500/20 border-r border-slate-600"
                  >
                    ⚙️ Settings Sub-Pages
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
                      {/* Campus and Region Selection Row */}
                      {expandedUsers[user.id] && (
                        <tr key={`${user.id}-campuses`} className="bg-slate-750/30">
                          <td colSpan={allFeatures.length + 1} className="px-3 sm:px-4 py-4">
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
                                                  const newPerms = { ...prev };
                                                  if (!newPerms[user.id]) newPerms[user.id] = {};
                                                  delete newPerms[user.id].allowed_campuses;
                                                  if (Object.keys(newPerms[user.id]).length === 0) delete newPerms[user.id];
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

