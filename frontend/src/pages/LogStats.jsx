import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, CalendarIcon, XMarkIcon, PencilIcon } from '@heroicons/react/24/outline';
import DynamicBackground from '../components/DynamicBackground';

const LogStats = () => {
  const navigate = useNavigate();
  const [selectedRegion, setSelectedRegion] = useState('');
  const [regions, setRegions] = useState([]);
  const [selectedCampus, setSelectedCampus] = useState('');
  const [campuses, setCampuses] = useState([]);
  const [allCampuses, setAllCampuses] = useState([]); // Store all campuses
  const [showQuickInput, setShowQuickInput] = useState(false);
  const [quickInputDate, setQuickInputDate] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [quickInputStats, setQuickInputStats] = useState({
    'Total People in Campus': '',
    '9:00 AM': '',
    '10:00 AM': '',
    '11:00 AM': '',
    '5:00 PM': '',
    '5:30 PM': '',
    'Kids 9:00 AM': '',
    'Kids 10:00 AM': '',
    'Kids 11:00 AM': '',
    'Kids 5:00 PM': '',
    'Kids 5:30 PM': '',
    'Kids Leaders': '',
    'New Kids': '',
    'Kids Salvations': '',
    'Packs Out': '',
    'Cards Returned': '',
    'First Time': '',
    'Visitors': '',
    'Hands up': '',
    'First Time Decision': '',
    'Rededication': '',
    'Salvation Cards Returned': '',
    'Youth Total': '',
    'Youth NP': '',
    'Youth Salvations': '',
    'Youth Leaders': '',
    'Saints': '',
    'Connect Groups': '',
    'Dream Team': '',
    'Seniors': '',
    'Baptisms': '',
    'Child Dedications': ''
  });
  const [isSubmittingQuickInput, setIsSubmittingQuickInput] = useState(false);
  const [sessionStats, setSessionStats] = useState([]);
  const [recentEntries, setRecentEntries] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // Get service times for selected campus
  const getCampusServiceTimes = () => {
    const campus = campuses.find(c => c.id === selectedCampus);
    console.log('[LogStats] Selected campus:', campus);
    console.log('[LogStats] Campus service_times:', campus?.service_times);
    
    if (campus && campus.service_times && campus.service_times.length > 0) {
      console.log('[LogStats] Using campus service times:', campus.service_times);
      return campus.service_times;
    }
    // Default to all service times if campus not found
    console.log('[LogStats] No service times found, using defaults');
    return ['9:00 AM', '10:00 AM', '11:00 AM', '5:00 PM', '5:30 PM'];
  };

  // Calculate total attendance from service times
  const calculateTotalAttendance = () => {
    const serviceTimes = getCampusServiceTimes();
    return serviceTimes.reduce((total, serviceTime) => {
      const value = parseInt(quickInputStats[serviceTime]) || 0;
      return total + value;
    }, 0);
  };

  // Calculate total kids attendance from service times
  const calculateTotalKidsAttendance = () => {
    const serviceTimes = getCampusServiceTimes();
    const kidsServiceTimes = serviceTimes.map(st => `Kids ${st}`);
    return kidsServiceTimes.reduce((total, serviceTime) => {
      const value = parseInt(quickInputStats[serviceTime]) || 0;
      return total + value;
    }, 0);
  };

  const totalAttendance = calculateTotalAttendance();
  const totalKidsAttendance = calculateTotalKidsAttendance();
  const totalKidsOverall = totalKidsAttendance + (parseInt(quickInputStats['Kids Leaders']) || 0);

  // Check user permissions and redirect if no access
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const response = await fetch('/api/session', {
          credentials: 'include',
          cache: 'no-store'
        });
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated) {
            const customPerms = data.custom_permissions || {};
            const role = data.role || 'member';
            
            // Check if user has input access via custom_permissions or role
            // Priority: custom_permissions.input > role defaults
            let hasInputAccess = false;
            
            if (customPerms.input === true) {
              // Explicitly granted via custom_permissions
              hasInputAccess = true;
            } else if (customPerms.input === false) {
              // Explicitly denied via custom_permissions
              hasInputAccess = false;
            } else {
              // Not set in custom_permissions, check role defaults
              hasInputAccess = ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 
                               'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'user', 'member'].includes(role);
            }
            
            // Redirect if user doesn't have input access
            if (!hasInputAccess) {
              console.log('[LogStats] User does not have input access, redirecting to home');
              navigate('/');
            }
          }
        }
      } catch (error) {
        console.error('Error checking user permissions:', error);
      }
    };
    checkPermissions();
  }, [navigate]);

  useEffect(() => {
    // Load regions - Dec 17, 2025 deployment
    console.log('[LogStats] 🚀 Loading regions... (v1.2 - LATEST)');
    fetch('/api/v2/regions', {
      credentials: 'include'
    })
      .then(res => {
        console.log('[LogStats] Regions response status:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('[LogStats] Regions data:', data);
        if (data.regions) {
          const activeRegions = data.regions.filter(r => r.active);
          console.log('[LogStats] Active regions:', activeRegions);
          setRegions(activeRegions);
          // Set default region to Australia
          if (activeRegions.length > 0) {
            const defaultRegion = activeRegions.find(r => r.code === 'AU') || activeRegions[0];
            setSelectedRegion(defaultRegion.code);
            console.log('[LogStats] Default region set to:', defaultRegion.code);
          }
        } else {
          console.error('[LogStats] No regions in response');
        }
      })
      .catch(err => console.error('[LogStats] Error loading regions:', err));

    // Load campuses - Dec 17, 2025 deployment
    console.log('[LogStats] 🏫 Loading campuses... (v1.2 - LATEST)');
    fetch('/api/campuses', {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        console.log('[LogStats] Campuses response:', data);
        if (data.campuses) {
          console.log('[LogStats] First campus (may be "All"):', data.campuses[0]);
          console.log('[LogStats] Second campus (real campus):', data.campuses[1]);
          console.log('[LogStats] ALL campus data:', data.campuses);
          setAllCampuses(data.campuses); // Store all campuses
          setCampuses(data.campuses);
          // Set the default campus from the API response
          if (data.default) {
            setSelectedCampus(data.default);
          } else if (data.campuses.length > 0) {
            setSelectedCampus(data.campuses[0].id);
          }
        }
      })
      .catch(err => console.error('[LogStats] Error loading campuses:', err));

    // Set default date to today
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setQuickInputDate(`${year}-${month}-${day}`);
  }, []);

  // Filter campuses when region changes
  useEffect(() => {
    console.log('[LogStats] Region changed to:', selectedRegion);
    console.log('[LogStats] All campuses count:', allCampuses.length);
    console.log('[LogStats] Regions available:', regions);
    
    if (selectedRegion && allCampuses.length > 0) {
      const region = regions.find(r => r.code === selectedRegion);
      console.log('[LogStats] Found region:', region);
      
      if (region) {
        console.log('[LogStats] Filtering campuses: region.id =', region.id);
        console.log('[LogStats] All campus region_ids:', allCampuses.map(c => ({id: c.id, name: c.name, region_id: c.region_id})));
        
        // Filter by region_id, excluding "All Campuses" option (id === 'all_campuses')
        const filteredCampuses = allCampuses.filter(c => 
          c.id !== 'all_campuses' && c.region_id === region.id
        );
        console.log('[LogStats] Filtered campuses:', filteredCampuses);
        
        setCampuses(filteredCampuses);
        // Reset selected campus to first in region
        if (filteredCampuses.length > 0) {
          setSelectedCampus(filteredCampuses[0].id);
        } else {
          console.warn('[LogStats] No campuses found for region:', selectedRegion);
          setSelectedCampus('');
        }
      }
    }
  }, [selectedRegion, allCampuses, regions]);

  // Reset stats when campus changes (so service times update)
  useEffect(() => {
    if (selectedCampus && campuses.length > 0) {
      // Reset all service time fields when campus changes
      const resetStats = { ...quickInputStats };
      
      // Clear all service time fields (they'll be repopulated based on campus)
      Object.keys(resetStats).forEach(key => {
        if (key.includes(':') || key.startsWith('Kids ')) {
          resetStats[key] = '';
        }
      });
      
      setQuickInputStats(resetStats);
    }
  }, [selectedCampus, campuses]);

  // Load recent entries when campus changes
  useEffect(() => {
    if (selectedCampus) {
      loadRecentEntries();
    }
  }, [selectedCampus]);

  const loadRecentEntries = async () => {
    if (!selectedCampus) return;
    
    setLoadingRecent(true);
    try {
      const response = await fetch(`/api/recent_entries?campus=${selectedCampus}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.entries) {
        setRecentEntries(data.entries);
      } else {
        setRecentEntries([]);
      }
    } catch (err) {
      console.error('Error loading recent entries:', err);
      setRecentEntries([]);
    } finally {
      setLoadingRecent(false);
    }
  };

  const handleEditFromRecent = (entry) => {
    // DEBUG: Log the entire entry to see what data we're receiving
    console.log('[EDIT_FROM_RECENT] Full entry:', entry);
    console.log('[EDIT_FROM_RECENT] Entry stats:', entry.stats);
    
    // Map backend field names to frontend field names
    const fieldMapping = {
      'Total People in Campus': 'Total People in Campus',
      '9:00 AM': '9:00 AM',
      '10:00 AM': '10:00 AM',
      '11:00 AM': '11:00 AM',
      '5:00 PM': '5:00 PM',
      '5:30 PM': '5:30 PM',
      'Kids 9:00 AM': 'Kids 9:00 AM',
      'Kids 10:00 AM': 'Kids 10:00 AM',
      'Kids 11:00 AM': 'Kids 11:00 AM',
      'Kids 5:00 PM': 'Kids 5:00 PM',
      'Kids 5:30 PM': 'Kids 5:30 PM',
      'Kids Leaders': 'Kids Leaders',
      'New Kids': 'New Kids',
      'New Kids Salvations': 'Kids Salvations',
      'Packs Out': 'Packs Out',
      'Cards Back': 'Cards Returned',
      'First Time Visitors': 'First Time',
      'Visitors': 'Visitors',
      'Hands up': 'Hands up',
      'First Time Christians': 'First Time Decision',
      'Rededications': 'Rededication',
      'Salvation Cards Returned': 'Salvation Cards Returned',
      'Youth Attendance': 'Youth Total',
      'Youth New People': 'Youth NP',
      'Youth Salvations': 'Youth Salvations',
      'Youth Leaders': 'Youth Leaders',
      'Saints': 'Saints',
      'Connect Groups': 'Connect Groups',
      'Dream Team': 'Dream Team',
      'Seniors': 'Seniors',
      'Baptisms': 'Baptisms',
      'Child Dedications': 'Child Dedications'
    };

    // Load stats from entry
    const newStats = {};
    Object.keys(quickInputStats).forEach(key => {
      const backendKey = Object.keys(fieldMapping).find(k => fieldMapping[k] === key) || key;
      const value = entry.stats[backendKey];
      newStats[key] = value !== undefined && value !== null && value !== '' ? String(value) : '';
    });

    console.log('[EDIT_FROM_RECENT] Mapped stats:', newStats);
    setQuickInputStats(newStats);
    setQuickInputDate(entry.date);
    setIsEditMode(true);
    // Use campus_id if available, otherwise fall back to campus name
    const campusId = entry.campusId || entry.stats.Campus || entry.campus;
    const originalCampus = entry.campusId || entry.stats.Campus || entry.campus;
    
    // Set the selected campus to the correct one for editing (prefer campus_id)
    setSelectedCampus(campusId);
    
    setEditingEntry({
      originalCampus: originalCampus, // Use original campus name from stats data
      originalDate: entry.date,
      campusId: campusId // Store campus_id for proper lookup
    });
    setShowQuickInput(true);
  };

  const handleQuickInputSubmit = async () => {
    if (!selectedCampus || !quickInputDate) {
      alert('Please select a campus and date');
      return;
    }

    setIsSubmittingQuickInput(true);
    
    try {
      // Filter out empty values
      const nonEmptyStats = Object.fromEntries(
        Object.entries(quickInputStats).filter(([_, value]) => value.trim() !== '')
      );

      if (Object.keys(nonEmptyStats).length === 0) {
        alert('Please enter at least one stat value');
        return;
      }

      // Map frontend field names to backend field names
      const fieldMapping = {
        'Total People in Campus': 'Total People in Campus',
        '9:00 AM': '9:00 AM',
        '10:00 AM': '10:00 AM',
        '11:00 AM': '11:00 AM',
        '5:00 PM': '5:00 PM',
        '5:30 PM': '5:30 PM',
        'Kids 9:00 AM': 'Kids 9:00 AM',
        'Kids 10:00 AM': 'Kids 10:00 AM',
        'Kids 11:00 AM': 'Kids 11:00 AM',
        'Kids 5:00 PM': 'Kids 5:00 PM',
        'Kids 5:30 PM': 'Kids 5:30 PM',
        'Kids Leaders': 'Kids Leaders',
        'New Kids': 'New Kids',
        'Kids Salvations': 'New Kids Salvations',
        'Packs Out': 'Packs Out',
        'Cards Returned': 'Cards Back',
        'First Time': 'First Time Visitors',
        'Visitors': 'Visitors',
        'Hands up': 'Hands up',
        'First Time Decision': 'First Time Christians',
        'Rededication': 'Rededications',
        'Salvation Cards Returned': 'Salvation Cards Returned',
        'Youth Total': 'Youth Attendance',
        'Youth NP': 'Youth New People',
        'Youth Salvations': 'Youth Salvations',
        'Youth Leaders': 'Youth Leaders',
        'Saints': 'Saints',
        'Connect Groups': 'Connect Groups',
        'Dream Team': 'Dream Team',
        'Seniors': 'Seniors',
        'Baptisms': 'Baptisms',
        'Child Dedications': 'Child Dedications'
      };

      // Convert stats to backend format
      const backendStats = {};
      Object.entries(nonEmptyStats).forEach(([key, value]) => {
        const backendKey = fieldMapping[key] || key;
        backendStats[backendKey] = parseInt(value) || 0;
      });

      // Note: Total Attendance and Kids Attendance are NOT sent to backend
      // The backend calculates these from the individual service time columns

      const endpoint = isEditMode ? '/api/quick_input/update' : '/api/quick_input';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          campus: selectedCampus,
          date: quickInputDate,
          stats: backendStats,
          ...(isEditMode && editingEntry && { 
            originalDate: editingEntry.originalDate || editingEntry.date, 
            originalCampus: editingEntry.campusId || editingEntry.originalCampus 
          })
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        const campusName = campuses.find(c => c.id === selectedCampus)?.name || selectedCampus;
        
        if (isEditMode) {
          // Update the existing entry in session stats
          setSessionStats(prev => prev.map(stat => 
            stat.timestamp === editingEntry.timestamp
              ? {
                  ...stat,
                  campus: campusName,
                  campusId: selectedCampus,
                  date: quickInputDate,
                  stats: {...quickInputStats},
                  text: `Quick input: ${Object.keys(nonEmptyStats).join(', ')}`
                }
              : stat
          ));
          alert('Stats updated successfully!');
        } else {
          // Add to session stats with full data for editing
          setSessionStats(prev => [{
            campus: campusName,
            campusId: selectedCampus,
            date: quickInputDate,
            stats: {...quickInputStats}, // Store complete stats
            text: `Quick input: ${Object.keys(nonEmptyStats).join(', ')}`,
            timestamp: new Date().toISOString()
          }, ...prev.slice(0, 9)]); // Keep last 10 entries
          alert('Stats logged successfully!');
        }

        // Reset form
        setQuickInputStats({
          'Total People in Campus': '',
          '9:00 AM': '',
          '10:00 AM': '',
          '11:00 AM': '',
          '5:00 PM': '',
          '5:30 PM': '',
          'Kids 9:00 AM': '',
          'Kids 10:00 AM': '',
          'Kids 11:00 AM': '',
          'Kids 5:00 PM': '',
          'Kids 5:30 PM': '',
          'Kids Leaders': '',
          'New Kids': '',
          'Kids Salvations': '',
          'Packs Out': '',
          'Cards Returned': '',
          'First Time': '',
          'Visitors': '',
          'Hands up': '',
          'First Time Decision': '',
          'Rededication': '',
          'Youth Total': '',
          'Youth NP': '',
          'Youth Salvations': '',
          'Saints': '',
          'Connect Groups': '',
          'Dream Team': '',
          'Seniors': '',
          'Baptisms': '',
          'Child Dedications': ''
        });
        setShowQuickInput(false);
        setIsEditMode(false);
        setEditingEntry(null);
        
        // Reload recent entries to show the updated/new entry
        loadRecentEntries();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || (isEditMode ? 'Failed to update stats' : 'Failed to log stats')}`);
      }
    } catch (error) {
      console.error('Error submitting quick input:', error);
      alert('Error submitting stats. Please try again.');
    } finally {
      setIsSubmittingQuickInput(false);
    }
  };

  return (
    <div className="relative">
      <DynamicBackground />
      
      {/* Header */}
      <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <span className="text-4xl">📊</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Stats Input</h1>
          <p className="text-slate-400 text-lg">Input church statistics and attendance data</p>
        </div>

        {/* Main Card */}
        <div className="max-w-6xl mx-auto">
          <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/20 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 space-y-4 sm:space-y-0">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Quick Stats Entry</h2>
                <p className="text-slate-300 text-base">Enter your church statistics quickly and efficiently</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
                {/* Region Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                  <span className="text-sm text-slate-300 font-medium">Region:</span>
                  <select
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm"
                  >
                    {regions.length === 0 ? (
                      <option value="">Loading...</option>
                    ) : (
                      regions.map(region => (
                        <option key={region.code} value={region.code} className="bg-slate-800">
                          {region.display_name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Campus Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                  <span className="text-sm text-slate-300 font-medium">Campus:</span>
                  <select
                    value={selectedCampus}
                    onChange={(e) => setSelectedCampus(e.target.value)}
                    className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                  >
                    {campuses.length === 0 ? (
                      <option value="">No campuses in this region</option>
                    ) : (
                      campuses.map(campus => (
                        <option key={campus.id} value={campus.id}>
                          {campus.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>
            
            {/* Quick Input Section */}
            <div className="text-center">
              <button
                onClick={() => setShowQuickInput(true)}
                className="relative bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-12 py-5 rounded-2xl text-xl font-bold transition-all duration-300 shadow-2xl hover:shadow-purple-500/50 transform hover:scale-105 overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative z-10">Start Input</span>
              </button>
            </div>
          </div>
        </div>

        {/* Recent Entries from Last 7 Days */}
        <div className="max-w-6xl mx-auto mt-8">
          <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Recent Entries (Last 7 Days)</h3>
              {loadingRecent && (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              )}
            </div>
            {recentEntries.length > 0 ? (
              <div className="space-y-4">
                {recentEntries.map((entry, index) => {
                  const totalAtt = (entry.stats['Total Attendance'] || 0);
                  const kidsAtt = (entry.stats['Kids Attendance'] || 0);
                  const newPeople = (entry.stats['New People'] || 0);
                  const newChristians = (entry.stats['New Christians'] || 0);
                  
                  // Format campus name properly
                  const campusName = entry.campus === 'All Campuses' ? 'All Campuses' : 
                    entry.campus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                  
                  // Create unique key for each entry
                  const uniqueKey = `${entry.date}-${entry.campus}-${index}`;
                  
                  return (
                    <div 
                      key={uniqueKey} 
                      className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-white/20 shadow-lg hover:shadow-xl hover:border-blue-500/50 transition-all duration-300 cursor-pointer group" 
                      onClick={() => {
                        handleEditFromRecent(entry);
                      }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 w-full">
                          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mb-4">
                            <div className="text-base sm:text-lg text-blue-400 font-bold">{entry.date}</div>
                            <div className="text-sm text-slate-400 bg-white/10 rounded-lg px-3 py-1 w-fit">
                              {campusName}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-4">
                            <div className="pb-2">
                              <div className="text-xs sm:text-sm text-slate-400 mb-2 leading-tight">Total Attendance</div>
                              <div className="text-white text-lg sm:text-xl font-semibold">{totalAtt.toLocaleString()}</div>
                            </div>
                            <div className="pb-2">
                              <div className="text-xs sm:text-sm text-slate-400 mb-2 leading-tight">New People</div>
                              <div className="text-green-400 text-lg sm:text-xl font-semibold">{newPeople.toLocaleString()}</div>
                            </div>
                            <div className="pb-2">
                              <div className="text-xs sm:text-sm text-slate-400 mb-2 leading-tight">New Christians</div>
                              <div className="text-yellow-400 text-lg sm:text-xl font-semibold">{newChristians.toLocaleString()}</div>
                            </div>
                            <div className="pb-2">
                              <div className="text-xs sm:text-sm text-slate-400 mb-2 leading-tight">Kids</div>
                              <div className="text-pink-400 text-lg sm:text-xl font-semibold">{kidsAtt.toLocaleString()}</div>
                            </div>
                          </div>
                        </div>
                        <div className="bg-blue-500/20 p-3 rounded-xl opacity-0 sm:opacity-100 sm:group-hover:opacity-100 transition-opacity mt-4 sm:mt-0 sm:ml-4 flex-shrink-0 self-end sm:self-auto">
                          <PencilIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-r from-slate-500 to-slate-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📝</span>
                </div>
                <div className="text-slate-300 text-lg font-semibold mb-2">No recent entries found</div>
                <p className="text-slate-400 text-sm">Start by using quick input above to log stats</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Input Modal */}
        {showQuickInput && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-3xl font-bold text-white mb-2">{isEditMode ? 'Edit Stats Entry' : 'Quick Stats Input'}</h3>
                  <p className="text-slate-300">{isEditMode ? 'Update your church statistics' : 'Enter your church statistics in organized sections'}</p>
                </div>
                <button
                  onClick={() => {
                    setShowQuickInput(false);
                    setIsEditMode(false);
                    setEditingEntry(null);
                  }}
                  className="text-slate-400 hover:text-white transition-colors duration-200 p-2 hover:bg-white/10 rounded-xl"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              
              {/* Region, Campus & Date Selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/30">
                  <label className="block text-sm font-semibold text-white mb-3">
                    Region
                  </label>
                  <select
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white w-full focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm"
                  >
                    {regions.length === 0 ? (
                      <option value="">Loading regions...</option>
                    ) : (
                      regions.map(region => (
                        <option key={region.code} value={region.code} className="bg-slate-800">
                          {region.code === 'AU' ? '🇦🇺' : region.code === 'US' ? '🇺🇸' : region.code === 'BR' ? '🇧🇷' : region.code === 'ID' ? '🇮🇩' : '🌏'} {region.display_name}
                        </option>
                      ))
                    )}
                  </select>
                  {regions.length === 0 && (
                    <p className="mt-2 text-xs text-red-400">⚠️ Regions not loading. Check console.</p>
                  )}
                </div>

                <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                  <label className="block text-sm font-semibold text-white mb-3">
                    Campus
                  </label>
                  <select
                    value={selectedCampus}
                    onChange={(e) => setSelectedCampus(e.target.value)}
                    className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                  >
                    {campuses.length === 0 ? (
                      <option value="">No campuses in this region</option>
                    ) : (
                      campuses.map(campus => (
                        <option key={campus.id} value={campus.id}>
                          {campus.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                
                <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                  <label className="block text-sm font-semibold text-white mb-3">
                    Service Date
                  </label>
                  <div className="flex items-center space-x-3">
                    <CalendarIcon className="w-5 h-5 text-blue-400" />
                    <input
                      type="date"
                      value={quickInputDate}
                      onChange={(e) => setQuickInputDate(e.target.value)}
                      className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                    />
                  </div>
                </div>
              </div>
              
              {/* Stats Form */}
              <div className="space-y-8">
                {/* Campus Information */}
                <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
                  <div className="flex items-center mb-6">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mr-4">
                      <span className="text-xl">🏢</span>
                    </div>
                    <h4 className="text-xl font-bold text-white">Campus Information</h4>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-white font-semibold min-w-[200px]">
                        Total People in Campus:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['Total People in Campus']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'Total People in Campus': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Service Attendance Breakdown */}
                <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
                  <div className="flex items-center mb-6">
                    <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mr-4">
                      <span className="text-xl">⛪</span>
                    </div>
                    <h4 className="text-xl font-bold text-white">Service Attendance (Adults)</h4>
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                    {getCampusServiceTimes().map((serviceTime) => (
                      <div key={serviceTime} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <label className="text-white font-semibold text-sm sm:text-base sm:min-w-[150px]">
                          {serviceTime}:
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={quickInputStats[serviceTime] || ''}
                          onChange={(e) => setQuickInputStats(prev => ({
                            ...prev,
                            [serviceTime]: e.target.value
                          }))}
                          placeholder="0"
                          className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                          style={{ color: '#ffffff' }}
                        />
                      </div>
                    ))}

                    <div className="flex items-center justify-between border-t border-slate-600 pt-3">
                      <label className="text-white font-semibold min-w-[150px]">
                        Total Attendance:
                      </label>
                      <div className="text-white font-semibold text-right w-32">
                        {totalAttendance}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Saints */}
                <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
                  <div className="flex items-center mb-6">
                    <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center mr-4">
                      <span className="text-xl">👥</span>
                    </div>
                    <h4 className="text-xl font-bold text-white">Saints</h4>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-white font-semibold min-w-[150px]">
                        Saints:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['Saints']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'Saints': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                  </div>
                </div>

                {/* New People */}
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-3">New People</h4>
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <label className="text-white font-semibold text-sm sm:text-base sm:min-w-[150px]">
                        Packs Out:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['Packs Out']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'Packs Out': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <label className="text-white font-semibold text-sm sm:text-base sm:min-w-[150px]">
                        Cards Returned:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['Cards Returned']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'Cards Returned': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <label className="text-white font-semibold text-sm sm:text-base sm:min-w-[150px]">
                        First Time:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['First Time']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'First Time': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <label className="text-white font-semibold text-sm sm:text-base sm:min-w-[150px]">
                        Visitors:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['Visitors']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'Visitors': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Salvations */}
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-3">Salvations</h4>
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <label className="text-white font-semibold text-sm sm:text-base sm:min-w-[150px]">
                        Hands up:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['Hands up']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'Hands up': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <label className="text-white font-semibold text-sm sm:text-base sm:min-w-[150px]">
                        Salvation Cards Returned:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['Salvation Cards Returned']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'Salvation Cards Returned': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <label className="text-white font-semibold text-sm sm:text-base sm:min-w-[150px]">
                        First Time Decision:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['First Time Decision']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'First Time Decision': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <label className="text-white font-semibold text-sm sm:text-base sm:min-w-[150px]">
                        Rededication:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['Rededication']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'Rededication': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Kids */}
                <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
                  <div className="flex items-center mb-6">
                    <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl flex items-center justify-center mr-4">
                      <span className="text-xl">👶</span>
                    </div>
                    <h4 className="text-xl font-bold text-white">Kids</h4>
                  </div>
                  <div className="space-y-4">
                    {getCampusServiceTimes().map((serviceTime) => {
                      const kidsServiceTime = `Kids ${serviceTime}`;
                      return (
                        <div key={kidsServiceTime} className="flex items-center justify-between">
                          <label className="text-white font-semibold min-w-[150px]">
                            {kidsServiceTime}:
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={quickInputStats[kidsServiceTime] || ''}
                            onChange={(e) => setQuickInputStats(prev => ({
                              ...prev,
                              [kidsServiceTime]: e.target.value
                            }))}
                            placeholder="0"
                            className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                            style={{ color: '#ffffff' }}
                          />
                        </div>
                      );
                    })}
                    <div className="border-t border-white/20 pt-4 mt-4">
                      <div className="flex items-center justify-between">
                        <label className="text-white font-semibold min-w-[150px]">
                          Total Kids Leaders:
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={quickInputStats['Kids Leaders']}
                          onChange={(e) => setQuickInputStats(prev => ({
                            ...prev,
                            'Kids Leaders': e.target.value
                          }))}
                          placeholder="0"
                          className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-white font-semibold min-w-[150px]">
                        New Kids:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['New Kids']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'New Kids': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-white font-semibold min-w-[150px]">
                        Kids Salvations:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['Kids Salvations']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'Kids Salvations': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                      />
                    </div>
                    {totalKidsOverall > 0 && (
                      <div className="flex items-center justify-between border-t border-white/20 pt-4 mt-4">
                        <span className="text-pink-300 font-bold text-lg">Total Kids (Kids + Leaders):</span>
                        <span className="text-pink-300 font-bold text-2xl">{totalKidsOverall}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Youth */}
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-3">Youth (Friday)</h4>
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <label className="text-white font-semibold text-sm sm:text-base sm:min-w-[150px]">
                        Youth Attendance:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['Youth Total']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'Youth Total': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <label className="text-white font-semibold text-sm sm:text-base sm:min-w-[150px]">
                        Youth New People:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['Youth NP']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'Youth NP': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <label className="text-white font-semibold text-sm sm:text-base sm:min-w-[150px]">
                        Youth Salvations:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['Youth Salvations']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'Youth Salvations': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <label className="text-white font-semibold text-sm sm:text-base sm:min-w-[150px]">
                        Youth Leaders:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['Youth Leaders']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'Youth Leaders': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Connect Groups & Ministry */}
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-3">Connect Groups & Ministry</h4>
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <label className="text-white font-semibold text-sm sm:text-base sm:min-w-[150px]">
                        Connect Groups:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['Connect Groups']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'Connect Groups': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <label className="text-white font-semibold text-sm sm:text-base sm:min-w-[150px]">
                        Dream Team:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['Dream Team']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'Dream Team': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <label className="text-white font-semibold text-sm sm:text-base sm:min-w-[150px]">
                        Seniors:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['Seniors']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'Seniors': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Special Events */}
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-3">Special Events</h4>
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <label className="text-white font-semibold text-sm sm:text-base sm:min-w-[150px]">
                        Baptisms:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['Baptisms']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'Baptisms': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <label className="text-white font-semibold text-sm sm:text-base sm:min-w-[150px]">
                        Child Dedications:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quickInputStats['Child Dedications']}
                        onChange={(e) => setQuickInputStats(prev => ({
                          ...prev,
                          'Child Dedications': e.target.value
                        }))}
                        placeholder="0"
                        className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-right w-full sm:w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                        style={{ color: '#ffffff' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Validation Hint */}
              <div className="mt-6 p-3 bg-slate-700/30 rounded-lg">
                <p className="text-sm text-slate-400">
                  Your number should not have commas or currency symbols
                </p>
              </div>
              
              {/* Submit Button */}
              <div className="flex justify-end mt-8">
                <button
                  onClick={handleQuickInputSubmit}
                  disabled={isSubmittingQuickInput}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white px-8 py-4 rounded-2xl flex items-center space-x-3 transition-all duration-300 shadow-lg hover:shadow-xl text-lg font-semibold transform hover:scale-105 disabled:transform-none"
                >
                  {isSubmittingQuickInput ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : isEditMode ? (
                    <PencilIcon className="w-5 h-5" />
                  ) : (
                    <PlusIcon className="w-5 h-5" />
                  )}
                  <span>{isSubmittingQuickInput ? (isEditMode ? 'Updating...' : 'Submitting...') : (isEditMode ? 'Update Stats' : 'Submit Stats')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default LogStats; 