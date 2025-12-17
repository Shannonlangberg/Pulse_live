import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BookOpenIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const buildEmptyForm = (sortOrder = 0) => ({
  displayName: '',
  slug: '',
  description: '',
  folderId: '',
  sortOrder,
  links: [],
});

const normalizeCategoryLinks = (links) => {
  if (!Array.isArray(links)) {
    return [];
  }

  return links
    .map((link, index) => ({
      id: link.id ?? null,
      _key: `existing-${link.id ?? index}`,
      label: link.label || '',
      url: link.url || '',
      description: link.description || '',
      sortOrder: link.sortOrder ?? link.sort_order ?? index,
    }))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
};

const ResourceManager = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState(buildEmptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCategories = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/resource-categories', {
        credentials: 'include',
      });

      if (response.status === 401) {
        setCategories([]);
        setError('Please sign in to manage resource categories.');
        return;
      }

      if (response.status === 403) {
        setCategories([]);
        setError('You do not have permission to manage resource categories.');
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to load resource categories.');
      }

      const data = await response.json();
      const categoryList = Array.isArray(data.categories) ? data.categories : [];
      setCategories(categoryList);
    } catch (err) {
      console.error('Failed to load resource categories', err);
      setError(err.message || 'Unable to load resource categories.');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (orderDiff !== 0) {
        return orderDiff;
      }
      return (a.displayName || '').localeCompare(b.displayName || '');
    });
  }, [categories]);

  const handleOpenModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        displayName: category.displayName || '',
        slug: category.slug || '',
        description: category.description || '',
        folderId: category.folderId || '',
        sortOrder: category.sortOrder ?? 0,
        links: normalizeCategoryLinks(category.links),
      });
    } else {
      setEditingCategory(null);
      setFormData(buildEmptyForm(categories.length));
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData(buildEmptyForm(categories.length));
    setIsSubmitting(false);
  };

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddLink = () => {
    setFormData((prev) => {
      const nextLinks = [
        ...prev.links,
        {
          id: null,
          _key: `new-${Date.now()}`,
          label: '',
          url: '',
          description: '',
          sortOrder: prev.links.length,
        },
      ];
      return {
        ...prev,
        links: nextLinks,
      };
    });
  };

  const handleLinkChange = (index, field, value) => {
    setFormData((prev) => {
      const nextLinks = [...prev.links];
      nextLinks[index] = {
        ...nextLinks[index],
        [field]: value,
      };
      return {
        ...prev,
        links: nextLinks,
      };
    });
  };

  const handleRemoveLink = (index) => {
    setFormData((prev) => {
      const nextLinks = prev.links.filter((_, idx) => idx !== index).map((link, idx) => ({
        ...link,
        sortOrder: idx,
      }));
      return {
        ...prev,
        links: nextLinks,
      };
    });
  };

  const handleReorderLink = (index, direction) => {
    setFormData((prev) => {
      const nextLinks = [...prev.links];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= nextLinks.length) {
        return prev;
      }
      const [moved] = nextLinks.splice(index, 1);
      nextLinks.splice(newIndex, 0, moved);
      return {
        ...prev,
        links: nextLinks.map((link, idx) => ({
          ...link,
          sortOrder: idx,
        })),
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedName = formData.displayName.trim();
    if (!trimmedName) {
      alert('Category name is required.');
      return;
    }

    const payload = {
      displayName: trimmedName,
      description: formData.description.trim(),
      folderId: formData.folderId.trim(),
      sortOrder: Number.isNaN(Number(formData.sortOrder))
        ? categories.length
        : Number(formData.sortOrder),
      links: formData.links
        .map((link, index) => ({
          id: link.id,
          label: link.label.trim(),
          url: link.url.trim(),
          description: link.description.trim(),
          sortOrder: index,
        }))
        .filter((link) => link.label && link.url),
    };

    const slugValue = formData.slug.trim();
    if (slugValue) {
      payload.slug = slugValue;
    }

    setIsSubmitting(true);

    try {
      const endpoint = editingCategory
        ? `/api/admin/resource-categories/${encodeURIComponent(editingCategory.slug || editingCategory.id)}`
        : '/api/admin/resource-categories';

      const method = editingCategory ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        alert('Please sign in to save resource categories. You may need to refresh the page after Google authentication.');
        setIsSubmitting(false);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save resource category.');
      }

      await loadCategories();
      handleCloseModal();
      alert(data.message || 'Resource category saved successfully.');
    } catch (err) {
      console.error('Failed to save resource category', err);
      alert(err.message || 'Failed to save resource category.');
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (category) => {
    if (!category) {
      return;
    }

    const confirmDelete = confirm(
      `Are you sure you want to delete "${category.displayName}" and its quick links?`
    );

    if (!confirmDelete) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/resource-categories/${encodeURIComponent(category.slug || category.id)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete resource category.');
      }

      await loadCategories();
      alert(data.message || 'Resource category deleted.');
    } catch (err) {
      console.error('Failed to delete resource category', err);
      alert(err.message || 'Failed to delete resource category.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-white text-xl">Loading resource categories...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center">
              <BookOpenIcon className="w-8 h-8 text-blue-300" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Resource Manager</h1>
              <p className="text-white/60 text-sm">
                Configure resource categories, linked Google Drive folders, and quick links.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Add Category
          </button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500/50 text-red-200 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/70 text-slate-300 text-sm">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Name</th>
                  <th className="px-6 py-4 text-left font-semibold">Identifier</th>
                  <th className="px-6 py-4 text-left font-semibold">Folder ID</th>
                  <th className="px-6 py-4 text-left font-semibold">Quick Links</th>
                  <th className="px-6 py-4 text-left font-semibold">Sort Order</th>
                  <th className="px-6 py-4 text-left font-semibold">Updated</th>
                  <th className="px-6 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-sm">
                {sortedCategories.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-white/60">
                      No categories configured yet. Start by adding one.
                    </td>
                  </tr>
                ) : (
                  sortedCategories.map((category) => (
                    <tr key={category.slug}>
                      <td className="px-6 py-4 text-white font-medium">
                        <div className="flex flex-col">
                          <span>{category.displayName}</span>
                          {category.description && (
                            <span className="text-xs text-white/50 mt-1 line-clamp-2">
                              {category.description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-white/70">
                        {category.slug}
                      </td>
                      <td className="px-6 py-4 text-white/60">
                        {category.folderId ? (
                          <code className="bg-slate-900/60 px-2 py-1 rounded text-xs">
                            {category.folderId}
                          </code>
                        ) : (
                          <span className="text-white/40 italic">Not linked</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-200 text-xs font-medium">
                          {category.links?.length || 0} link{(category.links?.length || 0) === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-white/70">
                        {category.sortOrder ?? 0}
                      </td>
                      <td className="px-6 py-4 text-white/60">
                        {category.updatedAt
                          ? new Date(category.updatedAt).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenModal(category)}
                            className="p-2 rounded-lg text-blue-300 hover:text-blue-200 hover:bg-blue-500/10 transition-colors"
                          >
                            <PencilIcon className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(category)}
                            className="p-2 rounded-lg text-red-300 hover:text-red-200 hover:bg-red-500/10 transition-colors"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  {editingCategory ? 'Edit Resource Category' : 'Add Resource Category'}
                </h2>
                <p className="text-white/50 text-sm">
                  Configure the category name, Drive folder, and any quick links.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-slate-700/50 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm text-white/70 font-medium">
                    Category Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.displayName}
                    onChange={(e) => handleFieldChange('displayName', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                    placeholder="HR"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70 font-medium">
                    Identifier (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => handleFieldChange('slug', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                    placeholder="hr"
                  />
                  <p className="text-xs text-white/40">
                    Used in URLs. Leave blank to generate automatically from the name.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70 font-medium">
                    Google Drive Folder ID
                  </label>
                  <input
                    type="text"
                    value={formData.folderId}
                    onChange={(e) => handleFieldChange('folderId', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                    placeholder="1H2I3J4K5LMN"
                  />
                  <p className="text-xs text-white/40">
                    Paste the ID from the Drive folder URL. Leave blank if not linked.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70 font-medium">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => handleFieldChange('sortOrder', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                    placeholder="0"
                  />
                  <p className="text-xs text-white/40">
                    Lower numbers appear first in the Resources tab.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/70 font-medium">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                  placeholder="Human resources policies, onboarding documents, and leave request forms."
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Quick Links</h3>
                    <p className="text-xs text-white/50">
                      Add external URLs like leave forms or policy pages. They appear above Drive files.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLink}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add Link
                  </button>
                </div>

                {formData.links.length === 0 ? (
                  <div className="border border-dashed border-white/20 rounded-xl p-6 text-center text-white/50">
                    No quick links yet. Click &quot;Add Link&quot; to include shortcuts.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.links.map((link, index) => (
                      <div
                        key={link.id ?? link._key ?? index}
                        className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-white/70 text-sm font-medium">
                            Link {index + 1}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleReorderLink(index, -1)}
                              disabled={index === 0}
                              className={`p-2 rounded-lg transition-colors ${
                                index === 0
                                  ? 'text-white/30 cursor-not-allowed'
                                  : 'text-white/70 hover:text-white hover:bg-slate-700/60'
                              }`}
                            >
                              <ArrowUpIcon className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReorderLink(index, 1)}
                              disabled={index === formData.links.length - 1}
                              className={`p-2 rounded-lg transition-colors ${
                                index === formData.links.length - 1
                                  ? 'text-white/30 cursor-not-allowed'
                                  : 'text-white/70 hover:text-white hover:bg-slate-700/60'
                              }`}
                            >
                              <ArrowDownIcon className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveLink(index)}
                              className="p-2 rounded-lg text-red-300 hover:text-red-200 hover:bg-red-500/10 transition-colors"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-white/60">
                              Link Label
                            </label>
                            <input
                              type="text"
                              value={link.label}
                              onChange={(e) => handleLinkChange(index, 'label', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500"
                              placeholder="Leave Request Form"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-white/60">
                              URL
                            </label>
                            <input
                              type="url"
                              value={link.url}
                              onChange={(e) => handleLinkChange(index, 'url', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500"
                              placeholder="https://forms.gle/..."
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-medium text-white/60">
                            Description (optional)
                          </label>
                          <textarea
                            rows={2}
                            value={link.description}
                            onChange={(e) => handleLinkChange(index, 'description', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500"
                            placeholder="Use this form to submit annual leave requests."
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col md:flex-row md:justify-end gap-3 border-t border-slate-800 pt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 text-white/80 hover:text-white hover:bg-slate-700 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`
                    px-5 py-2.5 rounded-xl text-white font-semibold transition-colors
                    ${isSubmitting ? 'bg-blue-500/40 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
                  `}
                >
                  {isSubmitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourceManager;

