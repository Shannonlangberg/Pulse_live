import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  CalendarIcon, 
  UserGroupIcon, 
  ClockIcon, 
  Cog6ToothIcon, 
  DocumentDuplicateIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  UserPlusIcon,
  ClipboardDocumentListIcon,
  BuildingOfficeIcon,
  CheckIcon,
  XMarkIcon,
  QuestionMarkCircleIcon,
  MagnifyingGlassIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import PeopleAssignmentModal from './PeopleAssignmentModal';

const ServicePlanning = ({ planId }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedCampus, setSelectedCampus] = useState('all');
  const [campuses, setCampuses] = useState([]);
  const [teams, setTeams] = useState([]);
  const [people, setPeople] = useState([]);
  const [servicePlan, setServicePlan] = useState({
    title: 'Plan Title',
    campus: '',
    date: new Date(),
    serviceTimes: [],
    rehearsalTimes: [],
    teams: [],
    notes: '',
    micAllocation: []
  });
  const [activeTab, setActiveTab] = useState('teams');
  const [showAddPeople, setShowAddPeople] = useState(false);
  const [showImportTemplate, setShowImportTemplate] = useState(false);
  const [showTeamActions, setShowTeamActions] = useState(false);
  const [showQuickAssign, setShowQuickAssign] = useState(false);
  const [showAutoSchedule, setShowAutoSchedule] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState({ teamId: null, roleName: null });
  const [templates, setTemplates] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [emailData, setEmailData] = useState({ subject: '', message: '', recipients: [] });
  const [chatData, setChatData] = useState({ message: '', recipients: [] });
  const [editMode, setEditMode] = useState(true);

  useEffect(() => {
    fetchData();
  }, [planId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchCampuses(),
        fetchTeams(),
        fetchPeople(),
        fetchTemplates(),
        fetchServicePlan()
      ]);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampuses = async () => {
    try {
      const response = await fetch('/api/campuses');
      if (response.ok) {
        const data = await response.json();
        setCampuses(data.campuses || []);
      }
    } catch (err) {
      console.error('Error fetching campuses:', err);
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/serving/teams');
      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams || []);
      }
    } catch (err) {
      console.error('Error fetching teams:', err);
    }
  };

  const fetchPeople = async () => {
    try {
      const response = await fetch('/api/people');
      if (response.ok) {
        const data = await response.json();
        setPeople(data.people || []);
      }
    } catch (err) {
      console.error('Error fetching people:', err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/serving/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
      // Fallback to mock data
      setTemplates([
        {
          id: 1,
          name: 'Sunday Service - Standard',
          description: 'Standard Sunday service template with worship, message, and hospitality',
          campus: 'Futures Copper Coast',
          serviceType: 'Sunday Service',
          duration: '90 minutes',
          teams: [
            {
              id: 1,
              name: 'Worship Team',
              roles: [
                { name: 'LEAD VOCAL', needed: 1, assigned: [] },
                { name: 'BACKUP VOCAL', needed: 2, assigned: [] },
                { name: 'GUITAR', needed: 1, assigned: [] },
                { name: 'KEYS', needed: 1, assigned: [] }
              ]
            },
            {
              id: 2,
              name: 'Hosting Team',
              roles: [
                { name: 'WELCOME', needed: 1, assigned: [] },
                { name: 'ANNOUNCEMENTS', needed: 1, assigned: [] },
                { name: 'PRAYER', needed: 1, assigned: [] }
              ]
            }
          ],
          teamsCount: 2,
          serviceTimes: [{ day: 'Su', time: '10:00am', date: '17/08' }],
          rehearsalTimes: [{ day: 'Sa', time: '6:00pm', date: '16/08' }],
          notes: 'Standard Sunday service setup'
        },
        {
          id: 2,
          name: 'Youth Service',
          description: 'Youth-focused service with contemporary worship and interactive elements',
          campus: 'Futures Mt Barker',
          serviceType: 'Youth Service',
          duration: '75 minutes',
          teams: [
            {
              id: 3,
              name: 'Youth Worship',
              roles: [
                { name: 'YOUTH LEAD VOCAL', needed: 1, assigned: [] },
                { name: 'YOUTH GUITAR', needed: 1, assigned: [] },
                { name: 'YOUTH DRUMS', needed: 1, assigned: [] }
              ]
            }
          ],
          teamsCount: 1,
          serviceTimes: [{ day: 'Fr', time: '7:00pm', date: '15/08' }],
          rehearsalTimes: [],
          notes: 'Youth service with contemporary music'
        }
      ]);
    }
  };

  const fetchServicePlan = async () => {
    if (planId) {
      // Fetch specific plan data based on planId
      try {
        // Mock data for specific plans - would come from API
        const planData = {
          1: {
            title: 'Sunday Service - Worship Focus',
            campus: 'Futures Copper Coast',
            date: new Date('2025-08-17'),
            serviceTimes: [{ day: 'Su', time: '10:00am', date: '17/08' }],
            rehearsalTimes: [{ day: 'Sa', time: '9:00am', date: '16/08' }],
            teams: [
              {
                id: 1,
                name: 'Worship Team',
                confirmed: 4,
                declined: 1,
                pending: 2,
                roles: [
                  { name: 'LEAD VOCAL', needed: 0, assigned: [{ id: 1, name: 'Sarah Johnson', initials: 'SJ' }] },
                  { name: 'BACKUP VOCAL', needed: 1, assigned: [{ id: 2, name: 'Mike Chen', initials: 'MC' }] },
                  { name: 'GUITAR', needed: 0, assigned: [{ id: 3, name: 'David Wilson', initials: 'DW' }] },
                  { name: 'KEYS', needed: 0, assigned: [{ id: 4, name: 'Lisa Thompson', initials: 'LT' }] },
                  { name: 'BASS', needed: 0, assigned: [{ id: 5, name: 'Harry Kohler', initials: 'HK' }] },
                  { name: 'DRUMS', needed: 1, assigned: [] }
                ]
              },
              {
                id: 2,
                name: 'Hosting Team',
                confirmed: 3,
                declined: 0,
                pending: 2,
                roles: [
                  { name: 'WELCOME', needed: 0, assigned: [{ id: 6, name: 'Emma Davis', initials: 'ED' }] },
                  { name: 'ANNOUNCEMENTS', needed: 0, assigned: [{ id: 7, name: 'James Brown', initials: 'JB' }] },
                  { name: 'PRAYER', needed: 0, assigned: [{ id: 8, name: 'Maria Garcia', initials: 'MG' }] },
                  { name: 'COMMUNION', needed: 1, assigned: [] },
                  { name: 'GIVING HOST', needed: 1, assigned: [] }
                ]
              },
              {
                id: 3,
                name: 'Technical Team',
                confirmed: 2,
                declined: 0,
                pending: 1,
                roles: [
                  { name: 'SOUND ENGINEER', needed: 0, assigned: [{ id: 9, name: 'Alex Turner', initials: 'AT' }] },
                  { name: 'LIGHTING', needed: 0, assigned: [{ id: 10, name: 'Chris Lee', initials: 'CL' }] },
                  { name: 'VIDEO', needed: 1, assigned: [] }
                ]
              }
            ],
            notes: 'Focus on contemporary worship with full band setup. Special emphasis on new worship songs. Need backup vocalists for harmonies.',
            micAllocation: ['Lead Vocal', 'Backup Vocal', 'Guitar', 'Keys', 'Bass', 'Drums']
          },
          2: {
            title: 'Sunday Service - Communion',
            campus: 'Futures Copper Coast',
            date: new Date('2025-08-24'),
            serviceTimes: [{ day: 'Su', time: '10:00am', date: '24/08' }],
            rehearsalTimes: [],
            teams: [
              {
                id: 1,
                name: 'Worship Team',
                confirmed: 3,
                declined: 0,
                pending: 2,
                roles: [
                  { name: 'ACOUSTIC GUITAR', needed: 0, assigned: [{ id: 1, name: 'Sarah Johnson', initials: 'SJ' }] },
                  { name: 'PIANO', needed: 0, assigned: [{ id: 2, name: 'Mike Chen', initials: 'MC' }] },
                  { name: 'LEAD VOCAL', needed: 0, assigned: [{ id: 3, name: 'David Wilson', initials: 'DW' }] },
                  { name: 'BACKUP VOCAL', needed: 1, assigned: [] },
                  { name: 'CAJON', needed: 1, assigned: [] }
                ]
              },
              {
                id: 2,
                name: 'Hosting Team',
                confirmed: 2,
                declined: 0,
                pending: 3,
                roles: [
                  { name: 'WELCOME', needed: 0, assigned: [{ id: 4, name: 'Emma Davis', initials: 'ED' }] },
                  { name: 'COMMUNION LEADER', needed: 0, assigned: [{ id: 5, name: 'James Brown', initials: 'JB' }] },
                  { name: 'PRAYER', needed: 1, assigned: [] },
                  { name: 'GIVING HOST', needed: 1, assigned: [] },
                  { name: 'USHERS', needed: 1, assigned: [] }
                ]
              }
            ],
            notes: 'Communion service with acoustic worship setup. Intimate atmosphere with focus on reflection and prayer.',
            micAllocation: ['Acoustic Guitar', 'Piano', 'Lead Vocal', 'Backup Vocal']
          }
        };

        const plan = planData[planId];
        if (plan) {
          setServicePlan(plan);
          setSelectedDate(plan.date);
          setSelectedCampus(plan.campus);
        }
      } catch (err) {
        console.error('Error fetching plan:', err);
      }
    } else {
      // Default mock data for now - would come from API
      setServicePlan({
        title: 'Plan Title',
        campus: 'Futures Copper Coast',
        date: new Date(),
        serviceTimes: [{ day: 'Su', time: '10:00am', date: '17/08' }],
        rehearsalTimes: [],
        teams: [
          {
            id: 1,
            name: 'Connections Team',
            confirmed: 0,
            declined: 0,
            pending: 5,
            roles: [
              { name: 'CONNECTIONS TEAM', needed: 4, assigned: [] },
              { name: 'CONNECTIONS TEAM LEADER', needed: 1, assigned: [] }
            ]
          },
          {
            id: 2,
            name: 'Hospitality',
            confirmed: 0,
            declined: 0,
            pending: 2,
            roles: [
              { name: 'CAFE', needed: 1, assigned: [] },
              { name: 'CAFE LEADER', needed: 1, assigned: [] }
            ]
          },
          {
            id: 3,
            name: 'Hosting Team',
            confirmed: 0,
            declined: 0,
            pending: 6,
            roles: [
              { name: 'AUDITORIUM', needed: 5, assigned: [] },
              { name: 'AUDITORIUM TEAM LEADER', needed: 1, assigned: [] }
            ]
          },
          {
            id: 4,
            name: 'Musicians',
            confirmed: 0,
            declined: 0,
            pending: 8,
            roles: [
              { name: 'BASS', needed: 0, assigned: [{ id: 1, name: 'Harry Kohler', initials: 'HK' }] },
              { name: 'DRUMS', needed: 1, assigned: [] },
              { name: 'GUITAR (ACOUSTIC)', needed: 0, assigned: [{ id: 2, name: 'Andrew Rawlins', initials: 'AR' }] },
              { name: 'GUITAR (LEAD)', needed: 1, assigned: [] },
              { name: 'KEYS 1', needed: 1, assigned: [] },
              { name: 'MUSIC DIRECTOR', needed: 1, assigned: [] },
              { name: 'TRACKS', needed: 1, assigned: [] }
            ]
          },
          {
            id: 5,
            name: 'Photography',
            confirmed: 0,
            declined: 0,
            pending: 2,
            roles: [
              { name: 'PHOTOGRAPHER', needed: 1, assigned: [] },
              { name: 'SOCIAL MEDIA', needed: 1, assigned: [] }
            ]
          },
          {
            id: 6,
            name: 'Platform',
            confirmed: 0,
            declined: 0,
            pending: 0,
            roles: [
              { name: 'COMMUNION', needed: 2, assigned: [] },
              { name: 'GIVING HOST', needed: 1, assigned: [] },
              { name: 'MEETING LEADER', needed: 1, assigned: [] },
              { name: 'PRAYER', needed: 1, assigned: [] },
              { name: 'PRE-SERVICE', needed: 1, assigned: [] },
              { name: 'PREACHER', needed: 1, assigned: [] },
              { name: 'WELCOME', needed: 1, assigned: [] }
            ]
          }
        ],
        notes: '',
        micAllocation: []
      });
    }
  };

  // Core Functionality Functions
  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setSelectedDate(newDate);
    // TODO: Fetch service plan for new date
  };

  const handleImportTemplate = async (templateId) => {
    try {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        setServicePlan(prev => ({
          ...prev,
          teams: template.teams || prev.teams,
          serviceTimes: template.serviceTimes || prev.serviceTimes,
          rehearsalTimes: template.rehearsalTimes || prev.rehearsalTimes,
          notes: template.notes || prev.notes
        }));
        setShowImportTemplate(false);
      }
    } catch (err) {
      console.error('Error importing template:', err);
    }
  };

  const handleAutoSchedule = async () => {
    try {
      const availablePeople = people.filter(p => !p.is_assigned);
      const neededPositions = servicePlan.teams.flatMap(team => 
        team.roles.filter(role => role.needed > 0)
      );

      neededPositions.forEach(position => {
        const suitablePerson = availablePeople.find(p => 
          p.skills?.some(skill => 
            position.name.toLowerCase().includes(skill.toLowerCase())
          )
        );
        if (suitablePerson) {
          assignPersonToRole(position.teamId, position.name, suitablePerson);
          suitablePerson.is_assigned = true;
        }
      });

      setShowAutoSchedule(false);
    } catch (err) {
      console.error('Error auto-scheduling:', err);
    }
  };

  const handleQuickAssign = async () => {
    try {
      const openPositions = servicePlan.teams.flatMap(team => 
        team.roles.filter(role => role.needed > 0)
      );
      
      if (openPositions.length > 0) {
        setShowQuickAssign(true);
      }
    } catch (err) {
      console.error('Error quick assigning:', err);
    }
  };

  const assignPersonToRole = (teamId, roleName, person) => {
    setServicePlan(prev => ({
      ...prev,
      teams: prev.teams.map(team => {
        if (team.id === teamId) {
          return {
            ...team,
            roles: team.roles.map(role => {
              if (role.name === roleName) {
                return {
                  ...role,
                  assigned: [...role.assigned, person],
                  needed: Math.max(0, role.needed - 1)
                };
              }
              return role;
            })
          };
        }
        return team;
      })
    }));
  };

  const removePersonFromRole = (teamId, roleName, personId) => {
    setServicePlan(prev => ({
      ...prev,
      teams: prev.teams.map(team => {
        if (team.id === teamId) {
          return {
            ...team,
            roles: team.roles.map(role => {
              if (role.name === roleName) {
                return {
                  ...role,
                  assigned: role.assigned.filter(p => p.id !== personId),
                  needed: role.needed + 1
                };
              }
              return role;
            })
          };
        }
        return team;
      })
    }));
  };

  const renderTeamsTab = () => (
    <div className="flex space-x-6">
      {/* Left Panel - Times, Files, Notes */}
      <div className="w-80 space-y-4">
        {/* Times Section */}
        <div className="bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white">Times</h3>
            <button className="text-blue-400 hover:text-blue-300">
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
          
          <div className="space-y-2">
            <div className="bg-slate-700 rounded p-2">
              <div className="text-sm font-medium text-white">SERVICE TIMES</div>
              <div className="text-sm text-slate-300">Su 10:00am 17/08</div>
            </div>
            
            <div className="bg-slate-700 rounded p-2">
              <div className="text-sm font-medium text-white">REHEARSAL TIMES</div>
              <div className="text-sm text-slate-400">No rehearsals scheduled</div>
            </div>
          </div>
        </div>

        {/* Files Section */}
        <div className="bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white">Files</h3>
            <button className="text-blue-400 hover:text-blue-300">
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-slate-400">There are no files for this plan.</p>
        </div>

        {/* Notes Section */}
        <div className="bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white">Notes</h3>
            <button className="text-blue-400 hover:text-blue-300">
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
          
          <div className="space-y-2">
            <div className="bg-slate-700 rounded p-2">
              <div className="text-sm font-medium text-white">MIC ALLOCATION</div>
              <div className="text-xs text-slate-300 space-y-1">
                <div>1: </div>
                <div>2: </div>
                <div>3: </div>
                <div>4: </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Teams */}
      <div className="flex-1">
        <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700">
          <div className="p-4 border-b border-slate-600">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Teams</h3>
              <div className="flex items-center space-x-2">
                <button className="text-slate-400 hover:text-slate-300 hover:bg-slate-700 rounded p-1">
                  <FunnelIcon className="h-5 w-5" />
                </button>
                <button className="text-slate-400 hover:text-slate-300 hover:bg-slate-700 rounded p-1">
                  <MagnifyingGlassIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Summary */}
          <div className="p-4 border-b border-slate-600 bg-slate-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6 text-sm">
                <span className="text-slate-300">
                  <span className="font-medium text-green-400">{servicePlan.teams.reduce((sum, team) => sum + team.confirmed, 0)}</span> Confirmed
                </span>
                <span className="text-slate-300">
                  <span className="font-medium text-red-400">{servicePlan.teams.reduce((sum, team) => sum + team.declined, 0)}</span> Declined
                </span>
                <span className="text-slate-300">
                  <span className="font-medium text-yellow-400">{servicePlan.teams.reduce((sum, team) => sum + team.pending, 0)}</span> Pending
                </span>
                <span className="text-slate-300">
                  <span className="font-medium text-blue-400">
                    {servicePlan.teams.reduce((sum, team) => 
                      sum + team.roles.reduce((roleSum, role) => roleSum + role.needed, 0), 0
                    )}
                  </span> Positions Needed
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={handleQuickAssign}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                  Quick Assign
                </button>
                <button 
                  onClick={() => setShowAddPeople(true)}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                >
                  Add People
                </button>
                <button 
                  onClick={() => setShowAutoSchedule(true)}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
                >
                  Auto Schedule
                </button>
              </div>
            </div>
          </div>

          {/* Teams Grid - Cleaner Layout */}
          <div className="p-6">
            <div className="grid grid-cols-3 gap-6">
              {servicePlan.teams.map((team) => (
                <div key={team.id} className="border border-slate-600 rounded-lg p-4 bg-slate-700/30 min-h-[200px]">
                  {/* Team Header - Compact */}
                  <div className="text-center mb-4 pb-3 border-b border-slate-600">
                    <h4 className="font-semibold text-white text-sm mb-2">{team.name}</h4>
                    <div className="flex items-center justify-center space-x-3 text-xs">
                      <span className="flex items-center text-green-400">
                        <CheckIcon className="h-3 w-3 mr-1" />
                        {team.confirmed}
                      </span>
                      <span className="flex items-center text-red-400">
                        <XMarkIcon className="h-3 w-3 mr-1" />
                        {team.declined}
                      </span>
                      <span className="flex items-center text-yellow-400">
                        <QuestionMarkCircleIcon className="h-3 w-3 mr-1" />
                        {team.pending}
                      </span>
                    </div>
                  </div>

                  {/* Roles - Compact List */}
                  <div className="space-y-2">
                    {team.roles.map((role, roleIndex) => (
                      <div key={roleIndex} className="text-xs">
                        {/* Role Header */}
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-slate-200 truncate">{role.name}</span>
                          {role.needed > 0 ? (
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => {
                                  const updatedTeams = servicePlan.teams.map(t => {
                                    if (t.id === team.id) {
                                      const updatedRoles = t.roles.map(r => {
                                        if (r.name === role.name) {
                                          return { ...r, needed: Math.max(0, r.needed - 1) };
                                        }
                                        return r;
                                      });
                                      return { ...t, roles: updatedRoles };
                                    }
                                    return t;
                                  });
                                  setServicePlan(prev => ({ ...prev, teams: updatedTeams }));
                                }}
                                className="w-5 h-5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-full flex items-center justify-center transition-colors flex-shrink-0 hover:scale-110 active:scale-95"
                                title="Decrease needed count"
                              >
                                -
                              </button>
                              <span className="bg-red-900/50 text-red-300 px-2 py-1 rounded text-xs whitespace-nowrap border border-red-700 min-w-[3rem] text-center font-medium">
                                {role.needed} Needed
                              </span>
                              <button
                                onClick={() => {
                                  const updatedTeams = servicePlan.teams.map(t => {
                                    if (t.id === team.id) {
                                      const updatedRoles = t.roles.map(r => {
                                        if (r.name === role.name) {
                                          return { ...r, needed: r.needed + 1 };
                                        }
                                        return r;
                                      });
                                      return { ...t, roles: updatedRoles };
                                    }
                                    return t;
                                  });
                                  setServicePlan(prev => ({ ...prev, teams: updatedTeams }));
                                }}
                                className="w-5 h-5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-full flex items-center justify-center transition-colors flex-shrink-0 hover:scale-110 active:scale-95"
                                title="Increase needed count"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                const updatedTeams = servicePlan.teams.map(t => {
                                  if (t.id === team.id) {
                                    const updatedRoles = t.roles.map(r => {
                                      if (r.name === role.name) {
                                        return { ...r, needed: 1 };
                                      }
                                      return r;
                                    });
                                    return { ...t, roles: updatedRoles };
                                  }
                                  return t;
                                });
                                setServicePlan(prev => ({ ...prev, teams: updatedTeams }));
                              }}
                              className="px-2 py-1 text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-600 rounded border border-dashed border-slate-500 transition-colors hover:scale-105 active:scale-95"
                              title="Add needed position"
                            >
                              + Add Need
                            </button>
                          )}
                        </div>
                        
                        {/* Assigned People - Compact */}
                        {role.assigned.length > 0 && (
                          <div className="space-y-1 mb-2">
                            {role.assigned.map((person) => (
                              <div key={person.id} className="flex items-center justify-between p-1 bg-blue-900/30 rounded text-xs border border-blue-700/50">
                                <div className="flex items-center space-x-1 min-w-0">
                                  <span className="w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0">
                                    {person.initials}
                                  </span>
                                  <span className="text-slate-200 truncate">{person.name}</span>
                                </div>
                                <button
                                  onClick={() => removePersonFromRole(team.id, role.name, person.id)}
                                  className="text-red-400 hover:text-red-300 flex-shrink-0"
                                >
                                  <XMarkIcon className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Person Button - Only show if needed */}
                        {role.needed > 0 && (
                          <button
                            onClick={() => {
                              setSelectedAssignment({ teamId: team.id, roleName: role.name });
                              setShowAddPeople(true);
                            }}
                            className="w-full p-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded border border-dashed border-blue-600 transition-colors"
                          >
                            + Add Person
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Team Actions - Bottom */}
                  <div className="mt-4 pt-3 border-t border-slate-600">
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => {
                          setSelectedAssignment({ teamId: team.id, roleName: null });
                          setShowAddPeople(true);
                        }}
                        className="px-3 py-2 text-xs bg-green-600 hover:bg-green-700 rounded text-white transition-colors"
                      >
                        Add People
                      </button>
                      <button 
                        onClick={() => {
                          // TODO: Open team management modal
                          alert('Team management coming soon!');
                        }}
                        className="px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 rounded text-white transition-colors"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderOrderTab = () => (
    <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Service Order</h3>
      
      {/* Service Timeline */}
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <div className="w-24 text-sm text-slate-400">9:00 AM</div>
          <div className="flex-1 p-3 bg-slate-700/50 rounded-lg border border-slate-600">
            <div className="flex items-center justify-between">
              <span className="font-medium text-white">Pre-Service Prayer</span>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">5 min</span>
                <button className="text-slate-400 hover:text-red-400">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-2 text-sm text-slate-300">Team: Prayer Team</div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="w-24 text-sm text-slate-400">9:05 AM</div>
          <div className="flex-1 p-3 bg-slate-700/50 rounded-lg border border-slate-600">
            <div className="flex items-center justify-between">
              <span className="font-medium text-white">Welcome & Announcements</span>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">3 min</span>
                <button className="text-slate-400 hover:text-red-400">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-2 text-sm text-slate-300">Team: Hosting Team</div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="w-24 text-sm text-slate-400">9:08 AM</div>
          <div className="flex-1 p-3 bg-slate-700/50 rounded-lg border border-slate-600">
            <div className="flex items-center justify-between">
              <span className="font-medium text-white">Worship</span>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">5 min</span>
                <button className="text-slate-400 hover:text-red-400">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-2 text-sm text-slate-300">Team: Worship Team</div>
          </div>
        </div>
      </div>

      {/* Add New Element */}
      <div className="mt-6 p-4 border-2 border-dashed border-slate-600 rounded-lg text-center">
        <button className="text-slate-400 hover:text-slate-300 transition-colors">
          <PlusIcon className="h-6 w-6 mx-auto mb-2" />
          <span>Add Service Element</span>
        </button>
      </div>
    </div>
  );

  const renderRehearseTab = () => (
    <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Rehearsal Schedule</h3>
      <p className="text-slate-400">No rehearsals scheduled for this service.</p>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'order':
        return renderOrderTab();
      case 'teams':
        return renderTeamsTab();
      case 'rehearse':
        return renderRehearseTab();
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{servicePlan.title}</h1>
            <p className="text-slate-400">{servicePlan.campus}</p>
          </div>
          
          {/* Date Navigation */}
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigateDate('prev')}
              className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-700 rounded transition-colors"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium">
              {selectedDate.toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: 'long', 
                year: 'numeric' 
              })}
            </button>
            <button 
              onClick={() => navigateDate('next')}
              className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-700 rounded transition-colors"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Edit Mode Toggle & Team Actions */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-400">Edit Mode:</span>
              <button
                onClick={() => setEditMode(!editMode)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  editMode 
                    ? 'bg-green-600 text-white' 
                    : 'bg-slate-600 text-slate-300'
                }`}
              >
                {editMode ? 'ON' : 'OFF'}
              </button>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowTeamActions(!showTeamActions)}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                Team actions
              </button>
            
            {showTeamActions && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-700 rounded-lg shadow-lg border border-slate-600 z-10">
                <div className="py-1">
                  <button 
                    onClick={() => setShowAddPeople(true)}
                    className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-600 hover:text-white"
                  >
                    Add People
                  </button>
                  <button 
                    onClick={() => setShowImportTemplate(true)}
                    className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-600 hover:text-white"
                  >
                    Import Template
                  </button>
                  <button 
                    onClick={() => {
                      // Show needed positions summary
                      const totalNeeded = servicePlan.teams.reduce((sum, team) => 
                        sum + team.roles.reduce((roleSum, role) => roleSum + role.needed, 0), 0
                      );
                      alert(`${totalNeeded} positions still need to be filled`);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-600 hover:text-white"
                  >
                    Needed Positions
                  </button>
                  <button 
                    onClick={() => setShowAutoSchedule(true)}
                    className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-600 hover:text-white"
                  >
                    Auto-Schedule
                  </button>
                  <button 
                    onClick={() => setShowEmailModal(true)}
                    className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-600 hover:text-white"
                  >
                    Email
                  </button>
                  <button 
                    onClick={() => setShowChatModal(true)}
                    className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-600 hover:text-white"
                  >
                    Chat
                  </button>
                  <button 
                    onClick={() => setShowAttendanceModal(true)}
                    className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-600 hover:text-white"
                  >
                    Take Attendance
                  </button>
                  <button 
                    onClick={() => setShowBulkEdit(true)}
                    className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-600 hover:text-white"
                  >
                    Bulk Edit
                  </button>
                  <button 
                    onClick={() => {
                      // Navigate to team management
                      window.location.href = '/serving?tab=teams';
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-600 hover:text-white"
                  >
                    Manage Teams
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-600">
          <nav className="flex space-x-8">
            {[
              { id: 'order', name: 'Order', icon: ClipboardDocumentListIcon },
              { id: 'teams', name: 'Teams', icon: UserGroupIcon },
              { id: 'rehearse', name: 'Rehearse', icon: ClockIcon }
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? 'border-green-500 text-green-400'
                      : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {renderTabContent()}
      </div>

      {/* Add People Modal */}
      <PeopleAssignmentModal
        isOpen={showAddPeople}
        onClose={() => {
          setShowAddPeople(false);
          setSelectedAssignment({ teamId: null, roleName: null });
        }}
        onAssign={(person) => {
          if (selectedAssignment.teamId && selectedAssignment.roleName) {
            assignPersonToRole(selectedAssignment.teamId, selectedAssignment.roleName, person);
          }
        }}
        teamId={selectedAssignment.teamId}
        roleName={selectedAssignment.roleName}
        currentAssignments={servicePlan.teams
          .find(t => t.id === selectedAssignment.teamId)
          ?.roles.find(r => r.name === selectedAssignment.roleName)
          ?.assigned || []}
        campus={servicePlan.campus}
      />

      {/* Import Template Modal */}
      {showImportTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-700">
            <div className="flex items-center justify-between p-6 border-b border-slate-600">
              <h2 className="text-xl font-semibold text-white">Import Service Template</h2>
              <button
                onClick={() => setShowImportTemplate(false)}
                className="text-slate-400 hover:text-slate-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <div key={template.id} className="border border-slate-600 rounded-lg p-4 bg-slate-700/30">
                    <h3 className="font-semibold text-white mb-2">{template.name}</h3>
                    <p className="text-slate-300 text-sm mb-3">{template.description}</p>
                    <div className="text-xs text-slate-400 mb-3">
                      <div>Campus: {template.campus}</div>
                      <div>Teams: {template.teamsCount}</div>
                      <div>Duration: {template.duration}</div>
                    </div>
                    <button
                      onClick={() => handleImportTemplate(template.id)}
                      className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                    >
                      Import Template
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Schedule Modal */}
      {showAutoSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md border border-slate-700">
            <div className="flex items-center justify-between p-6 border-b border-slate-600">
              <h2 className="text-xl font-semibold text-white">Auto-Schedule</h2>
              <button
                onClick={() => setShowAutoSchedule(false)}
                className="text-slate-400 hover:text-slate-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-slate-300 mb-4">
                This will automatically assign available people to open positions based on their skills and availability.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={handleAutoSchedule}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Run Auto-Schedule
                </button>
                <button
                  onClick={() => setShowAutoSchedule(false)}
                  className="px-4 py-2 text-slate-300 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl border border-slate-700">
            <div className="flex items-center justify-between p-6 border-b border-slate-600">
              <h2 className="text-xl font-semibold text-white">Send Email</h2>
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-slate-400 hover:text-slate-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Subject</label>
                <input
                  type="text"
                  value={emailData.subject}
                  onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Service reminder for Sunday"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Message</label>
                <textarea
                  value={emailData.message}
                  onChange={(e) => setEmailData(prev => ({ ...prev, message: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Hi team, just a reminder about Sunday's service..."
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    // TODO: Send email
                    alert('Email sent! (Mock functionality)');
                    setShowEmailModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Send Email
                </button>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="px-4 py-2 text-slate-300 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {showChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md border border-slate-700">
            <div className="flex items-center justify-between p-6 border-b border-slate-600">
              <h2 className="text-xl font-semibold text-white">Send Team Message</h2>
              <button
                onClick={() => setShowChatModal(false)}
                className="text-slate-400 hover:text-slate-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Message</label>
                <textarea
                  value={chatData.message}
                  onChange={(e) => setChatData(prev => ({ ...prev, message: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Quick update for the team..."
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    // TODO: Send chat message
                    alert('Message sent! (Mock functionality)');
                    setShowChatModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Send Message
                </button>
                <button
                  onClick={() => setShowChatModal(false)}
                  className="px-4 py-2 text-slate-300 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-700">
            <div className="flex items-center justify-between p-6 border-b border-slate-600">
              <h2 className="text-xl font-semibold text-white">Take Attendance</h2>
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="text-slate-400 hover:text-slate-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {servicePlan.teams.map((team) => (
                  <div key={team.id} className="border border-slate-600 rounded-lg p-4 bg-slate-700/30">
                    <h3 className="font-semibold text-white mb-3">{team.name}</h3>
                    <div className="space-y-2">
                      {team.roles.map((role) => (
                        <div key={role.name} className="flex items-center justify-between">
                          <span className="text-slate-300 text-sm">{role.name}</span>
                          <div className="flex space-x-2">
                            {role.assigned.map((person) => (
                              <div key={person.id} className="flex items-center space-x-2">
                                <span className="text-slate-300 text-xs">{person.name}</span>
                                <select
                                  value={attendanceData[person.id] || 'present'}
                                  onChange={(e) => setAttendanceData(prev => ({ ...prev, [person.id]: e.target.value }))}
                                  className="text-xs bg-slate-700 border border-slate-600 rounded text-slate-300"
                                >
                                  <option value="present">Present</option>
                                  <option value="absent">Absent</option>
                                  <option value="late">Late</option>
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    // TODO: Save attendance
                    alert('Attendance saved! (Mock functionality)');
                    setShowAttendanceModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Save Attendance
                </button>
                <button
                  onClick={() => setShowAttendanceModal(false)}
                  className="px-4 py-2 text-slate-300 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl border border-slate-700">
            <div className="flex items-center justify-between p-6 border-b border-slate-600">
              <h2 className="text-xl font-semibold text-white">Bulk Edit</h2>
              <button
                onClick={() => setShowBulkEdit(false)}
                className="text-slate-400 hover:text-slate-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Bulk Action</label>
                <select className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500">
                  <option>Select Action</option>
                  <option>Mark all as confirmed</option>
                  <option>Mark all as declined</option>
                  <option>Send reminder to all</option>
                  <option>Change service time</option>
                </select>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    // TODO: Apply bulk action
                    alert('Bulk action applied! (Mock functionality)');
                    setShowBulkEdit(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Apply Action
                </button>
                <button
                  onClick={() => setShowBulkEdit(false)}
                  className="px-4 py-2 text-slate-300 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Assign Modal */}
      {showQuickAssign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl border border-slate-700">
            <div className="flex items-center justify-between p-6 border-b border-slate-600">
              <h2 className="text-xl font-semibold text-white">Quick Assign</h2>
              <button
                onClick={() => setShowQuickAssign(false)}
                className="text-slate-400 hover:text-slate-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-slate-300 mb-4">
                Quickly assign people to open positions. This will show all available people and let you assign them quickly.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    handleAutoSchedule();
                    setShowQuickAssign(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Auto-Assign All
                </button>
                <button
                  onClick={() => setShowQuickAssign(false)}
                  className="px-4 py-2 text-slate-300 bg-slate-700 hover:bg-slate-700 rounded transition-colors"
                >
                  Cancel
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

export default ServicePlanning;
