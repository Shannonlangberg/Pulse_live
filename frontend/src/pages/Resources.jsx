import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderIcon,
  DocumentTextIcon,
  DocumentIcon,
  TableCellsIcon,
  ChevronRightIcon,
  ArrowUpRightIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';

const loadingStates = {
  categories: 'Loading resource categories...',
  files: 'Loading files...',
};

const formatModifiedTime = (value) => {
  if (!value) {
    return 'Unknown';
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }
    return new Intl.DateTimeFormat('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch (error) {
    return 'Unknown';
  }
};

const normalizeLinks = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const label = (item.label || item.name || '').trim();
      const url = (item.url || item.href || '').trim();
      if (!label || !url) {
        return null;
      }

      const description = (item.description || item.summary || '').trim();
      let sortOrder = item.sortOrder ?? item.sort_order;
      if (typeof sortOrder !== 'number') {
        sortOrder = index;
      }

      return {
        id: item.id ?? `link-${index}`,
        label,
        url,
        description,
        sortOrder,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (orderDiff !== 0) {
        return orderDiff;
      }
      return a.label.localeCompare(b.label);
    });
};

// Pick a document icon based on mime type / name — nearest heroicons match.
const getDocIcon = (file) => {
  const mime = (file.mimeType || '').toLowerCase();
  const name = (file.displayName || file.name || '').toLowerCase();
  if (mime.includes('spreadsheet') || name.endsWith('.csv') || name.endsWith('.xlsx')) {
    return TableCellsIcon;
  }
  if (mime.includes('document') || mime.includes('pdf') || name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx')) {
    return DocumentTextIcon;
  }
  return DocumentIcon;
};

