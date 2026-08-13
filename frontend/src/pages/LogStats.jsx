import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, CalendarIcon, XMarkIcon, PencilIcon, SparklesIcon, CloudIcon } from '@heroicons/react/24/outline';
import DynamicBackground from '../components/DynamicBackground';
import { useSession } from '../lib/useSession';

// Numeric input row: label left, round +/- steppers either side of a centered
// monospace input. Steppers read/write the same uncontrolled input + updateStat
// path the plain onChange already used, so no field keys or submit behavior change.
const NumberField = ({ statKey, label, formRef, quickInputStats, updateStat }) => {
  const handleStep = (delta) => {
    const input = formRef.current?.querySelector(`[data-stat-key="${statKey}"]`);
    const current = parseInt(input?.value, 10) || 0;
    const next = Math.max(0, current + delta);
    if (input) input.value = String(next);
    updateStat(statKey, String(next));
  };
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 py-3.5">
      <label className="text-[15px] sm:text-base text-fc-midnight flex-1 min-w-0">{label}</label>
      <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
        <button
          type="button"
          onClick={() => handleStep(-1)}
          aria-label={`Decrease ${label}`}
          className="w-11 h-11 rounded-full border border-fc-cream2 bg-white text-fc-brown text-xl leading-none flex items-center justify-center active:bg-fc-cream2/60 transition-colors"
        >
          &minus;
        </button>
        <input
          type="text"
          inputMode="numeric"
          data-stat-key={statKey}
          defaultValue={quickInputStats[statKey] || ''}
          onChange={(e) => updateStat(statKey, e.target.value)}
          placeholder="0"
          className="w-[70px] sm:w-[82px] h-11 px-2 rounded-[10px] border border-fc-cream2 bg-fc-cream font-mono text-lg text-fc-midnight text-center outline-none focus:ring-2 focus:ring-fc-olive/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => handleStep(1)}
          aria-label={`Increase ${label}`}
          className="w-11 h-11 rounded-full border border-fc-cream2 bg-white text-fc-brown text-xl leading-none flex items-center justify-center active:bg-fc-cream2/60 transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
};

// Card wrapper for a group of NumberFields, with hairline dividers between rows.
const SectionCard = ({ title, children }) => (
  <div className="fc-card p-5 sm:p-6">
    <div className="fc-label mb-1">{title}</div>
    <div className="divide-y divide-fc-cream2">{children}</div>
  </div>
);

