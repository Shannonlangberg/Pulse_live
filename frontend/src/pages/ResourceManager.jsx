import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BookOpenIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  DocumentTextIcon,
  FolderIcon,
  LinkIcon,
  DocumentIcon,
  PhotoIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

const buildEmptyForm = (sortOrder = 0) => ({
  displayName: '',
  slug: '',
  description: '',
  folderId: '',
  sortOrder,
  links: [],
});

// Detect link type from URL
const detectLinkType = (url) => {
  if (!url) return 'website';
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('drive.google.com/drive/folders/') || lowerUrl.includes('drive.google.com/drive/u/') && lowerUrl.includes('/folders/')) {
    return 'drive_folder';
  }
  if (lowerUrl.includes('drive.google.com/file/') || lowerUrl.includes('drive.google.com/u/') && lowerUrl.includes('/file/')) {
    return 'drive_file';
  }
  if (lowerUrl.includes('docs.google.com/forms/') || lowerUrl.includes('forms.gle/')) {
    return 'google_form';
  }
  if (lowerUrl.includes('docs.google.com/document/') || lowerUrl.includes('docs.google.com/spreadsheets/')) {
    return 'google_doc';
  }
  if (lowerUrl.endsWith('.pdf') || lowerUrl.includes('.pdf')) {
    return 'pdf';
  }
  if (lowerUrl.includes('dropbox.com')) {
    return 'dropbox';
  }
  return 'website';
};

// Get icon for link type
const getLinkTypeIcon = (type) => {
  switch (type) {
    case 'drive_folder':
      return FolderIcon;
    case 'drive_file':
    case 'google_doc':
      return DocumentTextIcon;
    case 'google_form':
      return DocumentIcon;
    case 'pdf':
      return DocumentIcon;
    case 'dropbox':
      return FolderIcon;
    default:
      return LinkIcon;
  }
};

// Get badge color for link type
const getLinkTypeBadge = (type) => {
  switch (type) {
    case 'drive_folder':
      return 'bg-fc-wash-butter text-fc-brown border-fc-wash-butter-border';
    case 'drive_file':
      return 'bg-fc-wash-sky text-fc-midnight border-fc-wash-sky-border';
    case 'google_form':
      return 'bg-fc-wash-mint text-fc-brown border-fc-wash-mint-border';
    case 'google_doc':
      return 'bg-fc-wash-violet text-fc-midnight border-fc-thistle';
    case 'pdf':
      return 'bg-fc-wash-peach text-fc-copper border-fc-wash-peach-border';
    case 'dropbox':
      return 'bg-fc-wash-sky text-fc-midnight border-fc-wash-sky-border';
    default:
      return 'bg-fc-cream2 text-fc-brown border-fc-cream2';
  }
};