const Resources = () => {
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');

  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  // Folder navigation state
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderBreadcrumb, setFolderBreadcrumb] = useState([]);

  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === selectedCategoryId) || null,
    [categories, selectedCategoryId]
  );

  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError('');
    try {
      const response = await fetch('/api/resources/categories', {
        credentials: 'include',
      });

      if (response.status === 401) {
        const payload = await response.json().catch(() => ({}));
        setCategories([]);
        setCategoriesError(payload.error || 'Please sign in to view resources.');
        return;
      }

      if (response.status === 403) {
        const payload = await response.json().catch(() => ({}));
        setCategories([]);
        setCategoriesError(payload.error || 'You do not have access to view resources.');
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const errorMsg = payload.error || `Unable to load resource categories (${response.status}). Please try again.`;
        console.error('Resources fetch error:', errorMsg, payload);
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const categoryList = Array.isArray(data.categories) ? data.categories : [];
      categoryList.sort((a, b) => {
        const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        if (orderDiff !== 0) {
          return orderDiff;
        }
        return (a.displayName || a.name || '').localeCompare(b.displayName || b.name || '');
      });
      setCategories(categoryList);
      if (categoryList.length > 0) {
        setSelectedCategoryId((current) => current || categoryList[0].id);
      }
    } catch (error) {
      setCategoriesError(error.message || 'Unable to load resource categories.');
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const fetchFiles = useCallback(
    async (categoryId, folderId = null) => {
      if (!categoryId) {
        return;
      }

      setFilesLoading(true);
      setFilesError('');
      setAuthRequired(false);
      if (!folderId) {
        setLinks([]);
      }

      try {
        const url = folderId
          ? `/api/resources/${encodeURIComponent(categoryId)}/folder/${encodeURIComponent(folderId)}`
          : `/api/resources/${encodeURIComponent(categoryId)}`;

        const response = await fetch(url, {
          credentials: 'include',
        });

        const payload = await response.json().catch(() => ({}));

        // Debug logging
        console.log('Resources API Response:', {
          status: response.status,
          categoryId,
          folderId,
          filesCount: payload.files?.length || 0,
          linksCount: payload.links?.length || 0,
          driveAuthNeeded: payload.drive_auth_needed,
          driveError: payload.drive_error,
          hasFolderId: payload.has_folder_id,
          hasAccessToken: payload.has_access_token,
          responseFolderId: payload.folder_id,
          files: payload.files,
          links: payload.links
        });

        if (response.status === 401) {
          setFiles([]);
          setLinks([]);
          setFilesError('Please sign in to view resources.');
          return;
        }

        // Check if we need Google Drive authentication
        if (payload.drive_auth_needed) {
          console.warn('Google Drive authentication needed:', payload.drive_error);
          setAuthRequired(true);
        }

        // Show drive error in UI if present
        if (payload.drive_error && !payload.drive_auth_needed) {
          console.error('Drive error:', payload.drive_error);
          setFilesError(payload.drive_error);
        }

        if (!response.ok) {
          const message = payload.error || 'Unable to fetch files for this category.';
          throw new Error(message);
        }

        const items = Array.isArray(payload.files) ? payload.files : [];
        items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        console.log('Setting files:', items.length, 'files');
        setFiles(items);

        // Only update links when at root level
        if (!folderId) {
          setLinks(normalizeLinks(payload.links));
        }

        // Only clear auth required if we got files or if no folder is configured
        if (!payload.drive_auth_needed) {
          setAuthRequired(false);
        }
      } catch (error) {
        setFilesError(error.message || 'Something went wrong while loading files.');
        setFiles([]);
        if (!folderId) {
          setLinks([]);
        }
      } finally {
        setFilesLoading(false);
      }
    },
    []
  );

  const handleFolderClick = (folder) => {
    // Add current folder to breadcrumb
    setFolderBreadcrumb(prev => [...prev, { id: folder.id, name: folder.displayName || folder.name }]);
    setCurrentFolderId(folder.id);
    fetchFiles(selectedCategoryId, folder.id);
  };

  const handleBreadcrumbClick = (index) => {
    if (index === -1) {
      // Go back to root
      setFolderBreadcrumb([]);
      setCurrentFolderId(null);
      fetchFiles(selectedCategoryId);
    } else {
      // Go to specific breadcrumb
      const newBreadcrumb = folderBreadcrumb.slice(0, index + 1);
      const folderId = folderBreadcrumb[index].id;
      setFolderBreadcrumb(newBreadcrumb);
      setCurrentFolderId(folderId);
      fetchFiles(selectedCategoryId, folderId);
    }
  };

  const handleAuthorize = useCallback(async () => {
    setIsLinking(true);
    setFilesError('');

    try {
      const params = selectedCategoryId ? `?category=${encodeURIComponent(selectedCategoryId)}` : '';
      const response = await fetch(`/api/google/auth-url${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Unable to begin Google authentication. Please try again.');
      }

      const data = await response.json();
      const authUrl = data.auth_url || data.authUrl;
      if (!authUrl) {
        throw new Error('Missing Google authentication URL.');
      }

      // Always use full-page redirect (no popup)
      sessionStorage.setItem('google_oauth_in_progress', 'true');
      sessionStorage.setItem('google_oauth_redirect', '/resources');
      window.location.href = authUrl;
      return; // Don't set error - we're navigating away
    } catch (error) {
      setFilesError(error.message || 'Unable to begin Google authentication.');
    } finally {
      setIsLinking(false);
    }
  }, [selectedCategoryId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (selectedCategoryId) {
      setFolderBreadcrumb([]);
      setCurrentFolderId(null);
      fetchFiles(selectedCategoryId);
    }
  }, [selectedCategoryId, fetchFiles]);

  // Handle OAuth redirect - check for success flag in URL or sessionStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('oauth_success');
    const oauthSuccessStorage = sessionStorage.getItem('google_oauth_success');

    if (oauthSuccess || oauthSuccessStorage) {
      // Clean up
      sessionStorage.removeItem('google_oauth_success');
      window.history.replaceState({}, '', '/resources');

      setAuthRequired(false);
      if (selectedCategoryId) {
        fetchFiles(selectedCategoryId);
      }
    }
  }, [selectedCategoryId, fetchFiles]);

  const renderCategoryPills = () => {
    if (categoriesLoading) {
      return <div className="text-fc-brown text-sm">{loadingStates.categories}</div>;
    }

    if (categoriesError) {
      return (
        <div className="text-fc-copper bg-fc-wash-peach border border-fc-wash-peach-border rounded-xl px-4 py-3 text-sm">
          {categoriesError}
        </div>
      );
    }

    if (categories.length === 0) {
      return <div className="text-fc-brown text-sm">No resource categories configured yet.</div>;
    }

    return (
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((category) => {
          const isActive = category.id === selectedCategoryId;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategoryId(category.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                isActive
                  ? 'bg-fc-olive/10 border-fc-olive/40 text-fc-midnight'
                  : 'bg-white border-fc-cream2 text-fc-brown hover:border-fc-olive/30'
              }`}
            >
              {category.displayName || category.name}
            </button>
          );
        })}
      </div>
    );
  };

  const renderQuickLinks = () => (
    <div className="bg-fc-wash-sky border border-fc-wash-sky-border rounded-xl p-5">
      <div className="fc-label mb-3">Quick links</div>
      <div className="flex flex-col">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 py-2.5 border-b border-fc-brown/10 last:border-b-0 text-sm text-fc-midnight hover:text-fc-copper transition-colors"
          >
            <span className="min-w-0 truncate">{link.label}</span>
            <ArrowUpRightIcon className="w-3.5 h-3.5 flex-shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );

  const renderBreadcrumb = () => {
    if (folderBreadcrumb.length === 0) return null;
    return (
      <div className="flex items-center flex-wrap gap-2 text-sm px-6 py-3 border-b border-fc-cream2 bg-fc-cream">
        <button
          onClick={() => handleBreadcrumbClick(-1)}
          className="text-fc-copper hover:underline font-medium"
        >
          {selectedCategory.displayName || selectedCategory.name}
        </button>
        {folderBreadcrumb.map((crumb, index) => (
          <div key={crumb.id} className="flex items-center gap-2">
            <span className="text-fc-thistle">/</span>
            {index === folderBreadcrumb.length - 1 ? (
              <span className="text-fc-midnight font-medium">{crumb.name}</span>
            ) : (
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className="text-fc-copper hover:underline font-medium"
              >
                {crumb.name}
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderMainContent = () => {
    if (!selectedCategory) {
      return (
        <div className="fc-card p-8 text-fc-brown text-sm">
          Choose a category to view available resources.
        </div>
      );
    }

    if (filesLoading) {
      return (
        <div className="fc-card p-10 flex flex-col items-center justify-center gap-4 text-fc-brown">
          <div className="w-10 h-10 border-2 border-fc-cream2 border-t-fc-olive rounded-full animate-spin" />
          <div className="text-sm">{loadingStates.files}</div>
        </div>
      );
    }

    const hasQuickLinks = links.length > 0;
    const hasDriveFiles = files.length > 0;

    // Show Google Drive auth prompt if needed and no files available
    if (authRequired && files.length === 0) {
      return (
        <div className="space-y-6">
          <div className="fc-card p-8 text-center space-y-5">
            <div className="mx-auto w-12 h-12 rounded-full bg-fc-wash-sky flex items-center justify-center">
              <LinkIcon className="w-5 h-5 text-fc-teal" />
            </div>
            <div className="space-y-2">
              <h3 className="fc-display fc-display-sm">Connect Google Drive</h3>
              <p className="text-fc-brown text-sm max-w-md mx-auto leading-relaxed">
                Authorise Futures PULSE to access your Google Drive resources so we can display the files shared with your team.
                We only request read-only access to the folders configured for these categories.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAuthorize}
              disabled={isLinking}
              className="fc-btn-primary"
            >
              <LinkIcon className="w-4 h-4" />
              {isLinking ? 'Opening Google...' : 'Connect with Google'}
            </button>
            {filesError && (
              <div className="text-fc-copper bg-fc-wash-peach border border-fc-wash-peach-border rounded-xl px-4 py-2 text-sm inline-block">
                {filesError}
              </div>
            )}
          </div>

          {hasQuickLinks && renderQuickLinks()}
        </div>
      );
    }

    if (filesError) {
      return (
        <div className="fc-card p-8 text-fc-copper bg-fc-wash-peach border border-fc-wash-peach-border text-sm">
          {filesError}
        </div>
      );
    }

    if (!hasQuickLinks && !hasDriveFiles) {
      return (
        <div className="fc-card p-8 text-fc-brown text-sm">
          No files found in this folder yet. Once files are added to the mapped Google Drive folder they will appear here automatically.
        </div>
      );
    }

    const folders = files.filter(f => f.mimeType && f.mimeType.includes('folder'));
    const documents = files.filter(f => !f.mimeType || !f.mimeType.includes('folder'));

    return (
      <div className="flex flex-col gap-5">
        {folders.length > 0 && (
          <div className="fc-card overflow-hidden">
            <div className="px-6 pt-5 pb-3 flex items-center justify-between gap-4">
              <div>
                <div className="fc-label mb-1.5">Folders</div>
                <h2 className="fc-display fc-display-sm">
                  {selectedCategory.displayName || selectedCategory.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => fetchFiles(selectedCategory.id, currentFolderId)}
                className="inline-flex items-center gap-1.5 text-fc-copper text-sm hover:underline flex-shrink-0"
              >
                <ArrowPathIcon className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
            {renderBreadcrumb()}
            <div className="px-6 pb-3">
              {folders.map((file) => (
                <button
                  key={file.id}
                  onClick={() => handleFolderClick(file)}
                  className="w-full flex items-center gap-3 py-3 border-b border-fc-cream2 last:border-b-0 text-left"
                >
                  <FolderIcon className="w-4 h-4 text-fc-gold flex-shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-sm text-fc-midnight">
                    {file.displayName || file.name}
                  </span>
                  <span className="text-xs text-fc-brown flex-shrink-0">
                    {formatModifiedTime(file.modifiedTime)}
                  </span>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-fc-thistle flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {documents.length > 0 && (
          <div className="fc-card overflow-hidden">
            <div className="px-6 pt-5 pb-3 flex items-center justify-between gap-4">
              <div className="fc-label">Documents</div>
              {folders.length === 0 && (
                <button
                  type="button"
                  onClick={() => fetchFiles(selectedCategory.id, currentFolderId)}
                  className="inline-flex items-center gap-1.5 text-fc-copper text-sm hover:underline flex-shrink-0"
                >
                  <ArrowPathIcon className="w-3.5 h-3.5" />
                  Refresh
                </button>
              )}
            </div>
            {folders.length === 0 && renderBreadcrumb()}
            <div className="px-6 pb-3">
              {documents.map((file) => {
                const DocIcon = getDocIcon(file);
                return (
                  <a
                    key={file.id}
                    href={file.webViewLink || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 py-3 border-b border-fc-cream2 last:border-b-0"
                  >
                    <DocIcon className="w-4 h-4 text-fc-teal flex-shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-sm text-fc-midnight">
                      {file.displayName || file.name}
                    </span>
                    <span className="text-xs text-fc-brown flex-shrink-0">
                      {formatModifiedTime(file.modifiedTime)}
                    </span>
                    <ArrowUpRightIcon className="w-3.5 h-3.5 text-fc-thistle flex-shrink-0" />
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {hasQuickLinks && currentFolderId === null && (
          <div className="lg:hidden">
            {renderQuickLinks()}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-fc-cream">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-7">
          <div className="fc-label mb-2.5">Shared library</div>
          <Link to="/resources" className="block hover:opacity-80 transition-opacity">
            <h1 className="fc-display fc-display-md mb-2">Resources</h1>
          </Link>
          <p className="text-sm text-fc-brown max-w-xl">
            Everything the campus teams share, pulled straight from the Futures Drive.
          </p>
        </div>

        {renderCategoryPills()}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
          <div className="min-w-0">
            {renderMainContent()}
          </div>

          <div className="hidden lg:flex flex-col gap-5">
            {links.length > 0 && currentFolderId === null && renderQuickLinks()}
            <div className="fc-card p-5">
              <div className="fc-label mb-2.5">Drive</div>
              <p className="text-sm text-fc-brown leading-relaxed mb-3.5">
                New files show up here on their own once they land in the mapped Drive folder.
              </p>
              <div className="flex items-center gap-2 text-sm text-fc-midnight">
                {authRequired ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-fc-copper flex-shrink-0" />
                    Not connected
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="w-4 h-4 text-fc-olive flex-shrink-0" />
                    Connected
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Resources;
