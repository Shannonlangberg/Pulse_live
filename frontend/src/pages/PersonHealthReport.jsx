import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { XMarkIcon, CalendarIcon, PencilIcon, UserGroupIcon, PlusIcon, MagnifyingGlassIcon, TrashIcon, UserPlusIcon, SparklesIcon } from '@heroicons/react/24/outline';
import ScheduleCatchUpModal from '../components/ScheduleCatchUpModal';

// Status badge component matching Heartbeat dashboard
const StatusBadge = ({ status, score }) => {
  const statusConfig = {
    healthy: {
      color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      label: 'Healthy',
      icon: '✓'
    },
    watch: {
      color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      label: 'Watch',
      icon: '⚠'
    },
    at_risk: {
      color: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
      label: 'At Risk',
      icon: '⚡'
    },
    critical: {
      color: 'bg-red-500/20 text-red-300 border-red-500/40',
      label: 'Critical',
      icon: '🚨'
    }
  };

  const config = statusConfig[status] || statusConfig.watch;

  return (
    <div
      className={`inline-flex items-center px-4 py-2 rounded-full border text-sm font-semibold ${config.color}`}
    >
      <span className="mr-2">{config.icon}</span>
      <span className="uppercase tracking-wide">{config.label}</span>
      {typeof score === 'number' && (
        <span className="ml-3 font-bold">{Math.round(score)}</span>
      )}
    </div>
  );
};

// Score card component
const ScoreCard = ({ label, value, weight, color, maxValue = 100, onClick }) => {
  // Ensure value is a number (handle null/undefined)
  const numValue = typeof value === 'number' ? value : (parseFloat(value) || 0);
  const percentage = Math.min((numValue / maxValue) * 100, 100);
  const colorClasses = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    indigo: 'bg-indigo-500',
    pink: 'bg-pink-500'
  };
  
  return (
    <div 
      className={`bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 transition-all ${
        onClick ? 'cursor-pointer hover:bg-slate-800/70 hover:border-slate-600 hover:scale-[1.02]' : ''
      }`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-center justify-between mb-3">
          <div>
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</div>
          <div className="text-3xl font-bold text-white">{Math.round(numValue)}</div>
          </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Weight</div>
          <div className="text-sm font-semibold text-slate-300">{weight}</div>
        </div>
      </div>
      <div className="w-full bg-slate-900/50 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClasses[color] || colorClasses.blue}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
        <span>{percentage.toFixed(1)}% of maximum</span>
        {onClick && (
          <span className="text-slate-500 text-[10px]">Click to view details →</span>
        )}
      </div>
    </div>
  );
};

