import React, { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  BookOpenIcon, 
  CalendarDaysIcon, 
  TagIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

const DevotionFormModal = ({ devotion, plans, mode, isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    scripture_reference: '',
    scripture_text: '',
    plan_id: '',
    day_number: 1,
    status: 'draft',
    author: '',
    scheduled_date: '',
    tags: [],
    prayer_focus: '',
    reflection_questions: [],
    additional_resources: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [newTag, setNewTag] = useState('');
  const [newQuestion, setNewQuestion] = useState('');

  const statusOptions = [
    { key: 'draft', name: 'Draft' },
    { key: 'published', name: 'Published' },
    { key: 'scheduled', name: 'Scheduled' }
  ];

  useEffect(() => {
    if (devotion && mode === 'edit') {
      // Populate form with existing devotion data
      setFormData({
        title: devotion.title || '',
        content: devotion.content || '',
        scripture_reference: devotion.scripture_reference || '',
        scripture_text: devotion.scripture_text || '',
        plan_id: devotion.plan?.id || '',
        day_number: devotion.day_number || 1,
        status: devotion.status || 'draft',
        author: devotion.author || '',
        scheduled_date: devotion.scheduled_date ? devotion.scheduled_date.split('T')[0] : '',
        tags: devotion.tags || [],
        prayer_focus: devotion.prayer_focus || '',
        reflection_questions: devotion.reflection_questions || [],
        additional_resources: devotion.additional_resources || ''
      });
    } else {
      // Reset form for create mode
      setFormData({
        title: '',
        content: '',
        scripture_reference: '',
        scripture_text: '',
        plan_id: '',
        day_number: 1,
        status: 'draft',
        author: '',
        scheduled_date: '',
        tags: [],
        prayer_focus: '',
        reflection_questions: [],
        additional_resources: ''
      });
    }
    setError(null);
    setValidationErrors({});
  }, [devotion, mode]);

  const validateForm = () => {
    const errors = {};

    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }

    if (!formData.content.trim()) {
      errors.content = 'Content is required';
    }

    if (!formData.scripture_reference.trim()) {
      errors.scripture_reference = 'Scripture reference is required';
    }

    if (!formData.scripture_text.trim()) {
      errors.scripture_text = 'Scripture text is required';
    }

    if (!formData.plan_id) {
      errors.plan_id = 'Plan is required';
    }

    if (!formData.day_number || formData.day_number < 1) {
      errors.day_number = 'Day number must be at least 1';
    }

    if (!formData.author.trim()) {
      errors.author = 'Author is required';
    }

    if (formData.status === 'scheduled' && !formData.scheduled_date) {
      errors.scheduled_date = 'Scheduled date is required for scheduled devotions';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = mode === 'edit' ? `/api/devotions/${devotion.id}` : '/api/devotions';
      const method = mode === 'edit' ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
        credentials: 'include'
      });

      if (response.ok) {
        onSuccess();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${mode} devotion`);
      }
    } catch (err) {
      console.error(`Error ${mode}ing devotion:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim().toLowerCase())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim().toLowerCase()]
      });
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const addReflectionQuestion = () => {
    if (newQuestion.trim()) {
      setFormData({
        ...formData,
        reflection_questions: [...formData.reflection_questions, newQuestion.trim()]
      });
      setNewQuestion('');
    }
  };

  const removeReflectionQuestion = (index) => {
    setFormData({
      ...formData,
      reflection_questions: formData.reflection_questions.filter((_, i) => i !== index)
    });
  };

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors({ ...validationErrors, [field]: null });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {mode === 'edit' ? 'Edit Devotion' : 'Create New Devotion'}
            </h2>
            <p className="text-slate-400 mt-1">
              {mode === 'edit' ? 'Update devotional content' : 'Create inspiring devotional content for your community'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-red-300 font-medium">Error</h4>
                <p className="text-red-200 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <BookOpenIcon className="h-5 w-5" />
                  Basic Information
                </h3>
                
                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      className={`w-full bg-slate-700/50 border rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        validationErrors.title ? 'border-red-500' : 'border-slate-600'
                      }`}
                      placeholder="Enter devotion title"
                    />
                    {validationErrors.title && (
                      <p className="text-red-400 text-sm mt-1">{validationErrors.title}</p>
                    )}
                  </div>

                  {/* Plan and Day */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Plan *
                      </label>
                      <select
                        value={formData.plan_id}
                        onChange={(e) => handleInputChange('plan_id', e.target.value)}
                        className={`w-full bg-slate-700/50 border rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          validationErrors.plan_id ? 'border-red-500' : 'border-slate-600'
                        }`}
                      >
                        <option value="">Select Plan</option>
                        {plans.map(plan => (
                          <option key={plan.id} value={plan.id}>{plan.name}</option>
                        ))}
                      </select>
                      {validationErrors.plan_id && (
                        <p className="text-red-400 text-sm mt-1">{validationErrors.plan_id}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Day Number *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.day_number}
                        onChange={(e) => handleInputChange('day_number', parseInt(e.target.value) || 1)}
                        className={`w-full bg-slate-700/50 border rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          validationErrors.day_number ? 'border-red-500' : 'border-slate-600'
                        }`}
                      />
                      {validationErrors.day_number && (
                        <p className="text-red-400 text-sm mt-1">{validationErrors.day_number}</p>
                      )}
                    </div>
                  </div>

                  {/* Author and Status */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Author *
                      </label>
                      <input
                        type="text"
                        value={formData.author}
                        onChange={(e) => handleInputChange('author', e.target.value)}
                        className={`w-full bg-slate-700/50 border rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          validationErrors.author ? 'border-red-500' : 'border-slate-600'
                        }`}
                        placeholder="Author name"
                      />
                      {validationErrors.author && (
                        <p className="text-red-400 text-sm mt-1">{validationErrors.author}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => handleInputChange('status', e.target.value)}
                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {statusOptions.map(status => (
                          <option key={status.key} value={status.key}>{status.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Scheduled Date */}
                  {formData.status === 'scheduled' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Scheduled Date *
                      </label>
                      <input
                        type="date"
                        value={formData.scheduled_date}
                        onChange={(e) => handleInputChange('scheduled_date', e.target.value)}
                        className={`w-full bg-slate-700/50 border rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          validationErrors.scheduled_date ? 'border-red-500' : 'border-slate-600'
                        }`}
                      />
                      {validationErrors.scheduled_date && (
                        <p className="text-red-400 text-sm mt-1">{validationErrors.scheduled_date}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Scripture Section */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Scripture</h3>
                
                <div className="space-y-4">
                  {/* Scripture Reference */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Scripture Reference *
                    </label>
                    <input
                      type="text"
                      value={formData.scripture_reference}
                      onChange={(e) => handleInputChange('scripture_reference', e.target.value)}
                      className={`w-full bg-slate-700/50 border rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        validationErrors.scripture_reference ? 'border-red-500' : 'border-slate-600'
                      }`}
                      placeholder="e.g., John 3:16, Psalm 23:1-3"
                    />
                    {validationErrors.scripture_reference && (
                      <p className="text-red-400 text-sm mt-1">{validationErrors.scripture_reference}</p>
                    )}
                  </div>

                  {/* Scripture Text */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Scripture Text *
                    </label>
                    <textarea
                      value={formData.scripture_text}
                      onChange={(e) => handleInputChange('scripture_text', e.target.value)}
                      rows={4}
                      className={`w-full bg-slate-700/50 border rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical ${
                        validationErrors.scripture_text ? 'border-red-500' : 'border-slate-600'
                      }`}
                      placeholder="Enter the full scripture text"
                    />
                    {validationErrors.scripture_text && (
                      <p className="text-red-400 text-sm mt-1">{validationErrors.scripture_text}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Content */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Content</h3>
                
                <div className="space-y-4">
                  {/* Main Content */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Devotional Content *
                    </label>
                    <textarea
                      value={formData.content}
                      onChange={(e) => handleInputChange('content', e.target.value)}
                      rows={8}
                      className={`w-full bg-slate-700/50 border rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical ${
                        validationErrors.content ? 'border-red-500' : 'border-slate-600'
                      }`}
                      placeholder="Write the main devotional content here..."
                    />
                    {validationErrors.content && (
                      <p className="text-red-400 text-sm mt-1">{validationErrors.content}</p>
                    )}
                  </div>

                  {/* Prayer Focus */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Prayer Focus
                    </label>
                    <textarea
                      value={formData.prayer_focus}
                      onChange={(e) => handleInputChange('prayer_focus', e.target.value)}
                      rows={3}
                      className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                      placeholder="Optional prayer focus or prayer points"
                    />
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <TagIcon className="h-5 w-5" />
                  Tags
                </h3>
                
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Add a tag"
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg transition-colors"
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="bg-slate-600 text-slate-200 px-2 py-1 rounded-lg text-sm flex items-center gap-1"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="text-slate-400 hover:text-red-400 transition-colors"
                          >
                            <XMarkIcon className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Reflection Questions */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Reflection Questions</h3>
                
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newQuestion}
                      onChange={(e) => setNewQuestion(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addReflectionQuestion())}
                      className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Add a reflection question"
                    />
                    <button
                      type="button"
                      onClick={addReflectionQuestion}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg transition-colors"
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {formData.reflection_questions.length > 0 && (
                    <div className="space-y-2">
                      {formData.reflection_questions.map((question, index) => (
                        <div
                          key={index}
                          className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 flex items-start justify-between gap-3"
                        >
                          <span className="text-slate-200 text-sm flex-1">{question}</span>
                          <button
                            type="button"
                            onClick={() => removeReflectionQuestion(index)}
                            className="text-slate-400 hover:text-red-400 transition-colors flex-shrink-0"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Resources */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Additional Resources</h3>
                <textarea
                  value={formData.additional_resources}
                  onChange={(e) => handleInputChange('additional_resources', e.target.value)}
                  rows={3}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                  placeholder="Optional additional resources, links, or references"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
              {mode === 'edit' ? 'Update Devotion' : 'Create Devotion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DevotionFormModal;



