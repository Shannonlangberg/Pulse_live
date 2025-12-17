import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const gradientBackground = 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900';

const loadingStates = {
  categories: 'Loading resource categories...',
  files: 'Loading files...',
};

const formatModifiedTime = (value) => {
  if (!value) {
    return 'Last updated: Unknown';
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Last updated: Unknown';
    }
    return `Last updated: ${new Intl.DateTimeFormat('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)}`;
  } catch (error) {
    return 'Last updated: Unknown';
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
        setCategoriesError(payload.error || 'You do not have access to view resources. Admin access required.');
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
    async (categoryId) => {
      if (!categoryId) {
        return;
      }

      setFilesLoading(true);
      setFilesError('');
      setAuthRequired(false);
      setLinks([]);

      try {
        const response = await fetch(`/api/resources/${encodeURIComponent(categoryId)}`, {
          credentials: 'include',
        });

        const payload = await response.json().catch(() => ({}));

        if (response.status === 401) {
          setFiles([]);
          setLinks([]);
          setFilesError('Please sign in to view resources.');
          return;
        }
        
        // 401 is for login, not Google Drive auth
        // Google Drive auth is only needed if we're trying to fetch Drive files
        // For now, we just show links, so no Drive auth needed

        if (!response.ok) {
          const message = payload.error || 'Unable to fetch files for this category.';
          throw new Error(message);
        }

        const items = Array.isArray(payload.files) ? payload.files : [];
        items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setFiles(items);
        setLinks(normalizeLinks(payload.links));
        // Clear auth required flag - we successfully loaded data
        setAuthRequired(false);
      } catch (error) {
        setFilesError(error.message || 'Something went wrong while loading files.');
        setFiles([]);
        setLinks([]);
      } finally {
        setFilesLoading(false);
      }
    },
    []
  );

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

  const renderCategoryCards = () => {
    if (categoriesLoading) {
      return (
        <div className="text-white/60 text-lg">
          {loadingStates.categories}
        </div>
      );
    }

    if (categoriesError) {
      return (
        <div className="text-red-300 bg-red-900/20 border border-red-500/40 rounded-2xl px-6 py-4">
          {categoriesError}
        </div>
      );
    }

    if (categories.length === 0) {
      return (
        <div className="text-white/60 text-lg">
          No resource categories configured yet.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {categories.map((category) => {
          const isActive = category.id === selectedCategoryId;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategoryId(category.id)}
              className={`
                group relative text-left bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10
                backdrop-blur-sm rounded-2xl p-6 border transition-all duration-300
                ${isActive ? 'border-blue-400/60 shadow-2xl shadow-blue-500/20 scale-[1.02]' : 'border-white/5 hover:border-blue-400/30 hover:scale-105'}
              `}
            >
              <div className="absolute inset-0 rounded-2xl bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative space-y-4">
                <div className="flex items-center justify-between">
                  <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center
                    ${isActive ? 'bg-blue-500/30 text-white' : 'bg-white/10 text-white/80'}
                  `}>
                    <span className="text-2xl">📁</span>
                  </div>
                  {isActive && (
                    <span className="text-blue-300 text-sm font-semibold">
                      Selected
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-white text-lg font-semibold tracking-tight">
                    {category.displayName || category.name}
                  </h3>
                  {category.description && (
                    <p className="text-white/60 text-sm mt-2 leading-relaxed">
                      {category.description}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderFilesPanel = () => {
    if (!selectedCategory) {
      return (
        <div className="bg-white/10 border border-white/10 rounded-3xl p-8 text-white/60">
          Choose a category to view available resources.
        </div>
      );
    }

    if (filesLoading) {
      return (
        <div className="bg-white/10 border border-white/10 rounded-3xl p-10 flex flex-col items-center justify-center gap-4 text-white/70">
          <div className="w-16 h-16 border-4 border-white/10 border-t-blue-400 rounded-full animate-spin" />
          <div className="text-lg">{loadingStates.files}</div>
        </div>
      );
    }

    const hasQuickLinks = links.length > 0;
    const hasDriveFiles = files.length > 0;

    const renderQuickLinks = () => (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-white text-lg font-semibold">
            Quick Links
          </h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-white/5 hover:border-purple-400/40 rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] flex flex-col gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-2xl">
                  🔗
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-semibold leading-tight group-hover:text-purple-200 transition-colors duration-300">
                    {link.label}
                  </h4>
                  {link.description && (
                    <p className="text-white/60 text-xs mt-2 leading-snug line-clamp-3">
                      {link.description}
                    </p>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    );

    const renderDriveFiles = () => (
      <div className="space-y-3">
        <h4 className="text-white text-lg font-semibold">
          Drive Files
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {files.map((file) => (
            <a
              key={file.id}
              href={file.webViewLink || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-gradient-to-br from-slate-800/70 to-slate-900/70 border border-white/5 hover:border-blue-400/40 rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] flex flex-col gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-2xl">
                  {file.mimeType && file.mimeType.includes('folder') ? '📂' : '📄'}
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-semibold leading-tight group-hover:text-blue-200 transition-colors duration-300">
                    {file.name}
                  </h4>
                </div>
              </div>
              <div className="text-white/40 text-xs">
                {formatModifiedTime(file.modifiedTime)}
              </div>
            </a>
          ))}
        </div>
      </div>
    );

    // Only show Google Drive auth if we actually need it (e.g., trying to fetch Drive files)
    // For now, we're just showing links, so this shouldn't be needed
    // But keep it for future when we implement Drive file fetching
    if (authRequired && files.length === 0 && links.length === 0) {
      return (
        <div className="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-400/30 rounded-3xl p-10 space-y-6">
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center text-3xl">
              🔐
            </div>
            <div className="space-y-2">
              <h3 className="text-white text-2xl font-semibold">Connect Google Drive</h3>
              <p className="text-white/70 max-w-xl mx-auto">
                Authorise Futures PULSE to access your Google Drive resources so we can display the files shared with your team.
                We only request read-only access to the folders configured for these categories.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAuthorize}
              disabled={isLinking}
              className={`
                inline-flex items-center gap-3 px-6 py-3 rounded-2xl font-semibold transition-all duration-300
                ${isLinking ? 'bg-blue-500/40 text-white/70 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-500/90 hover:to-purple-500/90 hover:scale-105'}
              `}
            >
              <span className="text-xl">🔗</span>
              {isLinking ? 'Opening Google...' : 'Connect with Google'}
            </button>
            {filesError && (
              <div className="text-red-300 bg-red-900/30 border border-red-500/40 rounded-2xl px-4 py-2">
                {filesError}
              </div>
            )}
          </div>

          {hasQuickLinks && (
            <div className="border-t border-white/10 pt-6">
              {renderQuickLinks()}
            </div>
          )}
        </div>
      );
    }

    if (filesError) {
      return (
        <div className="bg-red-900/20 border border-red-500/40 rounded-3xl p-8 text-red-200">
          {filesError}
        </div>
      );
    }

    if (!hasQuickLinks && !hasDriveFiles) {
      return (
        <div className="bg-white/10 border border-white/10 rounded-3xl p-8 text-white/60">
          No files found in this folder yet. Once files are added to the mapped Google Drive folder they will appear here automatically.
        </div>
      );
    }

    return (
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-white text-2xl font-semibold">
              {selectedCategory.displayName || selectedCategory.name} Resources
            </h3>
            <p className="text-white/60 text-sm mt-1">
              Files are read directly from the configured Google Drive folder.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchFiles(selectedCategory.id)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl transition-all duration-300"
          >
            <span className="text-lg">⟳</span>
            Refresh
          </button>
        </div>

        {hasQuickLinks && renderQuickLinks()}
        {hasDriveFiles && renderDriveFiles()}
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${gradientBackground}`}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-pink-500/5 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      <div className="relative">
        <header className="bg-gradient-to-r from-blue-600/90 via-purple-600/90 to-pink-600/90 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-10">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl">
                    📚
                  </div>
                  <div>
                    <Link to="/resources" className="block hover:opacity-80 transition-opacity">
                      <h1 className="text-white text-3xl sm:text-4xl font-bold tracking-tight">
                        Team Resources
                      </h1>
                    </Link>
                    <p className="text-white/80 text-base sm:text-lg mt-2 max-w-2xl">
                      A single home for Futures Church documents, templates, and media. Select a category to explore the files your team needs.
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-white/70 text-sm">
                {selectedCategory
                  ? `Viewing ${selectedCategory.displayName || selectedCategory.name}`
                  : 'Choose a category'}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">
          <section className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-1 h-10 bg-gradient-to-b from-blue-400 to-purple-400 rounded-full" />
              <div>
                <h2 className="text-white text-2xl font-semibold">
                  Resource Categories
                </h2>
                <p className="text-white/60 text-sm">
                  Curated folders organised by ministry area.
                </p>
              </div>
            </div>
            {renderCategoryCards()}
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-1 h-10 bg-gradient-to-b from-blue-400 to-purple-400 rounded-full" />
              <div>
                <h2 className="text-white text-2xl font-semibold">
                  Files &amp; Documents
                </h2>
                <p className="text-white/60 text-sm">
                  Direct links to the files stored in Google Drive.
                </p>
              </div>
            </div>
            {renderFilesPanel()}
          </section>
        </main>
      </div>
    </div>
  );
};

export default Resources;


