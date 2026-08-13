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
    <div className="min-h-screen bg-fc-cream p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-fc-wash-violet flex items-center justify-center">
                <MegaphoneIcon className="h-6 w-6 text-fc-violet" />
              </div>
              <div>
                <p className="fc-label mb-1">Homepage</p>
                <h1 className="fc-display fc-display-md text-fc-midnight">Homepage Manager</h1>
                <p className="text-fc-brown mt-1">Manage messages displayed on the landing page</p>
              </div>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="fc-btn-primary flex items-center gap-2"
            >
              <PlusIcon className="h-5 w-5" />
              New Message
            </button>
          </div>
        </div>

        {/* Messages by Region */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fc-copper mx-auto"></div>
            <p className="mt-4 text-fc-brown">Loading messages...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.keys(groupedMessages).length === 0 ? (
              <div className="fc-card p-12 text-center">
                <MegaphoneIcon className="h-16 w-16 text-fc-thistle mx-auto mb-4" />
                <p className="text-fc-brown text-lg">No messages yet. Create your first message!</p>
              </div>
            ) : (
              Object.entries(groupedMessages).map(([regionCode, regionMessages]) => (
                <div key={regionCode}>
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-fc-midnight">
                    <span className="px-3 py-1 bg-fc-wash-violet border border-fc-wash-violet-border rounded-lg text-fc-violet text-sm">
                      {regionCode}
                    </span>
                    <span className="text-fc-brown text-sm">
                      ({regionMessages.length} {regionMessages.length === 1 ? 'message' : 'messages'})
                    </span>
                  </h2>
                  <div className="grid gap-4">
                    {regionMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`fc-card p-6 ${
                          msg.is_active ? '' : 'opacity-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-[200px]">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="text-lg font-semibold text-fc-midnight">{msg.heading}</h3>
                              {msg.is_active ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-fc-wash-mint border border-fc-wash-mint-border rounded-lg text-fc-olive text-xs">
                                  <CheckCircleIcon className="h-3 w-3" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-fc-cream2 border border-fc-cream2 rounded-lg text-fc-brown text-xs">
                                  <XCircleIcon className="h-3 w-3" />
                                  Inactive
                                </span>
                              )}
                            </div>
                            <p className="text-fc-brown whitespace-pre-wrap">{msg.message}</p>
                            <div className="mt-3 flex items-center gap-4 text-sm text-fc-brown/70">
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
                                  ? 'bg-fc-wash-butter hover:bg-fc-wash-butter/70 text-fc-gold'
                                  : 'bg-fc-wash-mint hover:bg-fc-wash-mint/70 text-fc-olive'
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
                              className="p-2 bg-fc-wash-sky hover:bg-fc-wash-sky/70 text-fc-teal rounded-lg transition-colors"
                              title="Edit"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(msg.id)}
                              className="p-2 bg-fc-wash-peach hover:bg-fc-wash-peach/70 text-fc-copper rounded-lg transition-colors"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white border border-fc-cream2 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-lg">
              <h2 className="fc-display fc-display-sm text-fc-midnight mb-6">
                {editingMessage ? 'Edit Message' : 'New Message'}
              </h2>

              {error && (
                <div className="mb-4 bg-fc-wash-peach border border-fc-wash-peach-border text-fc-copper rounded-xl p-3">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {/* Heading */}
                <div>
                  <label className="block text-sm font-medium text-fc-brown mb-2">
                    Heading *
                  </label>
                  <input
                    type="text"
                    value={formData.heading}
                    onChange={(e) => setFormData({ ...formData, heading: e.target.value })}
                    placeholder="e.g., Merry Christmas"
                    className="fc-input w-full"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-fc-brown mb-2">
                    Message *
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="e.g., Don't forget this week we have xyz"
                    rows={4}
                    className="fc-input w-full"
                  />
                </div>

                {/* Region */}
                <div>
                  <label className="block text-sm font-medium text-fc-brown mb-2">
                    Region
                  </label>
                  <select
                    value={formData.region_code}
                    onChange={(e) => setFormData({ ...formData, region_code: e.target.value })}
                    className="fc-input w-full"
                  >
                    <option value="AU">Australia (AU)</option>
                    <option value="US">United States (US)</option>
                  </select>
                </div>

                {/* Display Order */}
                <div>
                  <label className="block text-sm font-medium text-fc-brown mb-2">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                    className="fc-input w-full"
                  />
                  <p className="text-xs text-fc-brown/70 mt-1">Lower numbers appear first</p>
                </div>

                {/* Active Status */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 rounded border-fc-cream2 text-fc-olive focus:ring-2 focus:ring-fc-olive"
                  />
                  <label htmlFor="is_active" className="text-sm text-fc-brown">
                    Active (visible on homepage)
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={handleCloseModal}
                  disabled={saving}
                  className="fc-btn-secondary disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="fc-btn-primary disabled:opacity-50 flex items-center gap-2"
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
