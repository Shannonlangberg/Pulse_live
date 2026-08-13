import React, { useState, useEffect } from 'react';
import { UserCircleIcon, KeyIcon, EnvelopeIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const MyProfile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const [emailData, setEmailData] = useState({
    email: ''
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
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
        if (data.authenticated) {
          setUser(data);
          setEmailData({ email: data.email || '' });
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    // Validation
    if (!passwordData.current_password) {
      setMessage({ type: 'error', text: 'Please enter your current password' });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      return;
    }

    if (!passwordData.new_password) {
      setMessage({ type: 'error', text: 'Please enter a new password' });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      return;
    }

    if (passwordData.new_password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      return;
    }

    if (passwordData.current_password === passwordData.new_password) {
      setMessage({ type: 'error', text: 'New password must be different from current password' });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          current_password: passwordData.current_password,
          new_password: passwordData.new_password
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: '✅ Password changed successfully! Your new password is now active.' });
        setPasswordData({
          current_password: '',
          new_password: '',
          confirm_password: ''
        });
        // Auto-dismiss success message after 5 seconds
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      } else {
        // Show specific error message from server
        const errorMsg = data.error || 'Failed to change password';
        setMessage({ type: 'error', text: errorMsg });
        // Auto-dismiss error after 8 seconds
        setTimeout(() => setMessage({ type: '', text: '' }), 8000);
      }
    } catch (err) {
      console.error('Password change error:', err);
      setMessage({ type: 'error', text: 'Network error: Unable to change password. Please try again.' });
      setTimeout(() => setMessage({ type: '', text: '' }), 8000);
    } finally {
      setSaving(false);
    }
  };

  const handleEmailUpdate = async (e) => {
    e.preventDefault();

    // Validation
    if (!emailData.email || !emailData.email.trim()) {
      setMessage({ type: 'error', text: 'Please enter an email address' });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      return;
    }

    if (!emailData.email.includes('@') || !emailData.email.includes('.')) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      return;
    }

    if (user && emailData.email === user.email) {
      setMessage({ type: 'error', text: 'This is already your current email address' });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/profile/update-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(emailData),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: '✅ Email updated successfully! Your new email is now active.' });
        loadProfile(); // Reload to get updated info
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      } else {
        const errorMsg = data.error || 'Failed to update email';
        setMessage({ type: 'error', text: errorMsg });
        setTimeout(() => setMessage({ type: '', text: '' }), 8000);
      }
    } catch (err) {
      console.error('Email update error:', err);
      setMessage({ type: 'error', text: 'Network error: Unable to update email. Please try again.' });
      setTimeout(() => setMessage({ type: '', text: '' }), 8000);
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-fc-cream p-6 flex items-center justify-center">
        <div className="text-fc-brown text-xl">Loading profile...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-fc-cream p-6 flex items-center justify-center">
        <div className="text-fc-copper text-xl">Failed to load profile</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fc-cream p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="fc-label mb-2">Account</p>
          <h1 className="fc-display fc-display-md flex items-center gap-3 text-fc-midnight">
            <UserCircleIcon className="w-9 h-9 text-fc-copper" />
            My Profile
          </h1>
          <p className="text-fc-brown mt-1">Manage your account settings</p>
        </div>

        {/* Message - Fixed at top for visibility */}
        {message.text && (
          <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-6 py-4 rounded-xl shadow-lg border-2 ${
            message.type === 'success'
              ? 'bg-white border-fc-olive text-fc-midnight'
              : 'bg-white border-fc-copper text-fc-midnight'
          }`} style={{ minWidth: '400px', maxWidth: '600px' }}>
            <div className="flex items-center justify-center text-lg font-semibold">
              {message.type === 'success' && <CheckCircleIcon className="w-7 h-7 mr-3 text-fc-olive" />}
              {message.type === 'error' && (
                <svg className="w-7 h-7 mr-3 text-fc-copper" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {message.text}
            </div>
          </div>
        )}

        {/* Profile Info */}
        <div className="fc-card p-6 mb-6">
          <h2 className="text-xl font-semibold text-fc-midnight mb-4">Account Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-fc-brown mb-1">Full Name</label>
              <div className="text-fc-midnight font-medium">{user.full_name || 'Not set'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-fc-brown mb-1">Username</label>
              <div className="text-fc-midnight font-medium">{user.username}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-fc-brown mb-1">Role</label>
              <div className="text-fc-midnight font-medium">{getRoleDisplayName(user.role)}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-fc-brown mb-1">Campus</label>
              <div className="text-fc-midnight font-medium">
                {user.campus === 'all_campuses' ? 'All Campuses' : user.campus}
              </div>
            </div>
          </div>
        </div>

        {/* Update Email */}
        <div className="fc-card p-6 mb-6">
          <h2 className="text-xl font-semibold text-fc-midnight mb-4 flex items-center">
            <EnvelopeIcon className="w-6 h-6 mr-2 text-fc-teal" />
            Email Address
          </h2>
          <form onSubmit={handleEmailUpdate}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-fc-brown mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={emailData.email}
                onChange={(e) => setEmailData({ email: e.target.value })}
                className="fc-input w-full"
                placeholder="your.email@futures.church"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="fc-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Updating...' : 'Update Email'}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="fc-card p-6">
          <h2 className="text-xl font-semibold text-fc-midnight mb-4 flex items-center">
            <KeyIcon className="w-6 h-6 mr-2 text-fc-teal" />
            Change Password
          </h2>
          <form onSubmit={handlePasswordChange}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-fc-brown mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                  className="fc-input w-full"
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-fc-brown mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  className="fc-input w-full"
                  placeholder="Enter new password (min 6 characters)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-fc-brown mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  className="fc-input w-full"
                  placeholder="Confirm new password"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="fc-btn-primary mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* Security Notice */}
        <div className="mt-6 bg-fc-wash-sky border border-fc-wash-sky-border rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-fc-teal" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-fc-midnight">Security Tips</h3>
              <div className="mt-2 text-sm text-fc-brown">
                <ul className="list-disc list-inside space-y-1">
                  <li>Use a strong password with at least 8 characters</li>
                  <li>Include uppercase, lowercase, numbers, and symbols</li>
                  <li>Don't share your password with anyone</li>
                  <li>Change your password regularly</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyProfile;
