import React, { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon, EyeSlashIcon, XMarkIcon, FilmIcon } from '@heroicons/react/24/outline';

const TVManager = () => {
  const [series, setSeries] = useState([]);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [showEpisodeModal, setShowEpisodeModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAudienceModal, setShowAudienceModal] = useState(false);
  const [categories, setCategories] = useState(['foundations', 'leadership', 'parents', 'youth', 'teaching', 'worship', 'discipleship']);
  const [audiences, setAudiences] = useState(['all', 'adults', 'youth', 'kids', 'parents', 'leaders', 'new_believers']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSeries();
    // Load saved categories and audiences from localStorage
    const savedCategories = localStorage.getItem('tv_categories');
    const savedAudiences = localStorage.getItem('tv_audiences');
    if (savedCategories) setCategories(JSON.parse(savedCategories));
    if (savedAudiences) setAudiences(JSON.parse(savedAudiences));
  }, []);

  const fetchSeries = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tv/admin/series/all', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setSeries(data.series || []);
      } else {
        setError('Failed to load series');
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching series:', err);
      setError('Failed to load series');
      setLoading(false);
    }
  };

  const handleCreateSeries = () => {
    setSelectedSeries(null);
    setShowSeriesModal(true);
  };

  const handleEditSeries = (series) => {
    setSelectedSeries(series);
    setShowSeriesModal(true);
  };

  const handleAddEpisode = (series) => {
    setSelectedSeries(series);
    setShowEpisodeModal(true);
  };

  const handleEditEpisode = (series, episode) => {
    setSelectedSeries(series);
    setShowEpisodeModal(true);
    // Store episode in selectedSeries temporarily
    setSelectedSeries({ ...series, editingEpisode: episode });
  };

  const handleDeleteSeries = async (seriesId) => {
    if (!window.confirm('Are you sure you want to delete this series? This will also delete all episodes.')) {
      return;
    }

    try {
      const response = await fetch(`/api/tv/admin/series/${seriesId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        fetchSeries();
      } else {
        alert('Failed to delete series');
      }
    } catch (err) {
      console.error('Error deleting series:', err);
      alert('Failed to delete series');
    }
  };

  const handleDeleteEpisode = async (episodeId) => {
    if (!window.confirm('Are you sure you want to delete this episode?')) {
      return;
    }

    try {
      const response = await fetch(`/api/tv/admin/episode/${episodeId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        fetchSeries();
      } else {
        alert('Failed to delete episode');
      }
    } catch (err) {
      console.error('Error deleting episode:', err);
      alert('Failed to delete episode');
    }
  };

  const handleTogglePublish = async (seriesId, currentStatus) => {
    try {
      const response = await fetch(`/api/tv/admin/series/${seriesId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          is_published: !currentStatus
        })
      });

      if (response.ok) {
        fetchSeries();
      } else {
        alert('Failed to update series');
      }
    } catch (err) {
      console.error('Error updating series:', err);
      alert('Failed to update series');
    }
  };

  const saveCategories = (newCategories) => {
    setCategories(newCategories);
    localStorage.setItem('tv_categories', JSON.stringify(newCategories));
  };

  const saveAudiences = (newAudiences) => {
    setAudiences(newAudiences);
    localStorage.setItem('tv_audiences', JSON.stringify(newAudiences));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Pulse TV Manager</h1>
            <p className="text-slate-400">Manage TV series and episodes</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCategoryModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-700"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Manage Categories</span>
            </button>
            <button
              onClick={() => setShowAudienceModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-700"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Manage Audiences</span>
            </button>
            <button
              onClick={handleCreateSeries}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              <span>New Series</span>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/40 text-red-200 rounded-xl px-4 py-3 mb-6">
            {error}
          </div>
        )}

        {/* Series List */}
        <div className="space-y-6">
          {(series || []).map((s) => (
            <div
              key={s.id}
              className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700"
            >
              {/* Series Header */}
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  {s.thumbnail_url ? (
                    <div className="w-32 h-20 bg-slate-700 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={s.thumbnail_url}
                        alt={s.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-32 h-20 bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-white/30 text-2xl">📺</span>
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-2xl font-semibold text-white mb-2">{s.title}</h3>
                        {s.description && (
                          <p className="text-sm text-slate-400 mb-3">{s.description}</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          {s.category && (
                            <span className="text-xs px-2 py-1 bg-purple-600/20 text-purple-300 rounded border border-purple-600/30">
                              {s.category}
                            </span>
                          )}
                          {s.audience && (
                            <span className="text-xs px-2 py-1 bg-blue-600/20 text-blue-300 rounded border border-blue-600/30">
                              {s.audience}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAddEpisode(s)}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                        >
                          <PlusIcon className="w-4 h-4" />
                          <span>Add Episode</span>
                        </button>
                        <button
                          onClick={() => handleTogglePublish(s.id, s.is_published)}
                          className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
                          title={s.is_published ? 'Unpublish' : 'Publish'}
                        >
                          {s.is_published ? (
                            <EyeIcon className="w-5 h-5 text-green-400" />
                          ) : (
                            <EyeSlashIcon className="w-5 h-5 text-slate-500" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEditSeries(s)}
                          className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
                          title="Edit"
                        >
                          <PencilIcon className="w-5 h-5 text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleDeleteSeries(s.id)}
                          className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="w-5 h-5 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Episodes List */}
              {s.episodes && s.episodes.length > 0 && (
                <div className="p-6 bg-slate-900/50">
                  <h4 className="text-lg font-semibold text-white mb-4">Episodes ({s.episodes.length})</h4>
                  <div className="space-y-3">
                    {(s.episodes || []).map((episode) => (
                      <div
                        key={episode.id}
                        className="flex items-center justify-between p-4 bg-slate-800 rounded-lg border border-slate-700"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-24 h-14 bg-slate-700 rounded overflow-hidden flex-shrink-0">
                            {episode.video_url && (
                              <div className="w-full h-full bg-red-600/20 flex items-center justify-center">
                                <FilmIcon className="w-6 h-6 text-red-400" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="text-white font-medium">{episode.title}</h5>
                              {episode.is_published ? (
                                <span className="text-xs px-2 py-0.5 bg-green-600/20 text-green-300 rounded border border-green-600/30">
                                  Published
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 bg-slate-600/20 text-slate-300 rounded border border-slate-600/30">
                                  Draft
                                </span>
                              )}
                            </div>
                            {episode.description && (
                              <p className="text-sm text-slate-400 line-clamp-1">{episode.description}</p>
                            )}
                            {episode.video_url && (
                              <p className="text-xs text-slate-500 mt-1 truncate">{episode.video_url}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditEpisode(s, episode)}
                            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
                            title="Edit"
                          >
                            <PencilIcon className="w-4 h-4 text-blue-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteEpisode(episode.id)}
                            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {series.length === 0 && (
          <div className="text-center py-16">
            <p className="text-slate-400 text-lg">No series yet. Create your first series!</p>
          </div>
        )}
      </div>

      {/* Series Modal */}
      {showSeriesModal && (
        <SeriesModal
          series={selectedSeries}
          categories={categories}
          audiences={audiences}
          onClose={() => {
            setShowSeriesModal(false);
            setSelectedSeries(null);
          }}
          onSave={() => {
            setShowSeriesModal(false);
            setSelectedSeries(null);
            fetchSeries();
          }}
        />
      )}

      {/* Episode Modal */}
      {showEpisodeModal && selectedSeries && (
        <EpisodeModal
          series={selectedSeries}
          episode={selectedSeries.editingEpisode || null}
          onClose={() => {
            setShowEpisodeModal(false);
            setSelectedSeries(null);
          }}
          onSave={() => {
            setShowEpisodeModal(false);
            setSelectedSeries(null);
            fetchSeries();
          }}
        />
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <CategoryManagerModal
          categories={categories}
          onClose={() => setShowCategoryModal(false)}
          onSave={(newCategories) => {
            saveCategories(newCategories);
            setShowCategoryModal(false);
          }}
        />
      )}

      {/* Audience Management Modal */}
      {showAudienceModal && (
        <AudienceManagerModal
          audiences={audiences}
          onClose={() => setShowAudienceModal(false)}
          onSave={(newAudiences) => {
            saveAudiences(newAudiences);
            setShowAudienceModal(false);
          }}
        />
      )}
    </div>
  );
};

// Series Modal Component
const SeriesModal = ({ series, categories, audiences, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    audience: 'all',
    thumbnail_url: '',
    is_published: false,
    tags: [],
    create_custom_step: false,
    custom_step_name: ''
  });
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [thumbnailPreview, setThumbnailPreview] = useState('');

  useEffect(() => {
    if (series) {
      setFormData({
        title: series.title || '',
        description: series.description || '',
        category: series.category || '',
        audience: series.audience || 'all',
        thumbnail_url: series.thumbnail_url || '',
        is_published: series.is_published || false,
        tags: series.tags?.map(t => t.name) || [],
        create_custom_step: series.create_custom_step || false,
        custom_step_name: series.custom_step_name || ''
      });
      setThumbnailPreview(series.thumbnail_url || '');
    }
  }, [series]);

  useEffect(() => {
    setThumbnailPreview(formData.thumbnail_url);
  }, [formData.thumbnail_url]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = series
        ? `/api/tv/admin/series/${series.id}`
        : '/api/tv/admin/series';
      
      const method = series ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onSave();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save series');
      }
    } catch (err) {
      console.error('Error saving series:', err);
      alert('Failed to save series');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()]
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(t => t !== tag)
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">
              {series ? 'Edit Series' : 'Create Series'}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Thumbnail Preview */}
            {thumbnailPreview && (
              <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden mb-4 border border-slate-700">
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-700"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-700"
                >
                  <option value="">Select category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Audience
                </label>
                <select
                  value={formData.audience}
                  onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-700"
                >
                  {audiences.map(aud => (
                    <option key={aud} value={aud}>{aud.charAt(0).toUpperCase() + aud.slice(1).replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Thumbnail
              </label>
              
              {/* Upload Button */}
              <div className="mb-3">
                <label className="flex items-center justify-center w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg cursor-pointer transition-colors">
                  {uploadingImage ? (
                    <>
                      <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload Image
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      // Validate file size (5MB)
                      if (file.size > 5 * 1024 * 1024) {
                        alert('File too large. Maximum size is 5MB');
                        return;
                      }
                      
                      // Validate file type
                      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
                      if (!validTypes.includes(file.type)) {
                        alert('Invalid file type. Use PNG, JPG, GIF, or WEBP');
                        return;
                      }
                      
                      // Upload file
                      const formData = new FormData();
                      formData.append('file', file);
                      
                      try {
                        setUploadingImage(true);
                        const response = await fetch('/api/tv/upload-thumbnail', {
                          method: 'POST',
                          credentials: 'include',
                          body: formData
                        });
                        
                        if (response.ok) {
                          const data = await response.json();
                          setFormData({ ...formData, thumbnail_url: data.url });
                          setThumbnailPreview(data.url);
                        } else {
                          const error = await response.json();
                          alert(error.error || 'Failed to upload image');
                        }
                      } catch (err) {
                        console.error('Error uploading image:', err);
                        alert('Failed to upload image');
                      } finally {
                        setUploadingImage(false);
                        e.target.value = ''; // Reset input
                      }
                    }}
                  />
                </label>
                <p className="text-xs text-slate-500 mt-2 text-center">Or enter a URL below</p>
              </div>
              
              {/* URL Input */}
              <input
                type="text"
                value={formData.thumbnail_url}
                onChange={(e) => {
                  setFormData({ ...formData, thumbnail_url: e.target.value });
                  setThumbnailPreview(e.target.value);
                }}
                className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-700"
                placeholder="https://... or /api/tv/uploads/tv/... or upload image above"
              />
              <p className="text-xs text-slate-500 mt-1">Enter a direct image URL or upload an image (JPG, PNG, GIF, WEBP - Max 5MB)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Tags
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-700"
                  placeholder="Add tag..."
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-purple-600/20 text-purple-300 rounded-lg text-sm border border-purple-600/30"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Custom Discipleship Step */}
            <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="create_custom_step"
                  checked={formData.create_custom_step}
                  onChange={(e) => setFormData({ ...formData, create_custom_step: e.target.checked })}
                  className="w-4 h-4 rounded bg-slate-900 text-purple-600 focus:ring-purple-500 border-slate-700"
                />
                <label htmlFor="create_custom_step" className="text-sm font-medium text-slate-300">
                  Create Custom Discipleship Step
                </label>
              </div>
              {formData.create_custom_step && (
                <div>
                  <label className="block text-xs text-slate-400 mb-2">
                    Step Name (leave empty to use series title)
                  </label>
                  <input
                    type="text"
                    value={formData.custom_step_name}
                    onChange={(e) => setFormData({ ...formData, custom_step_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-700 text-sm"
                    placeholder={formData.title || "Series title will be used"}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    When someone completes all episodes in this series, a discipleship step with this name will be added to their profile
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_published"
                checked={formData.is_published}
                onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                className="w-4 h-4 rounded bg-slate-900 text-purple-600 focus:ring-purple-500 border-slate-700"
              />
              <label htmlFor="is_published" className="text-sm text-slate-300">
                Publish immediately
              </label>
            </div>

            <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-700">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Episode Modal Component with YouTube URL support
const EpisodeModal = ({ series, episode, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    video_url: '',
    thumbnail_url: '',
    duration_seconds: 0,
    order_index: 0,
    is_published: false,
    downloadable_notes_url: '',
    discipleship_links: [],
    create_custom_step: false,
    custom_step_name: ''
  });
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingThumbnail, setGeneratingThumbnail] = useState(false);
  const [thumbnailPreview, setThumbnailPreview] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeError, setYoutubeError] = useState('');
  
  // Available discipleship step types
  const discipleshipStepTypes = [
    { value: 'salvation', label: 'Salvation' },
    { value: 'baptism', label: 'Baptism' },
    { value: 'holy_spirit', label: 'Holy Spirit' },
    { value: 'next_steps', label: 'Next Steps' },
    { value: 'dna_completed', label: 'DNA Completed' },
    { value: 'rise_attended', label: 'Rise Attended' },
    { value: 'first_served', label: 'First Served' }
  ];

  useEffect(() => {
    if (episode) {
      setFormData({
        title: episode.title || '',
        description: episode.description || '',
        video_url: episode.video_url || '',
        thumbnail_url: episode.thumbnail_url || '',
        duration_seconds: episode.duration_seconds || 0,
        order_index: episode.order_index || 0,
        is_published: episode.is_published || false,
        downloadable_notes_url: episode.downloadable_notes_url || '',
        discipleship_links: episode.discipleship_links?.map(link => ({
          discipleship_step_type: link.discipleship_step_type,
          auto_complete: link.auto_complete
        })) || [],
        create_custom_step: episode.create_custom_step || false,
        custom_step_name: episode.custom_step_name || ''
      });
      // Extract YouTube URL if it's already in video_url
      if (episode.video_url) {
        const videoId = extractYouTubeId(episode.video_url);
        if (videoId) {
          setYoutubeUrl(`https://www.youtube.com/watch?v=${videoId}`);
        } else {
          setYoutubeUrl(episode.video_url);
        }
      }
      // Set thumbnail preview
      setThumbnailPreview(episode.thumbnail_url || '');
    } else {
      // Get next order index
      const maxOrder = series.episodes ? Math.max(...series.episodes.map(e => e.order_index || 0), 0) : 0;
      setFormData({
        ...formData,
        order_index: maxOrder + 1
      });
    }
  }, [episode, series]);

  useEffect(() => {
    setThumbnailPreview(formData.thumbnail_url);
  }, [formData.thumbnail_url]);

  const extractYouTubeId = (url) => {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleYoutubeUrlChange = (url) => {
    setYoutubeUrl(url);
    setYoutubeError('');
    
    const videoId = extractYouTubeId(url);
    if (videoId) {
      // Store the embed URL format
      setFormData({
        ...formData,
        video_url: `https://www.youtube.com/watch?v=${videoId}`
      });
    } else if (url.trim() === '') {
      setFormData({
        ...formData,
        video_url: ''
      });
    } else {
      // Allow other video URLs (Vimeo, direct links, etc.)
      setFormData({
        ...formData,
        video_url: url
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate YouTube URL if provided
    if (youtubeUrl && !extractYouTubeId(youtubeUrl) && !youtubeUrl.includes('vimeo') && !youtubeUrl.startsWith('http')) {
      setYoutubeError('Please enter a valid YouTube URL (e.g., https://www.youtube.com/watch?v=VIDEO_ID)');
      return;
    }

    setLoading(true);

    try {
      const url = episode
        ? `/api/tv/admin/episode/${episode.id}`
        : '/api/tv/admin/episode';
      
      const method = episode ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        series_id: series.id
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        onSave();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save episode');
      }
    } catch (err) {
      console.error('Error saving episode:', err);
      alert('Failed to save episode');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const parseDuration = (durationStr) => {
    const parts = durationStr.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return 0;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {episode ? 'Edit Episode' : 'Add Episode'}
              </h2>
              <p className="text-sm text-slate-400 mt-1">Series: {series.title}</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* YouTube Best Practices Info */}
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-blue-300 mb-2">💡 Best Practice for Video Hosting</h3>
            <ul className="text-xs text-slate-300 space-y-1">
              <li>• <strong>YouTube Unlisted:</strong> Free, professional, easy to manage. Set videos to "Unlisted" in YouTube settings.</li>
              <li>• <strong>Vimeo:</strong> More control, better privacy, but requires paid plan for advanced features.</li>
              <li>• <strong>Self-hosted:</strong> Full control but requires storage/CDN setup (AWS S3, CloudFront, etc.).</li>
              <li>• <strong>Recommendation:</strong> Use YouTube Unlisted for most content - it's free, reliable, and professional.</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-700"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                YouTube URL or Video URL *
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => handleYoutubeUrlChange(e.target.value)}
                  className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-700"
                  placeholder="https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID"
                  required
                />
                {formData.video_url && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!formData.video_url) {
                        alert('Please enter a video URL first');
                        return;
                      }
                      try {
                        setGeneratingThumbnail(true);
                        const response = await fetch('/api/tv/generate-thumbnail', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          credentials: 'include',
                          body: JSON.stringify({
                            video_url: formData.video_url,
                            type: 'episode',
                            item_id: episode?.id || null
                          })
                        });
                        const data = await response.json();
                        if (response.ok) {
                          // Update episode thumbnail_url directly
                          setFormData({ ...formData, thumbnail_url: data.thumbnail_url });
                          setThumbnailPreview(data.thumbnail_url);
                          alert('Thumbnail generated successfully!');
                        } else {
                          alert(data.error || 'Failed to generate thumbnail');
                        }
                      } catch (err) {
                        console.error('Error generating thumbnail:', err);
                        alert('Failed to generate thumbnail');
                      } finally {
                        setGeneratingThumbnail(false);
                      }
                    }}
                    disabled={!formData.video_url || generatingThumbnail}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    title="Generate thumbnail from video"
                  >
                    {generatingThumbnail ? 'Generating...' : '📸 Auto Thumbnail'}
                  </button>
                )}
              </div>
              {youtubeError && (
                <p className="text-xs text-red-400 mt-1">{youtubeError}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                Supports YouTube (watch or youtu.be), Vimeo, or direct video URLs. Click "Auto Thumbnail" to generate from video.
              </p>
              {formData.video_url && extractYouTubeId(formData.video_url) && (
                <div className="mt-2 p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
                  <p className="text-xs text-green-300">✓ YouTube URL detected and validated</p>
                </div>
              )}
            </div>

            {/* Episode Thumbnail */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Episode Thumbnail (Optional - will use series thumbnail if not set)
              </label>
              
              {/* Thumbnail Preview */}
              {thumbnailPreview && (
                <div className="mb-3">
                  <img
                    src={thumbnailPreview}
                    alt="Thumbnail preview"
                    className="w-full max-w-xs h-32 object-cover rounded-lg border border-slate-700"
                    onError={(e) => {
                      console.error('Failed to load thumbnail:', thumbnailPreview);
                      e.target.style.display = 'none';
                    }}
                    onLoad={() => {
                      console.log('Thumbnail loaded successfully:', thumbnailPreview);
                    }}
                  />
                </div>
              )}
              
              {/* Upload Button */}
              <div className="mb-3">
                <label className="flex items-center justify-center w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg cursor-pointer transition-colors">
                  {uploadingImage ? (
                    <>
                      <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload Image
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      if (file.size > 5 * 1024 * 1024) {
                        alert('File too large. Maximum size is 5MB');
                        return;
                      }
                      
                      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
                      if (!validTypes.includes(file.type)) {
                        alert('Invalid file type. Use PNG, JPG, GIF, or WEBP');
                        return;
                      }
                      
                      const formDataToSend = new FormData();
                      formDataToSend.append('file', file);
                      
                      try {
                        setUploadingImage(true);
                        const response = await fetch('/api/tv/upload-thumbnail', {
                          method: 'POST',
                          credentials: 'include',
                          body: formDataToSend
                        });
                        
                        if (response.ok) {
                          const data = await response.json();
                          setFormData({ ...formData, thumbnail_url: data.url });
                          setThumbnailPreview(data.url);
                        } else {
                          const error = await response.json();
                          alert(error.error || 'Failed to upload image');
                        }
                      } catch (err) {
                        console.error('Error uploading image:', err);
                        alert('Failed to upload image');
                      } finally {
                        setUploadingImage(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>
              
              {/* URL Input */}
              <input
                type="text"
                value={formData.thumbnail_url || ''}
                onChange={(e) => {
                  setFormData({ ...formData, thumbnail_url: e.target.value });
                  setThumbnailPreview(e.target.value);
                }}
                onInvalid={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  return false;
                }}
                onBlur={(e) => {
                  // Clear any validation tooltips
                  e.target.setCustomValidity('');
                }}
                className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-700"
                placeholder="https://... or /api/tv/uploads/tv/... or upload image above"
              />
              <p className="text-xs text-slate-500 mt-1">Enter a direct image URL or upload an image. If empty, will use series thumbnail.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Duration (MM:SS or HH:MM:SS)
                </label>
                <input
                  type="text"
                  value={formatDuration(formData.duration_seconds)}
                  onChange={(e) => {
                    const seconds = parseDuration(e.target.value);
                    setFormData({ ...formData, duration_seconds: seconds });
                  }}
                  className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-700"
                  placeholder="5:30 or 1:05:30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Episode Order
                </label>
                <input
                  type="number"
                  value={formData.order_index}
                  onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-700"
                  min="1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Downloadable Notes URL (Optional)
              </label>
              <input
                type="text"
                value={formData.downloadable_notes_url}
                onChange={(e) => setFormData({ ...formData, downloadable_notes_url: e.target.value })}
                className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-700"
                placeholder="https://..."
              />
            </div>

            {/* Custom Discipleship Step */}
            <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="episode_create_custom_step"
                  checked={formData.create_custom_step}
                  onChange={(e) => setFormData({ ...formData, create_custom_step: e.target.checked })}
                  className="w-4 h-4 rounded bg-slate-900 text-purple-600 focus:ring-purple-500 border-slate-700"
                />
                <label htmlFor="episode_create_custom_step" className="text-sm font-medium text-slate-300">
                  Create Custom Discipleship Step
                </label>
              </div>
              {formData.create_custom_step && (
                <div>
                  <label className="block text-xs text-slate-400 mb-2">
                    Step Name (leave empty to use episode title)
                  </label>
                  <input
                    type="text"
                    value={formData.custom_step_name}
                    onChange={(e) => setFormData({ ...formData, custom_step_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-700 text-sm"
                    placeholder={formData.title || "Episode title will be used"}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    When someone completes this episode, a discipleship step with this name will be added to their profile
                  </p>
                </div>
              )}
            </div>

            {/* Discipleship Links */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Link to Existing Discipleship Steps (Optional)
              </label>
              <p className="text-xs text-slate-500 mb-3">
                When someone completes this episode, automatically mark these predefined discipleship steps as complete
              </p>
              <div className="space-y-2">
                {formData.discipleship_links.map((link, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-slate-900 rounded-lg border border-slate-700">
                    <select
                      value={link.discipleship_step_type}
                      onChange={(e) => {
                        const newLinks = [...formData.discipleship_links];
                        newLinks[index].discipleship_step_type = e.target.value;
                        setFormData({ ...formData, discipleship_links: newLinks });
                      }}
                      className="flex-1 px-3 py-2 bg-slate-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-700 text-sm"
                    >
                      <option value="">Select step type...</option>
                      {discipleshipStepTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={link.auto_complete}
                        onChange={(e) => {
                          const newLinks = [...formData.discipleship_links];
                          newLinks[index].auto_complete = e.target.checked;
                          setFormData({ ...formData, discipleship_links: newLinks });
                        }}
                        className="w-4 h-4 rounded bg-slate-800 text-purple-600 focus:ring-purple-500 border-slate-700"
                      />
                      Auto-complete
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const newLinks = formData.discipleship_links.filter((_, i) => i !== index);
                        setFormData({ ...formData, discipleship_links: newLinks });
                      }}
                      className="px-3 py-2 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      discipleship_links: [...formData.discipleship_links, { discipleship_step_type: '', auto_complete: true }]
                    });
                  }}
                  className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors text-sm"
                >
                  + Add Discipleship Step Link
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="episode_is_published"
                checked={formData.is_published}
                onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                className="w-4 h-4 rounded bg-slate-900 text-purple-600 focus:ring-purple-500 border-slate-700"
              />
              <label htmlFor="episode_is_published" className="text-sm text-slate-300">
                Publish immediately
              </label>
            </div>

            <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-700">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Episode'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Category Manager Modal
const CategoryManagerModal = ({ categories, onClose, onSave }) => {
  const [items, setItems] = useState(categories);
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    const trimmed = newItem.trim().toLowerCase().replace(/\s+/g, '_');
    if (trimmed && !items.includes(trimmed)) {
      setItems([...items, trimmed]);
      setNewItem('');
    }
  };

  const handleRemove = (item) => {
    setItems(items.filter(i => i !== item));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-2xl max-w-md w-full border border-slate-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Manage Categories</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
                className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-700"
                placeholder="Add new category..."
              />
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Add
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {items.map((item) => (
                <div key={item} className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-700">
                  <span className="text-white capitalize">{item.replace(/_/g, ' ')}</span>
                  <button
                    onClick={() => handleRemove(item)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => onSave(items)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Audience Manager Modal
const AudienceManagerModal = ({ audiences, onClose, onSave }) => {
  const [items, setItems] = useState(audiences);
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    const trimmed = newItem.trim().toLowerCase().replace(/\s+/g, '_');
    if (trimmed && !items.includes(trimmed)) {
      setItems([...items, trimmed]);
      setNewItem('');
    }
  };

  const handleRemove = (item) => {
    setItems(items.filter(i => i !== item));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-2xl max-w-md w-full border border-slate-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Manage Audiences</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
                className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-700"
                placeholder="Add new audience..."
              />
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Add
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {items.map((item) => (
                <div key={item} className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-700">
                  <span className="text-white capitalize">{item.replace(/_/g, ' ')}</span>
                  <button
                    onClick={() => handleRemove(item)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => onSave(items)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TVManager;
