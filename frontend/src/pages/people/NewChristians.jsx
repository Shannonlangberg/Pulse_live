import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  StarIcon, 
  BookOpenIcon, 
  ChartBarIcon, 
  UserGroupIcon,
  AcademicCapIcon,
  PhoneIcon,
  EnvelopeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SparklesIcon,
  HeartIcon
} from '@heroicons/react/24/outline';

const NewChristians = () => {
  const navigate = useNavigate();
  const [newChristians, setNewChristians] = useState([]);
  const [allNewChristians, setAllNewChristians] = useState([]); // Store all for filtering
  const [loading, setLoading] = useState(true);
  const [pathways, setPathways] = useState([]);
  const [expandedCards, setExpandedCards] = useState({});
  const [assigningPathway, setAssigningPathway] = useState({});
  const [selectedCampus, setSelectedCampus] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [campuses, setCampuses] = useState([]);

  useEffect(() => {
    loadNewChristians();
    loadPathways();
    loadCampuses();
  }, []);

  useEffect(() => {
    // Filter people when filters change
    if (allNewChristians.length > 0) {
      filterPeople();
    }
  }, [selectedCampus, selectedDepartment]);

  const loadNewChristians = async () => {
    try {
      setLoading(true);
      // Use the dedicated endpoint for new Christians with full data
      const response = await fetch('/api/people/new-christians', {
        credentials: 'include',
        cache: 'no-store'
      });
      
      if (response.ok) {
        const data = await response.json();
        const christians = data.new_christians || [];
        
        // Load pathway info for each person
        const christiansWithPathways = await Promise.all(
          christians.map(async (person) => {
            try {
              const pathwayResponse = await fetch(`/api/journeys/person/${person.id}`, {
                credentials: 'include'
              });
              if (pathwayResponse.ok) {
                const pathwayData = await pathwayResponse.json();
                person.assigned_pathways = pathwayData.pathways || [];
              }
            } catch (err) {
              console.error(`Error loading pathways for ${person.id}:`, err);
            }
            return person;
          })
        );
        
        setAllNewChristians(christiansWithPathways);
        filterPeople(christiansWithPathways);
      }
    } catch (err) {
      console.error('Error loading new Christians:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPathways = async () => {
    try {
      const response = await fetch('/api/journeys', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        const activePathways = (data.pathways || []).filter(p => p.is_active === true);
        setPathways(activePathways);
      } else {
        console.error('Failed to load pathways:', response.status);
      }
    } catch (err) {
      console.error('Error loading pathways:', err);
    }
  };

  const assignPathway = async (personId, pathwayId) => {
    if (!personId || !pathwayId) {
      console.error('[NewChristians] Missing personId or pathwayId:', { personId, pathwayId });
      alert('Error: Missing person or pathway information');
      return;
    }

    try {
      setAssigningPathway({ ...assigningPathway, [personId]: true });
      
      const pathwayIdInt = typeof pathwayId === 'string' ? parseInt(pathwayId, 10) : pathwayId;
      
      if (isNaN(pathwayIdInt)) {
        console.error('[NewChristians] Invalid pathway ID:', pathwayId);
        alert('Error: Invalid pathway ID');
        return;
      }
      
      console.log(`[NewChristians] Assigning pathway ${pathwayIdInt} to person ${personId}`);
      
      // Check if person already has a pathway - if so, replace it
      const person = allNewChristians.find(p => p.id === personId);
      const hasExistingPathway = person && person.assigned_pathways && person.assigned_pathways.length > 0;
      
      const response = await fetch(`/api/journeys/person/${personId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          pathway_id: pathwayIdInt,
          start_immediately: true,
          replace_existing: hasExistingPathway // Replace existing pathway if one exists
        })
      });
      
      if (response.ok) {
        await loadNewChristians(); // Reload to get updated pathway info
      } else {
        const result = await response.json().catch(() => ({}));
        const errorMsg = result.error || result.message || `Failed to assign pathway (${response.status})`;
        alert(`Error: ${errorMsg}`);
      }
    } catch (err) {
      console.error('[NewChristians] Error assigning pathway:', err);
      alert(`Failed to assign pathway: ${err.message || 'Network error'}`);
    } finally {
      setAssigningPathway({ ...assigningPathway, [personId]: false });
    }
  };

  const loadCampuses = async () => {
    try {
      const response = await fetch('/api/campuses/public');
      if (response.ok) {
        const data = await response.json();
        setCampuses(data.campuses || []);
      }
    } catch (err) {
      console.error('Error loading campuses:', err);
    }
  };

  const filterPeople = (peopleToFilter = null) => {
    const people = peopleToFilter || allNewChristians;
    let filtered = [...people];

    // Filter by campus
    if (selectedCampus !== 'all') {
      filtered = filtered.filter(person => {
        // Normalize person's campus: lowercase, replace spaces/hyphens with underscores
        const personCampus = (person.campus || '').toLowerCase().replace(/[\s-]+/g, '_').trim();
        // Normalize selected campus: lowercase (should already be in format like "copper_coast")
        const selectedCampusNormalized = selectedCampus.toLowerCase().trim();
        
        // Only match if both are non-empty and exactly equal
        if (!personCampus || !selectedCampusNormalized) {
          return false;
        }
        
        return personCampus === selectedCampusNormalized;
      });
    }

    // Filter by department
    if (selectedDepartment !== 'all') {
      filtered = filtered.filter(person => {
        const personDept = (person.department || '').trim();
        const selectedDept = selectedDepartment.trim();
        
        // Only match if both are non-empty and exactly equal
        if (!personDept || !selectedDept) {
          return false;
        }
        
        return personDept.toLowerCase() === selectedDept.toLowerCase();
      });
    }

    setNewChristians(filtered);
  };

  const toggleCard = (personId) => {
    setExpandedCards({
      ...expandedCards,
      [personId]: !expandedCards[personId]
    });
  };

  return (
    <div className="h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 overflow-y-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">New Christians</h2>
            <p className="text-white/60">Track discipleship progress and next steps • {newChristians.length} showing ({allNewChristians.length} total)</p>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-white/60 text-sm">Campus:</label>
            <select
              value={selectedCampus}
              onChange={(e) => setSelectedCampus(e.target.value)}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              <option value="all">All Campuses</option>
              {campuses.map(campus => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-white/60 text-sm">Department:</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              <option value="all">All Departments</option>
              <option value="Kids">Kids</option>
              <option value="Youth">Youth</option>
              <option value="Young Adults">Young Adults</option>
              <option value="Families">Families</option>
              <option value="Adults">Adults</option>
              <option value="Seniors">Seniors</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/60">Loading new Christians...</div>
      ) : (
        <div className="space-y-4">
          {newChristians.length > 0 ? (
            newChristians.map((person) => {
              const isExpanded = expandedCards[person.id];
              const hasPathway = person.assigned_pathways && person.assigned_pathways.length > 0;
              const currentPathway = hasPathway ? person.assigned_pathways[0] : null;
              const currentPathwayId = currentPathway ? (currentPathway.pathway_id || currentPathway.id) : null;
              
              return (
                <div
                  key={person.id}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <SparklesIcon className="h-6 w-6 text-purple-400" />
                        <h3 className="text-xl font-semibold text-white">
                          {person.full_name || person.preferred_name || person.name}
                        </h3>
                        <span className="px-2 py-1 text-xs font-semibold bg-purple-500/20 text-purple-300 rounded-full">
                          New Christian
                        </span>
                      </div>
                      <div className="text-white/60 text-sm mb-4">
                        Decision logged: {person.new_christian_date ? new Date(person.new_christian_date).toLocaleDateString() : 'Unknown'}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleCard(person.id)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUpIcon className="h-5 w-5 text-white/60" />
                      ) : (
                        <ChevronDownIcon className="h-5 w-5 text-white/60" />
                      )}
                    </button>
                  </div>

                  {/* Progress Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-white/60 text-sm mb-1">Foundations Progress</div>
                      <div className="text-white font-medium">
                        {person.foundations_progress || 'Not started'}
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-white/60 text-sm mb-1">Pathway Progress</div>
                      <div className="text-white font-medium">
                        {currentPathway 
                          ? `${currentPathway.progress_percentage || 0}% - ${currentPathway.pathway_name}`
                          : person.pathway_progress || 'Not started'}
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-white/60 text-sm mb-1">Group Attendance</div>
                      <div className="text-white font-medium">
                        {person.group_attendance || '0'}%
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-white/60 text-sm mb-1">Pulse TV Usage</div>
                      <div className="text-white font-medium">
                        {person.pulse_tv_usage || 'Low'}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <div className="relative">
                      <select
                        value={currentPathwayId ? String(currentPathwayId) : ""}
                        onChange={(e) => {
                          if (e.target.value && e.target.value !== '') {
                            const pathwayId = parseInt(e.target.value);
                            if (!isNaN(pathwayId)) {
                              // Only assign if it's different from current
                              if (!currentPathwayId || currentPathwayId !== pathwayId) {
                                assignPathway(person.id, pathwayId);
                              }
                            }
                          }
                        }}
                        disabled={assigningPathway[person.id] || pathways.length === 0}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-purple-500/50 outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer appearance-none"
                        style={{ minWidth: '250px', paddingRight: '2.5rem' }}
                      >
                        <option value="">
                          {pathways.length === 0 ? 'Loading pathways...' : currentPathway ? 'Change Pathway...' : 'Select Pathway (Recommended: Foundations)...'}
                        </option>
                        {pathways.length > 0 ? (
                          pathways.map(pathway => (
                            <option key={`pathway-${pathway.id}`} value={String(pathway.id)}>
                              {pathway.name} {pathway.is_template ? '(Template)' : ''}
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>No pathways available</option>
                        )}
                      </select>
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <ChevronDownIcon className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    {hasPathway && (
                      <div className="px-4 py-2 bg-green-600/20 text-green-300 rounded-lg text-sm font-medium flex items-center gap-2">
                        <AcademicCapIcon className="h-4 w-4" />
                        Current: {currentPathway.pathway_name}
                      </div>
                    )}
                    <button
                      onClick={() => navigate(`/persons/${person.id}`)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ml-auto"
                    >
                      <HeartIcon className="h-4 w-4" />
                      View Heartbeat Profile
                    </button>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                      {/* Pathway Details */}
                      {currentPathway && (
                        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <AcademicCapIcon className="h-5 w-5 text-purple-400" />
                            <div className="text-purple-400 font-semibold">Pathway: {currentPathway.pathway_name}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-white/60 mb-1">Progress</div>
                              <div className="text-white font-medium">{currentPathway.progress_percentage || 0}%</div>
                            </div>
                            {currentPathway.current_step && (
                              <div>
                                <div className="text-white/60 mb-1">Current Step</div>
                                <div className="text-white font-medium">{currentPathway.current_step.step_name}</div>
                              </div>
                            )}
                            {currentPathway.started_at && (
                              <div>
                                <div className="text-white/60 mb-1">Started</div>
                                <div className="text-white font-medium">
                                  {new Date(currentPathway.started_at).toLocaleDateString()}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* AI Analysis */}
                      {person.ai_analysis && (
                        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                          <div className="text-purple-400 font-semibold mb-2">AI Analysis</div>
                          <div className="text-white/80 mb-2">{person.ai_analysis}</div>
                          {person.suggested_next_step && (
                            <div className="text-blue-400 text-sm font-medium">
                              Suggested Next Step: {person.suggested_next_step}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Additional Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-white/60 mb-1">Decision Date</div>
                          <div className="text-white">
                            {person.new_christian_date ? new Date(person.new_christian_date).toLocaleDateString() : 'Unknown'}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/60 mb-1">Days Since Decision</div>
                          <div className="text-white">
                            {person.new_christian_date 
                              ? Math.floor((new Date() - new Date(person.new_christian_date)) / (1000 * 60 * 60 * 24))
                              : 'Unknown'} days
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-white/60">
              No new Christians found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NewChristians;

