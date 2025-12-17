import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  CalendarIcon, 
  UserGroupIcon, 
  ClockIcon, 
  Cog6ToothIcon, 
  DocumentDuplicateIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  UserPlusIcon,
  ClipboardDocumentListIcon,
  BuildingOfficeIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import ServicePlanning from './ServicePlanning';
import TemplateManagement from './TemplateManagement';
import PlanManagement from './PlanManagement';

const ServingManagement = () => {
  const [activeTab, setActiveTab] = useState('teams');
  const [selectedCampus, setSelectedCampus] = useState('all');
  const [campuses, setCampuses] = useState([]);
  const [teams, setTeams] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [teamFormData, setTeamFormData] = useState({
    name: '',
    description: '',
    campus: '',
    department: '',
    team_type: 'ministry',
    ministry_group: '',
    meeting_schedule: '',
    max_members: '',
    is_active: true,
    background_check_required: false
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Check URL parameters on component mount and when URL changes
  useEffect(() => {
    const checkUrlParams = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const planId = urlParams.get('planId');
      const tab = urlParams.get('tab');
      
      console.log('URL params:', { planId, tab }); // Debug logging
      
      if (planId && tab === 'planning') {
        console.log('Switching to planning tab'); // Debug logging
        setActiveTab('planning');
      }
    };

    // Check on mount
    checkUrlParams();

    // Listen for URL changes
    const handleUrlChange = () => {
      checkUrlParams();
    };

    window.addEventListener('popstate', handleUrlChange);
    
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchCampuses(),
        fetchTeams(),
        fetchSchedules(),
        fetchTemplates()
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

  const fetchSchedules = async () => {
    try {
      const response = await fetch('/api/serving/schedule');
      if (response.ok) {
        const data = await response.json();
        setSchedules(data.schedules || []);
      }
    } catch (err) {
      console.error('Error fetching schedules:', err);
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
    }
  };

  const getFilteredTeams = () => {
    if (selectedCampus === 'all') return teams;
    return teams.filter(team => team.campus === selectedCampus);
  };

  const getFilteredSchedules = () => {
    if (selectedCampus === 'all') return schedules;
    return schedules.filter(schedule => schedule.campus === selectedCampus);
  };

  const handleCreateTeam = async () => {
    try {
      const response = await fetch('/api/serving/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(teamFormData),
      });

      if (response.ok) {
        const newTeam = await response.json();
        setTeams(prev => [...prev, newTeam.team]);
        setShowCreateTeam(false);
        resetTeamForm();
      } else {
        console.error('Failed to create team');
      }
    } catch (err) {
      console.error('Error creating team:', err);
    }
  };

  const resetTeamForm = () => {
    setTeamFormData({
      name: '',
      description: '',
      campus: '',
      department: '',
      team_type: 'ministry',
      ministry_group: '',
      meeting_schedule: '',
      max_members: '',
      is_active: true,
      background_check_required: false
    });
  };

  const renderTeamsTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Team Management</h2>
          <p className="text-slate-400">Manage serving teams across all campuses</p>
        </div>
        <button
          onClick={() => setShowCreateTeam(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <PlusIcon className="h-5 w-5 text-white" />
          <span className="text-white font-medium">Create Team</span>
        </button>
      </div>

      {/* Campus Filter */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center space-x-4">
          <span className="text-slate-300 font-medium">Filter by Campus:</span>
          <select
            value={selectedCampus}
            onChange={(e) => setSelectedCampus(e.target.value)}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Campuses</option>
            {campuses.map(campus => (
              <option key={campus.id} value={campus.display_name || campus.name}>
                {campus.display_name || campus.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {getFilteredTeams().map((team) => (
          <div key={team.id} className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{team.name}</h3>
                <p className="text-sm text-slate-400">{team.campus}</p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                team.is_active 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {team.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            <p className="text-slate-300 mb-4">{team.description}</p>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Department:</span>
                <span className="text-white">{team.department || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Type:</span>
                <span className="text-white capitalize">{team.team_type}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Members:</span>
                <span className="text-white">{team.member_count || 0}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-slate-600">
              <button className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded text-white transition-colors">
                Manage Team
              </button>
              <button className="px-3 py-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors">
                <PencilIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSchedulesTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Schedule Management</h2>
          <p className="text-slate-400">Plan and manage serving schedules</p>
        </div>
        <button
          onClick={() => setShowCreateSchedule(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
        >
          <PlusIcon className="h-5 w-5 text-white" />
          <span className="text-white font-medium">Create Schedule</span>
        </button>
      </div>

      {/* Calendar View */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Service Calendar</h3>
          <div className="flex items-center space-x-4">
            <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded">
              <CalendarIcon className="h-5 w-5" />
            </button>
            <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded">
              <ClockIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Simple Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 text-center text-sm font-medium text-slate-400">
              {day}
            </div>
          ))}
          {Array.from({ length: 35 }, (_, i) => {
            const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i - 10);
            const hasSchedule = schedules.some(s => 
              new Date(s.scheduled_date).toDateString() === date.toDateString()
            );
            return (
              <div
                key={i}
                className={`p-2 text-center text-sm border border-slate-600 min-h-[60px] ${
                  date.getMonth() === selectedDate.getMonth() 
                    ? 'text-white' 
                    : 'text-slate-600'
                }`}
              >
                <div className="text-xs">{date.getDate()}</div>
                {hasSchedule && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full mx-auto mt-1"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Schedules */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Upcoming Schedules</h3>
        <div className="space-y-3">
          {getFilteredSchedules().slice(0, 5).map((schedule) => (
            <div key={schedule.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
              <div>
                <p className="font-medium text-white">{schedule.team_name}</p>
                <p className="text-sm text-slate-400">
                  {new Date(schedule.scheduled_date).toLocaleDateString()} at {schedule.start_time}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-400">{schedule.campus}</span>
                <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTemplatesTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Service Templates</h2>
          <p className="text-slate-400">Create and manage service templates</p>
        </div>
        <button
          onClick={() => setShowCreateTemplate(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
        >
          <PlusIcon className="h-5 w-5 text-white" />
          <span className="text-white font-medium">Create Template</span>
        </button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <div key={template.id} className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{template.name}</h3>
                <p className="text-sm text-slate-400">{template.campus}</p>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Template
              </span>
            </div>
            
            <p className="text-slate-300 mb-4">{template.description}</p>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Service Type:</span>
                <span className="text-white">{template.service_type}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Duration:</span>
                <span className="text-white">{template.duration}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Teams:</span>
                <span className="text-white">{template.teams_count}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-slate-600">
              <button className="flex-1 px-3 py-2 text-sm bg-purple-600 hover:bg-purple-700 rounded text-white transition-colors">
                Use Template
              </button>
              <button className="px-3 py-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors">
                <PencilIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderServicePlanningTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Service Planning</h2>
          <p className="text-slate-400">Plan detailed service timelines and team assignments</p>
        </div>
        <button className="flex items-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors">
          <PlusIcon className="h-5 w-5 text-white" />
          <span className="text-white font-medium">New Service Plan</span>
        </button>
      </div>

      {/* Service Plan Builder */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Service Plan Builder</h3>
        
        {/* Timeline Builder */}
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="w-24 text-sm text-slate-400">9:00 AM</div>
            <div className="flex-1 p-3 bg-slate-700/50 rounded-lg border border-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">Pre-Service Prayer</span>
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
                <span className="text-white font-medium">Welcome & Announcements</span>
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
                <span className="text-white font-medium">Worship</span>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400">20 min</span>
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
          <button className="text-slate-400 hover:text-white transition-colors">
            <PlusIcon className="h-6 w-6 mx-auto mb-2" />
            <span>Add Service Element</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'teams':
        return renderTeamsTab();
      case 'schedules':
        return renderSchedulesTab();
      case 'templates':
        return <TemplateManagement />;
      case 'planning':
        return <ServicePlanning planId={new URLSearchParams(window.location.search).get('planId')} />;
      case 'plans':
        return <PlanManagement />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-slate-700 rounded w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-700 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Serving Management</h1>
          <p className="text-slate-400">Complete serving management system for all campuses</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedCampus}
            onChange={(e) => setSelectedCampus(e.target.value)}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Campuses</option>
            {campuses.map(campus => (
              <option key={campus.id} value={campus.display_name || campus.name}>
                {campus.display_name || campus.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-700">
        <nav className="flex space-x-8">
          {[
            { id: 'teams', name: 'Teams', icon: UserGroupIcon },
            { id: 'schedules', name: 'Schedules', icon: CalendarIcon },
            { id: 'templates', name: 'Templates', icon: DocumentDuplicateIcon },
            { id: 'plans', name: 'Plans', icon: CalendarIcon },
            ...(new URLSearchParams(window.location.search).get('planId') ? [{ id: 'planning', name: 'Service Planning', icon: ClockIcon }] : [])
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {renderTabContent()}
      </div>

      {/* Create Team Modal */}
      {showCreateTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-700">
            <div className="flex items-center justify-between p-6 border-b border-slate-600">
              <h2 className="text-xl font-semibold text-white">Create New Team</h2>
                              <button
                  onClick={() => {
                    setShowCreateTeam(false);
                    resetTeamForm();
                  }}
                  className="text-slate-400 hover:text-slate-300"
                >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Team Name *
                  </label>
                  <input
                    type="text"
                    value={teamFormData.name}
                    onChange={(e) => setTeamFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
                    placeholder="e.g., Worship Team"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Campus *
                  </label>
                  <select
                    value={teamFormData.campus}
                    onChange={(e) => setTeamFormData(prev => ({ ...prev, campus: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Campus</option>
                    {campuses.map(campus => (
                      <option key={campus.id} value={campus.display_name || campus.name}>
                        {campus.display_name || campus.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={teamFormData.description}
                  onChange={(e) => setTeamFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
                  placeholder="Describe the team's purpose and responsibilities..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Department
                  </label>
                  <input
                    type="text"
                    value={teamFormData.department}
                    onChange={(e) => setTeamFormData(prev => ({ ...prev, department: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
                    placeholder="e.g., Worship, Hospitality, Technical"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Team Type
                  </label>
                  <select
                    value={teamFormData.team_type}
                    onChange={(e) => setTeamFormData(prev => ({ ...prev, team_type: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="ministry">Ministry</option>
                    <option value="operations">Operations</option>
                    <option value="worship">Worship</option>
                    <option value="youth">Youth</option>
                    <option value="children">Children</option>
                    <option value="hospitality">Hospitality</option>
                    <option value="technical">Technical</option>
                    <option value="creative">Creative</option>
                    <option value="prayer">Prayer</option>
                    <option value="missions">Missions</option>
                    <option value="education">Education</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Ministry Group
                  </label>
                  <select
                    value={teamFormData.ministry_group}
                    onChange={(e) => setTeamFormData(prev => ({ ...prev, ministry_group: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Ministry Group</option>
                    <option value="Children & Youth">Children & Youth</option>
                    <option value="Worship & Creative">Worship & Creative</option>
                    <option value="Outreach & Missions">Outreach & Missions</option>
                    <option value="Pastoral Care">Pastoral Care</option>
                    <option value="Technical & Media">Technical & Media</option>
                    <option value="Hospitality & Events">Hospitality & Events</option>
                    <option value="Administration">Administration</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Max Members
                  </label>
                  <input
                    type="number"
                    value={teamFormData.max_members}
                    onChange={(e) => setTeamFormData(prev => ({ ...prev, max_members: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
                    placeholder="e.g., 12"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Meeting Schedule
                </label>
                <input
                  type="text"
                  value={teamFormData.meeting_schedule}
                  onChange={(e) => setTeamFormData(prev => ({ ...prev, meeting_schedule: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
                  placeholder="e.g., Sundays 8:00 AM, Wednesdays 7:00 PM"
                />
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={teamFormData.is_active}
                    onChange={(e) => setTeamFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-600 rounded bg-slate-700"
                  />
                  <span className="ml-2 text-sm text-slate-300">Team is active</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={teamFormData.background_check_required}
                    onChange={(e) => setTeamFormData(prev => ({ ...prev, background_check_required: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-600 rounded bg-slate-700"
                  />
                  <span className="ml-2 text-sm text-slate-300">Background check required</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-600 bg-slate-700/50">
              <button
                onClick={() => {
                  setShowCreateTeam(false);
                  resetTeamForm();
                }}
                className="px-4 py-2 text-slate-300 bg-slate-700 border border-slate-600 rounded-lg hover:bg-slate-600 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTeam}
                disabled={!teamFormData.name || !teamFormData.campus}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  teamFormData.name && teamFormData.campus
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                }`}
              >
                Create Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals would go here - Create Schedule, Create Template */}
    </div>
  );
};

export default ServingManagement;
