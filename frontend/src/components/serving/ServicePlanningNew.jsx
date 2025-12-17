import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  CalendarIcon, 
  UserGroupIcon, 
  ClockIcon, 
  DocumentDuplicateIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';

const ServicePlanningNew = () => {
  const [templates, setTemplates] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('templates');
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [selectedCampus, setSelectedCampus] = useState('all');

  // Form states
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    campus: 'Paradise',
    service_type: 'SUNDAY',
    estimated_duration_minutes: 90,
    structure: { items: [] }
  });

  const [planForm, setPlanForm] = useState({
    title: '',
    campus: 'Paradise',
    service_date: new Date().toISOString().split('T')[0],
    service_time: '10:00',
    template_id: '',
    estimated_duration_minutes: 90,
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchTemplates(),
        fetchPlans()
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
              const response = await fetch('/api/serving/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  };

  const fetchPlans = async () => {
    try {
              const response = await fetch('/api/serving/plans');
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans || []);
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
    }
  };

  const createTemplate = async (e) => {
    e.preventDefault();
    try {
              const response = await fetch('/api/serving/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (response.ok) {
        await fetchTemplates();
        setShowCreateTemplate(false);
        setTemplateForm({
          name: '',
          description: '',
          campus: 'Paradise',
          service_type: 'SUNDAY',
          estimated_duration_minutes: 90,
          structure: { items: [] }
        });
      }
    } catch (err) {
      console.error('Error creating template:', err);
    }
  };

  const createPlan = async (e) => {
    e.preventDefault();
    try {
              const response = await fetch('/api/serving/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (response.ok) {
        await fetchPlans();
        setShowCreatePlan(false);
        setPlanForm({
          title: '',
          campus: 'Paradise',
          service_date: new Date().toISOString().split('T')[0],
          service_time: '10:00',
          template_id: '',
          estimated_duration_minutes: 90,
          notes: ''
        });
      }
    } catch (err) {
      console.error('Error creating plan:', err);
    }
  };

  const applyTemplate = async (templateId) => {
    try {
              const response = await fetch(`/api/serving/templates/${templateId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (response.ok) {
        await fetchPlans();
      }
    } catch (err) {
      console.error('Error applying template:', err);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-slate-700 rounded w-1/4 mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Service Planning</h2>
          <p className="text-slate-400">Create and manage service templates and plans</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowCreateTemplate(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <PlusIcon className="h-5 w-5" />
            <span>New Template</span>
          </button>
          <button
            onClick={() => setShowCreatePlan(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <PlusIcon className="h-5 w-5" />
            <span>New Plan</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-700">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'templates'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Service Templates ({templates.length})
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'plans'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Service Plans ({plans.length})
          </button>
        </nav>
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {templates.length === 0 ? (
            <div className="text-center py-12">
              <DocumentDuplicateIcon className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-400 mb-2">No templates yet</h3>
              <p className="text-slate-500">Create your first service template to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <div key={template.id} className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-white">{template.name}</h3>
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                      {template.service_type}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm mb-4">{template.description}</p>
                  <div className="flex justify-between items-center text-sm text-slate-500 mb-4">
                    <span>{template.campus}</span>
                    <span>{template.estimated_duration_minutes} min</span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => applyTemplate(template.id)}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm"
                    >
                      Apply Template
                    </button>
                    <button className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 rounded text-sm">
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          {plans.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-400 mb-2">No plans yet</h3>
              <p className="text-slate-500">Create your first service plan or apply a template.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {plans.map((plan) => (
                <div key={plan.id} className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{plan.title}</h3>
                      <p className="text-slate-400 text-sm">
                        {plan.campus} • {new Date(plan.service_date).toLocaleDateString()} • {plan.service_time}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      plan.status === 'DRAFT' ? 'bg-yellow-600 text-yellow-100' :
                      plan.status === 'PUBLISHED' ? 'bg-green-600 text-green-100' :
                      plan.status === 'LIVE' ? 'bg-blue-600 text-blue-100' :
                      'bg-slate-600 text-slate-100'
                    }`}>
                      {plan.status}
                    </span>
                  </div>
                  {plan.notes && (
                    <p className="text-slate-400 text-sm mb-4">{plan.notes}</p>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">
                      {plan.items_count || 0} items • {plan.estimated_duration_minutes} min
                    </span>
                    <div className="flex space-x-2">
                      <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm">
                        View Details
                      </button>
                      <button className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 rounded text-sm">
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Template Modal */}
      {showCreateTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Create Service Template</h3>
            <form onSubmit={createTemplate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({...templateForm, name: e.target.value})}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({...templateForm, description: e.target.value})}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Campus</label>
                  <select
                    value={templateForm.campus}
                    onChange={(e) => setTemplateForm({...templateForm, campus: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                  >
                    <option value="Paradise">Paradise</option>
                    <option value="South">South</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Service Type</label>
                  <select
                    value={templateForm.service_type}
                    onChange={(e) => setTemplateForm({...templateForm, service_type: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                  >
                    <option value="SUNDAY">Sunday</option>
                    <option value="SPECIAL">Special</option>
                    <option value="YOUTH">Youth</option>
                    <option value="KIDS">Kids</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  value={templateForm.estimated_duration_minutes}
                  onChange={(e) => setTemplateForm({...templateForm, estimated_duration_minutes: parseInt(e.target.value)})}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateTemplate(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                >
                  Create Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Plan Modal */}
      {showCreatePlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Create Service Plan</h3>
            <form onSubmit={createPlan} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  value={planForm.title}
                  onChange={(e) => setPlanForm({...planForm, title: e.target.value})}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Campus</label>
                  <select
                    value={planForm.campus}
                    onChange={(e) => setPlanForm({...planForm, campus: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                  >
                    <option value="Paradise">Paradise</option>
                    <option value="South">South</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Date</label>
                  <input
                    type="date"
                    value={planForm.service_date}
                    onChange={(e) => setPlanForm({...planForm, service_date: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Time</label>
                  <input
                    type="time"
                    value={planForm.service_time}
                    onChange={(e) => setPlanForm({...planForm, service_time: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Duration (min)</label>
                  <input
                    type="number"
                    value={planForm.estimated_duration_minutes}
                    onChange={(e) => setPlanForm({...planForm, estimated_duration_minutes: parseInt(e.target.value)})}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Template (Optional)</label>
                <select
                  value={planForm.template_id}
                  onChange={(e) => setPlanForm({...planForm, template_id: e.target.value})}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                >
                  <option value="">No template</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
                <textarea
                  value={planForm.notes}
                  onChange={(e) => setPlanForm({...planForm, notes: e.target.value})}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreatePlan(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                >
                  Create Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServicePlanningNew;




