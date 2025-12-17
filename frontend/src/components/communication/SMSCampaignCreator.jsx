import React, { useState, useEffect } from 'react';
import {
  DevicePhoneMobileIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  XMarkIcon,
  ClockIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';

const SMSCampaignCreator = ({ onSave, onCancel, existingCampaign }) => {
  const [formData, setFormData] = useState({
    name: '',
    to: [],
    from: 'FUTURES',
    message: '',
    trackLink: false,
    template: 'New Template',
    schedule: false,
    scheduledAt: ''
  });
  const [senderIds, setSenderIds] = useState([]);
  const [contactLists, setContactLists] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSenderDropdown, setShowSenderDropdown] = useState(false);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [smsCount, setSmsCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testStatus, setTestStatus] = useState(null); // { type: 'success' | 'error', message: string }
  const [showAddSenderModal, setShowAddSenderModal] = useState(false);
  const [newSenderKey, setNewSenderKey] = useState('');
  const [newSenderId, setNewSenderId] = useState('');
  const [senderLoading, setSenderLoading] = useState(false);
  const [senderError, setSenderError] = useState('');

  useEffect(() => {
    fetchSenderIds();
    fetchContactLists();
    if (existingCampaign) {
      setFormData({
        name: existingCampaign.name || '',
        to: existingCampaign.target_criteria?.to || [],
        from: existingCampaign.target_criteria?.sender_id || 'FUTURES',
        message: existingCampaign.content || '',
        trackLink: existingCampaign.target_criteria?.track_link || false,
        template: existingCampaign.template || 'New Template',
        schedule: !!existingCampaign.scheduled_at,
        scheduledAt: existingCampaign.scheduled_at ? new Date(existingCampaign.scheduled_at).toISOString().slice(0, 16) : ''
      });
    }
  }, [existingCampaign]);

  useEffect(() => {
    const count = formData.message.length;
    setCharCount(count);
    // SMS messages are typically 160 characters per segment
    setSmsCount(Math.ceil(count / 160));
  }, [formData.message]);

  const fetchSenderIds = async () => {
    try {
      const response = await fetch('/api/communication/sms/sender-ids', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSenderIds(Object.entries(data.sender_ids || {}).map(([key, value]) => ({ key, value })));
      }
    } catch (error) {
      console.error('Error fetching sender IDs:', error);
    }
  };

  const handleAddSenderId = async () => {
    if (!newSenderKey.trim() || !newSenderId.trim()) {
      setSenderError('Both key and sender ID are required');
      return;
    }

    // Validate sender ID format (alphanumeric, max 11 characters)
    if (!/^[A-Z0-9]+$/.test(newSenderId) || newSenderId.length > 11) {
      setSenderError('Sender ID must be alphanumeric and max 11 characters (e.g., FUTURES)');
      return;
    }

    setSenderLoading(true);
    setSenderError('');

    try {
      const response = await fetch('/api/communication/sms/sender-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          key: newSenderKey.trim().toLowerCase().replace(/\s+/g, '_'),
          sender_id: newSenderId.trim().toUpperCase()
        })
      });

      const data = await response.json();
      if (data.success) {
        // Refresh sender IDs list
        await fetchSenderIds();
        // Set the new sender ID as selected
        setFormData(prev => ({ ...prev, from: newSenderId.trim().toUpperCase() }));
        // Close modal and reset form
        setShowAddSenderModal(false);
        setNewSenderKey('');
        setNewSenderId('');
        setSenderError('');
      } else {
        setSenderError(data.error || 'Failed to add sender ID');
      }
    } catch (error) {
      console.error('Error adding sender ID:', error);
      setSenderError('Error adding sender ID. Please try again.');
    } finally {
      setSenderLoading(false);
    }
  };

  const fetchContactLists = async () => {
    try {
      // This would fetch from your contact lists API
      // For now, using sample data
      setContactLists([
        { id: '1', name: 'All Members', count: 1250 },
        { id: '2', name: 'Paradise Campus', count: 450 },
        { id: '3', name: 'South Campus', count: 320 },
        { id: '4', name: 'Youth Group', count: 180 },
        { id: '5', name: 'Kids Ministry', count: 95 }
      ]);
    } catch (error) {
      console.error('Error fetching contact lists:', error);
    }
  };

  const handleMessageChange = (e) => {
    setFormData(prev => ({ ...prev, message: e.target.value }));
  };

  const handlePersonalization = (variable) => {
    setFormData(prev => ({
      ...prev,
      message: prev.message + variable
    }));
  };

  const handleSendTest = async () => {
    if (!testPhoneNumber.trim()) {
      setTestStatus({ type: 'error', message: 'Please enter a phone number' });
      return;
    }

    if (!formData.message.trim()) {
      setTestStatus({ type: 'error', message: 'Please enter a message first' });
      return;
    }

    // Validate phone number format (basic check)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const cleanedPhone = testPhoneNumber.replace(/[\s\-\(\)]/g, '');
    if (!phoneRegex.test(cleanedPhone)) {
      setTestStatus({ type: 'error', message: 'Please enter a valid phone number (e.g., +15076328065)' });
      return;
    }

    setTestLoading(true);
    setTestStatus(null);

    try {
      const response = await fetch('/api/communication/sms/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          to_phone: cleanedPhone.startsWith('+') ? cleanedPhone : `+${cleanedPhone}`,
          message: formData.message
        })
      });

      const data = await response.json();
      if (data.success) {
        setTestStatus({ 
          type: 'success', 
          message: `Test SMS sent successfully! Message SID: ${data.message_sid || 'N/A'}` 
        });
        // Clear status after 5 seconds
        setTimeout(() => setTestStatus(null), 5000);
      } else {
        let errorMessage = data.error || 'Failed to send test SMS';
        
        // Check if it's a trial account restriction
        if (errorMessage.includes('unverified') || errorMessage.includes('Trial Account')) {
          errorMessage = (
            <div>
              <p className="font-semibold mb-2">Trial Account Restriction</p>
              <p className="mb-2">Your Twilio account is in trial mode. Even verified numbers may have restrictions.</p>
              <p className="mb-2">To send SMS to all numbers, upgrade your account:</p>
              <a 
                href={data.help_url || "https://www.twilio.com/console/billing/upgrade"} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Upgrade Twilio Account →
              </a>
            </div>
          );
        }
        
        setTestStatus({ 
          type: 'error', 
          message: errorMessage
        });
      }
    } catch (error) {
      console.error('Error sending test SMS:', error);
      setTestStatus({ 
        type: 'error', 
        message: 'Error sending test SMS. Please check your connection.' 
      });
    } finally {
      setTestLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const campaignData = {
        name: formData.name,
        campaign_type: 'sms',
        content: formData.message,
        target_criteria: {
          to: formData.to,
          sender_id: formData.from,
          track_link: formData.trackLink
        },
        scheduled_at: formData.schedule && formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : undefined
      };

      const response = await fetch('/api/communication/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(campaignData)
      });

      const data = await response.json();
      if (data.success) {
        onSave(data.campaign);
      } else {
        alert('Error: ' + (data.error || 'Failed to create campaign'));
      }
    } catch (error) {
      console.error('Error creating SMS campaign:', error);
      alert('Error creating campaign');
    } finally {
      setLoading(false);
    }
  };

  const filteredContactLists = contactLists.filter(list =>
    list.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
      {/* Left: Form */}
      <div className="space-y-6">
        {/* To Field */}
        <div>
          <label className="block text-white/80 text-sm font-semibold mb-2">
            To*
          </label>
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  placeholder="Search Contact Lists"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setShowContactDropdown(true)}
                  className="w-full pl-10 pr-10 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/10 transition-all"
                />
                <FunnelIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40 cursor-pointer" />
              </div>
            </div>
            {showContactDropdown && (
              <div className="absolute z-10 w-full mt-2 bg-slate-800 border border-white/10 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                {filteredContactLists.map(list => (
                  <div
                    key={list.id}
                    onClick={() => {
                      if (!formData.to.includes(list.id)) {
                        setFormData(prev => ({
                          ...prev,
                          to: [...prev.to, list.id]
                        }));
                      }
                      setShowContactDropdown(false);
                      setSearchTerm('');
                    }}
                    className="px-4 py-3 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-b-0"
                  >
                    <div className="text-white font-medium">{list.name}</div>
                    <div className="text-white/50 text-sm">{list.count} contacts</div>
                  </div>
                ))}
              </div>
            )}
            {formData.to.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.to.map(id => {
                  const list = contactLists.find(l => l.id === id);
                  return list ? (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm"
                    >
                      {list.name}
                      <button
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          to: prev.to.filter(t => t !== id)
                        }))}
                        className="hover:text-blue-100"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>
        </div>

        {/* From Field */}
        <div>
          <label className="block text-white/80 text-sm font-semibold mb-2">
            From*
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={formData.from}
                onChange={(e) => setFormData(prev => ({ ...prev, from: e.target.value }))}
                onFocus={() => setShowSenderDropdown(true)}
                placeholder="Search Senders"
                className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/10 transition-all"
              />
              {showSenderDropdown && (
                <div className="absolute z-10 w-full mt-2 bg-slate-800 border border-white/10 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                  {senderIds.map(sender => (
                    <div
                      key={sender.key}
                      onClick={() => {
                        setFormData(prev => ({ ...prev, from: sender.value }));
                        setShowSenderDropdown(false);
                      }}
                      className="px-4 py-3 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-b-0"
                    >
                      <div className="text-white font-medium">{sender.value}</div>
                      <div className="text-white/50 text-sm">{sender.key}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowAddSenderModal(true)}
              className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Add sender
            </button>
            <button
              type="button"
              className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold transition-colors"
            >
              Reply options
            </button>
          </div>
        </div>

        {/* Message Field */}
        <div>
          <label className="block text-white/80 text-sm font-semibold mb-2">
            Message*
          </label>
          <div className="mb-2">
            <span className="text-white/60 text-sm">Personalisation: </span>
            <button
              type="button"
              onClick={() => handlePersonalization('[Firstname]')}
              className="text-blue-400 hover:text-blue-300 text-sm mx-1"
            >
              [Firstname]
            </button>
            <button
              type="button"
              onClick={() => handlePersonalization('[Lastname]')}
              className="text-blue-400 hover:text-blue-300 text-sm mx-1"
            >
              [Lastname]
            </button>
            <button
              type="button"
              onClick={() => handlePersonalization('[Mobile]')}
              className="text-blue-400 hover:text-blue-300 text-sm mx-1"
            >
              [Mobile]
            </button>
          </div>
          <div className="relative">
            <textarea
              value={formData.message}
              onChange={handleMessageChange}
              placeholder="Opt-out reply STOP"
              rows="8"
              className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/10 transition-all resize-none"
            />
            <div className="absolute bottom-3 left-4 flex items-center gap-2">
              <span className="text-white/40 text-sm">😊</span>
            </div>
            <div className="absolute bottom-3 right-4 flex items-center gap-2">
              <span className="text-white/60 text-sm">{charCount}/612</span>
              <span className="px-2 py-1 bg-white/10 text-white/60 text-xs rounded-full">
                {smsCount} SMS
              </span>
            </div>
          </div>
        </div>

        {/* Track Link */}
        <div className="flex items-center justify-between">
          <label className="text-white/80 text-sm font-semibold">Track link</label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.trackLink}
              onChange={(e) => setFormData(prev => ({ ...prev, trackLink: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-white/20 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
          </label>
        </div>

        {/* Templates */}
        <div>
          <label className="block text-white/80 text-sm font-semibold mb-2">Templates</label>
          <div className="flex items-center gap-2">
            <select
              value={formData.template}
              onChange={(e) => setFormData(prev => ({ ...prev, template: e.target.value }))}
              className="flex-1 px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="New Template" className="bg-slate-800">New Template</option>
              <option value="Welcome" className="bg-slate-800">Welcome</option>
              <option value="Reminder" className="bg-slate-800">Reminder</option>
              <option value="Event" className="bg-slate-800">Event</option>
            </select>
            <button
              type="button"
              className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors"
            >
              Save
            </button>
          </div>
        </div>

        {/* Schedule Campaign */}
        <div className="flex items-center justify-between">
          <label className="text-white/80 text-sm font-semibold">Schedule campaign</label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.schedule}
              onChange={(e) => setFormData(prev => ({ ...prev, schedule: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-white/20 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
          </label>
        </div>

        {formData.schedule && (
          <div>
            <input
              type="datetime-local"
              value={formData.scheduledAt}
              onChange={(e) => setFormData(prev => ({ ...prev, scheduledAt: e.target.value }))}
              className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Test Message */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-white/80 text-sm font-semibold">Test Message</label>
            <span className="text-white/50 text-xs">Safe to test - won't send to campaign</span>
          </div>
          <p className="text-white/60 text-xs mb-3">
            Send a test SMS to your phone to preview how the message will look. This will NOT send to your campaign recipients.
          </p>
          <div className="flex gap-2">
            <input
              type="tel"
              value={testPhoneNumber}
              onChange={(e) => {
                setTestPhoneNumber(e.target.value);
                setTestStatus(null);
              }}
              placeholder="+15076328065"
              className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleSendTest}
              disabled={testLoading || !testPhoneNumber.trim() || !formData.message.trim()}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {testLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="w-4 h-4" />
                  Send Test
                </>
              )}
            </button>
          </div>
          {testStatus && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${
              testStatus.type === 'success' 
                ? 'bg-green-500/20 border border-green-500/50 text-green-300' 
                : 'bg-red-500/20 border border-red-500/50 text-red-300'
            }`}>
              {testStatus.message}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || !formData.name || !formData.message || formData.to.length === 0}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Send Campaign'}
          </button>
        </div>
      </div>

      {/* Right: Preview */}
      <div className="lg:sticky lg:top-6 h-fit">
        <div className="bg-slate-800 rounded-2xl p-6 border border-white/10">
          <h3 className="text-white font-semibold mb-4">Preview</h3>
          <div className="bg-slate-900 rounded-xl p-4 border border-white/10">
            {/* Phone Mockup */}
            <div className="bg-slate-700 rounded-lg p-4 max-w-xs mx-auto">
              {/* Phone Header */}
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-white/40 rounded-full"></div>
                  <div className="w-1 h-1 bg-white/40 rounded-full"></div>
                  <div className="w-1 h-1 bg-white/40 rounded-full"></div>
                </div>
                <div className="text-white/60 text-xs">9:41 AM</div>
                <div className="flex items-center gap-1">
                  <div className="w-6 h-3 border border-white/40 rounded-sm">
                    <div className="w-4 h-2 bg-green-400 rounded-sm m-0.5"></div>
                  </div>
                </div>
              </div>

              {/* Message Preview */}
              <div className="space-y-2">
                <div className="text-white/60 text-xs mb-2">Message</div>
                <div className="bg-slate-600 rounded-lg p-3 text-white text-sm">
                  {formData.message || 'Your message will appear here...'}
                </div>
                <div className="text-white/40 text-xs">Sun, 23 Nov, 5:48 PM</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Sender ID Modal */}
      {showAddSenderModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl border border-white/10 p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-xl font-semibold">Create New Sender ID</h3>
              <button
                onClick={() => {
                  setShowAddSenderModal(false);
                  setNewSenderKey('');
                  setNewSenderId('');
                  setSenderError('');
                }}
                className="text-white/60 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">
                  Key (Internal Name) *
                </label>
                <input
                  type="text"
                  value={newSenderKey}
                  onChange={(e) => {
                    setNewSenderKey(e.target.value);
                    setSenderError('');
                  }}
                  placeholder="e.g., futures_church, kids_ministry"
                  className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/10 transition-all"
                />
                <p className="text-white/50 text-xs mt-1">Used internally to identify this sender ID</p>
              </div>

              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">
                  Sender ID (What recipients see) *
                </label>
                <input
                  type="text"
                  value={newSenderId}
                  onChange={(e) => {
                    setNewSenderId(e.target.value.toUpperCase());
                    setSenderError('');
                  }}
                  placeholder="e.g., FUTURES, FUTURESKIDS"
                  maxLength={11}
                  className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/10 transition-all uppercase"
                />
                <p className="text-white/50 text-xs mt-1">
                  Max 11 characters, alphanumeric only. This is what appears as the sender name.
                </p>
                <p className="text-white/40 text-xs mt-1">
                  {newSenderId.length}/11 characters
                </p>
              </div>

              {senderError && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                  {senderError}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSenderModal(false);
                    setNewSenderKey('');
                    setNewSenderId('');
                    setSenderError('');
                  }}
                  className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddSenderId}
                  disabled={senderLoading || !newSenderKey.trim() || !newSenderId.trim()}
                  className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {senderLoading ? 'Creating...' : 'Create Sender ID'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SMSCampaignCreator;


