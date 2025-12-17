import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UserPlusIcon, 
  CalendarIcon, 
  MapPinIcon, 
  CheckCircleIcon,
  AcademicCapIcon,
  PhoneIcon,
  EnvelopeIcon,
  UserGroupIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  HeartIcon
} from '@heroicons/react/24/outline';

const NewPeople = () => {
  const navigate = useNavigate();
  const [newPeople, setNewPeople] = useState([]);
  const [allNewPeople, setAllNewPeople] = useState([]); // Store all people for filtering
  const [loading, setLoading] = useState(true);
  const [pathways, setPathways] = useState([]);
  const [expandedCards, setExpandedCards] = useState({});
  const [assigningPathway, setAssigningPathway] = useState({});
  const [updatingStatus, setUpdatingStatus] = useState({});
  const [selectedCampus, setSelectedCampus] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [campuses, setCampuses] = useState([]);

  useEffect(() => {
    loadNewPeople();
    loadPathways();
    loadCampuses();
  }, []);

  useEffect(() => {
    // Filter people when filters change
    if (allNewPeople.length > 0) {
      filterPeople();
    }
  }, [selectedCampus, selectedDepartment]);

  const loadNewPeople = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/persons?new_people=true', {
        credentials: 'include',
        cache: 'no-store'
      });
      
      if (response.ok) {
        const data = await response.json();
        const persons = data.persons || [];
        
        // Load pathway info for each person
        const personsWithPathways = await Promise.all(
          persons.map(async (person) => {
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
        
        setAllNewPeople(personsWithPathways);
        filterPeople(personsWithPathways);
      }
    } catch (err) {
      console.error('Error loading new people:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPathways = async () => {
    try {
      const response = await fetch('/api/journeys', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to load pathways:', response.status, errorText);
        return;
      }
      
      const data = await response.json();
      const allPathways = data.pathways || [];
      setPathways(allPathways);
    } catch (err) {
      console.error('Error loading pathways:', err);
    }
  };

  const assignPathway = async (personId, pathwayId) => {
    if (!personId || !pathwayId) {
      console.error('Missing personId or pathwayId:', { personId, pathwayId });
      alert('Error: Missing person or pathway information');
      return;
    }

    try {
      setAssigningPathway({ ...assigningPathway, [personId]: true });
      
      const pathwayIdInt = typeof pathwayId === 'string' ? parseInt(pathwayId, 10) : pathwayId;
      
      if (isNaN(pathwayIdInt)) {
        console.error('Invalid pathway ID:', pathwayId);
        alert('Error: Invalid pathway ID');
        return;
      }
      
      // Check if person already has a pathway - if so, replace it
      const person = allNewPeople.find(p => p.id === personId);
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
        await loadNewPeople(); // Reload to get updated pathway info
      } else {
        const result = await response.json().catch(() => ({}));
        const errorMsg = result.error || result.message || `Failed to assign pathway (${response.status})`;
        alert(`Error: ${errorMsg}`);
      }
    } catch (err) {
      console.error('Error assigning pathway:', err);
      alert(`Failed to assign pathway: ${err.message || 'Network error'}`);
    } finally {
      setAssigningPathway({ ...assigningPathway, [personId]: false });
    }
  };

  const updateFollowUpStatus = async (personId, status) => {
    try {
      setUpdatingStatus({ ...updatingStatus, [personId]: true });
      
      const response = await fetch(`/api/persons/${personId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          follow_up_status: status
        })
      });
      
      if (response.ok) {
        await loadNewPeople(); // Reload to get updated status
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update status');
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status');
    } finally {
      setUpdatingStatus({ ...updatingStatus, [personId]: false });
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
    const people = peopleToFilter || allNewPeople;
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

    setNewPeople(filtered);
  };

  const toggleCard = (personId) => {
    setExpandedCards({
      ...expandedCards,
      [personId]: !expandedCards[personId]
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 overflow-y-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">New People</h2>
            <p className="text-white/60">People who joined in the last 30 days • {newPeople.length} showing ({allNewPeople.length} total)</p>
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
        <div className="text-center py-12 text-white/60">Loading new people...</div>
      ) : (
        <div className="space-y-4">
          {newPeople.length > 0 ? (
            newPeople.map((person) => {
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
                        <UserPlusIcon className="h-6 w-6 text-blue-400" />
                        <h3 className="text-xl font-semibold text-white">
                          {person.full_name || person.preferred_name}
                        </h3>
                        {person.follow_up_status === 'needed' && (
                          <span className="px-2 py-1 text-xs font-semibold bg-red-500/20 text-red-300 rounded-full">
                            Needs Follow-up
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-white/60">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          Visit Date: {formatDate(person.created_at || person.date_added)}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPinIcon className="h-4 w-4" />
                          Campus: {person.campus || 'Unknown'}
                        </div>
                        {person.email && (
                          <div className="flex items-center gap-2">
                            <EnvelopeIcon className="h-4 w-4" />
                            {person.email}
                          </div>
                        )}
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

                  {/* Quick Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-white/60 text-sm mb-1">Service Attended</div>
                      <div className="text-white font-medium">{person.service_attended || 'Unknown'}</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-white/60 text-sm mb-1">Follow-up Status</div>
                      <div className="text-white font-medium capitalize">
                        {person.follow_up_status || 'Needed'}
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-white/60 text-sm mb-1">Assigned Pathway</div>
                      <div className="text-white font-medium">
                        {currentPathway ? currentPathway.pathway_name : 'None'}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button
                      onClick={() => updateFollowUpStatus(person.id, 'contacted')}
                      disabled={updatingStatus[person.id]}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <PhoneIcon className="h-4 w-4" />
                      Mark as Contacted
                    </button>
                    <div className="relative">
                      <select
                        id={`pathway-select-${person.id}`}
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
                        disabled={assigningPathway[person.id]}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-purple-500/50 outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer appearance-none"
                        style={{ minWidth: '200px', paddingRight: '2.5rem' }}
                      >
                        <option value="">
                          {pathways.length === 0 ? 'Loading pathways...' : currentPathway ? 'Change Pathway...' : 'Select Pathway...'}
                        </option>
                        {pathways.map(pathway => (
                          <option key={`pathway-${pathway.id}`} value={String(pathway.id)}>
                            {pathway.name} {pathway.is_template ? '(Template)' : ''}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <ChevronDownIcon className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/persons/${person.id}`)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <HeartIcon className="h-4 w-4" />
                      View Heartbeat Profile
                    </button>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                      {/* Pathway Progress */}
                      {currentPathway && (
                        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <AcademicCapIcon className="h-5 w-5 text-purple-400" />
                            <div className="text-purple-400 font-semibold">Assigned Pathway: {currentPathway.pathway_name}</div>
                          </div>
                          <div className="text-white/80 text-sm">
                            Progress: {currentPathway.progress_percentage || 0}%
                          </div>
                          {currentPathway.current_step && (
                            <div className="text-white/60 text-sm mt-1">
                              Current Step: {currentPathway.current_step.step_name}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Contact Info */}
                      {(person.email || person.phone) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {person.email && (
                            <div className="flex items-center gap-2 text-white/80">
                              <EnvelopeIcon className="h-4 w-4" />
                              <a href={`mailto:${person.email}`} className="hover:text-blue-400">
                                {person.email}
                              </a>
                            </div>
                          )}
                          {person.phone && (
                            <div className="flex items-center gap-2 text-white/80">
                              <PhoneIcon className="h-4 w-4" />
                              <a href={`tel:${person.phone}`} className="hover:text-blue-400">
                                {person.phone}
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {/* AI Follow-up Message */}
                      {person.ai_follow_up_message && (
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                          <div className="text-blue-400 font-semibold mb-2">AI Follow-up Message</div>
                          <div className="text-white/80">{person.ai_follow_up_message}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-white/60">
              No new people in the last 30 days
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NewPeople;

