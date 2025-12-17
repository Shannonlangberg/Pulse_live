import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  DocumentDuplicateIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  ClockIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const TemplateManagement = () => {
  const [templates, setTemplates] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    campus: '',
    serviceType: '',
    duration: '',
    teams: [],
    serviceOrder: [],
    notes: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      // Mock data for now - would come from API
      setTemplates([
        {
          id: 1,
          name: 'Sunday Service - Standard',
          description: 'Standard Sunday service template with worship, message, and hospitality',
          campus: 'Futures Copper Coast',
          serviceType: 'Sunday Service',
          duration: '90 minutes',
          teams: ['Worship Team', 'Hosting Team', 'Technical Team'],
          teamsCount: 3,
          lastUsed: '2025-08-17',
          createdBy: 'Shannon Langberg',
          isActive: true
        },
        {
          id: 2,
          name: 'Youth Service',
          description: 'Youth-focused service with contemporary worship and interactive elements',
          campus: 'Futures Mt Barker',
          serviceType: 'Youth Service',
          duration: '75 minutes',
          teams: ['Youth Worship', 'Youth Leaders', 'Technical Team'],
          teamsCount: 3,
          lastUsed: '2025-08-15',
          createdBy: 'Courtney Langberg',
          isActive: true
        },
        {
          id: 3,
          name: 'Prayer Meeting',
          description: 'Intimate prayer and worship gathering',
          campus: 'Futures Adelaide City',
          serviceType: 'Prayer Meeting',
          duration: '60 minutes',
          teams: ['Prayer Team', 'Worship Team'],
          teamsCount: 2,
          lastUsed: '2025-08-14',
          createdBy: 'Shannon Langberg',
          isActive: true
        }
      ]);
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = () => {
    setFormData({
      name: '',
      description: '',
      campus: '',
      serviceType: '',
      duration: '',
      teams: [],
      serviceOrder: [],
      notes: ''
    });
    setShowCreateModal(true);
  };

  const handleEditTemplate = (template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      description: template.description,
      campus: template.campus,
      serviceType: template.serviceType,
      duration: template.duration,
      teams: template.teams,
      serviceOrder: template.serviceOrder || [],
      notes: template.notes || ''
    });
    setShowEditModal(true);
  };

  const handleSaveTemplate = () => {
    if (showEditModal && selectedTemplate) {
      // Update existing template
      setTemplates(prev => prev.map(t => 
        t.id === selectedTemplate.id ? { ...t, ...formData } : t
      ));
      setShowEditModal(false);
    } else {
      // Create new template
      const newTemplate = {
        id: Date.now(),
        ...formData,
        teamsCount: formData.teams.length,
        lastUsed: null,
        createdBy: 'Current User',
        isActive: true
      };
      setTemplates(prev => [...prev, newTemplate]);
      setShowCreateModal(false);
    }
    
    setFormData({
      name: '',
      description: '',
      campus: '',
      serviceType: '',
      duration: '',
      teams: [],
      serviceOrder: [],
      notes: ''
    });
    setSelectedTemplate(null);
  };

  const handleDeleteTemplate = (templateId) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    }
  };

  const handleUseTemplate = (template) => {
    // This would open the service planning interface with the template loaded
    console.log('Using template:', template);
    // Navigate to service planning with template data
  };

  const serviceTypes = [
    'Sunday Service',
    'Youth Service',
    'Prayer Meeting',
    'Bible Study',
    'Worship Night',
    'Special Event',
    'Conference',
    'Workshop'
  ];

  const campusOptions = [
    'Futures Copper Coast',
    'Futures Mt Barker',
    'Futures Adelaide City',
    'Futures Paradise',
    'Futures South',
    'Futures Salisbury',
    'Futures Clare Valley',
    'Futures Victor Harbor'
  ];

  const teamOptions = [
    'Worship Team',
    'Hosting Team',
    'Technical Team',
    'Prayer Team',
    'Children\'s Team',
    'Youth Team',
    'Hospitality Team',
    'Security Team',
    'Media Team',
    'Usher Team'
  ];

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-slate-700 rounded w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-700 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Service Templates</h2>
          <p className="text-slate-400">Create and manage reusable service templates</p>
        </div>
        <button
          onClick={handleCreateTemplate}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
        >
          <PlusIcon className="h-5 w-5 text-white" />
          <span className="text-white font-medium">Create Template</span>
        </button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <div key={template.id} className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{template.name}</h3>
                <p className="text-sm text-slate-400">{template.campus}</p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                template.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {template.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            <p className="text-slate-300 mb-4">{template.description}</p>
            
            <div className="space-y-2 text-sm mb-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Service Type:</span>
                <span className="text-white">{template.serviceType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Duration:</span>
                <span className="text-white">{template.duration}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Teams:</span>
                <span className="text-white">{template.teamsCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Last Used:</span>
                <span className="text-white">{template.lastUsed || 'Never'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Created by:</span>
                <span className="text-white">{template.createdBy}</span>
              </div>
            </div>

            {/* Team Tags */}
            <div className="mb-4">
              <div className="flex flex-wrap gap-1">
                {template.teams.slice(0, 3).map((team, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {team}
                  </span>
                ))}
                {template.teams.length > 3 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    +{template.teams.length - 3}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-4 border-t border-slate-600">
              <button 
                onClick={() => handleUseTemplate(template)}
                className="flex-1 px-3 py-2 text-sm bg-purple-600 hover:bg-purple-700 rounded text-white transition-colors"
              >
                Use Template
              </button>
              <button 
                onClick={() => handleEditTemplate(template)}
                className="px-3 py-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
              <button 
                onClick={() => handleDeleteTemplate(template.id)}
                className="px-3 py-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Template Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {showEditModal ? 'Edit Template' : 'Create New Template'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedTemplate(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Sunday Service - Standard"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe the service type and purpose..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Campus
                  </label>
                  <select
                    value={formData.campus}
                    onChange={(e) => setFormData(prev => ({ ...prev, campus: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Campus</option>
                    {campusOptions.map(campus => (
                      <option key={campus} value={campus}>{campus}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Service Type
                  </label>
                  <select
                    value={formData.serviceType}
                    onChange={(e) => setFormData(prev => ({ ...prev, serviceType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Type</option>
                    {serviceTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration
                </label>
                <input
                  type="text"
                  value={formData.duration}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 90 minutes"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teams Required
                </label>
                <div className="space-y-2">
                  {teamOptions.map(team => (
                    <label key={team} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.teams.includes(team)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({ ...prev, teams: [...prev.teams, team] }));
                          } else {
                            setFormData(prev => ({ ...prev, teams: prev.teams.filter(t => t !== team) }));
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{team}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Additional notes or special instructions..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedTemplate(null);
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                {showEditModal ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateManagement;
