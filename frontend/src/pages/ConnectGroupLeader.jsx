import React, { useState, useEffect, useRef } from 'react';
import {
  UserGroupIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  XMarkIcon,
  ClockIcon,
  MapPinIcon,
  ArrowLeftOnRectangleIcon,
  HomeIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  Bars3Icon
} from '@heroicons/react/24/outline';

const ConnectGroupLeader = () => {
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [myGroups, setMyGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentView, setCurrentView] = useState('groups'); // 'groups', 'group-details', 'attendance'
  const [people, setPeople] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile sidebar state
  const memberDropdownRef = useRef(null);

  useEffect(() => {
    if (loggedIn && selectedGroup) {
      loadPeople();
    }
  }, [loggedIn, selectedGroup]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(event.target)) {
        setShowMemberDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadPeople = async () => {
    try {
      // Load people - use demo endpoint since leaders aren't logged into main app
      // Filter by campus when a group is selected
      const campus = selectedGroup?.campus;
      const url = campus && campus !== 'all_campuses' 
        ? `/api/persons/demo?campus=${campus}&page_size=1000`
        : '/api/persons/demo?page_size=1000';
      
      const response = await fetch(url, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setPeople(data.persons || []);
      }
    } catch (err) {
      console.error('Error loading people:', err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Find groups where user is leader/co-leader
      const response = await fetch('/api/connect-groups?is_active=true', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        const groups = data.groups || [];
        
        // Find groups where this email matches leader, co-leader, or any additional leader
        const userGroups = groups.filter(group => {
          const leaderEmail = group.leader_email?.toLowerCase();
          const coLeaderEmail = group.co_leader_email?.toLowerCase();
          const additionalLeaderEmails = (group.leader_emails || []).map(e => e?.toLowerCase());
          const inputEmail = email.toLowerCase();
          
          // Check if email matches any leader (primary, co-leader, or additional)
          const isLeader = leaderEmail === inputEmail || 
                          coLeaderEmail === inputEmail || 
                          additionalLeaderEmails.includes(inputEmail);
          
          if (isLeader) {
            // Verify access code if provided
            if (accessCode && group.leader_access_code) {
              return group.leader_access_code === accessCode;
            }
            // If no access code set, allow login
            return !group.leader_access_code || group.leader_access_code === accessCode;
          }
          return false;
        });

        if (userGroups.length > 0) {
          setMyGroups(userGroups);
          setLoggedIn(true);
          setCurrentView('groups');
        } else {
          setError('No groups found for this email, or incorrect access code');
        }
      } else {
        setError('Failed to load groups');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupDetails = async (group) => {
    try {
      // Include email and access code for leader authentication
      const params = new URLSearchParams();
      if (email) params.append('leader_email', email);
      if (accessCode) params.append('access_code', accessCode);
      
      const response = await fetch(`/api/connect-groups/${group.id}?${params.toString()}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedGroup(data);
        setCurrentView('group-details');
        // Also load meetings if available
        if (data.meetings) {
          // Meetings are already included in the response
        }
      }
    } catch (err) {
      console.error('Error loading group details:', err);
    }
  };

  const handleCreateMeeting = async (group) => {
    const meetingDate = prompt('Enter meeting date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!meetingDate) return;

    try {
      const response = await fetch(`/api/connect-groups/${group.id}/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          meeting_date: meetingDate,
          notes: '',
          leader_email: email,
          access_code: accessCode
        })
      });

      if (response.ok) {
        const data = await response.json();
        await loadGroupDetails(group);
        setSelectedMeeting(data.meeting);
        setCurrentView('attendance');
        // Load attendance for this meeting
        loadMeetingAttendance(data.meeting.id);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to create meeting');
      }
    } catch (err) {
      console.error('Error creating meeting:', err);
      alert('Failed to create meeting');
    }
  };

  const loadMeetingAttendance = async (meetingId) => {
    try {
      // Get meeting details which includes attendance
      const response = await fetch(`/api/connect-groups/meetings/${meetingId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedMeeting(data);
        setCurrentView('attendance');
        // Initialize attendance for all members AND leaders if not already set
        // Use selectedGroup from state (it should be set by loadGroupDetails)
        if (selectedGroup) {
          const existingAttendance = data.attendance || [];
          
          // Create a list of all people who should have attendance (members + leaders)
          const allPeople = [];
          
          // Add leader if exists
          if (selectedGroup.leader_id && selectedGroup.leader_name) {
            allPeople.push({
              id: selectedGroup.leader_id,
              full_name: selectedGroup.leader_name,
              email: selectedGroup.leader_email || null,
              is_leader: true
            });
          }
          
          // Add co-leader if exists
          if (selectedGroup.co_leader_id && selectedGroup.co_leader_name) {
            allPeople.push({
              id: selectedGroup.co_leader_id,
              full_name: selectedGroup.co_leader_name,
              email: selectedGroup.co_leader_email || null,
              is_leader: true
            });
          }
          
          // Add all members
          if (selectedGroup.members) {
            selectedGroup.members.forEach(member => {
              // Don't duplicate if leader/co-leader is also in members list
              if (!allPeople.find(p => p.id === member.id)) {
                allPeople.push({
                  ...member,
                  is_leader: false
                });
              }
            });
          }
          
          // Initialize attendance for all people
          const allAttendance = allPeople.map(person => {
            const existing = existingAttendance.find(a => a.person_id === person.id);
            return existing || {
              person_id: person.id,
              present: false,
              notes: ''
            };
          });
          setAttendance(allAttendance);
        } else {
          // If we don't have selectedGroup yet, just use what we got
          setAttendance(data.attendance || []);
        }
      }
    } catch (err) {
      console.error('Error loading attendance:', err);
    }
  };

  const handleSubmitAttendance = async () => {
    if (!selectedMeeting) return;

    try {
      const attendanceData = attendance.map(att => ({
        person_id: att.person_id,
        present: att.present,
        notes: att.notes || ''
      }));

      const response = await fetch(
        `/api/connect-groups/meetings/${selectedMeeting.id}/attendance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            attendance: attendanceData,
            leader_email: email,
            access_code: accessCode
          })
        }
      );

      if (response.ok) {
        alert('Attendance submitted successfully! Attendance has been recorded in Heartbeat.');
        await loadGroupDetails(selectedGroup);
        setCurrentView('group-details');
        setSelectedMeeting(null);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to submit attendance');
      }
    } catch (err) {
      console.error('Error submitting attendance:', err);
      alert('Failed to submit attendance');
    }
  };

  const toggleAttendance = (personId) => {
    setAttendance(prev => prev.map(att => 
      att.person_id === personId 
        ? { ...att, present: !att.present }
        : att
    ));
  };

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8">
          <div className="text-center mb-8">
            <UserGroupIcon className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Connect Group Leader Portal</h1>
            <p className="text-slate-400">Log in to manage your connect group</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="your.email@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Access Code (if set)
              </label>
              <input
                type="password"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Enter access code"
              />
              <p className="mt-1 text-xs text-slate-400">
                Your group admin may have set an access code. If not, leave blank.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors font-medium"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-white hover:bg-slate-700/50 rounded-lg"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">Leader Portal</h1>
            <p className="text-xs text-slate-400">Connect Groups</p>
          </div>
        </div>
        <div className="px-3 py-1 bg-slate-700/30 rounded-lg">
          <p className="text-xs text-slate-400">Logged in as</p>
          <p className="text-sm font-medium text-white truncate max-w-[120px]">{email}</p>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar Navigation */}
      <div className={`fixed md:static inset-y-0 left-0 z-50 md:z-auto w-64 bg-slate-800/50 backdrop-blur-sm border-r border-slate-700/50 flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        {/* Logo/Header */}
        <div className="p-4 md:p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <UserGroupIcon className="w-6 h-6 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-white truncate">Leader Portal</h1>
              <p className="text-xs text-slate-400">Connect Groups</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-2 text-slate-400 hover:text-white"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-2 md:p-4 space-y-2 overflow-y-auto">
          <button
            onClick={() => {
              setSelectedGroup(null);
              setSelectedMeeting(null);
              setCurrentView('groups');
              setSidebarOpen(false); // Close sidebar on mobile when navigating
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              currentView === 'groups'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            <HomeIcon className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">My Groups</span>
          </button>

          {/* Group List */}
          {myGroups.map(group => (
            <button
              key={group.id}
              onClick={() => {
                loadGroupDetails(group);
                setSidebarOpen(false); // Close sidebar on mobile when selecting group
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                selectedGroup?.id === group.id
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              <UserGroupIcon className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{group.name}</div>
                <div className="text-xs text-slate-400 truncate">{group.campus}</div>
              </div>
            </button>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="p-2 md:p-4 border-t border-slate-700/50">
          <div className="mb-3 px-3 md:px-4 py-2 bg-slate-700/30 rounded-lg">
            <p className="text-xs text-slate-400 mb-1">Logged in as</p>
            <p className="text-sm font-medium text-white truncate">{email}</p>
          </div>
          <button
            onClick={() => {
              setLoggedIn(false);
              setMyGroups([]);
              setSelectedGroup(null);
              setSelectedMeeting(null);
              setCurrentView('groups');
              setEmail('');
              setAccessCode('');
              setSidebarOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
          >
            <ArrowLeftOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">Log Out</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-6xl mx-auto p-4 md:p-6">
          {/* Groups List */}
          {currentView === 'groups' && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {myGroups.map(group => (
              <div
                key={group.id}
                className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 md:p-6 hover:border-blue-500/50 transition-colors cursor-pointer touch-manipulation"
                onClick={() => loadGroupDetails(group)}
              >
                <h3 className="text-lg md:text-xl font-semibold text-white mb-3 md:mb-4">{group.name}</h3>
                <div className="space-y-2 text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                    <MapPinIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{group.campus}</span>
                  </div>
                  {group.meeting_day && group.meeting_time && (
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{group.meeting_day} {group.meeting_time}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <UserGroupIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span>{group.member_count || 0} members</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

          {/* Group Details & Meetings */}
          {currentView === 'group-details' && selectedGroup && (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 md:p-6">
            {/* Mobile Back Button */}
            <button
              onClick={() => {
                setSelectedGroup(null);
                setCurrentView('groups');
              }}
              className="md:hidden mb-4 flex items-center gap-2 text-blue-400 hover:text-blue-300"
            >
              <ArrowLeftOnRectangleIcon className="w-5 h-5 rotate-180" />
              <span>Back to Groups</span>
            </button>

            <div className="mb-4 md:mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-white">{selectedGroup.name}</h2>
            </div>

            {/* Group Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-xs md:text-sm text-slate-400">Campus</label>
                <p className="text-white text-sm md:text-base">{selectedGroup.campus}</p>
              </div>
              {selectedGroup.meeting_day && (
                <div>
                  <label className="text-xs md:text-sm text-slate-400">Meeting Schedule</label>
                  <p className="text-white text-sm md:text-base">
                    {selectedGroup.meeting_day} {selectedGroup.meeting_time || ''} ({selectedGroup.meeting_frequency || 'weekly'})
                  </p>
                </div>
              )}
              {selectedGroup.location && (
                <div className="md:col-span-2">
                  <label className="text-xs md:text-sm text-slate-400">Location</label>
                  <p className="text-white text-sm md:text-base">{selectedGroup.location}</p>
                </div>
              )}
            </div>

            {/* Members */}
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-base md:text-lg font-semibold text-white">
                  Members ({selectedGroup.members?.length || 0})
                </h3>
                <button
                  onClick={() => setShowAddMember(!showAddMember)}
                  className="flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm touch-manipulation w-full sm:w-auto"
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add Member
                </button>
              </div>

              {/* Add Member Section */}
              {showAddMember && (
                <div className="mb-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                  <div className="relative" ref={memberDropdownRef}>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Search and Select Person
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setShowMemberDropdown(!showMemberDropdown);
                        }}
                        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 flex items-center justify-between"
                      >
                        <span className={memberSearch ? 'text-white' : 'text-slate-400'}>
                          {memberSearch || 'Search for a person...'}
                        </span>
                        <ChevronDownIcon className="w-5 h-5 text-slate-400" />
                      </button>
                      
                      {showMemberDropdown && (
                        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-80 overflow-hidden">
                          {/* Search Input */}
                          <div className="p-2 border-b border-slate-600">
                            <div className="relative">
                              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={memberSearch}
                                onChange={(e) => setMemberSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                                autoFocus
                              />
                            </div>
                          </div>
                          
                          {/* Options List */}
                          <div className="max-h-64 overflow-y-auto">
                            {people
                              .filter(p => {
                                const notInGroup = !selectedGroup.members?.some(m => m.id === p.id);
                                const campusMatch = !selectedGroup.campus || selectedGroup.campus === 'all_campuses' || p.campus === selectedGroup.campus;
                                const searchMatch = !memberSearch || 
                                  p.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                                  (p.email && p.email.toLowerCase().includes(memberSearch.toLowerCase()));
                                return notInGroup && campusMatch && searchMatch;
                              })
                              .map(person => (
                                <button
                                  key={person.id}
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const response = await fetch(
                                        `/api/connect-groups/${selectedGroup.id}/members`,
                                        {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json'
                                          },
                                          credentials: 'include',
                                          body: JSON.stringify({ 
                                            person_id: person.id,
                                            leader_email: email,
                                            access_code: accessCode
                                          })
                                        }
                                      );
                                      if (response.ok) {
                                        await loadGroupDetails(selectedGroup);
                                        setShowAddMember(false);
                                        setMemberSearch('');
                                        setShowMemberDropdown(false);
                                        alert('Member added successfully!');
                                      } else {
                                        const data = await response.json();
                                        alert(data.error || 'Failed to add member');
                                      }
                                    } catch (err) {
                                      console.error('Error adding member:', err);
                                      alert('Failed to add member');
                                    }
                                  }}
                                  className="w-full px-4 py-2 text-left text-white hover:bg-slate-700 focus:bg-slate-700 focus:outline-none"
                                >
                                  <div className="font-medium">{person.full_name}</div>
                                  {person.email && (
                                    <div className="text-sm text-slate-400">{person.email}</div>
                                  )}
                                </button>
                              ))}
                            {people.filter(p => {
                              const notInGroup = !selectedGroup.members?.some(m => m.id === p.id);
                              const campusMatch = !selectedGroup.campus || selectedGroup.campus === 'all_campuses' || p.campus === selectedGroup.campus;
                              const searchMatch = !memberSearch || 
                                p.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                                (p.email && p.email.toLowerCase().includes(memberSearch.toLowerCase()));
                              return notInGroup && campusMatch && searchMatch;
                            }).length === 0 && (
                              <div className="px-4 py-3 text-slate-400 text-sm text-center">
                                No people found
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {selectedGroup.members && selectedGroup.members.length > 0 ? (
                <div className="space-y-2">
                  {selectedGroup.members.map(member => (
                    <div
                      key={member.id}
                      className="p-3 md:p-4 bg-slate-700/50 rounded-lg"
                    >
                      <p className="text-white font-medium text-sm md:text-base">{member.full_name}</p>
                      {member.email && (
                        <p className="text-xs md:text-sm text-slate-400 mt-1 truncate">{member.email}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm md:text-base text-slate-400">No members yet. Click "Add Member" to get started!</p>
              )}
            </div>

            {/* Meetings */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-base md:text-lg font-semibold text-white">Meetings</h3>
                <button
                  onClick={() => handleCreateMeeting(selectedGroup)}
                  className="flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm touch-manipulation w-full sm:w-auto"
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Create Meeting
                </button>
              </div>
              {selectedGroup.meetings && selectedGroup.meetings.length > 0 ? (
                <div className="space-y-3">
                  {selectedGroup.meetings
                    .sort((a, b) => new Date(b.meeting_date) - new Date(a.meeting_date))
                    .map(meeting => (
                      <div
                        key={meeting.id}
                        className="p-4 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-700 active:bg-slate-600 transition-colors touch-manipulation"
                        onClick={() => loadMeetingAttendance(meeting.id)}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-white font-medium text-base md:text-lg">
                              {new Date(meeting.meeting_date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </p>
                            <p className="text-sm text-slate-400 mt-1">
                              {meeting.attendance_count || 0} of {meeting.total_members || 0} present
                            </p>
                          </div>
                          <div className="flex items-center justify-end sm:justify-start">
                            <span className="text-blue-400 font-medium">
                              Take Attendance →
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-slate-400">No meetings yet. Create one to get started!</p>
              )}
            </div>
          </div>
        )}

          {/* Attendance Taking */}
          {currentView === 'attendance' && selectedMeeting && (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 md:mb-6">
              <div className="flex-1">
                <h2 className="text-xl md:text-2xl font-bold text-white">
                  Attendance - {new Date(selectedMeeting.meeting_date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </h2>
                <p className="text-sm md:text-base text-slate-400 mt-1">{selectedGroup.name}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedMeeting(null);
                  setAttendance([]);
                  setCurrentView('group-details');
                }}
                className="flex items-center gap-2 text-slate-400 hover:text-white px-4 py-2 rounded-lg hover:bg-slate-700/50 touch-manipulation w-full sm:w-auto justify-center sm:justify-start"
              >
                <ArrowLeftOnRectangleIcon className="w-5 h-5 rotate-180" />
                <span>Back to Group</span>
              </button>
            </div>

            {/* Attendance List */}
            <div className="space-y-2 mb-6">
              {(() => {
                // Create a list of all people (leaders + members) for attendance
                const allPeople = [];
                
                // Add leader if exists
                if (selectedGroup.leader_id && selectedGroup.leader_name) {
                  allPeople.push({
                    id: selectedGroup.leader_id,
                    full_name: selectedGroup.leader_name,
                    email: selectedGroup.leader_email || null,
                    is_leader: true,
                    role: 'Leader'
                  });
                }
                
                // Add co-leader if exists
                if (selectedGroup.co_leader_id && selectedGroup.co_leader_name) {
                  allPeople.push({
                    id: selectedGroup.co_leader_id,
                    full_name: selectedGroup.co_leader_name,
                    email: selectedGroup.co_leader_email || null,
                    is_leader: true,
                    role: 'Co-Leader'
                  });
                }
                
                // Add all members
                if (selectedGroup.members) {
                  selectedGroup.members.forEach(member => {
                    // Don't duplicate if leader/co-leader is also in members list
                    if (!allPeople.find(p => p.id === member.id)) {
                      allPeople.push({
                        ...member,
                        is_leader: false,
                        role: 'Member'
                      });
                    }
                  });
                }
                
                return allPeople.map(person => {
                  const personAttendance = attendance.find(a => a.person_id === person.id) || {
                    person_id: person.id,
                    present: false,
                    notes: ''
                  };
                  
                  return (
                    <div
                      key={person.id}
                      className={`p-4 rounded-lg border-2 transition-colors touch-manipulation ${
                        personAttendance.present
                          ? 'bg-emerald-500/10 border-emerald-500/50'
                          : 'bg-slate-700/50 border-slate-600/50'
                      }`}
                      onClick={() => toggleAttendance(person.id)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white font-medium text-base md:text-lg truncate">{person.full_name}</p>
                            {person.is_leader && (
                              <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded flex-shrink-0">
                                {person.role}
                              </span>
                            )}
                          </div>
                          {person.email && (
                            <p className="text-sm text-slate-400 truncate mt-1">{person.email}</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAttendance(person.id);
                          }}
                          className={`flex-shrink-0 p-3 rounded-lg transition-colors touch-manipulation ${
                            personAttendance.present
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-slate-600 text-slate-400'
                          }`}
                        >
                          {personAttendance.present ? (
                            <CheckCircleIcon className="w-6 h-6 md:w-7 md:h-7" />
                          ) : (
                            <XCircleIcon className="w-6 h-6 md:w-7 md:h-7" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Submit Button */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleSubmitAttendance}
                className="flex-1 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg transition-colors font-medium text-base touch-manipulation"
              >
                Submit Attendance
              </button>
              <button
                onClick={() => {
                  setSelectedMeeting(null);
                  setAttendance([]);
                  setCurrentView('group-details');
                }}
                className="px-6 py-3.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white rounded-lg transition-colors text-base touch-manipulation sm:w-auto w-full"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default ConnectGroupLeader;

