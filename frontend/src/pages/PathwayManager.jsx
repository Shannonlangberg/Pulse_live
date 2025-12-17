import React, { useState, useEffect } from 'react';
import {
  AcademicCapIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';

const PathwayManager = () => {
  const [pathways, setPathways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPathway, setEditingPathway] = useState(null);
  const [expandedPathway, setExpandedPathway] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'general',
    is_template: false,
    steps: []
  });
  const [stepFormData, setStepFormData] = useState({
    step_name: '',
    step_description: '',
    milestone_type: '',
    is_required: true,
    step_order: 1,
    step_actions: []
  });
  const [editingStepIndex, setEditingStepIndex] = useState(null);
  const [actionFormData, setActionFormData] = useState({
    type: 'watch_video',
    title: '',
    url: '',
    icon: 'play'
  });

  useEffect(() => {
    loadPathways();
  }, []);

  const loadPathways = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('/api/journeys', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setPathways(data.pathways || []);
      } else {
        setError('Failed to load journeys');
      }
    } catch (err) {
      console.error('Error loading pathways:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (pathway = null) => {
    if (pathway) {
      setEditingPathway(pathway);
      setFormData({
        name: pathway.name,
        description: pathway.description || '',
        category: pathway.category || 'general',
        is_template: pathway.is_template || false,
        steps: (pathway.steps || []).map(step => ({
          ...step,
          step_actions: step.step_actions || []
        }))
      });
    } else {
      setEditingPathway(null);
      setFormData({
        name: '',
        description: '',
        category: 'general',
        is_template: false,
        steps: []
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingPathway(null);
    setStepFormData({
      step_name: '',
      step_description: '',
      milestone_type: '',
      is_required: true,
      step_order: 1,
      step_actions: []
    });
  };

  const handleAddStep = () => {
    if (!stepFormData.step_name.trim()) {
      alert('Step name is required');
      return;
    }

    const newStep = {
      ...stepFormData,
      step_order: formData.steps.length + 1,
      id: `temp_${Date.now()}` // Temporary ID for UI
    };

    setFormData({
      ...formData,
      steps: [...formData.steps, newStep]
    });

    setStepFormData({
      step_name: '',
      step_description: '',
      milestone_type: '',
      is_required: true,
      step_order: formData.steps.length + 2,
      step_actions: []
    });
  };

  const handleRemoveStep = (index) => {
    const newSteps = formData.steps.filter((_, i) => i !== index);
    // Reorder steps
    newSteps.forEach((step, i) => {
      step.step_order = i + 1;
    });
    setFormData({ ...formData, steps: newSteps });
  };

  const handleMoveStep = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === formData.steps.length - 1) return;

    const newSteps = [...formData.steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    
    // Update step orders
    newSteps.forEach((step, i) => {
      step.step_order = i + 1;
    });
    
    setFormData({ ...formData, steps: newSteps });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Journey name is required');
      return;
    }

    try {
      const url = editingPathway 
        ? `/api/journeys/${editingPathway.id}`
        : '/api/journeys';
      
      const method = editingPathway ? 'PUT' : 'POST';
      
      const payload = {
        ...formData,
        steps: formData.steps.map((s, i) => ({
          id: s.id, // Include step ID if it exists (for updates)
          step_order: i + 1,
          step_name: s.step_name,
          step_description: s.step_description,
          milestone_type: s.milestone_type,
          is_required: s.is_required,
          step_actions: s.step_actions || []
        }))
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        await loadPathways();
        handleCloseModal();
        alert(editingPathway ? 'Journey updated successfully' : 'Journey created successfully');
      } else {
        alert(data.error || 'Failed to save journey');
      }
    } catch (err) {
      console.error('Error saving journey:', err);
      alert('Failed to save journey');
    }
  };

  const handleDelete = async (pathway) => {
    if (!confirm(`Are you sure you want to delete "${pathway.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/journeys/${pathway.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        await loadPathways();
        alert('Journey deleted successfully');
      } else {
        alert(data.error || 'Failed to delete journey');
      }
    } catch (err) {
      console.error('Error deleting journey:', err);
      alert('Failed to delete journey');
    }
  };

  if (loading && pathways.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-white text-xl">Loading journeys...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 flex items-center">
                <AcademicCapIcon className="w-10 h-10 mr-3 text-purple-500" />
                Journey Manager
              </h1>
              <p className="text-slate-400">Create and manage discipleship journeys for tracking spiritual growth</p>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Create Journey
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Pathways List */}
        <div className="space-y-4">
          {pathways.length === 0 ? (
            <div className="bg-slate-800/50 rounded-xl p-12 text-center border border-slate-700/50">
              <p className="text-slate-400 mb-4">No journeys found.</p>
              <button
                onClick={() => handleOpenModal()}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
              >
                Create Your First Journey
              </button>
            </div>
          ) : (
            pathways.map((pathway) => (
              <div key={pathway.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-white">{pathway.name}</h3>
                        {pathway.is_template && (
                          <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-semibold">
                            Template
                          </span>
                        )}
                        <span className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-xs">
                          {pathway.category}
                        </span>
                      </div>
                      {pathway.description && (
                        <p className="text-slate-400 mb-3">{pathway.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span>{pathway.step_count || 0} steps</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpandedPathway(expandedPathway === pathway.id ? null : pathway.id)}
                        className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg"
                        title="View Steps"
                      >
                        {expandedPathway === pathway.id ? (
                          <ChevronUpIcon className="w-5 h-5" />
                        ) : (
                          <ChevronDownIcon className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleOpenModal(pathway)}
                        className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg"
                        title="Edit Journey"
                      >
                        <PencilIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(pathway)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                        title="Delete Journey"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Steps View */}
                  {expandedPathway === pathway.id && (
                    <div className="mt-6 pt-6 border-t border-slate-700">
                      <h4 className="text-sm font-semibold text-slate-300 mb-4">Journey Steps</h4>
                      <div className="space-y-2">
                        {pathway.steps && pathway.steps.length > 0 ? (
                          pathway.steps.map((step, index) => (
                            <div key={step.id} className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
                              <div className="flex-shrink-0 w-8 h-8 bg-purple-500/20 text-purple-400 rounded-full flex items-center justify-center text-sm font-bold">
                                {step.step_order}
                              </div>
                              <div className="flex-1">
                                <div className="text-white font-medium">{step.step_name}</div>
                                {step.step_description && (
                                  <div className="text-sm text-slate-400">{step.step_description}</div>
                                )}
                                {step.milestone_type && (
                                  <div className="text-xs text-slate-500 mt-1">Milestone: {step.milestone_type}</div>
                                )}
                              </div>
                              {!step.is_required && (
                                <span className="px-2 py-1 bg-slate-600 text-slate-400 rounded text-xs">
                                  Optional
                                </span>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-slate-400 text-sm">No steps defined yet.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800 z-10">
              <h2 className="text-2xl font-bold text-white">
                {editingPathway ? 'Edit Journey' : 'Create New Journey'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Journey Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    placeholder="e.g., Leadership Journey"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="general">General</option>
                    <option value="leadership">Leadership</option>
                    <option value="worship">Worship</option>
                    <option value="ministry">Ministry</option>
                    <option value="connect_leader">Connect Leader</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  rows="3"
                  placeholder="Describe this pathway..."
                />
              </div>

              {/* Steps Section */}
              <div className="border-t border-slate-700 pt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Journey Steps</h3>
                
                {/* Add Step Form */}
                <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Step Name *</label>
                      <input
                        type="text"
                        value={stepFormData.step_name}
                        onChange={(e) => setStepFormData({ ...stepFormData, step_name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                        placeholder="e.g., Salvation"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Milestone Type</label>
                      <input
                        type="text"
                        value={stepFormData.milestone_type}
                        onChange={(e) => setStepFormData({ ...stepFormData, milestone_type: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                        placeholder="e.g., salvation, baptism"
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Step Description</label>
                    <textarea
                      value={stepFormData.step_description}
                      onChange={(e) => setStepFormData({ ...stepFormData, step_description: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                      rows="2"
                      placeholder="Describe what this step involves..."
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={stepFormData.is_required}
                        onChange={(e) => setStepFormData({ ...stepFormData, is_required: e.target.checked })}
                        className="w-4 h-4 rounded bg-slate-600 border-slate-500 text-purple-600"
                      />
                      <span className="text-sm text-slate-300">Required step</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddStep}
                      className="ml-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
                    >
                      Add Step
                    </button>
                  </div>
                </div>

                {/* Steps List */}
                <div className="space-y-2">
                  {formData.steps.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-4">No steps added yet. Add steps above.</p>
                  ) : (
                    formData.steps.map((step, index) => (
                      <div key={step.id || index} className="border border-slate-600 rounded-lg overflow-hidden">
                        <div className="flex items-center gap-3 p-3 bg-slate-700/50">
                          <div className="flex-shrink-0 w-8 h-8 bg-purple-500/20 text-purple-400 rounded-full flex items-center justify-center text-sm font-bold">
                            {step.step_order}
                          </div>
                          <div className="flex-1">
                            <div className="text-white font-medium">{step.step_name}</div>
                            {step.step_description && (
                              <div className="text-sm text-slate-400">{step.step_description}</div>
                            )}
                            {(step.step_actions && step.step_actions.length > 0) && (
                              <div className="text-xs text-purple-400 mt-1">
                                {step.step_actions.length} action{step.step_actions.length !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleMoveStep(index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveStep(index, 'down')}
                            disabled={index === formData.steps.length - 1}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            ↓
                          </button>
                            <button
                              type="button"
                              onClick={() => setEditingStepIndex(editingStepIndex === index ? null : index)}
                              className="p-1 text-blue-400 hover:text-blue-300"
                              title="Edit Actions"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveStep(index)}
                              className="p-1 text-red-400 hover:text-red-300"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Step Actions Editor */}
                        {editingStepIndex === index && (
                          <div className="bg-slate-800/50 border-t border-slate-600 p-4 space-y-3">
                            <div className="text-sm font-semibold text-slate-300 mb-2">Step Actions</div>
                            
                            {/* Actions List */}
                            {step.step_actions && step.step_actions.length > 0 && (
                              <div className="space-y-2 mb-3">
                                {step.step_actions.map((action, actionIndex) => (
                                  <div key={actionIndex} className="flex items-center gap-2 p-2 bg-slate-700/50 rounded">
                                    <span className="text-xs text-slate-400">
                                      {action.type === 'watch_video' ? '▶️' : action.type === 'read_content' ? '📖' : action.icon || '✓'}
                                    </span>
                                    <span className="text-sm text-slate-300 flex-1">{action.title}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newSteps = [...formData.steps];
                                        newSteps[index].step_actions = newSteps[index].step_actions.filter((_, i) => i !== actionIndex);
                                        setFormData({ ...formData, steps: newSteps });
                                      }}
                                      className="text-xs text-red-400 hover:text-red-300"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Add Action Form */}
                            <div className="bg-slate-700/30 rounded p-3 space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Action Type</label>
                                  <select
                                    value={actionFormData.type}
                                    onChange={(e) => setActionFormData({ ...actionFormData, type: e.target.value })}
                                    className="w-full px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-xs"
                                  >
                                    <option value="watch_video">Watch Video</option>
                                    <option value="read_content">Read Content</option>
                                    <option value="complete_task">Complete Task</option>
                                    <option value="external_link">External Link</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Icon</label>
                                  <input
                                    type="text"
                                    value={actionFormData.icon}
                                    onChange={(e) => setActionFormData({ ...actionFormData, icon: e.target.value })}
                                    className="w-full px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-xs"
                                    placeholder="play, read, etc."
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs text-slate-400 mb-1">Title</label>
                                <input
                                  type="text"
                                  value={actionFormData.title}
                                  onChange={(e) => setActionFormData({ ...actionFormData, title: e.target.value })}
                                  className="w-full px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-xs"
                                  placeholder="e.g., Watch This is Christianity on Pulse"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-400 mb-1">URL/Link</label>
                                <input
                                  type="text"
                                  value={actionFormData.url}
                                  onChange={(e) => setActionFormData({ ...actionFormData, url: e.target.value })}
                                  className="w-full px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-xs"
                                  placeholder="https://..."
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!actionFormData.title.trim()) {
                                    alert('Action title is required');
                                    return;
                                  }
                                  const newSteps = [...formData.steps];
                                  if (!newSteps[index].step_actions) {
                                    newSteps[index].step_actions = [];
                                  }
                                  newSteps[index].step_actions.push({ ...actionFormData });
                                  setFormData({ ...formData, steps: newSteps });
                                  setActionFormData({ type: 'watch_video', title: '', url: '', icon: 'play' });
                                }}
                                className="w-full px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs"
                              >
                                Add Action
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  {editingPathway ? 'Update Journey' : 'Create Journey'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PathwayManager;



