import React, { useState, useEffect } from 'react';
import { XMarkIcon, EnvelopeIcon, DevicePhoneMobileIcon, ArrowUpTrayIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import RichEmailEditor from './RichEmailEditor';
import SMSCampaignCreator from './SMSCampaignCreator';

const CreateCampaignModal = ({ campaignType, onClose, onSuccess, existingCampaign }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    subject_line: '',
    content: '',
    content_text: '',
    target_criteria: {
      campus: [],
      department: [],
      tags: []
    },
    scheduled_at: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [campuses, setCampuses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sendNow, setSendNow] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [csvMapping, setCsvMapping] = useState({});
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testStatus, setTestStatus] = useState(null);

  useEffect(() => {
    fetchCampuses();
    fetchDepartments();
    if (existingCampaign) {
      setFormData({
        name: existingCampaign.name || '',
        description: existingCampaign.description || '',
        subject_line: existingCampaign.subject_line || '',
        content: existingCampaign.content || '',
        content_text: existingCampaign.content_text || '',
        target_criteria: existingCampaign.target_criteria || { campus: [], department: [], tags: [] },
        scheduled_at: existingCampaign.scheduled_at ? new Date(existingCampaign.scheduled_at).toISOString().slice(0, 16) : ''
      });
    }
  }, [existingCampaign]);

  const fetchCampuses = async () => {
    try {
      const response = await fetch('/api/communication/campuses', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setCampuses(data.campuses || []);
      }
    } catch (error) {
      console.error('Error fetching campuses:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/communication/departments', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || ['Kids', 'Youth', 'Young Adults', 'Families', 'Adults', 'Seniors']);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      setDepartments(['Kids', 'Youth', 'Young Adults', 'Families', 'Adults', 'Seniors']);
    }
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      }).filter(row => Object.values(row).some(v => v));

      setCsvData(rows);
      setShowCSVUpload(true);
    };
    reader.readAsText(file);
  };

  const handleCSVImport = async () => {
    try {
      const response = await fetch('/api/communication/import/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          data: csvData,
          mapping: csvMapping,
          target_group: {
            campus: formData.target_criteria.campus,
            department: formData.target_criteria.department,
            tags: formData.target_criteria.tags
          }
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(`Successfully imported ${data.imported_count} records!`);
        setShowCSVUpload(false);
        setCsvFile(null);
        setCsvData([]);
        setCsvMapping({});
      } else {
        alert('Error: ' + (data.error || 'Failed to import CSV'));
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert('Error importing CSV');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTargetChange = (type, value, checked) => {
    setFormData(prev => {
      const criteria = { ...prev.target_criteria };
      if (!criteria[type]) criteria[type] = [];
      
      if (checked) {
        criteria[type] = [...criteria[type], value];
      } else {
        criteria[type] = criteria[type].filter(item => item !== value);
      }
      
      return {
        ...prev,
        target_criteria: criteria
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        campaign_type: campaignType,
        subject_line: campaignType === 'email' ? formData.subject_line : undefined,
        content: formData.content,
        content_text: campaignType === 'email' ? formData.content_text : undefined,
        target_criteria: formData.target_criteria,
        scheduled_at: formData.scheduled_at ? new Date(formData.scheduled_at).toISOString() : undefined
      };

      let response;
      if (existingCampaign) {
        // Update existing campaign
        response = await fetch(`/api/communication/campaigns/${existingCampaign.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      } else {
        // Create new campaign
        response = await fetch('/api/communication/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save campaign');
      }

      // Send immediately if requested
      if (sendNow && data.campaign?.id) {
        const sendResponse = await fetch(`/api/communication/campaigns/${data.campaign.id}/send`, {
          method: 'POST',
          credentials: 'include'
        });

        const sendData = await sendResponse.json();
        if (!sendResponse.ok || !sendData.success) {
          alert(`Campaign created but failed to send: ${sendData.error || 'Unknown error'}`);
        }
      }

      onSuccess();
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-white/10 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            {campaignType === 'email' ? (
              <EnvelopeIcon className="w-6 h-6 text-blue-400" />
            ) : (
              <DevicePhoneMobileIcon className="w-6 h-6 text-green-400" />
            )}
            <h2 className="text-2xl font-bold text-white">
              {existingCampaign ? 'Edit' : 'Create'} {campaignType === 'email' ? 'Email' : 'SMS'} Campaign
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-white/60" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/20 border border-red-500/40 text-red-200 rounded-xl p-4">
              {error}
            </div>
          )}

          {/* Campaign Name */}
          <div>
            <label className="block text-white/80 text-sm font-semibold mb-2">
              Campaign Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/10 transition-all"
              placeholder="e.g., Weekly Newsletter"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-white/80 text-sm font-semibold mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="2"
              className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/10 transition-all"
              placeholder="Brief description of this campaign"
            />
          </div>

          {/* Subject Line (Email only) */}
          {campaignType === 'email' && (
            <div>
              <label className="block text-white/80 text-sm font-semibold mb-2">
                Subject Line *
              </label>
              <input
                type="text"
                name="subject_line"
                value={formData.subject_line}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/10 transition-all"
                placeholder="Email subject line"
              />
            </div>
          )}

          {/* Content */}
          {campaignType === 'email' ? (
            <div>
              <label className="block text-white/80 text-sm font-semibold mb-2">
                Email Content *
              </label>
              <RichEmailEditor
                value={formData.content}
                onChange={(html) => setFormData(prev => ({ ...prev, content: html }))}
              />
            </div>
          ) : (
            <div>
              <label className="block text-white/80 text-sm font-semibold mb-2">
                SMS Message *
              </label>
              <textarea
                name="content"
                value={formData.content}
                onChange={handleChange}
                required
                rows="6"
                maxLength={1600}
                className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/10 transition-all"
                placeholder="SMS message (160 characters recommended for single message)"
              />
              <div className="text-white/50 text-sm mt-1">
                {formData.content.length} / 160 characters
              </div>
              
              {/* Test SMS Section */}
              <div className="mt-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-white/80 text-sm font-semibold">Test SMS</label>
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
                    onClick={async () => {
                      if (!testPhoneNumber.trim()) {
                        setTestStatus({ type: 'error', message: 'Please enter a phone number' });
                        return;
                      }

                      if (!formData.content.trim()) {
                        setTestStatus({ type: 'error', message: 'Please enter a message first' });
                        return;
                      }

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
                            message: formData.content
                          })
                        });

                        const data = await response.json();
                        if (data.success) {
                          setTestStatus({ 
                            type: 'success', 
                            message: `Test SMS sent successfully! Message SID: ${data.message_sid || 'N/A'}` 
                          });
                          setTimeout(() => setTestStatus(null), 5000);
                        } else {
                          setTestStatus({ 
                            type: 'error', 
                            message: data.error || 'Failed to send test SMS' 
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
                    }}
                    disabled={testLoading || !testPhoneNumber.trim() || !formData.content.trim()}
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
            </div>
          )}

          {/* Plain Text Content (Email only) */}
          {campaignType === 'email' && (
            <div>
              <label className="block text-white/80 text-sm font-semibold mb-2">
                Plain Text Version
              </label>
              <textarea
                name="content_text"
                value={formData.content_text}
                onChange={handleChange}
                rows="6"
                className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/10 transition-all"
                placeholder="Plain text version for email clients that don't support HTML"
              />
            </div>
          )}

          {/* Targeting */}
          <div>
            <label className="block text-white/80 text-sm font-semibold mb-3">
              Target Audience
            </label>
            
            {/* CSV Upload */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-white/60 text-sm">Custom Lists</div>
                <label className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg cursor-pointer transition-colors text-sm">
                  <ArrowUpTrayIcon className="w-4 h-4" />
                  Upload CSV
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Campus Selection */}
            <div className="mb-4">
              <div className="text-white/60 text-sm mb-2">Campuses</div>
              <div className="flex flex-wrap gap-2">
                {campuses.map((campus) => (
                  <label key={campus} className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.target_criteria.campus?.includes(campus)}
                      onChange={(e) => handleTargetChange('campus', campus, e.target.checked)}
                      className="w-4 h-4 text-blue-500 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                    />
                    <span className="text-white text-sm">{campus}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Department Selection */}
            <div className="mb-4">
              <div className="text-white/60 text-sm mb-2">Departments</div>
              <div className="flex flex-wrap gap-2">
                {departments.map((dept) => (
                  <label key={dept} className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.target_criteria.department?.includes(dept)}
                      onChange={(e) => handleTargetChange('department', dept, e.target.checked)}
                      className="w-4 h-4 text-blue-500 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                    />
                    <span className="text-white text-sm">{dept}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-white/80 text-sm font-semibold mb-2">
              Schedule (Optional)
            </label>
            <input
              type="datetime-local"
              name="scheduled_at"
              value={formData.scheduled_at}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/10 transition-all"
            />
            {!formData.scheduled_at && (
              <label className="flex items-center gap-2 mt-2 text-white/60 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendNow}
                  onChange={(e) => setSendNow(e.target.checked)}
                  className="w-4 h-4 text-blue-500 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                />
                <span>Send immediately after creating</span>
              </label>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold transition-all duration-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : existingCampaign ? 'Update Campaign' : 'Create Campaign'}
            </button>
          </div>
        </form>

        {/* CSV Upload Modal */}
        {showCSVUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-800 rounded-xl p-6 border border-white/10 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">CSV Import</h3>
                <button
                  onClick={() => {
                    setShowCSVUpload(false);
                    setCsvFile(null);
                    setCsvData([]);
                    setCsvMapping({});
                  }}
                  className="p-2 hover:bg-white/10 rounded transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-white" />
                </button>
              </div>

              {csvData.length > 0 && (
                <div className="space-y-4">
                  <div className="text-white/80 text-sm">
                    Found {csvData.length} rows. Map your CSV columns to person fields:
                  </div>
                  
                  <div className="space-y-2">
                    {Object.keys(csvData[0] || {}).map(header => (
                      <div key={header} className="flex items-center gap-2">
                        <span className="text-white/60 text-sm w-32">{header}:</span>
                        <select
                          value={csvMapping[header] || ''}
                          onChange={(e) => setCsvMapping(prev => ({ ...prev, [header]: e.target.value }))}
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="" className="bg-slate-800">-- Select Field --</option>
                          <option value="email" className="bg-slate-800">Email *</option>
                          <option value="first_name" className="bg-slate-800">First Name *</option>
                          <option value="last_name" className="bg-slate-800">Last Name</option>
                          <option value="phone" className="bg-slate-800">Phone</option>
                          <option value="campus" className="bg-slate-800">Campus</option>
                          <option value="department" className="bg-slate-800">Department</option>
                          <option value="tags" className="bg-slate-800">Tags</option>
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4">
                    <button
                      onClick={() => {
                        setShowCSVUpload(false);
                        setCsvFile(null);
                        setCsvData([]);
                        setCsvMapping({});
                      }}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCSVImport}
                      disabled={!csvMapping.email || !csvMapping.first_name}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Import
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateCampaignModal;

