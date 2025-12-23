import React, { useState, useEffect } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MegaphoneIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';

const HomepageManager = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [formData, setFormData] = useState({
    heading: '',
    message: '',
    region_code: 'AU',
    is_active: true,
    display_order: 0
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/homepage-messages/all', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (message = null) => {
    if (message) {
      setEditingMessage(message);
      setFormData({
        heading: message.heading,
        message: message.message,
        region_code: message.region_code,
        is_active: message.is_active,
        display_order: message.display_order
      });
    } else {
      setEditingMessage(null);
      setFormData({
        heading: '',
        message: '',
        region_code: 'AU',
        is_active: true,
        display_order: 0
      });
    }
    setShowModal(true);
    setError('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingMessage(null);
    setFormData({
      heading: '',
      message: '',
      region_code: 'AU',
      is_active: true,
      display_order: 0
    });
    setError('');
  };

  const handleSave = async () => {
    if (!formData.heading.trim() || !formData.message.trim()) {
      setError('Heading and message are required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const url = editingMessage
        ? `/api/homepage-messages/${editingMessage.id}`
        : '/api/homepage-messages';
      const method = editingMessage ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save message');
      }

      await fetchMessages();
      handleCloseModal();
    } catch (err) {
      console.error('Error saving message:', err);
      setError(err.message || 'Failed to save message');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      const response = await fetch(`/api/homepage-messages/${messageId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete message');
      }

      await fetchMessages();
    } catch (err) {
      console.error('Error deleting message:', err);
      alert('Failed to delete message');
    }
  };

  const handleToggleActive = async (message) => {
    try {
      const response = await fetch(`/api/homepage-messages/${message.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          is_active: !message.is_active
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update message');
      }

      await fetchMessages();
    } catch (err) {
      console.error('Error updating message:', err);
      alert('Failed to update message');
    }
  };

  const groupedMessages = messages.reduce((acc, msg) => {
    if (!acc[msg.region_code]) {
      acc[msg.region_code] = [];
    }
    acc[msg.region_code].push(msg);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center">
                <MegaphoneIcon className="h-6 w-6 text-blue-300" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Homepage Manager</h1>
                <p className="text-white/60">Manage messages displayed on the landing page</p>
              </div>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 px-4 py-2 rounded-xl transition-all"
            >
              <PlusIcon className="h-5 w-5" />
              New Message
            </button>
          </div>
        </div>

        {/* Messages by Region */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-white/60">Loading messages...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.keys(groupedMessages).length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                <MegaphoneIcon className="h-16 w-16 text-white/30 mx-auto mb-4" />
                <p className="text-white/60 text-lg">No messages yet. Create your first message!</p>
              </div>
            ) : (
              Object.entries(groupedMessages).map(([regionCode, regionMessages]) => (
                <div key={regionCode}>
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <span className="px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-lg text-blue-300">
                      {regionCode}
                    </span>
                    <span className="text-white/60 text-sm">
                      ({regionMessages.length} {regionMessages.length === 1 ? 'message' : 'messages'})
                    </span>
                  </h2>
                  <div className="grid gap-4">
                    {regionMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`bg-white/5 border rounded-2xl p-6 ${
                          msg.is_active ? 'border-white/10' : 'border-white/5 opacity-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold">{msg.heading}</h3>
                              {msg.is_active ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-400/30 rounded-lg text-green-300 text-xs">
                                  <CheckCircleIcon className="h-3 w-3" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/20 border border-gray-400/30 rounded-lg text-gray-300 text-xs">
                                  <XCircleIcon className="h-3 w-3" />
                                  Inactive
                                </span>
                              )}
                            </div>
                            <p className="text-white/70 whitespace-pre-wrap">{msg.message}</p>
                            <div className="mt-3 flex items-center gap-4 text-sm text-white/50">
                              <span>Order: {msg.display_order}</span>
                              <span>•</span>
                              <span>Created by: {msg.created_by || 'Unknown'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleActive(msg)}
                              className={`p-2 rounded-lg transition-colors ${
                                msg.is_active
                                  ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300'
                                  : 'bg-green-500/20 hover:bg-green-500/30 text-green-300'
                              }`}
                              title={msg.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {msg.is_active ? (
                                <XCircleIcon className="h-5 w-5" />
                              ) : (
                                <CheckCircleIcon className="h-5 w-5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleOpenModal(msg)}
                              className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(msg.id)}
                              className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-6">
                {editingMessage ? 'Edit Message' : 'New Message'}
              </h2>

              {error && (
                <div className="mb-4 bg-red-500/20 border border-red-400/30 text-red-300 rounded-xl p-3">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {/* Heading */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Heading *
                  </label>
                  <input
                    type="text"
                    value={formData.heading}
                    onChange={(e) => setFormData({ ...formData, heading: e.target.value })}
                    placeholder="e.g., Merry Christmas"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Message *
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="e.g., Don't forget this week we have xyz"
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Region */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Region
                  </label>
                  <select
                    value={formData.region_code}
                    onChange={(e) => setFormData({ ...formData, region_code: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="AU">Australia (AU)</option>
                    <option value="US">United States (US)</option>
                  </select>
                </div>

                {/* Display Order */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-white/50 mt-1">Lower numbers appear first</p>
                </div>

                {/* Active Status */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 rounded bg-white/5 border-white/10 text-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="text-sm text-white/80">
                    Active (visible on homepage)
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={handleCloseModal}
                  disabled={saving}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    editingMessage ? 'Update' : 'Create'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomepageManager;