// Activity timeline item
const ActivityItem = ({ icon, title, date, details, type = 'default' }) => {
  const typeColors = {
    attendance: 'border-blue-500/30 bg-blue-500/10',
    serving: 'border-amber-500/30 bg-amber-500/10',
    connect: 'border-purple-500/30 bg-purple-500/10',
    discipleship: 'border-indigo-500/30 bg-indigo-500/10',
    care: 'border-pink-500/30 bg-pink-500/10',
    default: 'border-slate-700/50 bg-slate-800/50'
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${typeColors[type] || typeColors.default}`}>
      <div className="text-xl">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white mb-1">{title}</div>
        {details && (
          <div className="text-xs text-slate-400 mb-1">{details}</div>
        )}
        {date && (
          <div className="text-xs text-slate-500">
            {new Date(date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const PersonHealthReport = () => {
  const { personId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [recalculating, setRecalculating] = useState(false);
  const [showPathwayModal, setShowPathwayModal] = useState(false);
  const [pathways, setPathways] = useState([]);
  const [selectedPathwayId, setSelectedPathwayId] = useState(null);
  const [replaceExistingPathway, setReplaceExistingPathway] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [stepToComplete, setStepToComplete] = useState(null);
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().split('T')[0]);
  const [isEditingCompletion, setIsEditingCompletion] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showConnectGroupModal, setShowConnectGroupModal] = useState(false);
  const [connectGroups, setConnectGroups] = useState([]);
  const [loadingConnectGroups, setLoadingConnectGroups] = useState(false);
  const [stepToAssign, setStepToAssign] = useState(null);
  const [familyData, setFamilyData] = useState(null);
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [familySearchTerm, setFamilySearchTerm] = useState('');
  const [updatingFlags, setUpdatingFlags] = useState({});
  const [familySearchResults, setFamilySearchResults] = useState([]);
  const [loadingFamilySearch, setLoadingFamilySearch] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [watchedEpisodes, setWatchedEpisodes] = useState([]);
  const [loadingWatched, setLoadingWatched] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const fetchWatchedEpisodes = async () => {
    try {
      setLoadingWatched(true);
      const response = await fetch(`/api/tv/person/${personId}/watched`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const result = await response.json();
        setWatchedEpisodes(result.episodes || []);
      }
    } catch (err) {
      console.error('Error fetching watched episodes:', err);
    } finally {
      setLoadingWatched(false);
    }
  };

  useEffect(() => {
    fetchPersonData();
    fetchPathways();
    fetchWatchedEpisodes();
  }, [personId]);

  useEffect(() => {
    // Fetch AI suggestion when pathway data is available
    if (data?.pathway?.id) {
      fetchAISuggestion();
    }
  }, [data?.pathway?.id]);

  // Auto-refresh heartbeat data every 30 seconds and on window focus
  useEffect(() => {
    if (!personId) return;
    
    // Refresh on window focus (user switches back to tab)
    const handleFocus = () => {
      console.log('Window focused - refreshing heartbeat data');
      fetchPersonData(true); // Silent refresh
    };
    window.addEventListener('focus', handleFocus);

    // Auto-refresh every 30 seconds to catch mobile check-ins (silent refresh - don't show loading)
    const interval = setInterval(() => {
      console.log('Auto-refreshing heartbeat data');
      fetchPersonData(true); // Silent refresh
    }, 30000); // 30 seconds

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [personId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPathways = async () => {
    try {
      const response = await fetch('/api/journeys', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setPathways(data.pathways || []);
      }
    } catch (err) {
      console.error('Error loading pathways:', err);
    }
  };

  const fetchAISuggestion = async () => {
    if (!data?.pathway?.id) {
      console.warn('Cannot fetch AI suggestion: no pathway ID');
      return;
    }
    
    try {
      setLoadingSuggestion(true);
      const response = await fetch(`/api/journeys/progress/${data.pathway.id}/ai-suggestion`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('AI suggestion response:', result);
        if (result.suggestion) {
          setAiSuggestion(result);
        } else {
          console.warn('No suggestion in response:', result);
          setAiSuggestion({ suggestion: null, message: result.message });
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Error fetching AI suggestion:', response.status, errorData);
        setAiSuggestion({ suggestion: null, error: errorData.error || 'Failed to get suggestion' });
      }
    } catch (err) {
      console.error('Error fetching AI suggestion:', err);
      setAiSuggestion({ suggestion: null, error: 'Failed to connect to server' });
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const handleAssignPathway = async () => {
    if (!selectedPathwayId) {
      alert('Please select a journey');
      return;
    }

    try {
      const response = await fetch(`/api/journeys/person/${personId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          pathway_id: parseInt(selectedPathwayId),
          start_immediately: true,
          replace_existing: replaceExistingPathway || hasPathway
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(replaceExistingPathway || hasPathway ? 'Journey replaced successfully!' : 'Journey assigned successfully!');
        setShowPathwayModal(false);
        setSelectedPathwayId(null);
        setReplaceExistingPathway(false);
        await fetchPersonData();
      } else {
        alert(result.error || 'Failed to assign journey');
      }
    } catch (err) {
      console.error('Error assigning journey:', err);
      alert('Failed to assign journey');
    }
  };

  const handleCompleteStepClick = (stepId) => {
    if (!data.pathway) {
      alert('No journey assigned');
      return;
    }
    
    // Set today's date as default
    setCompletionDate(new Date().toISOString().split('T')[0]);
    setStepToComplete(stepId);
    setIsEditingCompletion(false);
    setShowCompleteModal(true);
  };

  const handleEditCompletionClick = (stepId, currentDate) => {
    if (!data.pathway) {
      alert('No journey assigned');
      return;
    }
    
    // Set the existing completion date or today as default
    if (currentDate) {
      const date = new Date(currentDate);
      setCompletionDate(date.toISOString().split('T')[0]);
    } else {
      setCompletionDate(new Date().toISOString().split('T')[0]);
    }
    setStepToComplete(stepId);
    setIsEditingCompletion(true);
    setShowCompleteModal(true);
  };

  const handleCompleteStep = async () => {
    if (!stepToComplete || !data.pathway) {
      return;
    }

    try {
      let response;
      if (isEditingCompletion) {
        // Update existing completion
        response = await fetch(`/api/journeys/progress/${data.pathway.id}/update-completion`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            step_id: stepToComplete,
            completed_at: completionDate
          }),
        });
      } else {
        // Create new completion
        response = await fetch(`/api/journeys/progress/${data.pathway.id}/complete-step`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            step_id: stepToComplete,
            completed_at: completionDate
          }),
        });
      }

      const result = await response.json();

      if (response.ok) {
        setShowCompleteModal(false);
        setStepToComplete(null);
        setIsEditingCompletion(false);
        await fetchPersonData();
      } else {
        alert(result.error || (isEditingCompletion ? 'Failed to update completion date' : 'Failed to complete step'));
      }
    } catch (err) {
      console.error('Error completing step:', err);
      alert(isEditingCompletion ? 'Failed to update completion date' : 'Failed to complete step');
    }
  };

  const loadConnectGroups = async () => {
    if (!data?.person?.campus) {
      alert('Person campus not found');
      return;
    }

    try {
      setLoadingConnectGroups(true);
      const response = await fetch(`/api/connect-groups?campus=${data.person.campus}&is_active=true`, {
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        setConnectGroups(result.groups || []);
      } else {
        alert('Failed to load connect groups');
      }
    } catch (err) {
      console.error('Error loading connect groups:', err);
      alert('Failed to load connect groups');
    } finally {
      setLoadingConnectGroups(false);
    }
  };

  const handleAssignConnectGroupClick = async (step) => {
    setStepToAssign(step);
    await loadConnectGroups();
    setShowConnectGroupModal(true);
  };

  const handleAssignConnectGroup = async (groupId) => {
    if (!data?.person?.id) {
      alert('Person ID not found');
      return;
    }

    try {
      // Update person's connect group - this will auto-complete the step via backend and auto-unmark
      const response = await fetch(`/api/persons/${data.person.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          connect_group: groupId
        }),
      });

      const result = await response.json();

      if (response.ok) {
        const selectedGroup = connectGroups.find(g => g.id === groupId);
        alert(`Assigned to ${selectedGroup?.name || 'connect group'}! They will be removed from New Person/New Christian lists.`);
        setShowConnectGroupModal(false);
        setStepToAssign(null);
        
        // Add a small delay to ensure backend has committed the changes
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Force refresh person data with cache buster
        await fetchPersonData();
        
        // Also refresh pathway data specifically
        if (data?.pathway?.id) {
          try {
            const pathwayResponse = await fetch(`/api/journeys/person/${data.person.id}`, {
              credentials: 'include',
              headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              }
            });
            if (pathwayResponse.ok) {
              const pathwayResult = await pathwayResponse.json();
              if (pathwayResult.pathway) {
                setData(prev => ({
                  ...prev,
                  pathway: pathwayResult.pathway
                }));
              }
            }
          } catch (err) {
            console.error('Error refreshing pathway:', err);
          }
        }
        
        alert('Connect group assigned successfully! The step will be marked as complete.');
      } else {
        alert(result.error || 'Failed to assign connect group');
      }
    } catch (err) {
      console.error('Error assigning connect group:', err);
      alert('Failed to assign connect group');
    }
  };

  const fetchFamilyData = async () => {
    try {
      const response = await fetch(`/api/persons/${personId}/family`, {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setFamilyData(result);
      } else if (response.status === 404) {
        // Person has no family - set to null
        setFamilyData({ has_family: false, members: [] });
      }
    } catch (err) {
      console.error('Error fetching family data:', err);
      // Don't fail the whole page load if family fetch fails
      setFamilyData({ has_family: false, members: [] });
    }
  };

  const fetchPersonData = async (silent = false) => {
      try {
        if (!silent) {
          setLoading(true);
        }
        setError('');

      // Add cache buster to ensure fresh data
      const cacheBuster = `?t=${Date.now()}&_r=${Math.random().toString(36).substr(2, 9)}`;
      const response = await fetch(`/api/heartbeat/person/${personId}${cacheBuster}`, {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Person not found');
          }
          throw new Error('Failed to load person details');
        }

      const result = await response.json();
        
      if (result.error) {
        throw new Error(result.error);
        }
        
      // Debug: Log the data we received
      console.log('Fetched person data:', {
        has_person: !!result.person,
        has_heartbeat: !!result.heartbeat,
        heartbeat_scores: result.heartbeat ? {
          gather: result.heartbeat.gather_score,
          engagement: result.heartbeat.engagement_score,
          spiritual: result.heartbeat.spiritual_score,
          care: result.heartbeat.care_score,
          total: result.heartbeat.total_score,
          status: result.heartbeat.status
        } : null,
        has_pathway: !!result.pathway,
        has_recent_activity: !!result.recent_activity,
        attendance_count: result.recent_activity?.attendance?.length || 0,
        discipleship_steps_count: result.recent_activity?.discipleship_steps?.length || 0
      });
        
      // Force React to recognize this as new data by creating new object
      setData({...result});
      
      // Log if heartbeat scores changed
      if (result.heartbeat && data?.heartbeat) {
        const oldGather = data.heartbeat.gather_score || 0;
        const newGather = result.heartbeat.gather_score || 0;
        if (oldGather !== newGather) {
          console.log(`🔄 GATHER score updated: ${oldGather} → ${newGather}`);
        }
      }
      
      // Fetch family data
      await fetchFamilyData();
      
      } catch (err) {
      console.error('Person heartbeat load error:', err);
      setError(err.message || 'Unable to load person details.');
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    };

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      const response = await fetch(`/api/heartbeat/recalculate/person/${personId}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Recalculation failed');
      }

      const result = await response.json();
      alert('Recalculation complete!');
      
      // Reload data
      await fetchPersonData();
    } catch (err) {
      console.error('Recalculation error:', err);
      alert('Failed to recalculate. Please try again.');
    } finally {
      setRecalculating(false);
    }
  };

  const handleMarkAsNewPerson = async () => {
    try {
      setUpdatingFlags({ ...updatingFlags, newPerson: true });
      const isCurrentlyMarked = person.is_new_person;
      const today = new Date().toISOString().split('T')[0];
      
      const response = await fetch(`/api/persons/${personId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          is_new_person: !isCurrentlyMarked,
          new_person_date: !isCurrentlyMarked ? today : null
        })
      });

      if (response.ok) {
        if (!isCurrentlyMarked) {
          alert('Marked as New Person! They will now appear in the New People list.');
        } else {
          alert('Unmarked as New Person. They will no longer appear in the New People list.');
        }
        await fetchPersonData();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update new person status');
      }
    } catch (err) {
      console.error('Error updating new person status:', err);
      alert('Failed to update new person status');
    } finally {
      setUpdatingFlags({ ...updatingFlags, newPerson: false });
    }
  };

  const handleMarkAsNewChristian = async () => {
    try {
      setUpdatingFlags({ ...updatingFlags, newChristian: true });
      const isCurrentlyMarked = person.is_new_christian;
      const today = new Date().toISOString().split('T')[0];
      
      const response = await fetch(`/api/persons/${personId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          is_new_christian: !isCurrentlyMarked,
          new_christian_date: !isCurrentlyMarked ? today : null
        })
      });

      if (response.ok) {
        if (!isCurrentlyMarked) {
          alert('Marked as New Christian! They will now appear in the New Christians list.');
        } else {
          alert('Unmarked as New Christian. They will no longer appear in the New Christians list.');
        }
        await fetchPersonData();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update new christian status');
      }
    } catch (err) {
      console.error('Error updating new christian status:', err);
      alert('Failed to update new christian status');
    } finally {
      setUpdatingFlags({ ...updatingFlags, newChristian: false });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-slate-400 text-sm">
            <span className="inline-block w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
            Loading heartbeat data...
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <button
            type="button"
            onClick={() => navigate('/heartbeat')}
            className="mb-4 text-sm text-slate-400 hover:text-slate-200 flex items-center gap-2"
          >
            ← Back to Heartbeat
          </button>
          <div className="py-6 text-center text-sm text-red-300 bg-red-900/20 rounded-lg border border-red-800/40">
            {error || 'Person not found'}
          </div>
        </div>
      </div>
    );
  }

  const { person, heartbeat, recent_activity, pathway } = data;
  const hasHeartbeat = heartbeat !== null && heartbeat !== undefined;
  const hasPathway = pathway !== null && pathway !== undefined;
  
  // Log heartbeat data for debugging
  if (heartbeat) {
    console.log('💓 Current heartbeat scores:', {
      gather: heartbeat.gather_score,
      engagement: heartbeat.engagement_score,
      spiritual: heartbeat.spiritual_score,
      care: heartbeat.care_score,
      total: heartbeat.total_score,
      status: heartbeat.status
    });
  }

  // Combine all recent activity for timeline
  const allActivities = [];
  
  if (recent_activity) {
    recent_activity.attendance?.forEach(a => {
      allActivities.push({
        type: 'attendance',
        icon: '🏛️',
        title: 'Service Attendance',
        date: a.created_at,
        details: `Source: ${a.source}`,
        data: a
      });
    });

    recent_activity.serving?.forEach(s => {
      allActivities.push({
        type: 'serving',
        icon: '🤝',
        title: `Served: ${s.role || 'Team Member'}`,
        date: s.created_at,
        details: `Status: ${s.status}`,
        data: s
      });
    });

    recent_activity.connect_groups?.forEach(c => {
      allActivities.push({
        type: 'connect',
        icon: '👥',
        title: 'Connect Group',
        date: c.date,
        details: `Status: ${c.status}`,
        data: c
      });
    });

    recent_activity.discipleship_steps?.forEach(d => {
      allActivities.push({
        type: 'discipleship',
        icon: '✨',
        title: d.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        date: d.date,
        details: d.description,
        data: d
      });
    });

    recent_activity.open_care_cases?.forEach(c => {
      allActivities.push({
        type: 'care',
        icon: '💜',
        title: `Care Case: ${c.type.replace(/_/g, ' ')}`,
        date: c.created_at,
        details: `${c.priority} priority - ${c.status}`,
        data: c
      });
    });
  }

  // Sort by date (newest first)
  allActivities.sort((a, b) => {
    const dateA = new Date(a.date || a.data?.created_at || 0);
    const dateB = new Date(b.date || b.data?.created_at || 0);
    return dateB - dateA;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back Button */}
        <button
          type="button"
          onClick={() => navigate('/heartbeat')}
          className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-2 transition"
        >
          ← Back to Heartbeat
        </button>

        {/* Header Card */}
        <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-slate-700/70 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/40 to-blue-500/40 flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                  {person.full_name
                    ?.split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2) || '??'}
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white mb-1">{person.full_name}</h1>
                  {person.preferred_name && person.preferred_name !== person.full_name && (
                    <p className="text-sm text-slate-400">Preferred: {person.preferred_name}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-300">
                    {person.campus && (
                      <span className="px-2 py-1 bg-slate-800/50 rounded-lg text-xs">
                        📍 {person.campus}
                      </span>
                    )}
                    {person.department && (
                      <span className="px-2 py-1 bg-slate-800/50 rounded-lg text-xs capitalize">
                        👥 {person.department.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
                {person.email && (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">✉️</span>
                    <span>{person.email}</span>
                  </div>
                )}
                {person.phone && (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">📞</span>
                    <span>{person.phone}</span>
                  </div>
                )}
              </div>
              
              {/* Quick Actions - Mark as New Person/New Christian */}
              <div className="mt-4 pt-4 border-t border-slate-700/50 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleMarkAsNewPerson}
                  disabled={updatingFlags.newPerson}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-2 ${
                    person.is_new_person
                      ? 'bg-blue-500/30 text-blue-200 border border-blue-500/60 hover:bg-blue-500/40 hover:border-blue-500/80'
                      : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:border-blue-500/50'
                  } disabled:opacity-50`}
                  title={person.is_new_person ? 'Click to unmark as New Person' : 'Mark as New Person (first visit)'}
                >
                  <UserPlusIcon className="w-4 h-4" />
                  {person.is_new_person ? '✓ New Person (click to unmark)' : 'Mark as New Person'}
                </button>
                <button
                  type="button"
                  onClick={handleMarkAsNewChristian}
                  disabled={updatingFlags.newChristian}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-2 ${
                    person.is_new_christian
                      ? 'bg-purple-500/30 text-purple-200 border border-purple-500/60 hover:bg-purple-500/40 hover:border-purple-500/80'
                      : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:border-purple-500/50'
                  } disabled:opacity-50`}
                  title={person.is_new_christian ? 'Click to unmark as New Christian' : 'Mark as New Christian (made decision)'}
                >
                  <SparklesIcon className="w-4 h-4" />
                  {person.is_new_christian ? '✓ New Christian (click to unmark)' : 'Mark as New Christian'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await loadConnectGroups();
                    setShowConnectGroupModal(true);
                  }}
                  disabled={loadingConnectGroups || !person.campus}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 hover:border-green-500/50 disabled:opacity-50"
                  title="Assign to a connect group (will also remove from New Person/New Christian lists)"
                >
                  <UserGroupIcon className="w-4 h-4" />
                  Assign to Connect Group
                </button>
                {(person.is_new_person || person.is_new_christian) && (
                  <div className="text-xs text-slate-500 ml-2 flex items-center gap-2">
                    {person.is_new_person && person.new_person_date && (
                      <span>First visit: {new Date(person.new_person_date).toLocaleDateString()}</span>
                    )}
                    {person.is_new_christian && person.new_christian_date && (
                      <span>Decision: {new Date(person.new_christian_date).toLocaleDateString()}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-3">
              {hasHeartbeat ? (
                <>
                  <StatusBadge status={heartbeat?.status || 'watch'} score={heartbeat?.total_score || 0} />
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/people?edit=${personId}`)}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold hover:scale-105 transition-all text-sm flex items-center gap-2"
                        title="Edit Profile"
                      >
                        <PencilIcon className="w-4 h-4" />
                        Edit Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowScheduleModal(true)}
                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:scale-105 transition-all text-sm flex items-center gap-2"
                      >
                        <CalendarIcon className="w-4 h-4" />
                        Schedule Catch-Up
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleRecalculate}
                      disabled={recalculating}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {recalculating ? 'Recalculating...' : '🔄 Recalculate'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <div className="text-sm text-slate-400 mb-2">No Heartbeat Data</div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/people?edit=${personId}`)}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold hover:scale-105 transition-all text-sm flex items-center gap-2"
                        title="Edit Profile"
                      >
                        <PencilIcon className="w-4 h-4" />
                        Edit Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowScheduleModal(true)}
                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:scale-105 transition-all text-sm flex items-center gap-2"
                      >
                        <CalendarIcon className="w-4 h-4" />
                        Schedule Catch-Up
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleRecalculate}
                      disabled={recalculating}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {recalculating ? 'Calculating...' : 'Calculate Heartbeat'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {hasHeartbeat ? (
          <>
            {/* Score Breakdown */}
        <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-slate-700/70 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <span>📊</span>
                Heartbeat Score Breakdown
          </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <ScoreCard
                  label="Gather"
                  value={heartbeat?.gather_score ?? 0}
                  weight="35%"
                  color="blue"
                  onClick={() => {
                    setSelectedCategory('gather');
                    setShowCategoryModal(true);
                  }}
                />
                <ScoreCard
                  label="Engagement"
                  value={heartbeat?.engagement_score ?? 0}
                  weight="25%"
                  color="purple"
                  onClick={() => {
                    setSelectedCategory('engagement');
                    setShowCategoryModal(true);
                  }}
                />
                <ScoreCard
                  label="Spiritual"
                  value={heartbeat?.spiritual_score ?? 0}
                  weight="25%"
                  color="indigo"
                  onClick={() => {
                    setSelectedCategory('spiritual');
                    setShowCategoryModal(true);
                  }}
                />
                <ScoreCard
                  label="Care"
                  value={heartbeat?.care_score ?? 0}
                  weight="15%"
                  color="pink"
                  onClick={() => {
                    setSelectedCategory('care');
                    setShowCategoryModal(true);
                  }}
                />
            </div>

              {/* Total Score */}
              <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/40 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs text-purple-300 uppercase tracking-wide mb-1">Total Heartbeat Score</div>
                    <div className="text-4xl font-bold text-white">{Math.round(heartbeat?.total_score || 0)}</div>
                    <div className="text-sm text-purple-300 mt-1">out of 100</div>
                  </div>
                  <div className="text-6xl opacity-20">💜</div>
                </div>
                <div className="w-full bg-slate-900/50 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(heartbeat?.total_score || 0, 100)}%` }}
                  />
                </div>
                <div className="mt-4 text-xs text-purple-300/80">
                  Calculated: {new Date(heartbeat.calculated_at).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Risk Factors */}
            {heartbeat.risk_reasons && heartbeat.risk_reasons.length > 0 && (
              <div className="bg-gradient-to-br from-red-900/20 to-orange-900/20 border border-red-500/40 rounded-2xl p-6 shadow-xl">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span>⚠️</span>
                  Risk Factors
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {heartbeat.risk_reasons.map((reason, idx) => (
                    <div
                      key={idx}
                      className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-200"
                    >
                      {reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missed Connect Groups */}
            {(() => {
              const missedMeetings = (recent_activity?.connect_groups || []).filter(c => c.status === 'absent');
              const presentMeetings = (recent_activity?.connect_groups || []).filter(c => c.status === 'present');
              const totalMeetings = missedMeetings.length + presentMeetings.length;
              const attendanceRate = totalMeetings > 0 ? ((presentMeetings.length / totalMeetings) * 100).toFixed(1) : 0;

              if (missedMeetings.length > 0 || totalMeetings > 0) {
                return (
                  <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 border border-amber-500/40 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                        <span>📅</span>
                        Connect Group Attendance
                      </h2>
                      {totalMeetings > 0 && (
                        <div className="text-right">
                          <div className="text-sm text-amber-300 font-semibold">{attendanceRate}% Attendance</div>
                          <div className="text-xs text-amber-400/70">
                            {presentMeetings.length} present / {totalMeetings} total
                          </div>
                        </div>
                      )}
                    </div>

                    {totalMeetings > 0 && (
                      <div className="mb-6">
                        <div className="w-full bg-slate-900/50 rounded-full h-3 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${attendanceRate}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {missedMeetings.length > 0 ? (
                      <div>
                        <h3 className="text-lg font-semibold text-amber-300 mb-3 flex items-center gap-2">
                          <span>❌</span>
                          Missed Meetings ({missedMeetings.length})
                        </h3>
                        <div className="space-y-2">
                          {missedMeetings
                            .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
                            .slice(0, 10)
                            .map((meeting, idx) => {
                              const meetingDate = new Date(meeting.date || meeting.created_at);
                              const daysAgo = Math.floor((new Date() - meetingDate) / (1000 * 60 * 60 * 24));
                              
                              return (
                                <div
                                  key={idx}
                                  className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-300 font-bold">
                                      ❌
                                    </div>
                                    <div>
                                      <div className="font-medium text-amber-200">
                                        {meeting.connect_group?.name || 'Connect Group'}
                                      </div>
                                      <div className="text-sm text-amber-300/70">
                                        {meetingDate.toLocaleDateString('en-US', { 
                                          weekday: 'short', 
                                          year: 'numeric', 
                                          month: 'short', 
                                          day: 'numeric' 
                                        })}
                                        {daysAgo >= 0 && daysAgo <= 30 && (
                                          <span className="ml-2">
                                            ({daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-xs text-amber-400/60 px-2 py-1 bg-amber-500/10 rounded">
                                    Absent
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                        {missedMeetings.length > 10 && (
                          <div className="mt-3 text-sm text-amber-300/70 text-center">
                            Showing 10 of {missedMeetings.length} missed meetings
                          </div>
                        )}
                      </div>
                    ) : totalMeetings > 0 ? (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                        <div className="text-2xl mb-2">✅</div>
                        <div className="text-green-300 font-semibold">No missed meetings!</div>
                        <div className="text-sm text-green-300/70 mt-1">
                          {presentMeetings.length} meeting{presentMeetings.length !== 1 ? 's' : ''} attended
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4 text-center">
                        <div className="text-slate-400 text-sm">No connect group attendance records yet</div>
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })()}

            {/* Discipleship Journey */}
            {hasPathway ? (
              <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/40 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <span>🎓</span>
                    Discipleship Journey: {pathway.pathway_name}
                  </h2>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-semibold">
                      {pathway.progress_percentage}% Complete
                    </span>
                    <button
                      onClick={() => setShowPathwayModal(true)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold transition-colors"
                      title="Assign or change journey"
                    >
                      Change Journey
                    </button>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="w-full bg-slate-900/50 rounded-full h-4 overflow-hidden mb-2">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${pathway.progress_percentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{pathway.completed_steps} of {pathway.total_steps} steps completed</span>
                    <span>{pathway.progress_percentage}%</span>
                  </div>
                </div>

                {/* Next Step */}
                {pathway.next_step ? (
                  <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4 mb-4">
                    <div className="text-sm font-semibold text-indigo-300 mb-1">Next Step:</div>
                    <div className="text-lg font-bold text-white mb-1">{pathway.next_step.step_name}</div>
                    {pathway.next_step.step_description && (
                      <div className="text-sm text-slate-300 mb-2">{pathway.next_step.step_description}</div>
                    )}
                    
                    {/* Suggested Next Step */}
                    {loadingSuggestion && (
                      <div className="mt-4 pt-4 border-t border-indigo-500/20">
                        <div className="flex items-center gap-2 text-sm text-indigo-200/70">
                          <div className="inline-block w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                          <span>Getting suggestion...</span>
                        </div>
                      </div>
                    )}
                    {!loadingSuggestion && aiSuggestion?.suggestion && (
                      <div className="mt-4 pt-4 border-t border-indigo-500/20">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-lg">💭</span>
                          <div className="text-xs font-semibold text-purple-300 uppercase tracking-wide">Suggested Next Step</div>
                        </div>
                        <div className="text-sm text-slate-200 italic leading-relaxed">
                          {aiSuggestion.suggestion}
                        </div>
                      </div>
                    )}
                    {!loadingSuggestion && (!aiSuggestion || !aiSuggestion.suggestion) && (
                      <div className="mt-4 pt-4 border-t border-indigo-500/20">
                        <button
                          onClick={fetchAISuggestion}
                          className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1 transition-colors"
                        >
                          <span>💭</span>
                          <span>Get suggested next step</span>
                        </button>
                        {aiSuggestion?.error && (
                          <div className="text-xs text-red-300 mt-2">{aiSuggestion.error}</div>
                        )}
                        {aiSuggestion?.message && (
                          <div className="text-xs text-slate-400 mt-2 italic">{aiSuggestion.message}</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🎉</span>
                        <div>
                          <div className="text-sm font-semibold text-green-300 mb-1">Journey Complete!</div>
                          <div className="text-sm text-slate-300">All steps have been completed.</div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowPathwayModal(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors"
                      >
                        Assign New Journey
                      </button>
                    </div>
                  </div>
                )}

                {/* Pathway Steps List */}
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-300 mb-2">All Steps:</div>
                  {pathway.pathway && pathway.pathway.steps ? (
                    pathway.pathway.steps.map((step) => {
                      const isCompleted = step.is_completed || false;
                      const isCurrent = pathway.next_step && pathway.next_step.id === step.id;
                      // Check if this is the "Joined Connect Group" step
                      const isConnectGroupStep = step.milestone_type === 'group_join' || 
                                                 (step.step_name && step.step_name.toLowerCase().includes('connect group'));
                      // Show Assign button for connect group step if not completed
                      const showAssignButton = isConnectGroupStep && !isCompleted;
                      
                      // Debug logging for Baptism step
                      if (step.step_name && step.step_name.toLowerCase().includes('baptism')) {
                        console.log(`[Baptism Debug] Step: ${step.step_name}, isCompleted: ${isCompleted}, isCurrent: ${isCurrent}, milestone_type: ${step.milestone_type}, step data:`, step);
                      }
                      
                      return (
                        <div
                          key={step.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            isCompleted
                              ? 'bg-green-500/10 border-green-500/30'
                              : isCurrent
                              ? 'bg-indigo-500/20 border-indigo-500/40'
                              : 'bg-slate-700/50 border-slate-600/50'
                          }`}
                        >
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            isCompleted
                              ? 'bg-green-500/20 text-green-400'
                              : isCurrent
                              ? 'bg-indigo-500/20 text-indigo-400'
                              : 'bg-slate-600 text-slate-400'
                          }`}>
                            {isCompleted ? '✓' : step.step_order}
                          </div>
                          <div className="flex-1">
                            <div className={`font-medium ${
                              isCompleted ? 'text-green-300' : isCurrent ? 'text-indigo-300' : 'text-slate-300'
                            }`}>
                              {step.step_name}
                            </div>
                            {step.step_description && (
                              <div className="text-xs text-slate-400 mt-1">{step.step_description}</div>
                            )}
                            {isCompleted && step.completed_at && (
                              <div 
                                onClick={() => handleEditCompletionClick(step.id, step.completed_at)}
                                className="text-xs text-green-300/70 mt-1 cursor-pointer hover:text-green-300 hover:underline"
                                title="Click to edit completion date"
                              >
                                Completed: {new Date(step.completed_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isCompleted ? (
                              // Step is completed - show nothing or completed badge handled above
                              null
                            ) : showAssignButton ? (
                              // Connect group step - show Assign button
                              <>
                                {isCurrent && (
                                  <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded text-xs font-semibold">
                                    Current
                                  </span>
                                )}
                                <button
                                  onClick={() => handleAssignConnectGroupClick(step)}
                                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold"
                                  title="Assign to a connect group"
                                >
                                  Assign
                                </button>
                              </>
                            ) : (
                              // All other steps - show Complete button
                              <>
                                {isCurrent && (
                                  <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded text-xs font-semibold">
                                    Current
                                  </span>
                                )}
                                <button
                                  onClick={() => handleCompleteStepClick(step.id)}
                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold"
                                  title="Mark as completed"
                                >
                                  Complete
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-sm text-slate-400">Loading pathway steps...</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-slate-700/70 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <span>🎓</span>
                    Discipleship Journey
                  </h2>
                  <button
                    onClick={() => setShowPathwayModal(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold"
                  >
                    Assign Journey
                  </button>
                </div>
                <p className="text-slate-400 mb-2">No journey assigned yet.</p>
                <p className="text-sm text-slate-500">
                  Assign a journey to track their discipleship growth and next steps.
                </p>
                </div>
              )}

            {/* Watched Episodes - Engagement Section */}
            <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-slate-700/70 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span>📺</span>
                Watched on Pulse TV
                {watchedEpisodes.length > 0 && (
                  <span className="ml-auto px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs font-semibold">
                    {watchedEpisodes.length} {watchedEpisodes.length === 1 ? 'Episode' : 'Episodes'}
                  </span>
                )}
              </h2>
              
              {loadingWatched ? (
                <div className="text-center py-8">
                  <div className="inline-block w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-slate-400 mt-2">Loading watched episodes...</p>
                </div>
              ) : watchedEpisodes.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {watchedEpisodes.map((episode) => (
                    <div
                      key={episode.id}
                      className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-purple-500/50 transition-colors"
                    >
                      {episode.series?.thumbnail_url ? (
                        <div className="w-24 h-16 bg-slate-700 rounded overflow-hidden flex-shrink-0">
                          <img
                            src={episode.series.thumbnail_url}
                            alt={episode.series.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-24 h-16 bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded flex items-center justify-center flex-shrink-0">
                          <span className="text-white/30 text-2xl">📺</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-semibold mb-1 line-clamp-1">{episode.title}</h3>
                            {episode.series && (
                              <p className="text-sm text-slate-400 mb-1">{episode.series.title}</p>
                            )}
                            {episode.completed_at && (
                              <p className="text-xs text-slate-500">
                                Watched {new Date(episode.completed_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </p>
                            )}
                          </div>
                          <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs font-semibold flex-shrink-0">
                            ✓ Completed
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-400 mb-2">No episodes watched yet</p>
                  <p className="text-sm text-slate-500">
                    When this person watches episodes on Pulse TV, they'll appear here
                  </p>
                </div>
              )}
            </div>

            {/* Recent Activity Timeline */}
            {allActivities.length > 0 && (
              <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-slate-700/70 rounded-2xl p-6 shadow-xl">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span>📅</span>
                  Recent Activity (Last 12 Weeks)
                </h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {allActivities.slice(0, 20).map((activity, idx) => (
                    <ActivityItem
                      key={idx}
                      icon={activity.icon}
                      title={activity.title}
                      date={activity.date || activity.data?.created_at}
                      details={activity.details}
                      type={activity.type}
                    />
                  ))}
            </div>
                {allActivities.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    No recent activity recorded
                    </div>
                  )}
              </div>
            )}
          </>
        ) : (
          <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-slate-700/70 rounded-2xl p-6 shadow-xl text-center">
            <div className="text-6xl mb-4 opacity-50">💜</div>
            <h2 className="text-xl font-semibold text-white mb-2">No Heartbeat Data</h2>
            <p className="text-slate-400 mb-4">
              This person doesn't have a heartbeat calculation yet. Click "Calculate Heartbeat" above to generate one.
            </p>
            <p className="text-sm text-slate-500">
              Note: You'll need attendance, engagement, and other data in the system for accurate scores.
            </p>
                    </div>
                  )}

        {/* Assign Journey Modal */}
        {showPathwayModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-2xl w-full">
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Assign Journey</h2>
                <button
                  onClick={() => {
                    setShowPathwayModal(false);
                    setSelectedPathwayId(null);
                  }}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Select Journey
                  </label>
                  <select
                    value={selectedPathwayId || ''}
                    onChange={(e) => setSelectedPathwayId(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Choose a journey...</option>
                    {pathways.map((pathway) => (
                      <option key={pathway.id} value={pathway.id}>
                        {pathway.name} {pathway.is_template && '(Template)'}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPathwayId && (
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-sm text-slate-300">
                      {pathways.find(p => p.id === parseInt(selectedPathwayId))?.description || 'No description'}
                    </div>
                    <div className="text-xs text-slate-400 mt-2">
                      {pathways.find(p => p.id === parseInt(selectedPathwayId))?.step_count || 0} steps
                    </div>
                  </div>
                )}

                {hasPathway && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={replaceExistingPathway}
                        onChange={(e) => setReplaceExistingPathway(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded bg-slate-700 border-slate-600 text-amber-600 focus:ring-amber-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-amber-300 mb-1">
                          Replace Current Journey
                        </div>
                        <div className="text-xs text-amber-300/70">
                          This will replace the current "{pathway.pathway_name}" journey. The person will start fresh with the new journey.
                        </div>
                      </div>
                    </label>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-slate-700">
                  <button
                    onClick={() => {
                      setShowPathwayModal(false);
                      setSelectedPathwayId(null);
                      setReplaceExistingPathway(false);
                    }}
                    className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssignPathway}
                    disabled={!selectedPathwayId}
                    className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {hasPathway && replaceExistingPathway ? 'Replace Journey' : 'Assign Journey'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Complete Step Modal */}
        {showCompleteModal && stepToComplete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-md w-full">
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">
                  {isEditingCompletion ? 'Edit Completion Date' : 'Complete Step'}
                </h2>
                <button
                  onClick={() => {
                    setShowCompleteModal(false);
                    setStepToComplete(null);
                    setIsEditingCompletion(false);
                  }}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Completion Date
                  </label>
                  <input
                    type="date"
                    value={completionDate}
                    onChange={(e) => setCompletionDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Select the date when this step was completed. Defaults to today's date.
                  </p>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-700">
                  <button
                    onClick={() => {
                      setShowCompleteModal(false);
                      setStepToComplete(null);
                      setIsEditingCompletion(false);
                    }}
                    className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCompleteStep}
                    className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                  >
                    {isEditingCompletion ? 'Update Date' : 'Mark Complete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Family Management Modal */}
        {showFamilyModal && familyData?.has_family && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-2xl w-full max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <UserGroupIcon className="w-6 h-6" />
                  Add Family Member
                </h2>
                <button
                  onClick={() => {
                    setShowFamilyModal(false);
                    setFamilySearchTerm('');
                    setFamilySearchResults([]);
                  }}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <div className="mb-4">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={familySearchTerm}
                      onChange={async (e) => {
                        const term = e.target.value;
                        setFamilySearchTerm(term);
                        if (term.length >= 2) {
                          setLoadingFamilySearch(true);
                          try {
                            const response = await fetch(`/api/persons/${personId}/family/search-members?search=${encodeURIComponent(term)}`, {
                              credentials: 'include'
                            });
                            if (response.ok) {
                              const data = await response.json();
                              setFamilySearchResults(data.persons || []);
                            }
                          } catch (err) {
                            console.error('Error searching:', err);
                          } finally {
                            setLoadingFamilySearch(false);
                          }
                        } else {
                          setFamilySearchResults([]);
                        }
                      }}
                      placeholder="Search by name or email..."
                      className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    />
                  </div>
                </div>

                {loadingFamilySearch && (
                  <div className="text-center py-8 text-slate-400">Searching...</div>
                )}

                {!loadingFamilySearch && familySearchResults.length > 0 && (
                  <div className="space-y-2">
                    {familySearchResults.map((person) => (
                      <div
                        key={person.id}
                        className="bg-slate-700/50 rounded-lg p-4 flex items-center justify-between border border-slate-600/50 hover:bg-slate-700 transition-colors"
                      >
                        <div>
                          <div className="text-white font-medium">{person.full_name}</div>
                          {person.email && (
                            <div className="text-sm text-slate-400">{person.email}</div>
                          )}
                          {person.campus && (
                            <div className="text-xs text-slate-500 mt-1">📍 {person.campus}</div>
                          )}
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch(`/api/persons/${personId}/family/add-member`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json'
                                },
                                credentials: 'include',
                                body: JSON.stringify({
                                  member_person_id: person.id
                                })
                              });
                              if (response.ok) {
                                await fetchFamilyData();
                                setFamilySearchTerm('');
                                setFamilySearchResults([]);
                                setShowFamilyModal(false);
                                alert(`${person.full_name} added to family!`);
                              } else {
                                const error = await response.json();
                                alert(error.error || 'Failed to add member');
                              }
                            } catch (err) {
                              console.error('Error adding member:', err);
                              alert('Failed to add member');
                            }
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {!loadingFamilySearch && familySearchTerm.length >= 2 && familySearchResults.length === 0 && (
                  <div className="text-center py-8 text-slate-400">No results found</div>
                )}

                {familySearchTerm.length < 2 && (
                  <div className="text-center py-8 text-slate-400">
                    Type at least 2 characters to search for people
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Category Detail Modal */}
        {showCategoryModal && selectedCategory && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-4xl w-full max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">
                  {selectedCategory === 'gather' && '🏛️ Gather - Attendance Events'}
                  {selectedCategory === 'engagement' && '👥 Engagement - Connect Groups & Serving'}
                  {selectedCategory === 'spiritual' && '✨ Spiritual - Discipleship Steps'}
                  {selectedCategory === 'care' && '💜 Care - Care Cases & Touchpoints'}
                </h2>
                <button
                  onClick={() => {
                    setShowCategoryModal(false);
                    setSelectedCategory(null);
                  }}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {(() => {
                  if (!data || !data.recent_activity) {
                    return (
                      <div className="text-center py-12">
                        <p className="text-slate-400 text-lg mb-2">No activity data available</p>
                      </div>
                    );
                  }

                  let categoryEvents = [];
                  let categoryIcon = '';
                  let categoryColor = '';
                  const recent_activity = data.recent_activity;

                  if (selectedCategory === 'gather' && recent_activity?.attendance) {
                    categoryEvents = recent_activity.attendance.map(a => ({
                      ...a,
                      type: 'attendance',
                      icon: '🏛️',
                      title: 'Service Attendance',
                      date: a.created_at,
                      details: `Source: ${a.source || 'Unknown'}`,
                      color: 'blue'
                    }));
                    categoryIcon = '🏛️';
                    categoryColor = 'blue';
                  } else if (selectedCategory === 'engagement') {
                    const connectEvents = (recent_activity?.connect_groups || []).map(c => ({
                      ...c,
                      type: 'connect',
                      icon: '👥',
                      title: 'Connect Group Attendance',
                      date: c.date || c.created_at,
                      details: `Status: ${c.status || 'attended'}`,
                      color: 'purple'
                    }));
                    const servingEvents = (recent_activity?.serving || []).map(s => ({
                      ...s,
                      type: 'serving',
                      icon: '🤝',
                      title: `Served: ${s.role || 'Team Member'}`,
                      date: s.created_at,
                      details: `Status: ${s.status || 'active'}`,
                      color: 'purple'
                    }));
                    const givingEvents = (recent_activity?.giving || []).map(g => ({
                      ...g,
                      type: 'giving',
                      icon: '💰',
                      title: `Gave: $${g.amount?.toFixed(2) || '0.00'}`,
                      date: g.created_at,
                      details: `${g.giving_type || 'Tithe'} - ${g.source || 'Web'}`,
                      color: 'purple'
                    }));
                    categoryEvents = [...connectEvents, ...servingEvents, ...givingEvents].sort((a, b) => {
                      const dateA = new Date(a.date || a.created_at || 0);
                      const dateB = new Date(b.date || b.created_at || 0);
                      return dateB - dateA;
                    });
                    categoryIcon = '👥';
                    categoryColor = 'purple';
                  } else if (selectedCategory === 'spiritual') {
                    // Debug: Log spiritual data with full expansion
                    console.log('Spiritual modal - recent_activity:', recent_activity);
                    console.log('Spiritual modal - discipleship_steps:', recent_activity?.discipleship_steps);
                    console.log('Spiritual modal - person milestones:', {
                      baptised_on: data?.person?.baptised_on,
                      dna_completed: data?.person?.dna_completed,
                      filled_holy_spirit: data?.person?.filled_holy_spirit,
                      rise_attended: data?.person?.rise_attended,
                      first_served_on: data?.person?.first_served_on
                    });
                    
                    if (recent_activity?.discipleship_steps && recent_activity.discipleship_steps.length > 0) {
                      categoryEvents = recent_activity.discipleship_steps.map(d => {
                      // Handle Person milestones, pathway steps, and DiscipleshipStep records
                      const isPersonMilestone = d.is_person_milestone;
                      const isPathwayStep = d.is_pathway_step;
                      let title = '';
                      let icon = '✨';
                      
                      if (isPersonMilestone) {
                        // Use description for Person milestones (e.g., "Baptism", "DNA Completed")
                        title = d.description || d.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        // Use specific icons for milestones
                        if (d.type === 'baptism') icon = '💧';
                        else if (d.type === 'dna_completed') icon = '📖';
                        else if (d.type === 'filled_holy_spirit') icon = '🔥';
                        else if (d.type === 'rise_attended') icon = '🌟';
                        else if (d.type === 'first_served') icon = '🤝';
                      } else if (isPathwayStep) {
                        // Pathway step completions (e.g., "Salvation", "Baptism", "This is Christianity")
                        title = d.description || d.step_name || d.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        // Use specific icons based on milestone_type or step name
                        const milestoneType = d.milestone_type || '';
                        const stepName = (d.description || '').toLowerCase();
                        if (milestoneType === 'baptism' || stepName.includes('baptism')) icon = '💧';
                        else if (milestoneType === 'salvation' || stepName.includes('salvation')) icon = '✝️';
                        else if (milestoneType === 'holy_spirit' || stepName.includes('holy spirit')) icon = '🔥';
                        else if (milestoneType === 'dna' || stepName.includes('dna')) icon = '📖';
                        else if (milestoneType === 'rise' || stepName.includes('rise')) icon = '🌟';
                        else if (milestoneType === 'group_join' || stepName.includes('connect group')) icon = '👥';
                        else if (stepName.includes('christianity') || stepName.includes('course')) icon = '📚';
                      } else {
                        // Regular DiscipleshipStep
                        title = d.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                      }
                      
                      // Build details with connect group name if available
                      let details = d.description || d.step_name || '';
                      if (d.connect_group_name) {
                        details = `${details} - ${d.connect_group_name}`;
                      }
                      
                      return {
                        ...d,
                        type: 'discipleship',
                        icon: icon,
                        title: title,
                        date: d.date || d.created_at,
                        details: details,
                        color: 'indigo'
                      };
                    });
                      categoryIcon = '✨';
                      categoryColor = 'indigo';
                    } else {
                      // No discipleship steps found
                      categoryEvents = [];
                      categoryIcon = '✨';
                      categoryColor = 'indigo';
                    }
                  } else if (selectedCategory === 'care' && recent_activity?.open_care_cases) {
                    categoryEvents = recent_activity.open_care_cases.map(c => ({
                      ...c,
                      type: 'care',
                      icon: '💜',
                      title: `Care Case: ${c.type?.replace(/_/g, ' ') || 'Unknown'}`,
                      date: c.created_at,
                      details: `${c.priority || 'unknown'} priority - ${c.status || 'open'}`,
                      color: 'pink'
                    }));
                    categoryIcon = '💜';
                    categoryColor = 'pink';
                  }

                  if (categoryEvents.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4 opacity-50">{categoryIcon}</div>
                        <p className="text-slate-400 text-lg mb-2">No events found</p>
                        <p className="text-slate-500 text-sm">
                          {selectedCategory === 'gather' && 'No attendance events recorded for this person.'}
                          {selectedCategory === 'engagement' && 'No connect group or serving events recorded for this person.'}
                          {selectedCategory === 'spiritual' && 'No discipleship steps recorded for this person.'}
                          {selectedCategory === 'care' && 'No open care cases for this person.'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      <div className="text-sm text-slate-400 mb-4">
                        Showing {categoryEvents.length} event{categoryEvents.length !== 1 ? 's' : ''}
                        {selectedCategory === 'spiritual' ? ' (All milestones)' : ' (Last 12 weeks)'}
                      </div>
                      {categoryEvents.map((event, idx) => {
                        const eventDate = new Date(event.date || event.created_at);
                        return (
                          <div
                            key={idx}
                            className={`border rounded-lg p-4 ${
                              categoryColor === 'blue' ? 'border-blue-500/30 bg-blue-500/10' :
                              categoryColor === 'purple' ? 'border-purple-500/30 bg-purple-500/10' :
                              categoryColor === 'indigo' ? 'border-indigo-500/30 bg-indigo-500/10' :
                              'border-pink-500/30 bg-pink-500/10'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="text-2xl">{event.icon}</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-white mb-1">{event.title}</div>
                                {event.details && (
                                  <div className="text-sm text-slate-300 mb-2">{event.details}</div>
                                )}
                                <div className="text-xs text-slate-400">
                                  {eventDate.toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    timeZoneName: 'short'
                                  })}
                                </div>
                                {/* Additional event-specific details */}
                                {event.source && (
                                  <div className="mt-2 text-xs text-slate-500">
                                    Source: {event.source}
                                  </div>
                                )}
                                {event.role && (
                                  <div className="mt-2 text-xs text-slate-500">
                                    Role: {event.role}
                                  </div>
                                )}
                                {event.description && (
                                  <div className="mt-2 text-xs text-slate-400">
                                    {event.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Schedule Catch-Up Modal */}
      {showScheduleModal && person && (
        <ScheduleCatchUpModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          personId={personId}
          personName={person.full_name || 'Person'}
          onSuccess={() => {
            setShowScheduleModal(false);
            // Optionally refresh data or show success message
          }}
        />
      )}

      {/* Connect Group Assignment Modal */}
      {showConnectGroupModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Assign Connect Group</h2>
                <p className="text-sm text-slate-400 mt-1">This will also remove them from New Person/New Christian lists</p>
              </div>
              <button
                onClick={() => {
                  setShowConnectGroupModal(false);
                  setStepToAssign(null);
                }}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {loadingConnectGroups ? (
                <div className="text-center py-8">
                  <div className="inline-block w-6 h-6 border-2 border-slate-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <div className="text-slate-400 text-sm">Loading connect groups...</div>
                </div>
              ) : connectGroups.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-slate-400 text-sm">No connect groups available for this campus.</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {connectGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => handleAssignConnectGroup(group.id)}
                      className="w-full text-left p-4 bg-slate-700/50 hover:bg-slate-700 rounded-lg border border-slate-600/50 hover:border-purple-500/50 transition-all"
                    >
                      <div className="font-medium text-white">{group.name}</div>
                      {group.description && (
                        <div className="text-sm text-slate-400 mt-1">{group.description}</div>
                      )}
                      {group.campus && (
                        <div className="text-xs text-slate-500 mt-1">{group.campus}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonHealthReport;
