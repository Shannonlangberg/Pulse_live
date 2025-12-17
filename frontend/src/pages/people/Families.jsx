import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UserGroupIcon, 
  HeartIcon, 
  CalendarIcon, 
  CurrencyDollarIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChatBubbleLeftRightIcon,
  PencilIcon,
  UserPlusIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  UserIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

const Families = () => {
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [campusFilter, setCampusFilter] = useState('all_campuses');
  const [healthFilter, setHealthFilter] = useState('all');
  const [hasKidsFilter, setHasKidsFilter] = useState('all');
  const [hasYouthFilter, setHasYouthFilter] = useState('all');
  const [campuses, setCampuses] = useState([]);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [showFamilyDetail, setShowFamilyDetail] = useState(false);
  const [showCreateFamilyModal, setShowCreateFamilyModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [availablePeople, setAvailablePeople] = useState([]);
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [peopleSearchTerm, setPeopleSearchTerm] = useState('');
  const [toast, setToast] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showPastoralNoteModal, setShowPastoralNoteModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [pastoralNoteText, setPastoralNoteText] = useState('');

  useEffect(() => {
    loadCampuses();
    loadFamilies();
  }, [campusFilter, healthFilter, hasKidsFilter, hasYouthFilter, searchTerm]);

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

  const loadFamilies = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (campusFilter && campusFilter !== 'all_campuses') {
        params.append('campus', campusFilter);
      }
      if (healthFilter && healthFilter !== 'all') {
        params.append('health', healthFilter);
      }
      if (hasKidsFilter === 'true') {
        params.append('has_kids', 'true');
      }
      if (hasYouthFilter === 'true') {
        params.append('has_youth', 'true');
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      const response = await fetch(`/api/people/families?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setFamilies(data.families || []);
        if (data.families && data.families.length === 0) {
          setError('No families found. Create a family by assigning family_id to people in the People section, or use the "Create Family" button below.');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || errorData.details || `Failed to load families (${response.status})`);
        console.error('Error loading families:', errorData);
      }
    } catch (err) {
      console.error('Error loading families:', err);
      setError(`Failed to connect to server: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (status) => {
    const colors = {
      healthy: 'text-emerald-400',
      watch: 'text-amber-400',
      at_risk: 'text-orange-400',
      critical: 'text-red-400'
    };
    return colors[status] || 'text-slate-400';
  };

  const getHealthBgColor = (status) => {
    const colors = {
      healthy: 'bg-emerald-500/20 border-emerald-500/40',
      watch: 'bg-amber-500/20 border-amber-500/40',
      at_risk: 'bg-orange-500/20 border-orange-500/40',
      critical: 'bg-red-500/20 border-red-500/40'
    };
    return colors[status] || 'bg-slate-500/20 border-slate-500/40';
  };

  const getHealthLabel = (status) => {
    const labels = {
      healthy: 'Healthy',
      watch: 'Watch',
      at_risk: 'At Risk',
      critical: 'Critical'
    };
    return labels[status] || 'Unknown';
  };

  const filteredFamilies = useMemo(() => {
    return families.filter(family => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesName = family.family_name?.toLowerCase().includes(searchLower);
        const matchesMembers = family.members.some(m => 
          m.name?.toLowerCase().includes(searchLower) || 
          m.full_name?.toLowerCase().includes(searchLower)
        );
        return matchesName || matchesMembers;
      }
      return true;
    });
  }, [families, searchTerm]);

  const searchPeople = async (search) => {
    if (!search || search.length < 2) {
      setAvailablePeople([]);
      return;
    }
    try {
      setSearchingPeople(true);
      const params = new URLSearchParams();
      params.append('search', search);
      params.append('limit', '20');
      const response = await fetch(`/api/persons?${params.toString()}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setAvailablePeople(data.persons || data.people || []);
      }
    } catch (err) {
      console.error('Error searching people:', err);
    } finally {
      setSearchingPeople(false);
    }
  };

  const createFamilyForPerson = async (personId) => {
    try {
      console.log('Creating family for person:', personId);
      
      // URL encode the person ID to handle special characters (like spaces in PCO IDs)
      const encodedPersonId = encodeURIComponent(personId);
      console.log('Encoded person ID:', encodedPersonId);
      
      const url = `/api/persons/${encodedPersonId}/family/create`;
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('Response status:', response.status);
      
      const data = await response.json().catch(async () => {
        const text = await response.text().catch(() => 'No response body');
        console.error('Failed to parse JSON response:', text);
        return { error: 'Invalid response from server', details: text };
      });
      
      console.log('Response data:', data);
      
      if (response.ok) {
        setShowCreateFamilyModal(false);
        setPeopleSearchTerm('');
        setAvailablePeople([]);
        
        if (data.already_exists) {
          setToast({ type: 'info', message: 'This person already has a family assigned.' });
          await loadFamilies();
        } else {
          // Reload families to get the newly created one
          await loadFamilies();
          setToast({ type: 'success', message: 'Family created successfully!' });
          
          // Wait a moment for state to update, then find and open the family
          setTimeout(async () => {
            try {
              // Fetch fresh families list
              const response = await fetch('/api/people/families', {
                credentials: 'include'
              });
              
              if (response.ok) {
                const familyData = await response.json();
                const updatedFamilies = familyData.families || [];
                
                // Find family by the person's ID
                const newFamily = updatedFamilies.find(f => 
                  f.members && f.members.some(m => m.id === personId)
                );
                
                if (newFamily) {
                  setSelectedFamily(newFamily);
                  setShowFamilyDetail(true);
                } else {
                  // If not found, try to find by family_id if we have it
                  if (data.family_id) {
                    const familyById = updatedFamilies.find(f => f.id === data.family_id);
                    if (familyById) {
                      setSelectedFamily(familyById);
                      setShowFamilyDetail(true);
                    }
                  }
                }
              }
            } catch (err) {
              console.error('Error loading family detail:', err);
            }
          }, 500);
        }
      } else {
        // Show detailed error message
        const errorMsg = data.error || data.details || `Failed to create family (${response.status})`;
        console.error('Error creating family:', {
          status: response.status,
          statusText: response.statusText,
          data: data,
          personId: personId
        });
        setToast({ type: 'error', message: errorMsg });
      }
    } catch (err) {
      console.error('Error creating family:', err);
      setToast({ type: 'error', message: `Failed to create family: ${err.message}` });
    }
  };

  const addMemberToFamily = async (familyPersonId, memberPersonId) => {
    try {
      console.log('Adding member to family:', { familyPersonId, memberPersonId });
      
      // URL encode person IDs to handle special characters
      const encodedFamilyPersonId = encodeURIComponent(familyPersonId);
      console.log('Encoded family person ID:', encodedFamilyPersonId);
      
      const url = `/api/persons/${encodedFamilyPersonId}/family/add-member`;
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_person_id: memberPersonId })
      });
      
      console.log('Response status:', response.status);
      
      const data = await response.json().catch(async () => {
        const text = await response.text().catch(() => 'No response body');
        console.error('Failed to parse JSON response:', text);
        return { error: 'Invalid response from server', details: text };
      });
      
      console.log('Response data:', data);
      
      if (response.ok) {
        setToast({ type: 'success', message: 'Member added to family successfully!' });
        await loadFamilies();
        setShowAddMemberModal(false);
        setPeopleSearchTerm('');
        setAvailablePeople([]);
        
        // Refresh detail view if open - fetch fresh data
        if (selectedFamily) {
          try {
            const familyResponse = await fetch('/api/people/families', {
              credentials: 'include'
            });
            if (familyResponse.ok) {
              const familyData = await familyResponse.json();
              const updatedFamilies = familyData.families || [];
              const updatedFamily = updatedFamilies.find(f => f.id === selectedFamily.id);
              if (updatedFamily) {
                setSelectedFamily(updatedFamily);
              }
            }
          } catch (refreshErr) {
            console.error('Error refreshing family detail:', refreshErr);
          }
        }
      } else {
        const errorMsg = data.error || data.details || `Failed to add member (${response.status})`;
        console.error('Error adding member:', {
          status: response.status,
          data: data,
          familyPersonId: familyPersonId,
          memberPersonId: memberPersonId
        });
        setToast({ type: 'error', message: errorMsg });
      }
    } catch (err) {
      console.error('Error adding member:', err);
      setToast({ type: 'error', message: `Failed to add member: ${err.message}` });
    }
  };

  const handleMessageFamily = () => {
    if (selectedFamily && selectedFamily.members && selectedFamily.members.length > 0) {
      setShowMessageModal(true);
    } else {
      setToast({ type: 'error', message: 'No family members to message' });
    }
  };

  const sendMessageToFamily = async (family) => {
    if (!messageText.trim() || !family) {
      setToast({ type: 'error', message: 'Please enter a message' });
      return;
    }

    try {
      // Get all member emails/phones
      const members = family.members || [];
      const emails = members.filter(m => m.email).map(m => m.email);
      const phones = members.filter(m => m.phone).map(m => m.phone);

      // For now, just show a success message
      // In the future, this could integrate with a messaging service
      setToast({ 
        type: 'success', 
        message: `Message prepared for ${members.length} family member(s). Messaging feature coming soon!` 
      });
      setShowMessageModal(false);
      setMessageText('');
    } catch (err) {
      console.error('Error sending message:', err);
      setToast({ type: 'error', message: 'Failed to send message' });
    }
  };

  const handleAddPastoralNote = () => {
    if (selectedFamily && selectedFamily.members && selectedFamily.members.length > 0) {
      setShowPastoralNoteModal(true);
    } else {
      setToast({ type: 'error', message: 'No family members to add note for' });
    }
  };

  const savePastoralNote = async (family) => {
    if (!pastoralNoteText.trim() || !family) {
      setToast({ type: 'error', message: 'Please enter a pastoral note' });
      return;
    }

    try {
      // Get the first member (or parent) to attach the note to
      const primaryMember = family.members.find(m => m.role === 'parent') || family.members[0];
      
      if (!primaryMember || !primaryMember.id) {
        setToast({ type: 'error', message: 'Could not find family member to attach note to' });
        return;
      }

      // Update the person's pastoral notes
      const response = await fetch(`/api/persons/${encodeURIComponent(primaryMember.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pastoral_notes: pastoralNoteText
        })
      });

      if (response.ok) {
        setToast({ type: 'success', message: 'Pastoral note saved successfully' });
        setShowPastoralNoteModal(false);
        setPastoralNoteText('');
        // Reload families to refresh data
        await loadFamilies();
        // Refresh selected family if still viewing it
        const updatedFamilies = await fetch('/api/people/families', {
          credentials: 'include'
        }).then(r => r.json()).then(d => d.families || []).catch(() => []);
        const updatedFamily = updatedFamilies.find(f => f.id === family.id);
        if (updatedFamily) setSelectedFamily(updatedFamily);
      } else {
        const error = await response.json().catch(() => ({}));
        setToast({ type: 'error', message: error.error || 'Failed to save pastoral note' });
      }
    } catch (err) {
      console.error('Error saving pastoral note:', err);
      setToast({ type: 'error', message: 'Failed to save pastoral note' });
    }
  };

  // Early return for family detail view - must be after all function definitions
  if (showFamilyDetail && selectedFamily) {
    return (
      <>
        <FamilyDetailView 
          family={selectedFamily} 
          onBack={() => {
            setShowFamilyDetail(false);
            setSelectedFamily(null);
          }}
          onAddMember={() => setShowAddMemberModal(true)}
          onMessageFamily={handleMessageFamily}
          onAddPastoralNote={handleAddPastoralNote}
          showMessageModal={showMessageModal}
          showPastoralNoteModal={showPastoralNoteModal}
          messageText={messageText}
          setMessageText={setMessageText}
          pastoralNoteText={pastoralNoteText}
          setPastoralNoteText={setPastoralNoteText}
          sendMessageToFamily={sendMessageToFamily}
          savePastoralNote={savePastoralNote}
          setShowMessageModal={setShowMessageModal}
          setShowPastoralNoteModal={setShowPastoralNoteModal}
          loadFamilies={loadFamilies}
          setSelectedFamily={setSelectedFamily}
          setToast={setToast}
        />
        
        {/* Add Member Modal - rendered here so it's accessible from FamilyDetailView */}
        {showAddMemberModal && selectedFamily && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-white">Add Member to {selectedFamily.family_name}</h3>
                <button
                  onClick={() => {
                    setShowAddMemberModal(false);
                    setPeopleSearchTerm('');
                    setAvailablePeople([]);
                  }}
                  className="text-white/60 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <p className="text-white/60 mb-4">Search for a person to add to this family:</p>
              <div className="relative mb-4">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={peopleSearchTerm}
                  onChange={(e) => {
                    setPeopleSearchTerm(e.target.value);
                    searchPeople(e.target.value);
                  }}
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {searchingPeople && (
                <div className="text-center py-4 text-white/60">Searching...</div>
              )}
              {availablePeople.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availablePeople
                    .filter(p => !selectedFamily.members.some(m => m.id === p.id))
                    .map((person) => (
                      <div
                        key={person.id}
                        className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
                      >
                        <div>
                          <div className="text-white font-medium">{person.full_name}</div>
                          {person.email && <div className="text-sm text-white/60">{person.email}</div>}
                          {person.campus && <div className="text-xs text-white/40">{person.campus}</div>}
                        </div>
                        <button
                          onClick={() => {
                            const parentMember = selectedFamily.members.find(m => m.role === 'parent') || selectedFamily.members[0];
                            if (parentMember && parentMember.id) {
                              console.log('Button clicked - adding member:', {
                                parentMemberId: parentMember.id,
                                newMemberId: person.id,
                                parentMember: parentMember
                              });
                              addMemberToFamily(parentMember.id, person.id);
                            } else {
                              console.error('No valid parent member found:', {
                                selectedFamily,
                                members: selectedFamily.members
                              });
                              setToast({ type: 'error', message: 'Could not find a family member to add to. Please refresh the page.' });
                            }
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                        >
                          Add to Family
                        </button>
                      </div>
                    ))}
                </div>
              )}
              {peopleSearchTerm && !searchingPeople && availablePeople.length === 0 && (
                <div className="text-center py-4 text-white/60">No people found</div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Families</h2>
          <p className="text-white/60">Household behavior is the #1 pastoral predictor</p>
        </div>
        <button
          onClick={() => setShowCreateFamilyModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <UserPlusIcon className="w-5 h-5" />
          Create Family
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold mb-1">Error Loading Families</div>
              <div className="text-sm text-red-200/80">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search families, members..."
            className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <select
            value={campusFilter}
            onChange={(e) => setCampusFilter(e.target.value)}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="all_campuses">All Campuses</option>
            {campuses.map(campus => (
              <option key={campus.id} value={campus.id}>{campus.name}</option>
            ))}
          </select>

          <select
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="all">All Health Statuses</option>
            <option value="healthy">Healthy</option>
            <option value="watch">Watch</option>
            <option value="at_risk">At Risk</option>
            <option value="critical">Critical</option>
          </select>

          <select
            value={hasKidsFilter}
            onChange={(e) => setHasKidsFilter(e.target.value)}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="all">All Families</option>
            <option value="true">Has Kids</option>
          </select>

          <select
            value={hasYouthFilter}
            onChange={(e) => setHasYouthFilter(e.target.value)}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="all">All Families</option>
            <option value="true">Has Youth</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/60">Loading families...</div>
      ) : filteredFamilies.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-white/60 mb-4">No families found matching your filters</div>
          {!error && (
            <div className="text-white/40 text-sm">
              <p className="mb-2">To create families:</p>
              <p>1. Click "Create Family" above to assign a family_id to a person</p>
              <p>2. Or edit people in the People section and assign them a family_id</p>
              <p>3. Families are automatically grouped when people share the same family_id</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredFamilies.map((family) => (
            <div
              key={family.id}
              onClick={() => {
                setSelectedFamily(family);
                setShowFamilyDetail(true);
              }}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all"
            >
              {/* Family Header */}
              <div className="mb-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-xl font-semibold text-white">
                    {family.family_name || family.members.map(m => m.name).join(', ')}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getHealthBgColor(family.heartbeat_status)} ${getHealthColor(family.heartbeat_status)}`}>
                    {getHealthLabel(family.heartbeat_status)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-white/60">
                  <span>{family.members.length} {family.members.length === 1 ? 'member' : 'members'}</span>
                  {family.campus && <span>{family.campus}</span>}
                </div>
              </div>

              {/* Heartbeat Score - Big */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <HeartIcon className="h-5 w-5 text-red-400" />
                  <span className="text-sm text-white/60">Household Heartbeat</span>
                </div>
                <div className="text-4xl font-bold text-white">
                  {family.household_heartbeat}
                </div>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-white/60 text-xs mb-1">Attendance Together</div>
                  <div className="text-white text-lg font-semibold">
                    {family.attendance_together}%
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-white/60 text-xs mb-1">Groups</div>
                  <div className="text-white text-lg font-semibold">
                    {family.groups_involvement?.length || 0}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-white/60 text-xs mb-1">Serving</div>
                  <div className="text-white text-lg font-semibold">
                    {family.serving_patterns?.length || 0}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-white/60 text-xs mb-1">Giving</div>
                  <div className="text-white text-lg font-semibold capitalize">
                    {family.giving_rhythm || 'none'}
                  </div>
                </div>
              </div>

              {/* Status Indicators */}
              <div className="flex flex-wrap gap-2">
                {family.new_people_count > 0 && (
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded border border-blue-500/30">
                    {family.new_people_count} New
                  </span>
                )}
                {family.new_christians_count > 0 && (
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded border border-purple-500/30">
                    {family.new_christians_count} New Christian{family.new_christians_count > 1 ? 's' : ''}
                  </span>
                )}
                {family.care_cases?.length > 0 && (
                  <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded border border-red-500/30">
                    {family.care_cases.length} Care Case{family.care_cases.length > 1 ? 's' : ''}
                  </span>
                )}
                {family.attendance_drifting && (
                  <span className="px-2 py-1 bg-orange-500/20 text-orange-300 text-xs rounded border border-orange-500/30">
                    Drifting
                  </span>
                )}
              </div>

              {/* AI Summary Preview */}
              {family.ai_summary && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-start gap-2">
                    <SparklesIcon className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-white/70 line-clamp-2">{family.ai_summary}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Family Modal */}
      {showCreateFamilyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-white">Create Family</h3>
              <button
                onClick={() => {
                  setShowCreateFamilyModal(false);
                  setPeopleSearchTerm('');
                  setAvailablePeople([]);
                }}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-white/60 mb-4">Search for a person to create a family for them:</p>
            <div className="relative mb-4">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={peopleSearchTerm}
                onChange={(e) => {
                  setPeopleSearchTerm(e.target.value);
                  searchPeople(e.target.value);
                }}
                placeholder="Search by name or email..."
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {searchingPeople && (
              <div className="text-center py-4 text-white/60">Searching...</div>
            )}
            {availablePeople.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availablePeople.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    <div>
                      <div className="text-white font-medium">{person.full_name}</div>
                      {person.email && <div className="text-sm text-white/60">{person.email}</div>}
                      {person.campus && <div className="text-xs text-white/40">{person.campus}</div>}
                    </div>
                    <button
                      onClick={() => createFamilyForPerson(person.id)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                    >
                      Create Family
                    </button>
                  </div>
                ))}
              </div>
            )}
            {peopleSearchTerm && !searchingPeople && availablePeople.length === 0 && (
              <div className="text-center py-4 text-white/60">No people found</div>
            )}
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && selectedFamily && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-white">Add Member to {selectedFamily.family_name}</h3>
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setPeopleSearchTerm('');
                  setAvailablePeople([]);
                }}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-white/60 mb-4">Search for a person to add to this family:</p>
            <div className="relative mb-4">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={peopleSearchTerm}
                onChange={(e) => {
                  setPeopleSearchTerm(e.target.value);
                  searchPeople(e.target.value);
                }}
                placeholder="Search by name or email..."
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {searchingPeople && (
              <div className="text-center py-4 text-white/60">Searching...</div>
            )}
            {availablePeople.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availablePeople
                  .filter(p => !selectedFamily.members.some(m => m.id === p.id))
                  .map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                      <div>
                        <div className="text-white font-medium">{person.full_name}</div>
                        {person.email && <div className="text-sm text-white/60">{person.email}</div>}
                        {person.campus && <div className="text-xs text-white/40">{person.campus}</div>}
                      </div>
                      <button
                        onClick={() => {
                          const parentMember = selectedFamily.members.find(m => m.role === 'parent') || selectedFamily.members[0];
                          if (parentMember && parentMember.id) {
                            console.log('Button clicked - adding member:', {
                              parentMemberId: parentMember.id,
                              newMemberId: person.id,
                              parentMember: parentMember
                            });
                            addMemberToFamily(parentMember.id, person.id);
                          } else {
                            console.error('No valid parent member found:', {
                              selectedFamily,
                              members: selectedFamily.members
                            });
                            setToast({ type: 'error', message: 'Could not find a family member to add to. Please refresh the page.' });
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                      >
                        Add to Family
                      </button>
                    </div>
                  ))}
              </div>
            )}
            {peopleSearchTerm && !searchingPeople && availablePeople.length === 0 && (
              <div className="text-center py-4 text-white/60">No people found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Family Detail View Component
const FamilyDetailView = ({ 
  family, 
  onBack, 
  onAddMember,
  onMessageFamily,
  onAddPastoralNote,
  showMessageModal,
  showPastoralNoteModal,
  messageText,
  setMessageText,
  pastoralNoteText,
  setPastoralNoteText,
  sendMessageToFamily,
  savePastoralNote,
  setShowMessageModal,
  setShowPastoralNoteModal,
  loadFamilies,
  setSelectedFamily,
  setToast
}) => {
  const navigate = useNavigate();

  // Get family name - should already be in "Lastname Family" format from backend
  const getFullFamilyName = () => {
    // Backend should already format it as "Lastname Family"
    return family.family_name || 'Family';
  };

  return (
    <div className="h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 overflow-y-auto">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-white/60 hover:text-white transition-colors"
      >
        <span>←</span> Back to Families
      </button>

      {/* Family Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">{getFullFamilyName()}</h2>
        <div className="flex items-center gap-4 text-white/60">
          <span>{family.members.length} {family.members.length === 1 ? 'member' : 'members'}</span>
          {family.campus && <span>{family.campus}</span>}
        </div>
      </div>

      {/* Heartbeat Score - Large Display */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <HeartIcon className="h-6 w-6 text-red-400" />
              <span className="text-white/60">Household Heartbeat</span>
            </div>
            <div className="text-6xl font-bold text-white mb-2">
              {family.household_heartbeat}
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-semibold border inline-block ${
              family.heartbeat_status === 'healthy' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' :
              family.heartbeat_status === 'watch' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' :
              family.heartbeat_status === 'at_risk' ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' :
              'bg-red-500/20 border-red-500/40 text-red-300'
            }`}>
              {family.heartbeat_status === 'healthy' ? 'Healthy' :
               family.heartbeat_status === 'watch' ? 'Watch' :
               family.heartbeat_status === 'at_risk' ? 'At Risk' : 'Critical'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Members List */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Family Members</h3>
          <div className="space-y-3">
            {family.members.map((member) => (
              <div key={member.id} className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-white font-medium">{member.full_name || member.name}</div>
                    <div className="text-sm text-white/60">{member.role} • {member.department || 'No department'}</div>
                    {member.email && (
                      <div className="text-xs text-white/40 mt-1">{member.email}</div>
                    )}
                  </div>
                  <div className="text-right mr-4">
                    <div className="text-white font-semibold">{member.heartbeat_score}</div>
                    <div className="text-xs text-white/60">Heartbeat</div>
                  </div>
                </div>
                {member.connect_group && (
                  <div className="text-sm text-white/60 mb-3">Group: {member.connect_group}</div>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => navigate(`/persons/${member.id}`)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-sm transition-colors"
                  >
                    <UserIcon className="h-4 w-4" />
                    View Profile
                  </button>
                  <button
                    onClick={() => navigate(`/persons/${member.id}`)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-lg text-sm transition-colors"
                  >
                    <HeartIcon className="h-4 w-4" />
                    View Heartbeat
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Attendance Timeline */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Attendance Timeline</h3>
          <div className="mb-4">
            <div className="text-3xl font-bold text-white mb-1">{family.attendance_together}%</div>
            <div className="text-sm text-white/60">Attendance Together</div>
          </div>
          {family.attendance_timeline && family.attendance_timeline.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {family.attendance_timeline.slice(0, 10).map((event, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-white/60">{new Date(event.date).toLocaleDateString()}</span>
                  <span className="text-white">
                    {event.count} of {family.members.length} {event.all_present && '✓'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-white/60 text-sm">No recent attendance data</div>
          )}
        </div>

        {/* Groups Involvement */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Groups Involvement</h3>
          {family.groups_involvement && family.groups_involvement.length > 0 ? (
            <div className="space-y-2">
              {family.groups_involvement.map((group, idx) => (
                <div key={idx} className="bg-white/5 rounded-lg p-3 text-white">
                  {group}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-white/60 text-sm">No groups</div>
          )}
        </div>

        {/* Serving Patterns */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Serving & Volunteer Patterns</h3>
          {family.serving_patterns && family.serving_patterns.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {family.serving_patterns.slice(0, 10).map((pattern, idx) => (
                <div key={idx} className="bg-white/5 rounded-lg p-3">
                  <div className="text-white font-medium">{pattern.person_name}</div>
                  <div className="text-sm text-white/60">{pattern.role} • {pattern.team_name}</div>
                  {pattern.date && (
                    <div className="text-xs text-white/40 mt-1">
                      {new Date(pattern.date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-white/60 text-sm">No serving records</div>
          )}
        </div>

        {/* Giving Rhythm */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Giving Rhythm</h3>
          <div className="text-2xl font-bold text-white mb-2 capitalize">{family.giving_rhythm || 'none'}</div>
          <div className="text-sm text-white/60">
            {family.parent_giving ? 'Parents are giving' : 'No giving activity'}
          </div>
        </div>

        {/* New People & New Christians */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">New People & New Christians</h3>
          <div className="space-y-3">
            {family.new_people_count > 0 && (
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3">
                <div className="text-blue-300 font-medium">{family.new_people_count} New People</div>
                <div className="text-sm text-blue-200/60">Joined in last 30 days</div>
              </div>
            )}
            {family.new_christians_count > 0 && (
              <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-3">
                <div className="text-purple-300 font-medium">{family.new_christians_count} New Christian{family.new_christians_count > 1 ? 's' : ''}</div>
                <div className="text-sm text-purple-200/60">In the last 2 years</div>
              </div>
            )}
            {family.new_people_count === 0 && family.new_christians_count === 0 && (
              <div className="text-white/60 text-sm">No new people or new Christians</div>
            )}
          </div>
        </div>

        {/* Care Cases */}
        {family.care_cases && family.care_cases.length > 0 && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Pastoral Care Cases</h3>
            <div className="space-y-3">
              {family.care_cases.map((case_item) => (
                <div key={case_item.id} className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-red-300 font-medium">{case_item.person_name}</div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      case_item.priority === 'high' ? 'bg-red-500/40 text-red-200' :
                      case_item.priority === 'medium' ? 'bg-orange-500/40 text-orange-200' :
                      'bg-yellow-500/40 text-yellow-200'
                    }`}>
                      {case_item.priority}
                    </span>
                  </div>
                  {case_item.notes && (
                    <div className="text-sm text-red-200/60">{case_item.notes}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pastoral Notes */}
        {family.pastoral_notes && family.pastoral_notes.length > 0 && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Pastoral Notes</h3>
            <div className="space-y-3">
              {family.pastoral_notes.map((note, idx) => (
                <div key={idx} className="bg-white/5 rounded-lg p-3">
                  <div className="text-white font-medium mb-1">{note.person_name}</div>
                  <div className="text-sm text-white/60">{note.notes}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Summary */}
        {family.ai_summary && (
          <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 backdrop-blur-sm border border-purple-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <SparklesIcon className="h-5 w-5 text-purple-400" />
              <h3 className="text-xl font-semibold text-white">AI Family Health Summary</h3>
            </div>
            <p className="text-white/80 leading-relaxed">{family.ai_summary}</p>
          </div>
        )}

        {/* Next Steps */}
        {family.next_steps && family.next_steps.length > 0 && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <SparklesIcon className="h-5 w-5 text-blue-400" />
              <h3 className="text-xl font-semibold text-white">AI-Generated Next Steps</h3>
            </div>
            <div className="space-y-3">
              {family.next_steps.map((step, idx) => (
                <div key={idx} className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-start gap-3">
                    {step.type === 'follow_up' && <UserPlusIcon className="h-5 w-5 text-blue-400 mt-0.5" />}
                    {step.type === 'discipleship' && <SparklesIcon className="h-5 w-5 text-purple-400 mt-0.5" />}
                    {step.type === 'engagement' && <CalendarIcon className="h-5 w-5 text-amber-400 mt-0.5" />}
                    {step.type === 'care' && <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mt-0.5" />}
                    <div className="flex-1">
                      <div className="text-white font-medium mb-1">{step.title}</div>
                      <div className="text-sm text-white/60">{step.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex gap-4">
        <button 
          onClick={onMessageFamily}
          className="px-6 py-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg transition-colors flex items-center gap-2"
        >
          <ChatBubbleLeftRightIcon className="h-5 w-5" />
          Message Family
        </button>
        <button 
          onClick={onAddPastoralNote}
          className="px-6 py-3 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-lg transition-colors flex items-center gap-2"
        >
          <PencilIcon className="h-5 w-5" />
          Add Pastoral Note
        </button>
        <button 
          onClick={onAddMember}
          className="px-6 py-3 bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-500/30 rounded-lg transition-colors flex items-center gap-2"
        >
          <UserPlusIcon className="h-5 w-5" />
          Add Member
        </button>
      </div>

      {/* Message Family Modal */}
      {showMessageModal && family && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-white">Message Family</h3>
              <button
                onClick={() => {
                  setShowMessageModal(false);
                  setMessageText('');
                }}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-white/60 mb-4">
              Send a message to {family.members.length} family member(s)
            </p>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Enter your message..."
              rows={6}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowMessageModal(false);
                  setMessageText('');
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendMessageToFamily}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Send Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Pastoral Note Modal */}
      {showPastoralNoteModal && family && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-white">Add Pastoral Note</h3>
              <button
                onClick={() => {
                  setShowPastoralNoteModal(false);
                  setPastoralNoteText('');
                }}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-white/60 mb-4">
              Add a pastoral note for {family.family_name || 'this family'}
            </p>
            <textarea
              value={pastoralNoteText}
              onChange={(e) => setPastoralNoteText(e.target.value)}
              placeholder="Enter your pastoral note..."
              rows={6}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowPastoralNoteModal(false);
                  setPastoralNoteText('');
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => savePastoralNote(family)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Families;