const LogStats = () => {
  const navigate = useNavigate();
  const session = useSession();
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
  const [formMountKey, setFormMountKey] = useState(0);
  /** Checked = special service (Easter, Good Friday, etc.) — saved but not counted in normal YTD / averages */
  const [specialEventExcludeFromNormalTotals, setSpecialEventExcludeFromNormalTotals] = useState(false);
  const [specialServiceLabel, setSpecialServiceLabel] = useState('');

  // Ref updated synchronously on every keystroke - guaranteed to have latest values on submit
  const quickInputFormRef = useRef(null);
  const latestValuesRef = useRef({});
  const updateStat = (key, value) => {
    console.log(`[UPDATE_STAT] key="${key}", value="${value}"`);
    latestValuesRef.current = { ...latestValuesRef.current, [key]: value };
    console.log('[UPDATE_STAT] latestValuesRef.current after update:', latestValuesRef.current);
    const next = { ...quickInputStats, [key]: value };
    setQuickInputStats(next);
  };
  // Get stats for submit: use ref which is updated synchronously on every onChange
  const getStatsForSubmit = () => {
    console.log('[GET_STATS] latestValuesRef.current:', JSON.stringify(latestValuesRef.current, null, 2));
    console.log('[GET_STATS] quickInputStats:', JSON.stringify(quickInputStats, null, 2));
    // Merge: quickInputStats has initial values, latestValuesRef has user changes
    const result = { ...quickInputStats, ...latestValuesRef.current };
    console.log('[GET_STATS] Final merged result:', JSON.stringify(result, null, 2));
    return result;
  };

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

  // Check user permissions and redirect if no access.
  // permissions.log_stats is fully resolved server-side (role defaults + overrides).
  useEffect(() => {
    if (session.loading || !session.authenticated) return;
    if (!session.permissions.log_stats) {
      console.log('[LogStats] User does not have stats input access, redirecting to home');
      navigate('/');
    }
  }, [session.loading, session.authenticated, session.permissions.log_stats, navigate]);

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
  // CRITICAL: Skip when modal is open - otherwise we remount form and lose user's typed values
  useEffect(() => {
    if (showQuickInput) return;
    if (selectedCampus && campuses.length > 0) {
      setQuickInputStats(prev => {
        const resetStats = { ...prev };
        Object.keys(resetStats).forEach(key => {
          if (key.includes(':') || key.startsWith('Kids ')) {
            resetStats[key] = '';
          }
        });
        return resetStats;
      });
      setFormMountKey(k => k + 1); // Force form remount with fresh defaults
    }
  }, [selectedCampus, campuses, showQuickInput]);

  // Load recent entries when campus changes
  useEffect(() => {
    if (selectedCampus) {
      loadRecentEntries();
    }
  }, [selectedCampus]);

  const loadRecentEntries = async (cacheBuster = false) => {
    if (!selectedCampus) return;
    
    setLoadingRecent(true);
    try {
      const url = cacheBuster
        ? `/api/recent_entries?campus=${encodeURIComponent(selectedCampus)}&_t=${Date.now()}`
        : `/api/recent_entries?campus=${encodeURIComponent(selectedCampus)}&_t=${Date.now()}`;
      const response = await fetch(url, {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
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

  const handleEditFromRecent = async (entry) => {
    // Refetch to get latest data before opening edit form
    try {
      const url = `/api/recent_entries?campus=${encodeURIComponent(selectedCampus)}&_t=${Date.now()}`;
      const response = await fetch(url, {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
      });
      const data = await response.json();
      if (data.entries && data.entries.length > 0) {
        const freshEntry = data.entries.find(e => 
          e.date === entry.date && 
          (e.campus === entry.campus || e.stats?.Campus === entry.campus || (e.stats?.campusId || e.campusId) === (entry.campusId || entry.stats?.campusId))
        );
        if (freshEntry) entry = freshEntry;
        setRecentEntries(data.entries);
      }
    } catch (err) {
      console.warn('[EDIT_FROM_RECENT] Could not refetch, using cached entry:', err);
    }
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

    // Load stats from entry - start with all known keys
    const newStats = {};
    Object.keys(quickInputStats).forEach(key => {
      const backendKey = Object.keys(fieldMapping).find(k => fieldMapping[k] === key) || key;
      const value = entry.stats[backendKey];
      newStats[key] = value !== undefined && value !== null && value !== '' ? String(value) : '';
    });

    // Merge in ANY extra keys from entry.stats (e.g. custom service times like "7:00PM (Brazilian)")
    // Also ensure backend keys (Youth Attendance, Youth New People, etc.) map to form keys (Youth Total, Youth NP)
    const skipKeys = ['id', 'date', 'campus', 'campusId', 'Tithe'];
    const backendToFrontend = {
      'Youth Attendance': 'Youth Total',
      'Youth New People': 'Youth NP',
      'First Time Visitors': 'First Time',
      'First Time Christians': 'First Time Decision',
      'Rededications': 'Rededication',
      'New Kids Salvations': 'Kids Salvations',
      'Cards Back': 'Cards Returned',
    };
    Object.entries(entry.stats || {}).forEach(([k, v]) => {
      if (skipKeys.includes(k)) return;
      const str = v !== undefined && v !== null && v !== '' ? String(v) : '';
      // If this is a backend key that maps to a frontend key, ONLY set the frontend key
      if (backendToFrontend[k] !== undefined) {
        newStats[backendToFrontend[k]] = str;
      } else {
        // Otherwise set the key as-is (for custom service times, etc.)
        newStats[k] = str;
      }
    });

    console.log('[EDIT_FROM_RECENT] Mapped stats:', newStats);
    console.log('[EDIT_FROM_RECENT] Setting latestValuesRef.current to:', newStats);
    latestValuesRef.current = { ...newStats }; // Sync ref BEFORE opening modal - source of truth for submit
    setQuickInputStats(newStats);
    setQuickInputDate(entry.date);
    const ir = entry.stats?.include_in_rollup_metrics;
    setSpecialEventExcludeFromNormalTotals(ir === false || ir === 0 || ir === '0');
    setSpecialServiceLabel(
      entry.stats?.special_service_label != null && entry.stats?.special_service_label !== ''
        ? String(entry.stats.special_service_label)
        : ''
    );
    setIsEditMode(true);
    // Use campus_id if available, otherwise fall back to campus name
    const campusId = entry.campusId || entry.stats?.campusId || entry.stats?.Campus || entry.campus;
    const originalCampus = campusId || entry.campus;
    
    // DON'T change selectedCampus - keep the list filter so after save we refetch the same view
    
    setEditingEntry({
      originalCampus: originalCampus,
      originalDate: entry.date,
      campusId: campusId,
      recordId: entry.stats?.id ?? entry.id // DB record ID for reliable update
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
      // Ref updated on every keystroke + DOM sync - guaranteed latest values
      const latestStats = getStatsForSubmit();
      console.log('[SUBMIT_DEBUG] === PAYLOAD CONSTRUCTION ===');
      console.log('[SUBMIT_DEBUG] latestValuesRef.current:', latestValuesRef.current);
      console.log('[SUBMIT_DEBUG] latestStats (after getStatsForSubmit):', latestStats);
      console.log('[SUBMIT_DEBUG] quickInputStats (state):', quickInputStats);
      
      const nonEmptyStats = Object.fromEntries(
        Object.entries(latestStats).filter(([_, value]) => String(value || '').trim() !== '')
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

      // Build backend stats: ONLY send non-empty fields to avoid overwriting untouched fields with 0
      const backendStats = {};
      Object.entries(nonEmptyStats).forEach(([key, value]) => {
        const backendKey = fieldMapping[key] || key;
        const parsed = parseInt(value, 10);
        if (!Number.isNaN(parsed)) {
          backendStats[backendKey] = parsed;
        }
      });

      console.log('[SUBMIT_DEBUG] backendStats (before send):', backendStats);
      console.log('[SUBMIT_DEBUG] isEditMode:', isEditMode);
      console.log('[SUBMIT_DEBUG] editingEntry:', editingEntry);

      // Note: Total Attendance and Kids Attendance are NOT sent to backend
      // The backend calculates these from the individual service time columns

      const endpoint = isEditMode ? '/api/quick_input/update' : '/api/quick_input';
      // When editing, use the entry's campus (not dropdown) so we update the correct record
      const campusForPayload = isEditMode && editingEntry
        ? (editingEntry.campusId || editingEntry.originalCampus)
        : selectedCampus;
      
      const payload = {
        campus: campusForPayload,
        date: quickInputDate,
        stats: backendStats,
        include_in_rollup_metrics: !specialEventExcludeFromNormalTotals,
        ...(specialServiceLabel.trim() || isEditMode
          ? { special_service_label: specialServiceLabel.trim() }
          : {}),
        ...(isEditMode && editingEntry && { 
          originalDate: editingEntry.originalDate || editingEntry.date, 
          originalCampus: editingEntry.campusId || editingEntry.originalCampus,
          recordId: editingEntry.recordId
        })
      };
      console.log('[SUBMIT_DEBUG] Full payload being sent:', JSON.stringify(payload, null, 2));
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        
        const campusName = campuses.find(c => c.id === selectedCampus)?.name || selectedCampus;
        
        if (isEditMode) {
          // Update the existing entry in session stats (use latestStats = what we actually sent)
          setSessionStats(prev => prev.map(stat => 
            stat.timestamp === editingEntry.timestamp
              ? {
                  ...stat,
                  campus: campusName,
                  campusId: selectedCampus,
                  date: quickInputDate,
                  stats: {...latestStats},
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
            stats: {...latestStats}, // Store complete stats
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
        setSpecialEventExcludeFromNormalTotals(false);
        setSpecialServiceLabel('');
        
        // Reload recent entries with cache-buster so the list shows DB state (not cached)
        loadRecentEntries(true);
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
    <div className="relative min-h-screen">
      <DynamicBackground />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="fc-label mb-2">Weekly entry</div>
          <h1 className="fc-display fc-display-md mb-2">Stats Input</h1>
          <p className="text-fc-brown text-[15px]">Input church statistics and attendance data</p>
        </div>

        {/* Main Card */}
        <div className="fc-card p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-6">
            <div>
              <h2 className="fc-display text-2xl mb-1">Quick Stats Entry</h2>
              <p className="text-fc-brown text-[15px]">Enter your church statistics quickly and efficiently</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Region Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <span className="fc-label">Region</span>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="fc-input py-2.5 text-sm"
                >
                  {regions.length === 0 ? (
                    <option value="">Loading...</option>
                  ) : (
                    regions.map(region => (
                      <option key={region.code} value={region.code}>
                        {region.display_name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Campus Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <span className="fc-label">Campus</span>
                <select
                  value={selectedCampus}
                  onChange={(e) => setSelectedCampus(e.target.value)}
                  className="fc-input py-2.5 text-sm"
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
              onClick={() => {
                latestValuesRef.current = { ...quickInputStats };
                setSpecialEventExcludeFromNormalTotals(false);
                setSpecialServiceLabel('');
                setShowQuickInput(true);
              }}
              className="fc-btn-primary px-12 py-4 text-lg"
            >
              Start Input
            </button>
          </div>
        </div>

        {/* Recent Entries from Last 30 Days */}
        <div className="mt-8">
          <div className="fc-card p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="fc-display text-2xl">Recent Entries (Last 30 Days)</h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => loadRecentEntries(true)}
                  disabled={loadingRecent}
                  className="text-sm text-fc-copper hover:opacity-80 disabled:opacity-50"
                >
                  Refresh
                </button>
                {loadingRecent && (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-fc-copper"></div>
                )}
              </div>
            </div>
            {recentEntries.length > 0 ? (
              <div className="space-y-3">
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
                      className="bg-fc-cream rounded-2xl p-4 sm:p-6 border border-fc-cream2 hover:border-fc-copper/40 hover:shadow-md transition-all duration-200 cursor-pointer group"
                      onClick={() => {
                        // Fix: Use index to get the current entry from state to avoid stale closure
                        handleEditFromRecent(recentEntries[index]);
                      }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 w-full">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
                            <div className="text-base sm:text-lg text-fc-copper font-semibold">{entry.date}</div>
                            <div className="text-sm text-fc-brown bg-white rounded-lg px-3 py-1 w-fit border border-fc-cream2">
                              {campusName}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-4">
                            <div className="pb-2">
                              <div className="text-xs sm:text-sm text-fc-brown mb-2 leading-tight">Total Attendance</div>
                              <div className="text-fc-midnight text-lg sm:text-xl font-mono">{totalAtt.toLocaleString()}</div>
                            </div>
                            <div className="pb-2">
                              <div className="text-xs sm:text-sm text-fc-brown mb-2 leading-tight">New People</div>
                              <div className="text-fc-olive text-lg sm:text-xl font-mono">{newPeople.toLocaleString()}</div>
                            </div>
                            <div className="pb-2">
                              <div className="text-xs sm:text-sm text-fc-brown mb-2 leading-tight">New Christians</div>
                              <div className="text-fc-gold text-lg sm:text-xl font-mono">{newChristians.toLocaleString()}</div>
                            </div>
                            <div className="pb-2">
                              <div className="text-xs sm:text-sm text-fc-brown mb-2 leading-tight">Kids</div>
                              <div className="text-fc-teal text-lg sm:text-xl font-mono">{kidsAtt.toLocaleString()}</div>
                            </div>
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded-xl opacity-0 sm:opacity-100 sm:group-hover:opacity-100 transition-opacity mt-4 sm:mt-0 sm:ml-4 flex-shrink-0 self-end sm:self-auto border border-fc-cream2">
                          <PencilIcon className="w-5 h-5 sm:w-6 sm:h-6 text-fc-copper" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-fc-cream2 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📝</span>
                </div>
                <div className="text-fc-midnight text-lg font-semibold mb-2">No recent entries found</div>
                <p className="text-fc-brown text-sm">Start by using quick input above to log stats</p>
              </div>
            )}
          </div>
        </div>
      </div>

        {/* Quick Input Modal */}
        {showQuickInput && (
          <div className="fixed inset-0 bg-fc-midnight/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div ref={quickInputFormRef} key={`stats-form-${selectedCampus}-${formMountKey}-${isEditMode ? (editingEntry?.recordId ?? 'edit') : 'new'}`} className="bg-fc-cream border border-fc-cream2 rounded-3xl p-6 sm:p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl pb-28">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="fc-label mb-2">{isEditMode ? 'Editing entry' : 'Weekly entry'}</div>
                  <h3 className="fc-display text-2xl sm:text-3xl mb-1">{isEditMode ? 'Edit Stats Entry' : 'Quick Stats Input'}</h3>
                  <p className="text-fc-brown text-[15px]">{isEditMode ? 'Update your church statistics' : 'Enter your church statistics in organized sections'}</p>
                </div>
                <button
                  onClick={() => {
                    setShowQuickInput(false);
                    setIsEditMode(false);
                    setEditingEntry(null);
                  }}
                  className="text-fc-brown hover:text-fc-midnight transition-colors duration-200 p-2 hover:bg-fc-cream2 rounded-xl flex-shrink-0"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Region, Campus & Date Selection */}
              <div className="flex flex-wrap gap-2 mb-6">
                <label className="inline-flex items-center gap-2 px-3 py-2.5 bg-white rounded-full shadow-sm border border-fc-cream2 text-sm">
                  <span className="fc-label !mb-0 !tracking-normal !text-[11px]">Region</span>
                  <select
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    className="bg-transparent text-fc-midnight text-sm outline-none border-none"
                  >
                    {regions.length === 0 ? (
                      <option value="">Loading regions...</option>
                    ) : (
                      regions.map(region => (
                        <option key={region.code} value={region.code}>
                          {region.code === 'AU' ? '🇦🇺' : region.code === 'US' ? '🇺🇸' : region.code === 'BR' ? '🇧🇷' : region.code === 'ID' ? '🇮🇩' : '🌏'} {region.display_name}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                {regions.length === 0 && (
                  <p className="text-xs text-fc-copper self-center">Regions not loading. Check console.</p>
                )}

                <label className="inline-flex items-center gap-2 px-3 py-2.5 bg-white rounded-full shadow-sm border border-fc-cream2 text-sm">
                  <span className="fc-label !mb-0 !tracking-normal !text-[11px]">Campus</span>
                  <select
                    value={selectedCampus}
                    onChange={(e) => setSelectedCampus(e.target.value)}
                    className="bg-transparent text-fc-midnight text-sm outline-none border-none"
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
                </label>

                <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-white rounded-full shadow-sm border border-fc-cream2 text-sm cursor-pointer">
                  <CalendarIcon className="w-4 h-4 text-fc-copper" />
                  <input
                    type="date"
                    value={quickInputDate}
                    onChange={(e) => setQuickInputDate(e.target.value)}
                    className="bg-transparent text-fc-midnight text-sm outline-none border-none"
                  />
                </label>
              </div>

              <div className="mb-6 flex gap-2 flex-wrap items-start">
                <button
                  type="button"
                  onClick={() => setSpecialEventExcludeFromNormalTotals(v => !v)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-colors ${
                    specialEventExcludeFromNormalTotals
                      ? 'bg-fc-copper text-white'
                      : 'bg-white text-fc-midnight border border-fc-cream2'
                  }`}
                >
                  <SparklesIcon className="w-3.5 h-3.5" /> Special service
                </button>
                {specialEventExcludeFromNormalTotals && (
                  <input
                    type="text"
                    value={specialServiceLabel}
                    onChange={(e) => setSpecialServiceLabel(e.target.value)}
                    placeholder="e.g. Good Friday, Christmas Eve"
                    maxLength={200}
                    className="fc-input min-w-[220px] py-2.5"
                  />
                )}
              </div>
              {specialEventExcludeFromNormalTotals && (
                <p className="-mt-3 mb-6 text-sm text-fc-brown max-w-xl">
                  This entry is still saved and visible in history, but it is <strong className="text-fc-midnight">not included</strong> in normal weekly/YTD charts, campus averages, or annual totals when you use filters like "standard services only."
                </p>
              )}

              {/* Stats Form */}
              <div className="space-y-5">
                {/* Campus Information */}
                <SectionCard title="Campus Information">
                  <NumberField statKey="Total People in Campus" label="Total People in Campus" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                </SectionCard>

                {/* Service Attendance Breakdown */}
                <SectionCard title="Service Attendance (Adults)">
                  {getCampusServiceTimes().map((serviceTime) => (
                    <NumberField key={serviceTime} statKey={serviceTime} label={serviceTime} formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                  ))}
                  <div className="flex items-center justify-between pt-4">
                    <span className="fc-label !mb-0">Total Attendance</span>
                    <span className="font-mono text-2xl text-fc-midnight">{totalAttendance}</span>
                  </div>
                </SectionCard>

                {/* Saints */}
                <SectionCard title="Saints">
                  <NumberField statKey="Saints" label="Saints" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                </SectionCard>

                {/* New People */}
                <SectionCard title="New People">
                  <NumberField statKey="Packs Out" label="Packs Out" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                  <NumberField statKey="Cards Returned" label="Cards Returned" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                  <NumberField statKey="First Time" label="First Time" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                  <NumberField statKey="Visitors" label="Visitors" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                </SectionCard>

                {/* Salvations */}
                <SectionCard title="Salvations">
                  <NumberField statKey="Hands up" label="Hands up" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                  <NumberField statKey="Salvation Cards Returned" label="Salvation Cards Returned" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                  <NumberField statKey="First Time Decision" label="First Time Decision" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                  <NumberField statKey="Rededication" label="Rededication" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                </SectionCard>

                {/* Kids */}
                <SectionCard title="Kids">
                  {getCampusServiceTimes().map((serviceTime) => {
                    const kidsServiceTime = `Kids ${serviceTime}`;
                    return (
                      <NumberField key={kidsServiceTime} statKey={kidsServiceTime} label={kidsServiceTime} formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                    );
                  })}
                  <NumberField statKey="Kids Leaders" label="Total Kids Leaders" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                  <NumberField statKey="New Kids" label="New Kids" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                  <NumberField statKey="Kids Salvations" label="Kids Salvations" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                  {totalKidsOverall > 0 && (
                    <div className="flex items-center justify-between pt-4">
                      <span className="fc-label !mb-0 text-fc-teal">Total Kids (Kids + Leaders)</span>
                      <span className="font-mono text-2xl text-fc-teal">{totalKidsOverall}</span>
                    </div>
                  )}
                </SectionCard>

                {/* Youth */}
                <SectionCard title="Youth (Friday)">
                  <NumberField statKey="Youth Total" label="Youth Attendance" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                  <NumberField statKey="Youth NP" label="Youth New People" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                  <NumberField statKey="Youth Salvations" label="Youth Salvations" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                  <NumberField statKey="Youth Leaders" label="Youth Leaders" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                </SectionCard>

                {/* Connect Groups & Ministry */}
                <SectionCard title="Connect Groups & Ministry">
                  <NumberField statKey="Connect Groups" label="Connect Groups" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                  <NumberField statKey="Dream Team" label="Dream Team" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                  <NumberField statKey="Seniors" label="Seniors" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                </SectionCard>

                {/* Special Events */}
                <SectionCard title="Special Events">
                  <NumberField statKey="Baptisms" label="Baptisms" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                  <NumberField statKey="Child Dedications" label="Child Dedications" formRef={quickInputFormRef} quickInputStats={quickInputStats} updateStat={updateStat} />
                </SectionCard>
              </div>

              {/* Still to count */}
              {(() => {
                const remainingLabels = {
                  'Total People in Campus': 'Total People in Campus',
                  'Saints': 'Saints',
                  'Packs Out': 'Packs Out',
                  'Cards Returned': 'Cards Returned',
                  'First Time': 'First Time',
                  'Visitors': 'Visitors',
                  'Hands up': 'Hands up',
                  'Salvation Cards Returned': 'Salvation Cards Returned',
                  'First Time Decision': 'First Time Decision',
                  'Rededication': 'Rededication',
                  'Kids Leaders': 'Total Kids Leaders',
                  'New Kids': 'New Kids',
                  'Kids Salvations': 'Kids Salvations',
                  'Youth Total': 'Youth Attendance',
                  'Youth NP': 'Youth New People',
                  'Youth Salvations': 'Youth Salvations',
                  'Youth Leaders': 'Youth Leaders',
                  'Connect Groups': 'Connect Groups',
                  'Dream Team': 'Dream Team',
                  'Seniors': 'Seniors',
                  'Baptisms': 'Baptisms',
                  'Child Dedications': 'Child Dedications',
                  ...Object.fromEntries(getCampusServiceTimes().map(st => [st, st])),
                  ...Object.fromEntries(getCampusServiceTimes().map(st => [`Kids ${st}`, `Kids ${st}`])),
                };
                const remaining = Object.entries(remainingLabels).filter(
                  ([key]) => !String(quickInputStats[key] || '').trim()
                );
                if (remaining.length === 0) return null;
                return (
                  <div className="mt-6 bg-fc-cream2/60 rounded-xl p-4 sm:p-5">
                    <div className="fc-label mb-2">Still to count</div>
                    <div className="flex flex-col">
                      {remaining.slice(0, 8).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            const input = quickInputFormRef.current?.querySelector(`[data-stat-key="${key}"]`);
                            input?.focus();
                            input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                          className="flex items-center justify-between gap-3 py-2 border-b border-fc-brown/10 last:border-b-0 text-sm text-fc-brown text-left w-full hover:text-fc-midnight transition-colors"
                        >
                          <span>{label}</span>
                          <span className="text-xs text-fc-brown">Empty</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Validation Hint */}
              <div className="mt-6 p-3 bg-fc-cream2/60 rounded-lg">
                <p className="text-sm text-fc-brown">
                  Your number should not have commas or currency symbols
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end mt-8 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickInput(false);
                    setIsEditMode(false);
                    setEditingEntry(null);
                  }}
                  className="fc-btn-secondary px-6 py-4"
                >
                  Back
                </button>
                <button
                  onClick={handleQuickInputSubmit}
                  disabled={isSubmittingQuickInput}
                  className="fc-btn-primary px-8 py-4 flex items-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
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

            {/* Sticky bottom bar: running attendance total */}
            <div className="fixed left-0 right-0 bottom-0 z-[60] bg-fc-cream/95 backdrop-blur-sm border-t border-fc-cream2">
              <div className="max-w-5xl mx-auto px-6 sm:px-8 py-3 flex items-center justify-between gap-5">
                <div>
                  <div className="fc-label !mb-1">Attendance</div>
                  <div className="font-mono text-2xl text-fc-midnight leading-none">{totalAttendance}</div>
                </div>
                <div className="flex items-center gap-2 text-sm text-fc-brown">
                  <CloudIcon className="w-4 h-4" /> Saved
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
};

export default LogStats; 