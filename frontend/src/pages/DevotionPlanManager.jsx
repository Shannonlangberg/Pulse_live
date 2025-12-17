import React, { useState, useEffect, useRef } from 'react';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  EyeIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  GlobeAltIcon,
  DocumentTextIcon,
  PhotoIcon,
  VideoCameraIcon,
  CloudArrowUpIcon
} from '@heroicons/react/24/outline';
import { useNavigate, useParams } from 'react-router-dom';

const DevotionPlanManager = () => {
  const navigate = useNavigate();
  const { planId } = useParams();
  const fileInputRef = useRef(null);
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showDayEditor, setShowDayEditor] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedMedia, setUploadedMedia] = useState([]);
  const [campuses, setCampuses] = useState([]);

  // Plan creation form
  const [newPlan, setNewPlan] = useState({
    title: '',
    description: '',
    total_days: 30,
    campus: 'all_campuses',
    status: 'draft'
  });

  // Day editor form
  const [dayContent, setDayContent] = useState({
    day_index: 1,
    title: '',
    scripture_ref: '',
    scripture_text: '',
    devo_body: '',
    prayer_focus: '',
    media: [],
    cover_image: ''
  });

  // Bible API integration
  const [bibleVersions] = useState([
    { id: 'NIV', name: 'New International Version', abbreviation: 'NIV' },
    { id: 'ESV', name: 'English Standard Version', abbreviation: 'ESV' },
    { id: 'KJV', name: 'King James Version', abbreviation: 'KJV' },
    { id: 'NKJV', name: 'New King James Version', abbreviation: 'NKJV' },
    { id: 'NLT', name: 'New Living Translation', abbreviation: 'NLT' },
    { id: 'CSB', name: 'Christian Standard Bible', abbreviation: 'CSB' },
    { id: 'NASB', name: 'New American Standard Bible', abbreviation: 'NASB' },
    { id: 'MSG', name: 'The Message', abbreviation: 'MSG' }
  ]);
  const [selectedVersion, setSelectedVersion] = useState('NIV');
  const [isLoadingScripture, setIsLoadingScripture] = useState(false);
  const [scriptureSearchResults, setScriptureSearchResults] = useState([]);
  const [showScriptureSearch, setShowScriptureSearch] = useState(false);

  useEffect(() => {
    fetchPlans();
    fetchCampuses();
    if (planId) {
      fetchPlanDetails(planId);
    }
  }, [planId]);

  const fetchCampuses = async () => {
    try {
      const response = await fetch('/api/campuses/public');
      if (response.ok) {
        const data = await response.json();
        setCampuses(data.campuses || []);
      }
    } catch (error) {
      console.error('Error fetching campuses:', error);
    }
  };

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/devotions/admin/plans');
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans || []);
        
        // If planId is provided, select that plan
        if (planId && data.plans) {
          const plan = data.plans.find(p => p.id === planId);
          if (plan) {
            setSelectedPlan(plan);
            fetchPlanContent(plan.id);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanDetails = async (id) => {
    try {
      const response = await fetch(`/api/devotions/admin/plans/${id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedPlan(data.plan);
      }
    } catch (error) {
      console.error('Error fetching plan details:', error);
    }
  };

  const fetchPlanContent = async (planId) => {
    try {
      const response = await fetch(`/api/devotions/admin/plans/${planId}/content`);
      if (response.ok) {
        const data = await response.json();
        if (selectedPlan) {
          setSelectedPlan({
            ...selectedPlan,
            content: data.content || [],
            total_days: data.plan?.total_days || selectedPlan.total_days || 30
          });
        }
      }
    } catch (error) {
      console.error('Error fetching plan content:', error);
    }
  };

  const handleCreatePlan = async () => {
    try {
      const response = await fetch('/api/devotions/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlan)
      });

      if (response.ok) {
        const data = await response.json();
        await fetchPlans();
        setShowCreatePlan(false);
        setNewPlan({ title: '', description: '', total_days: 30, campus: 'all_campuses', status: 'draft' });
        
        // Navigate to the new plan
        navigate(`/devotions/plans/${data.plan.id}`);
      }
    } catch (error) {
      console.error('Error creating plan:', error);
    }
  };

  const handleEditDay = (dayIndex) => {
    if (!selectedPlan) return;
    
    const existingContent = selectedPlan.content?.find(c => c.day_index === dayIndex);
    
    setSelectedDay({ day_index: dayIndex });
    setDayContent({
      day_index: dayIndex,
      title: existingContent?.title || '',
      scripture_ref: existingContent?.scripture_ref || '',
      scripture_text: existingContent?.scripture_text || '',
      devo_body: existingContent?.devo_body || '',
      prayer_focus: existingContent?.prayer_focus || '',
      media: existingContent?.media || [],
      cover_image: existingContent?.cover_image || ''
    });
    setUploadedMedia(existingContent?.media || []);
    setShowDayEditor(true);
  };

  const handleSaveDay = async () => {
    if (!selectedPlan) return;
    
    try {
      const response = await fetch(`/api/devotions/admin/plans/${selectedPlan.id}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...dayContent,
          media: uploadedMedia
        })
      });

      if (response.ok) {
        await fetchPlanContent(selectedPlan.id);
        setShowDayEditor(false);
        setSelectedDay(null);
      }
    } catch (error) {
      console.error('Error saving day:', error);
    }
  };

  // Bible API functions
  const searchScripture = async (reference) => {
    if (!reference.trim()) return;
    
    setIsLoadingScripture(true);
    try {
      const response = await fetch(`/api/bible/search?reference=${encodeURIComponent(reference)}&version=${selectedVersion}`);
      const data = await response.json();
      
      if (data.success) {
        setDayContent({
          ...dayContent,
          scripture_ref: data.reference,
          scripture_text: data.text || data.note || `[${data.reference} - ${data.version}] Scripture text will be fetched from Bible API`
        });
        setScriptureSearchResults([data]);
        setShowScriptureSearch(true);
      } else {
        alert(data.error || 'Could not fetch scripture. Please try again or enter text manually.');
      }
    } catch (error) {
      console.error('Error searching scripture:', error);
      alert('Error fetching scripture. Please try again or enter text manually.');
    } finally {
      setIsLoadingScripture(false);
    }
  };

  const insertScriptureText = (scriptureData) => {
    setDayContent({
      ...dayContent,
      scripture_text: scriptureData.text || scriptureData.note,
      scripture_ref: scriptureData.reference
    });
    setShowScriptureSearch(false);
    setScriptureSearchResults([]);
  };

  // Media upload functions
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    setUploadingMedia(true);
    const uploadPromises = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/devotions/admin/upload', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          uploadPromises.push(Promise.resolve({
            type: data.type,
            url: data.url,
            filename: data.filename
          }));
        }
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }

    const uploaded = await Promise.all(uploadPromises);
    setUploadedMedia([...uploadedMedia, ...uploaded]);
    setUploadingMedia(false);
    setUploadProgress(0);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    handleFileUpload(files);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    handleFileUpload(files);
  };

  const removeMedia = (index) => {
    setUploadedMedia(uploadedMedia.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <BookOpenIcon className="h-10 w-10 text-white" />
          </div>
          <div className="text-white text-2xl font-bold mb-2">Loading Plans</div>
          <div className="text-white/60 text-lg">Fetching devotion plans...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <BookOpenIcon className="h-10 w-10 text-blue-400" />
              <div>
                <h1 className="text-4xl font-bold text-white">Devotion Plan Manager</h1>
                <p className="text-white/60 mt-1">Create and customize daily devotion plans with Bible integration</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreatePlan(true)}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-blue-500/25 hover:scale-105 transition-all duration-300"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
              Create New Plan
            </button>
          </div>

          {/* Bible API Info */}
          <div className="glass-effect rounded-xl p-4 backdrop-blur-sm border border-slate-700/50">
            <div className="flex items-start gap-3">
              <GlobeAltIcon className="h-5 w-5 text-blue-400 mt-0.5" />
              <div>
                <h3 className="text-blue-300 font-medium mb-1">Bible API Integration</h3>
                <p className="text-white/60 text-sm">
                  Enter scripture references (e.g., "John 3:16", "Psalm 23:1-3") and automatically fetch text from multiple Bible versions.
                  Supports NIV, ESV, KJV, NKJV, NLT, CSB, NASB, MSG and more.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Plans Grid */}
        {!selectedPlan ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                onClick={() => {
                  setSelectedPlan(plan);
                  fetchPlanContent(plan.id);
                }}
                className="glass-effect rounded-xl p-6 backdrop-blur-sm border border-slate-700/50 hover:border-blue-500/50 transition-all duration-300 hover:scale-105 cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">{plan.title}</h3>
                    {plan.description && (
                      <p className="text-white/60 text-sm mb-3 line-clamp-2">{plan.description}</p>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                    plan.status === 'published' 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                      : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  }`}>
                    {plan.status}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm text-white/50 mb-3">
                  <span>{plan.campus || 'All Campuses'}</span>
                  <span>{plan.total_days || plan.content_count || 30} days</span>
                </div>
                
                {plan.content_count > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-white/50 mb-1">
                      <span>Content Progress</span>
                      <span>{plan.content_count}/{plan.total_days || 30} days</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${((plan.content_count || 0) / (plan.total_days || 30)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Day Grid for Selected Plan */
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <button
                  onClick={() => {
                    setSelectedPlan(null);
                    setSelectedDay(null);
                  }}
                  className="text-blue-400 hover:text-blue-300 mb-2 flex items-center gap-2"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                  Back to Plans
                </button>
                <h2 className="text-2xl font-bold text-white">{selectedPlan.title}</h2>
                <p className="text-white/60 text-sm mt-1">
                  {selectedPlan.total_days || 30} days • {selectedPlan.content_count || 0} days configured
                </p>
              </div>
              <button
                onClick={() => handleEditDay((selectedPlan.content?.length || 0) + 1)}
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium rounded-lg shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Day
              </button>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-14 lg:grid-cols-20 gap-2">
              {Array.from({ length: selectedPlan.total_days || 30 }, (_, i) => {
                const dayIndex = i + 1;
                const dayContent = selectedPlan.content?.find(c => c.day_index === dayIndex);
                const isConfigured = !!dayContent;
                
                return (
                  <button
                    key={dayIndex}
                    onClick={() => handleEditDay(dayIndex)}
                    className={`
                      w-12 h-12 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-110
                      ${isConfigured 
                        ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/25' 
                        : 'bg-slate-800/50 text-white/40 hover:bg-slate-700/50 border border-slate-700/50'
                      }
                    `}
                    title={dayContent ? `Day ${dayIndex}: ${dayContent.title || 'Configured'}` : `Day ${dayIndex}: Not configured`}
                  >
                    {dayIndex}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Create Plan Modal */}
        {showCreatePlan && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-effect rounded-xl p-6 max-w-md w-full backdrop-blur-sm border border-slate-700/50">
              <h3 className="text-xl font-bold text-white mb-4">Create New Devotion Plan</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Plan Title</label>
                  <input
                    type="text"
                    value={newPlan.title}
                    onChange={(e) => setNewPlan({...newPlan, title: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 30-Day Prayer Journey"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Description</label>
                  <textarea
                    value={newPlan.description}
                    onChange={(e) => setNewPlan({...newPlan, description: e.target.value})}
                    rows={3}
                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Brief description of the plan"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">Total Days</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={newPlan.total_days}
                      onChange={(e) => setNewPlan({...newPlan, total_days: parseInt(e.target.value) || 30})}
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">Campus</label>
                    <select
                      value={newPlan.campus}
                      onChange={(e) => setNewPlan({...newPlan, campus: e.target.value})}
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all_campuses">All Campuses</option>
                      {campuses
                        .filter(campus => campus.active !== false && campus.id !== 'all_campuses')
                        .map(campus => (
                          <option key={campus.id} value={campus.id || campus.campus_id}>
                            {campus.display_name || campus.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreatePlan(false)}
                  className="px-6 py-2 bg-slate-700/50 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePlan}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
                >
                  Create Plan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Day Editor Modal */}
        {showDayEditor && selectedDay && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-effect rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto backdrop-blur-sm border border-slate-700/50">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-700/50 sticky top-0 bg-slate-800/80 backdrop-blur-sm z-10">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Day {selectedDay.day_index} {dayContent.title && `- ${dayContent.title}`}
                  </h2>
                  <p className="text-white/60 mt-1">{selectedPlan?.title}</p>
                </div>
                <button
                  onClick={() => setShowDayEditor(false)}
                  className="p-2 text-white/60 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Form */}
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-6">
                    {/* Title */}
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">Day Title</label>
                      <input
                        type="text"
                        value={dayContent.title}
                        onChange={(e) => setDayContent({...dayContent, title: e.target.value})}
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., The Promise of the Spirit"
                      />
                    </div>

                    {/* Scripture Reference with Bible API */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">Scripture</h3>
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedVersion}
                            onChange={(e) => setSelectedVersion(e.target.value)}
                            className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {bibleVersions.map(version => (
                              <option key={version.id} value={version.id}>
                                {version.abbreviation}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-white/80 mb-2">
                            Scripture Reference
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={dayContent.scripture_ref}
                              onChange={(e) => setDayContent({...dayContent, scripture_ref: e.target.value})}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  searchScripture(dayContent.scripture_ref);
                                }
                              }}
                              className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="e.g., Acts 1:1-11 or John 3:16"
                            />
                            <button
                              onClick={() => searchScripture(dayContent.scripture_ref)}
                              disabled={!dayContent.scripture_ref.trim() || isLoadingScripture}
                              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-all duration-300 shadow-lg hover:shadow-blue-500/25"
                            >
                              {isLoadingScripture ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              ) : (
                                <>
                                  <MagnifyingGlassIcon className="h-4 w-4" />
                                  <span>Fetch</span>
                                </>
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-white/50 mt-1">
                            Enter reference (e.g., John 3:16, Psalm 23:1-3) and click Fetch
                          </p>
                        </div>

                        {/* Scripture Text */}
                        <div>
                          <label className="block text-sm font-medium text-white/80 mb-2">
                            Scripture Text
                          </label>
                          <textarea
                            value={dayContent.scripture_text}
                            onChange={(e) => setDayContent({...dayContent, scripture_text: e.target.value})}
                            rows={8}
                            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-serif leading-relaxed"
                            placeholder="Scripture text will appear here after fetching, or paste manually..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    {/* Devotional Content */}
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        Devotional Content
                      </label>
                      <textarea
                        value={dayContent.devo_body}
                        onChange={(e) => setDayContent({...dayContent, devo_body: e.target.value})}
                        rows={10}
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-relaxed"
                        placeholder="Write the main devotional content for this day..."
                      />
                    </div>

                    {/* Prayer Focus */}
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        Prayer Focus
                      </label>
                      <textarea
                        value={dayContent.prayer_focus}
                        onChange={(e) => setDayContent({...dayContent, prayer_focus: e.target.value})}
                        rows={3}
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Prayer points or focus for this day"
                      />
                    </div>

                    {/* Media Upload */}
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        Images & Videos
                      </label>
                      <div
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className="border-2 border-dashed border-slate-700/50 rounded-lg p-6 text-center hover:border-blue-500/50 transition-colors"
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <CloudArrowUpIcon className="h-12 w-12 text-white/40 mx-auto mb-3" />
                        <p className="text-white/60 text-sm mb-2">
                          Drag & drop images or videos here, or
                        </p>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingMedia}
                          className="text-blue-400 hover:text-blue-300 text-sm font-medium disabled:text-white/40"
                        >
                          {uploadingMedia ? 'Uploading...' : 'Browse Files'}
                        </button>
                        <p className="text-white/40 text-xs mt-2">
                          Supports: PNG, JPG, GIF, MP4, MOV, WEBM
                        </p>
                      </div>

                      {/* Uploaded Media Preview */}
                      {uploadedMedia.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 mt-4">
                          {uploadedMedia.map((media, index) => (
                            <div key={index} className="relative group">
                              {media.type === 'image' ? (
                                <img
                                  src={media.url}
                                  alt={`Upload ${index + 1}`}
                                  className="w-full h-32 object-cover rounded-lg"
                                />
                              ) : (
                                <video
                                  src={media.url}
                                  className="w-full h-32 object-cover rounded-lg"
                                  controls
                                />
                              )}
                              <button
                                onClick={() => removeMedia(index)}
                                className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-6 border-t border-slate-700/50">
                  <button
                    onClick={() => setShowDayEditor(false)}
                    className="px-6 py-2 bg-slate-700/50 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveDay}
                    className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-blue-500/25 transition-all duration-300 flex items-center gap-2"
                  >
                    <CheckIcon className="h-4 w-4" />
                    Save Day
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DevotionPlanManager;