const normalizeCategoryLinks = (links) => {
  if (!Array.isArray(links)) {
    return [];
  }

  return links
    .map((link, index) => {
      const url = link.url || '';
      const linkType = detectLinkType(url);
      return {
        id: link.id ?? null,
        _key: `existing-${link.id ?? index}`,
        label: link.label || '',
        url: url,
        description: link.description || '',
        sortOrder: link.sortOrder ?? link.sort_order ?? index,
        type: link.type || linkType,
      };
    })
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
  
  // Display names management state
  const [showDisplayNamesModal, setShowDisplayNamesModal] = useState(false);
  const [managingCategory, setManagingCategory] = useState(null);
  const [driveItems, setDriveItems] = useState([]);
  const [driveOverrides, setDriveOverrides] = useState({});
  const [loadingDriveItems, setLoadingDriveItems] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [customNameInput, setCustomNameInput] = useState('');

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

  const handleManageDisplayNames = async (category) => {
    setManagingCategory(category);
    setShowDisplayNamesModal(true);
    setLoadingDriveItems(true);
    setDriveItems([]);
    setDriveOverrides({});
    
    try {
      // Fetch Drive items for this category
      const filesResponse = await fetch(`/api/resources/${encodeURIComponent(category.slug || category.id)}`, {
        credentials: 'include',
      });
      
      if (filesResponse.ok) {
        const data = await filesResponse.json();
        setDriveItems(data.files || []);
      }
      
      // Fetch existing overrides
      const overridesResponse = await fetch(`/api/admin/resource-categories/${encodeURIComponent(category.slug || category.id)}/drive-overrides`, {
        credentials: 'include',
      });
      
      if (overridesResponse.ok) {
        const data = await overridesResponse.json();
        const overridesMap = {};
        (data.overrides || []).forEach(o => {
          overridesMap[o.driveItemId] = o;
        });
        setDriveOverrides(overridesMap);
      }
    } catch (err) {
      console.error('Failed to load drive items', err);
    } finally {
      setLoadingDriveItems(false);
    }
  };

  const handleSaveCustomName = async (driveItemId) => {
    if (!customNameInput.trim() || !managingCategory) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/resource-categories/${encodeURIComponent(managingCategory.slug || managingCategory.id)}/drive-overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          driveItemId: driveItemId,
          customName: customNameInput.trim()
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save custom name');
      }
      
      const data = await response.json();
      setDriveOverrides(prev => ({
        ...prev,
        [driveItemId]: data.override
      }));
      setEditingItemId(null);
      setCustomNameInput('');
      alert('Custom name saved!');
    } catch (err) {
      console.error('Failed to save custom name', err);
      alert(err.message || 'Failed to save custom name');
    }
  };

  const handleDeleteOverride = async (overrideId, driveItemId) => {
    if (!confirm('Remove this custom name?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/resource-categories/${encodeURIComponent(managingCategory.slug || managingCategory.id)}/drive-overrides/${overrideId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete override');
      }
      
      setDriveOverrides(prev => {
        const updated = { ...prev };
        delete updated[driveItemId];
        return updated;
      });
      alert('Custom name removed!');
    } catch (err) {
      console.error('Failed to delete override', err);
      alert(err.message || 'Failed to delete override');
    }
  };

  const handleCloseDisplayNamesModal = () => {
    setShowDisplayNamesModal(false);
    setManagingCategory(null);
    setDriveItems([]);
    setDriveOverrides({});
    setEditingItemId(null);
    setCustomNameInput('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-fc-cream p-6 flex items-center justify-center">
        <div className="text-fc-brown text-lg">Loading resource categories...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fc-cream p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-fc-wash-sky flex items-center justify-center">
              <BookOpenIcon className="w-8 h-8 text-fc-teal" />
            </div>
            <div>
              <h1 className="fc-display fc-display-md">Resource Manager</h1>
              <p className="text-fc-brown text-sm">
                Configure resource categories, linked Google Drive folders, and quick links.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="fc-btn-primary"
          >
            <PlusIcon className="w-5 h-5" />
            Add Category
          </button>
        </div>

        {error && (
          <div className="bg-fc-wash-peach border border-fc-wash-peach-border text-fc-copper rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div className="fc-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-fc-cream2 text-fc-brown text-sm">
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
              <tbody className="divide-y divide-fc-cream2 text-sm">
                {sortedCategories.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-fc-brown">
                      No categories configured yet. Start by adding one.
                    </td>
                  </tr>
                ) : (
                  sortedCategories.map((category) => (
                    <tr key={category.slug}>
                      <td className="px-6 py-4 text-fc-midnight font-medium">
                        <div className="flex flex-col">
                          <span>{category.displayName}</span>
                          {category.description && (
                            <span className="text-xs text-fc-brown mt-1 line-clamp-2">
                              {category.description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-fc-brown">
                        {category.slug}
                      </td>
                      <td className="px-6 py-4 text-fc-brown">
                        {category.folderId ? (
                          <code className="bg-fc-cream2 px-2 py-1 rounded text-xs">
                            {category.folderId}
                          </code>
                        ) : (
                          <span className="text-fc-brown/50 italic">Not linked</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-fc-wash-sky-border bg-fc-wash-sky text-fc-midnight text-xs font-medium">
                          {category.links?.length || 0} link{(category.links?.length || 0) === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-fc-brown">
                        {category.sortOrder ?? 0}
                      </td>
                      <td className="px-6 py-4 text-fc-brown">
                        {category.updatedAt
                          ? new Date(category.updatedAt).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenModal(category)}
                            className="p-2 rounded-lg text-fc-teal hover:bg-fc-wash-sky transition-colors"
                            title="Edit Category"
                          >
                            <PencilIcon className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleManageDisplayNames(category)}
                            className="p-2 rounded-lg text-fc-violet hover:bg-fc-wash-violet transition-colors"
                            title="Manage Display Names"
                          >
                            <DocumentTextIcon className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(category)}
                            className="p-2 rounded-lg text-fc-copper hover:bg-fc-wash-peach transition-colors"
                            title="Delete Category"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-fc-midnight/50 p-4">
          <div className="bg-white border border-fc-cream2 rounded-2xl shadow-pop max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-fc-cream2">
              <div>
                <h2 className="fc-display fc-display-sm">
                  {editingCategory ? 'Edit Resource Category' : 'Add Resource Category'}
                </h2>
                <p className="text-fc-brown text-sm">
                  Configure the category name, Drive folder, and any quick links.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-2 rounded-xl text-fc-brown hover:text-fc-midnight hover:bg-fc-cream2 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm text-fc-brown font-medium">
                    Category Name <span className="text-fc-copper">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.displayName}
                    onChange={(e) => handleFieldChange('displayName', e.target.value)}
                    className="fc-input"
                    placeholder="HR"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-fc-brown font-medium">
                    Identifier (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => handleFieldChange('slug', e.target.value)}
                    className="fc-input"
                    placeholder="hr"
                  />
                  <p className="text-xs text-fc-brown/70">
                    Used in URLs. Leave blank to generate automatically from the name.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-fc-brown font-medium">
                    Google Drive Folder ID
                  </label>
                  <input
                    type="text"
                    value={formData.folderId}
                    onChange={(e) => handleFieldChange('folderId', e.target.value)}
                    className="fc-input"
                    placeholder="1H2I3J4K5LMN"
                  />
                  <p className="text-xs text-fc-brown/70">
                    Paste the ID from the Drive folder URL. Leave blank if not linked.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-fc-brown font-medium">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => handleFieldChange('sortOrder', e.target.value)}
                    className="fc-input"
                    placeholder="0"
                  />
                  <p className="text-xs text-fc-brown/70">
                    Lower numbers appear first in the Resources tab.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-fc-brown font-medium">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  className="fc-input"
                  placeholder="Human resources policies, onboarding documents, and leave request forms."
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-fc-midnight">Quick Links</h3>
                    <p className="text-xs text-fc-brown">
                      Add external URLs like leave forms or policy pages. They appear above Drive files.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLink}
                    className="fc-btn-secondary text-sm py-2 px-4"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add Link
                  </button>
                </div>

                {formData.links.length === 0 ? (
                  <div className="border border-dashed border-fc-cream2 rounded-xl p-6 text-center text-fc-brown">
                    No quick links yet. Click &quot;Add Link&quot; to include shortcuts.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.links.map((link, index) => (
                      <div
                        key={link.id ?? link._key ?? index}
                        className="bg-fc-cream border border-fc-cream2 rounded-xl p-4 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-fc-brown text-sm font-medium">
                            Link {index + 1}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleReorderLink(index, -1)}
                              disabled={index === 0}
                              className={`p-2 rounded-lg transition-colors ${
                                index === 0
                                  ? 'text-fc-brown/30 cursor-not-allowed'
                                  : 'text-fc-brown hover:text-fc-midnight hover:bg-fc-cream2'
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
                                  ? 'text-fc-brown/30 cursor-not-allowed'
                                  : 'text-fc-brown hover:text-fc-midnight hover:bg-fc-cream2'
                              }`}
                            >
                              <ArrowDownIcon className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveLink(index)}
                              className="p-2 rounded-lg text-fc-copper hover:bg-fc-wash-peach transition-colors"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-fc-brown">
                              Link Label
                            </label>
                            <input
                              type="text"
                              value={link.label}
                              onChange={(e) => handleLinkChange(index, 'label', e.target.value)}
                              className="fc-input"
                              placeholder="Leave Request Form"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-fc-brown">
                              URL
                            </label>
                            <input
                              type="url"
                              value={link.url}
                              onChange={(e) => handleLinkChange(index, 'url', e.target.value)}
                              className="fc-input"
                              placeholder="https://forms.gle/..."
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-medium text-fc-brown">
                            Description (optional)
                          </label>
                          <textarea
                            rows={2}
                            value={link.description}
                            onChange={(e) => handleLinkChange(index, 'description', e.target.value)}
                            className="fc-input"
                            placeholder="Use this form to submit annual leave requests."
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col md:flex-row md:justify-end gap-3 border-t border-fc-cream2 pt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="fc-btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="fc-btn-primary"
                >
                  {isSubmitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDisplayNamesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-fc-midnight/50 p-4">
          <div className="bg-white border border-fc-cream2 rounded-2xl shadow-pop max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-fc-cream2">
              <div>
                <h2 className="fc-display fc-display-sm">
                  Manage Display Names
                </h2>
                <p className="text-fc-brown text-sm">
                  {managingCategory?.displayName} - Set custom names for Drive items
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseDisplayNamesModal}
                className="p-2 rounded-xl text-fc-brown hover:text-fc-midnight hover:bg-fc-cream2 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 py-6">
              {loadingDriveItems ? (
                <div className="text-center py-12 text-fc-brown">
                  Loading Drive items...
                </div>
              ) : driveItems.length === 0 ? (
                <div className="text-center py-12 text-fc-brown">
                  No Drive items found. Make sure the folder has files/folders and you're authenticated with Google Drive.
                </div>
              ) : (
                <div className="space-y-3">
                  {driveItems.map((item) => {
                    const override = driveOverrides[item.id];
                    const isEditing = editingItemId === item.id;
                    const isFolder = item.mimeType && item.mimeType.includes('folder');

                    return (
                      <div
                        key={item.id}
                        className="bg-fc-cream border border-fc-cream2 rounded-xl p-4"
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
                            isFolder ? 'bg-fc-wash-butter' : 'bg-fc-wash-sky'
                          }`}>
                            {isFolder ? '📁' : '📄'}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="text-fc-brown/70 text-xs mb-1">
                              Original: {item.name}
                            </div>

                            {override ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-fc-midnight font-semibold">
                                    {override.customName}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-fc-wash-mint text-fc-brown text-xs">
                                    Custom
                                  </span>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingItemId(item.id);
                                      setCustomNameInput(override.customName);
                                    }}
                                    className="text-xs px-3 py-1 rounded-lg bg-fc-teal text-white hover:brightness-95 transition-all"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOverride(override.id, item.id)}
                                    className="text-xs px-3 py-1 rounded-lg bg-fc-copper text-white hover:brightness-95 transition-all"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ) : isEditing ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={customNameInput}
                                  onChange={(e) => setCustomNameInput(e.target.value)}
                                  placeholder="Enter custom display name"
                                  className="fc-input"
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveCustomName(item.id)}
                                    className="text-xs px-3 py-1 rounded-lg bg-fc-olive text-white hover:brightness-95 transition-all"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingItemId(null);
                                      setCustomNameInput('');
                                    }}
                                    className="text-xs px-3 py-1 rounded-lg bg-fc-cream2 text-fc-brown hover:bg-fc-cream2/70 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItemId(item.id);
                                  setCustomNameInput('');
                                }}
                                className="text-xs px-3 py-1 rounded-lg bg-fc-violet text-white hover:brightness-95 transition-all"
                              >
                                Set Custom Name
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourceManager;

