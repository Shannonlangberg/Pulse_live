import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  HeartIcon,
  UserGroupIcon,
  UserCircleIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';

const PeopleMain = () => {
  const navigate = useNavigate();
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('healthy'); // healthy, watch, at_risk, critical, new_people, new_christians, in_groups
  const [campuses, setCampuses] = useState([]);
  const [pathways, setPathways] = useState([]);
  const [assigningPathway, setAssigningPathway] = useState({});

  useEffect(() => {
    loadPersons();
    loadCampuses();
    loadPathways();
  }, [statusFilter, searchTerm]);

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

  const loadPersons = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      // Map status filter to pulse_status or special filters
      if (statusFilter === 'healthy') {
        params.append('pulse_status', 'green');
      } else if (statusFilter === 'watch') {
        params.append('pulse_status', 'amber');
      } else if (statusFilter === 'at_risk') {
        params.append('pulse_status', 'amber');
      } else if (statusFilter === 'critical') {
        params.append('pulse_status', 'red');
      } else if (statusFilter === 'new_people') {
        params.append('new_people', 'true');
      } else if (statusFilter === 'new_christians') {
        params.append('new_christians', 'true');
      }

      const response = await fetch(`/api/persons?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store'
      });

      if (response.ok) {
        const data = await response.json();
        let filtered = data.persons || [];

        // Additional filtering for in_groups (client-side as it's simple)
        if (statusFilter === 'in_groups') {
          filtered = filtered.filter(p => p.connect_group);
        }

        // Load pathway info for each person
        const personsWithPathways = await Promise.all(
          filtered.map(async (person) => {
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

        setPersons(personsWithPathways);
      }
    } catch (err) {
      console.error('Error loading persons:', err);
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
        console.log('All pathways from API:', data.pathways);
        
        // Show all active pathways (both templates and non-templates for assignment)
        // Users can assign any active pathway
        const activePathways = (data.pathways || []).filter(p => p.is_active === true);
        setPathways(activePathways);
        console.log(`Loaded ${activePathways.length} active pathways (including templates)`);
        
        // Also log what we're filtering out
        const filtered = (data.pathways || []).filter(p => !p.is_active);
        if (filtered.length > 0) {
          console.log(`Filtered out ${filtered.length} inactive pathways`);
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to load pathways:', response.status, errorText);
      }
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
      
      console.log(`Assigning pathway ${pathwayIdInt} (type: ${typeof pathwayIdInt}) to person ${personId}`);
      
      const requestBody = {
        pathway_id: pathwayIdInt,
        start_immediately: true
      };
      
      console.log('Request body:', JSON.stringify(requestBody));
      
      const response = await fetch(`/api/journeys/person/${personId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });
      
      console.log('Response status:', response.status, response.statusText);
      
      let result;
      try {
        result = await response.json();
      } catch (jsonErr) {
        const text = await response.text();
        console.error('Failed to parse JSON response:', text);
        alert(`Server error: ${response.status} ${response.statusText}`);
        return;
      }
      
      console.log('Assignment response:', result);
      
      if (response.ok) {
        alert('Journey assigned successfully!');
        await loadPersons(); // Reload to get updated pathway info
      } else {
        const errorMsg = result.error || result.message || `Failed to assign pathway (${response.status})`;
        console.error('Assignment error:', errorMsg, result);
        alert(`Error: ${errorMsg}`);
      }
    } catch (err) {
      console.error('Error assigning pathway:', err);
      alert(`Failed to assign pathway: ${err.message || 'Network error'}`);
    } finally {
      setAssigningPathway({ ...assigningPathway, [personId]: false });
    }
  };

  const getHeartbeatColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getHeartbeatScore = (person) => {
    // Use heartbeat_score from API if available, otherwise calculate from pulse_status
    if (person.heartbeat_score !== undefined) {
      return person.heartbeat_score;
    }
    // Fallback calculation
    if (person.pulse_status === 'green') return 85;
    if (person.pulse_status === 'amber') return 65;
    if (person.pulse_status === 'red') return 35;
    return 50; // Default
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    } catch {
      return 'Never';
    }
  };

  const filterButtons = [
    { key: 'healthy', label: 'Healthy', color: 'bg-green-500/20 text-green-400 border-green-500/50' },
    { key: 'watch', label: 'Watch', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' },
    { key: 'at_risk', label: 'At Risk', color: 'bg-orange-500/20 text-orange-400 border-orange-500/50' },
    { key: 'critical', label: 'Critical', color: 'bg-red-500/20 text-red-400 border-red-500/50' },
    { key: 'new_people', label: 'New People', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
    { key: 'new_christians', label: 'New Christians', color: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
    { key: 'in_groups', label: 'In Groups', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' }
  ];

  return (
    <div className="h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="p-6">
        {/* Header with Search */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search people, families..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all"
                />
              </div>
            </div>
            <div className="ml-4">
              <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center cursor-pointer hover:bg-white/20 transition-colors">
                <UserCircleIcon className="h-6 w-6 text-white/80" />
              </div>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2 flex-wrap">
            {filterButtons.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setStatusFilter(filter.key)}
                className={`
                  px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 border-2
                  ${statusFilter === filter.key
                    ? `${filter.color} shadow-lg`
                    : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }
                `}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* People Table */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Heartbeat</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Pathway</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Group</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Serving</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Campus</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-white/80">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-white/60">
                      Loading people...
                    </td>
                  </tr>
                ) : persons.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-white/60">
                      No people found matching your filters
                    </td>
                  </tr>
                ) : (
                  persons.map((person) => {
                    const heartbeatScore = getHeartbeatScore(person);
                    const initials = (person.preferred_name || person.full_name || '')
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2);
                    
                    const hasPathway = person.assigned_pathways && person.assigned_pathways.length > 0;
                    const currentPathway = hasPathway ? person.assigned_pathways[0] : null;

                    return (
                      <tr key={person.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30 flex items-center justify-center text-white font-semibold">
                              {initials}
                            </div>
                            <div>
                              <div className="text-white font-medium">
                                {person.preferred_name || person.full_name}
                              </div>
                              {person.email && (
                                <div className="text-white/60 text-sm">{person.email}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="relative w-12 h-12">
                              <svg className="w-12 h-12 transform -rotate-90">
                                <circle
                                  cx="24"
                                  cy="24"
                                  r="20"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  className="text-slate-700/50"
                                />
                                <circle
                                  cx="24"
                                  cy="24"
                                  r="20"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  strokeDasharray={`${(heartbeatScore / 100) * 125.6} 125.6`}
                                  className={getHeartbeatColor(heartbeatScore)}
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className={`text-xs font-bold ${getHeartbeatColor(heartbeatScore)}`}>
                                  {heartbeatScore}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {hasPathway ? (
                            <div className="flex items-center gap-2">
                              <AcademicCapIcon className="h-4 w-4 text-purple-400" />
                              <div>
                                <div className="text-white/90 text-sm font-medium">
                                  {currentPathway.pathway_name}
                                </div>
                                <div className="text-white/60 text-xs">
                                  {currentPathway.progress_percentage || 0}% complete
                                </div>
                              </div>
                            </div>
                          ) : (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  const pathwayId = parseInt(e.target.value);
                                  console.log(`Selected pathway ${pathwayId} for person ${person.id}`);
                                  assignPathway(person.id, pathwayId);
                                  e.target.value = '';
                                }
                              }}
                              disabled={assigningPathway[person.id] || pathways.length === 0}
                              className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed outline-none focus:ring-2 focus:ring-purple-500/50"
                            >
                              <option value="">
                                {pathways.length === 0 ? 'Loading pathways...' : 'Assign Pathway...'}
                              </option>
                              {pathways.map(pathway => (
                                <option key={pathway.id} value={pathway.id}>
                                  {pathway.name} {pathway.is_template ? '(Template)' : ''}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-6 py-4 text-white/80">
                          {person.connect_group_name || person.connect_group || 'No Group'}
                        </td>
                        <td className="px-6 py-4 text-white/80">
                          {person.dream_team_roles && person.dream_team_roles.length > 0
                            ? person.dream_team_roles.join(', ')
                            : 'Not Serving'}
                        </td>
                        <td className="px-6 py-4 text-white/80">
                          {person.campus === 'all_campuses' ? 'All Campuses' : person.campus || '—'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {hasPathway && (
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    const pathwayId = parseInt(e.target.value);
                                    console.log(`Changing pathway to ${pathwayId} for person ${person.id}`);
                                    assignPathway(person.id, pathwayId);
                                    e.target.value = '';
                                  }
                                }}
                                disabled={assigningPathway[person.id] || pathways.length === 0}
                                className="px-2 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/50 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed outline-none"
                                title="Change Pathway"
                              >
                                <option value="">Change...</option>
                                {pathways.map(pathway => (
                                  <option key={pathway.id} value={pathway.id}>
                                    {pathway.name} {pathway.is_template ? '(Template)' : ''}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              onClick={() => navigate(`/persons/${person.id}`)}
                              className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/50 rounded-lg transition-all duration-200 hover:scale-105 text-sm"
                            >
                              View Profile
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {persons.length > 0 && (
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
              <div className="text-white/60 text-sm">
                Showing {persons.length} {persons.length === 1 ? 'person' : 'people'}
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white/80 rounded-lg transition-colors">
                  &lt;
                </button>
                <button className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/50 rounded-lg">
                  1
                </button>
                <button className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white/80 rounded-lg transition-colors">
                  2
                </button>
                <button className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white/80 rounded-lg transition-colors">
                  &gt;
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PeopleMain;

