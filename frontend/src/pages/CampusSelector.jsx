import React, { useState, useEffect } from 'react';

const CampusSelector = ({ onCampusSelect, userRole, userCampus }) => {
  const [regions, setRegions] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  
  // Check if user has full access (admin, senior leader, senior pastor, lead pastor)
  const hasFullAccess = userRole === 'admin' || userRole === 'senior_leader' || userRole === 'senior_pastor' || userRole === 'lead_pastor';
  const canSeeTracker = userRole === 'admin' || userRole === 'lead_pastor' || userRole === 'senior_pastor' || userRole === 'senior_leader';
  
  // Filter campuses based on user role, assigned campus, and selected region
  const getAccessibleCampuses = () => {
    let accessibleCampuses = campuses;
    
    // First, filter by user role and assigned campus
    if (!hasFullAccess) {
      // For campus pastors, only show their assigned campus
      if (userCampus && userCampus !== 'all_campuses') {
        // Normalize campus ID for matching (handle case, spaces, underscores)
        const normalizedUserCampus = userCampus.toLowerCase().trim().replace(/\s+/g, '_');
        
        accessibleCampuses = campuses.filter(c => {
          const campusId = (c.id || '').toLowerCase().trim();
          const campusName = (c.name || '').toLowerCase().trim();
          return campusId === normalizedUserCampus || 
                 campusId === userCampus.toLowerCase().trim() ||
                 campusName === userCampus.toLowerCase().trim() ||
                 campusName.includes(userCampus.toLowerCase().trim()) ||
                 campusId.includes(normalizedUserCampus);
        });
        
        // If no campus found, log warning but don't return empty (show all for debugging)
        if (accessibleCampuses.length === 0) {
          console.warn(`[CampusSelector] Campus pastor campus "${userCampus}" not found. Available campuses:`, campuses.map(c => `${c.id} (${c.name})`));
          // Return all campuses so user can see what's available (for debugging)
          // In production, you might want to return empty array instead
          return campuses;
        }
      } else {
        return []; // No access
      }
    }
    
    // Then, filter by selected region if one is selected
    if (selectedRegion) {
      accessibleCampuses = accessibleCampuses.filter(c => c.region_id === selectedRegion.id);
    }
    
    return accessibleCampuses;
  };

  useEffect(() => {
    fetchRegions();
    fetchCampuses();
  }, []);

  // Fetch submission status when Australia region is selected
  useEffect(() => {
    if (selectedRegion?.code === 'AU' && canSeeTracker) {
      fetchSubmissionStatus();
      
      // Auto-refresh every 30 seconds
      const interval = setInterval(() => {
        fetchSubmissionStatus();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [selectedRegion, canSeeTracker]);

  const fetchSubmissionStatus = async () => {
    try {
      setLoadingStatus(true);
      // Add cache buster to ensure fresh data
      const response = await fetch(`/api/weekly-submission-status?_t=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-cache'
      });
      if (response.ok) {
        const data = await response.json();
        setSubmissionStatus(data);
      }
    } catch (error) {
      console.error('Error fetching submission status:', error);
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchRegions = async () => {
    try {
      // Add cache buster to ensure fresh data
      const response = await fetch(`/api/v2/regions?_t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        setRegions(data.regions || []);
      }
    } catch (error) {
      console.error('Error fetching regions:', error);
    }
  };

  const fetchCampuses = async () => {
    try {
      const response = await fetch('/api/v2/campuses', {
        credentials: 'include',
      });
      const result = await response.json();
      const campusesList = result.campuses || [];
      
      if (Array.isArray(campusesList)) {
        // Map v2 API response to the format expected by the component
        const formattedCampuses = campusesList
          .filter(c => c.campus_id !== 'all_campuses' && c.active)
          .map(c => ({
            id: c.campus_id,
            name: c.display_name,
            region_id: c.region_id,
            description: c.notes || 'Campus Ministry Dashboard',
            icon: '⛪'
          }));
        setCampuses(formattedCampuses);
      }
    } catch (error) {
      console.error('Error fetching campuses:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <span className="text-4xl">⛪</span>
          </div>
          <div className="text-white text-2xl font-bold mb-2">Loading Campuses</div>
          <div className="text-white/60 text-lg">Fetching campus data...</div>
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

      {/* Header */}
      <div className="relative bg-gradient-to-r from-blue-600/90 via-purple-600/90 to-pink-600/90 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <span className="text-4xl">⛪</span>
              </div>
              <div>
                <h1 className="text-5xl font-bold text-white tracking-tight">
                  Futures Church
                </h1>
                <p className="text-white/80 text-xl font-medium">
                  Campus Dashboard Selection
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-12">
        {/* Back Button */}
        {selectedRegion && (
          <button
            onClick={() => setSelectedRegion(null)}
            className="mb-8 flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-all"
          >
            <span className="text-xl">←</span>
            <span>Back to Regions</span>
          </button>
        )}

        {/* Sunday Report Submission Tracker - Only for Australia campus selection */}
        {selectedRegion?.code === 'AU' && canSeeTracker && submissionStatus && (
          <div className="mb-8 bg-white/5 backdrop-blur-sm rounded-xl p-4 md:p-5 border border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xl sm:text-2xl">📊</span>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Weekly Report Status
                  </h3>
                  <p className="text-white/50 text-xs">
                    Week of {submissionStatus.week_start}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={fetchSubmissionStatus}
                  disabled={loadingStatus}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-all disabled:opacity-50"
                  title="Refresh status"
                >
                  <span className={`text-sm ${loadingStatus ? 'animate-spin' : ''}`}>🔄</span>
                </button>
                <div className="text-right bg-white/5 rounded-lg px-3 sm:px-4 py-2 border border-white/10">
                  <div className="text-white/50 text-xs uppercase tracking-wider">Progress</div>
                  <div className="text-lg sm:text-xl font-bold text-white">
                    {submissionStatus.campuses?.filter(c => c.status === 'submitted').length || 0} / {submissionStatus.campuses?.length || 0}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
              {submissionStatus.campuses?.map((campus) => (
                <div
                  key={campus.id}
                  className="group relative"
                  title={campus.last_submitted ? `${campus.name} - Submitted ${campus.last_submitted}` : `${campus.name} - Awaiting submission`}
                >
                  <div className={`relative overflow-hidden rounded-lg p-2 sm:p-3 transition-all duration-300 hover:scale-105 cursor-pointer ${
                    campus.status === 'submitted'
                      ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30'
                      : 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/30'
                  }`}>
                    <div className="flex flex-col items-center gap-1.5 sm:gap-2">
                      <div className="relative">
                        <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${
                          campus.status === 'submitted' 
                            ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' 
                            : 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                        } animate-pulse`}></div>
                      </div>
                      <div className="text-center w-full">
                        <div className="text-white text-[10px] sm:text-xs font-semibold leading-tight truncate px-1">
                          {campus.name}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
                    <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl border border-white/20">
                      <div className="font-semibold">{campus.name}</div>
                      {campus.last_submitted && (
                        <div className="text-white/70">{campus.last_submitted}</div>
                      )}
                      {!campus.last_submitted && (
                        <div className="text-white/50 italic">Not yet submitted</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            {selectedRegion ? `${selectedRegion.display_name} Campuses` : 'Select a Region'}
          </h2>
          <p className="text-white/60 text-lg">
            {selectedRegion 
              ? 'Choose a campus to view detailed ministry analytics' 
              : 'Choose your region to begin'
            }
          </p>
        </div>

        {/* Region Selection */}
        {!selectedRegion && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {regions.map((region) => (
              <div
                key={region.id}
                onClick={() => region.active && setSelectedRegion(region)}
                className={`group relative bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 shadow-2xl transition-all duration-500 ${
                  region.active 
                    ? 'hover:shadow-blue-500/25 hover:scale-105 cursor-pointer' 
                    : 'opacity-60 cursor-not-allowed'
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${
                  region.active 
                    ? 'from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100' 
                    : 'from-gray-500/5 to-transparent'
                } rounded-2xl transition-opacity duration-500`}></div>
                
                <div className="relative text-center">
                  <div className={`w-20 h-20 ${
                    region.active 
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20' 
                      : 'bg-gray-500/20'
                  } rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm`}>
                    <span className="text-4xl">
                      {region.code === 'AU' ? '🇦🇺' : 
                       region.code === 'US' ? '🇺🇸' : 
                       region.code === 'BR' ? '🇧🇷' : 
                       region.code === 'ID' ? '🇮🇩' : '🌏'}
                    </span>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-white mb-3">
                    {region.display_name}
                  </h3>
                  
                  {region.coming_soon ? (
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 rounded-full">
                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                        <span className="text-blue-300 font-semibold text-sm">Coming Soon</span>
                      </div>
                      <p className="text-white/40 text-sm">
                        Launching in {region.launch_date || '2026'}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-white/60 text-lg mb-6">
                        {campuses.filter(c => c.region_id === region.id).length} {hasFullAccess ? 'Active' : 'Assigned'} Campus{campuses.filter(c => c.region_id === region.id).length !== 1 ? 'es' : ''}
                      </p>
                      <div className="flex items-center justify-center gap-2 text-blue-400 font-semibold">
                        <span>View Campuses</span>
                        <span className="text-xl group-hover:translate-x-1 transition-transform duration-300">→</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Campus Selection (when region is selected) */}
        {selectedRegion && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Australia National Overview for senior leadership */}
            {selectedRegion.code === 'AU' && (userRole === 'senior_leader' || userRole === 'admin' || userRole === 'senior_pastor' || userRole === 'lead_pastor') && (
              <div
                onClick={() => onCampusSelect({ id: 'australia', name: 'Australia', description: 'National Overview', icon: '🇦🇺', isRollup: true })}
                className="group relative bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 shadow-2xl hover:shadow-purple-500/25 transition-all duration-500 hover:scale-105 cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative text-center">
                  <div className="w-20 h-20 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
                    <span className="text-4xl">🇦🇺</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">
                    Australia
                  </h3>
                  <p className="text-white/60 text-lg mb-6">
                    National Overview
                  </p>
                  <div className="flex items-center justify-center gap-2 text-purple-400 font-semibold">
                    <span>View Dashboard</span>
                    <span className="text-xl group-hover:translate-x-1 transition-transform duration-300">→</span>
                  </div>
                </div>
              </div>
            )}

            {/* Individual Campuses */}
            {getAccessibleCampuses().map((campus) => (
              <div
                key={campus.id}
                onClick={() => onCampusSelect(campus)}
                className="group relative bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 shadow-2xl hover:shadow-blue-500/25 transition-all duration-500 hover:scale-105 cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative text-center">
                  <div className="w-20 h-20 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
                    <span className="text-4xl">{campus.icon || '⛪'}</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">
                    {campus.name}
                  </h3>
                  <p className="text-white/60 text-lg mb-6">
                    {campus.description || 'Campus Ministry Dashboard'}
                  </p>
                  <div className="flex items-center justify-center gap-2 text-blue-400 font-semibold">
                    <span>View Dashboard</span>
                    <span className="text-xl group-hover:translate-x-1 transition-transform duration-300">→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* User Role Info */}
        <div className="mt-16 text-center">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 shadow-2xl max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <span className="text-2xl">👤</span>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Your Access Level</h3>
                <p className="text-white/60 text-lg">
                  {userRole === 'senior_leader' || userRole === 'admin' || userRole === 'senior_pastor' || userRole === 'lead_pastor'
                    ? 'Full access to all campus dashboards' 
                    : 'Access to your assigned campus dashboard'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampusSelector;




