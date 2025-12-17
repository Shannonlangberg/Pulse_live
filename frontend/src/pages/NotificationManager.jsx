import React, { useState, useEffect } from 'react';
import { BellIcon, PaperAirplaneIcon, CalendarIcon, TrashIcon, XMarkIcon, ClockIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

const NotificationManager = () => {
  const [stats, setStats] = useState(null);
  const [scheduledNotifications, setScheduledNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSendModal, setShowSendModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [activeTab, setActiveTab] = useState('send'); // 'send' or 'scheduled'
  
  const [testForm, setTestForm] = useState({
    expo_push_token: '',
    title: 'Test Notification',
    body: 'This is a test notification from Futures PULSE'
  });
  
  const [sendForm, setSendForm] = useState({
    title: '',
    body: '',
    target_audience: 'all',
    target_campus: '',
    target_emails: [],
    target_role: ''
  });
  
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    body: '',
    scheduled_for: '',
    target_audience: 'all',
    target_campus: '',
    target_emails: [],
    target_role: ''
  });

  const [campuses, setCampuses] = useState([]);
  const [emailInput, setEmailInput] = useState('');

  useEffect(() => {
    loadStats();
    loadScheduledNotifications();
    loadCampuses();
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

  const loadStats = async () => {
    try {
      const response = await fetch('/api/notifications/stats', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadScheduledNotifications = async () => {
    try {
      const response = await fetch('/api/notifications/scheduled', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setScheduledNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Error loading scheduled notifications:', err);
    }
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(sendForm)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(`Notification sent successfully! ${data.sent_count} devices notified.`);
        setShowSendModal(false);
        setSendForm({
          title: '',
          body: '',
          target_audience: 'all',
          target_campus: '',
          target_emails: [],
          target_role: ''
        });
        loadStats();
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError(data.error || 'Failed to send notification');
      }
    } catch (err) {
      console.error('Error sending notification:', err);
      setError('Failed to send notification. Please try again.');
    }
  };

  const handleTestNotification = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!testForm.expo_push_token.trim()) {
      setError('Please enter an Expo push token');
      return;
    }

    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(testForm)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(`✅ Test notification sent successfully! Token: ${data.token}`);
        setShowTestModal(false);
        setTestForm({
          expo_push_token: '',
          title: 'Test Notification',
          body: 'This is a test notification from Futures PULSE'
        });
        setTimeout(() => setSuccess(''), 10000);
      } else {
        setError(data.error || 'Failed to send test notification');
        if (data.errors && data.errors.length > 0) {
          setError(data.error + ': ' + data.errors.join(', '));
        }
      }
    } catch (err) {
      console.error('Error sending test notification:', err);
      setError('Failed to send test notification. Please try again.');
    }
  };

  const handleScheduleNotification = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/notifications/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(scheduleForm)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess('Notification scheduled successfully!');
        setShowScheduleModal(false);
        setScheduleForm({
          title: '',
          body: '',
          scheduled_for: '',
          target_audience: 'all',
          target_campus: '',
          target_emails: [],
          target_role: ''
        });
        loadScheduledNotifications();
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError(data.error || 'Failed to schedule notification');
      }
    } catch (err) {
      console.error('Error scheduling notification:', err);
      setError('Failed to schedule notification. Please try again.');
    }
  };

  const handleCancelNotification = async (notificationId) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled notification?')) {
      return;
    }

    try {
      const response = await fetch(`/api/notifications/scheduled/${notificationId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess('Notification cancelled successfully!');
        loadScheduledNotifications();
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError(data.error || 'Failed to cancel notification');
      }
    } catch (err) {
      console.error('Error cancelling notification:', err);
      setError('Failed to cancel notification. Please try again.');
    }
  };

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (email && email.includes('@') && !sendForm.target_emails.includes(email)) {
      setSendForm({
        ...sendForm,
        target_emails: [...sendForm.target_emails, email]
      });
      setEmailInput('');
    }
  };

  const removeEmail = (email) => {
    setSendForm({
      ...sendForm,
      target_emails: sendForm.target_emails.filter(e => e !== email)
    });
  };

  const addEmailSchedule = () => {
    const email = emailInput.trim().toLowerCase();
    if (email && email.includes('@') && !scheduleForm.target_emails.includes(email)) {
      setScheduleForm({
        ...scheduleForm,
        target_emails: [...scheduleForm.target_emails, email]
      });
      setEmailInput('');
    }
  };

  const removeEmailSchedule = (email) => {
    setScheduleForm({
      ...scheduleForm,
      target_emails: scheduleForm.target_emails.filter(e => e !== email)
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded-lg text-xs">Pending</span>,
      sent: <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded-lg text-xs">Sent</span>,
      failed: <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded-lg text-xs">Failed</span>,
      cancelled: <span className="px-2 py-1 bg-gray-500/20 text-gray-300 rounded-lg text-xs">Cancelled</span>
    };
    return badges[status] || badges.pending;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white/70">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center">
            <BellIcon className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Push Notifications</h1>
            <p className="text-white/60 text-sm sm:text-base">Send and schedule push notifications to app users</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="text-white/60 text-sm mb-1">Active Devices</div>
            <div className="text-2xl font-bold text-white">{stats.total_active_tokens || 0}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="text-white/60 text-sm mb-1">Pending</div>
            <div className="text-2xl font-bold text-yellow-400">{stats.scheduled_pending || 0}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="text-white/60 text-sm mb-1">Sent</div>
            <div className="text-2xl font-bold text-green-400">{stats.scheduled_sent || 0}</div>
          </div>
        </div>
      )}

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-900/30 border border-red-500/40 text-red-200 rounded-xl px-4 py-3">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-900/30 border border-green-500/40 text-green-200 rounded-xl px-4 py-3">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700/50 items-center">
        <button
          onClick={() => setActiveTab('send')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'send'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-white/60 hover:text-white'
          }`}
        >
          Send Now
        </button>
        <button
          onClick={() => setActiveTab('scheduled')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'scheduled'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-white/60 hover:text-white'
          }`}
        >
          Scheduled ({scheduledNotifications.filter(n => n.status === 'pending').length})
        </button>
        <button
          onClick={() => setShowTestModal(true)}
          className="ml-auto px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm font-medium"
        >
          🧪 Test
        </button>
      </div>

      {/* Send Now Tab */}
      {activeTab === 'send' && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <form onSubmit={handleSendNotification} className="space-y-6">
            <div>
              <label className="block text-white/90 text-sm font-medium mb-2">Title</label>
              <input
                type="text"
                value={sendForm.title}
                onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                placeholder="Notification title"
              />
            </div>

            <div>
              <label className="block text-white/90 text-sm font-medium mb-2">Message</label>
              <textarea
                value={sendForm.body}
                onChange={(e) => setSendForm({ ...sendForm, body: e.target.value })}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24"
                required
                placeholder="Notification message"
              />
            </div>

            <div>
              <label className="block text-white/90 text-sm font-medium mb-2">Target Audience</label>
              <select
                value={sendForm.target_audience}
                onChange={(e) => setSendForm({ ...sendForm, target_audience: e.target.value, target_campus: '', target_emails: [] })}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Users</option>
                <option value="specific_campus">Specific Campus</option>
                <option value="specific_users">Specific Users</option>
              </select>
            </div>

            {sendForm.target_audience === 'specific_campus' && (
              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Campus</label>
                <select
                  value={sendForm.target_campus}
                  onChange={(e) => setSendForm({ ...sendForm, target_campus: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Select Campus</option>
                  {campuses.map(campus => (
                    <option key={campus.id} value={campus.id}>{campus.name}</option>
                  ))}
                </select>
              </div>
            )}

            {sendForm.target_audience === 'specific_users' && (
              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">User Emails</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                    className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="user@example.com"
                  />
                  <button
                    type="button"
                    onClick={addEmail}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Add
                  </button>
                </div>
                {sendForm.target_emails.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {sendForm.target_emails.map(email => (
                      <span key={email} className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg text-sm flex items-center gap-2">
                        {email}
                        <button
                          type="button"
                          onClick={() => removeEmail(email)}
                          className="hover:text-red-400"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
              Send Notification Now
            </button>
          </form>
        </div>
      )}

      {/* Scheduled Tab */}
      {activeTab === 'scheduled' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Scheduled Notifications</h2>
            <button
              onClick={() => {
                setScheduleForm({
                  title: '',
                  body: '',
                  scheduled_for: '',
                  target_audience: 'all',
                  target_campus: '',
                  target_emails: [],
                  target_role: ''
                });
                setShowScheduleModal(true);
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              <CalendarIcon className="h-5 w-5" />
              Schedule New
            </button>
          </div>

          {scheduledNotifications.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-12 text-center">
              <ClockIcon className="h-12 w-12 text-white/30 mx-auto mb-4" />
              <p className="text-white/60">No scheduled notifications yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduledNotifications.map(notification => (
                <div key={notification.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-white font-semibold">{notification.title}</h3>
                        {getStatusBadge(notification.status)}
                      </div>
                      <p className="text-white/70 text-sm mb-2">{notification.body}</p>
                      <div className="flex items-center gap-4 text-xs text-white/50">
                        <span>Scheduled: {new Date(notification.scheduled_for).toLocaleString()}</span>
                        {notification.sent_at && (
                          <span>Sent: {new Date(notification.sent_at).toLocaleString()}</span>
                        )}
                        {notification.sent_count > 0 && (
                          <span className="text-green-400">✓ {notification.sent_count} sent</span>
                        )}
                        {notification.failed_count > 0 && (
                          <span className="text-red-400">✗ {notification.failed_count} failed</span>
                        )}
                      </div>
                    </div>
                    {notification.status === 'pending' && (
                      <button
                        onClick={() => handleCancelNotification(notification.id)}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Schedule Notification</h2>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-2 text-white/60 hover:text-white"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleScheduleNotification} className="space-y-6">
              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  value={scheduleForm.title}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Message</label>
                <textarea
                  value={scheduleForm.body}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, body: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24"
                  required
                />
              </div>

              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Schedule For</label>
                <input
                  type="datetime-local"
                  value={scheduleForm.scheduled_for}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_for: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Target Audience</label>
                <select
                  value={scheduleForm.target_audience}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, target_audience: e.target.value, target_campus: '', target_emails: [] })}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Users</option>
                  <option value="specific_campus">Specific Campus</option>
                  <option value="specific_users">Specific Users</option>
                </select>
              </div>

              {scheduleForm.target_audience === 'specific_campus' && (
                <div>
                  <label className="block text-white/90 text-sm font-medium mb-2">Campus</label>
                  <select
                    value={scheduleForm.target_campus}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, target_campus: e.target.value })}
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Select Campus</option>
                    {campuses.map(campus => (
                      <option key={campus.id} value={campus.id}>{campus.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {scheduleForm.target_audience === 'specific_users' && (
                <div>
                  <label className="block text-white/90 text-sm font-medium mb-2">User Emails</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addEmailSchedule())}
                      className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="user@example.com"
                    />
                    <button
                      type="button"
                      onClick={addEmailSchedule}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      Add
                    </button>
                  </div>
                  {scheduleForm.target_emails.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {scheduleForm.target_emails.map(email => (
                        <span key={email} className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg text-sm flex items-center gap-2">
                          {email}
                          <button
                            type="button"
                            onClick={() => removeEmailSchedule(email)}
                            className="hover:text-red-400"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Schedule Notification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Notification Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">🧪 Test Notification</h2>
              <button
                onClick={() => setShowTestModal(false)}
                className="p-2 text-white/60 hover:text-white"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-blue-900/30 border border-blue-500/40 rounded-lg text-sm text-blue-200">
              <p className="font-semibold mb-2">How to get a test push token:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                <li>Open the mobile app on a physical device</li>
                <li>Go to Profile → Settings</li>
                <li>Enable "Push Notifications" toggle</li>
                <li>Grant permission when prompted</li>
                <li>Token will be registered automatically</li>
              </ol>
              <p className="mt-3 text-xs text-blue-300 italic">
                Or check the app console logs for the Expo push token
              </p>
            </div>

            <form onSubmit={handleTestNotification} className="space-y-6">
              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">
                  Expo Push Token
                </label>
                <input
                  type="text"
                  value={testForm.expo_push_token}
                  onChange={(e) => setTestForm({ ...testForm, expo_push_token: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                  placeholder="ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
                />
                <p className="mt-1 text-xs text-white/50">
                  Paste the full Expo push token (starts with ExponentPushToken[...])
                </p>
              </div>

              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  value={testForm.title}
                  onChange={(e) => setTestForm({ ...testForm, title: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Message</label>
                <textarea
                  value={testForm.body}
                  onChange={(e) => setTestForm({ ...testForm, body: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 h-24"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  🧪 Send Test
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationManager;

