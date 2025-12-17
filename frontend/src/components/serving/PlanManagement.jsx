import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronDownIcon,
  ChevronRightIcon,
  CalendarIcon,
  ClockIcon,
  UserGroupIcon,
  MapPinIcon,
  PlusIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import ServicePlanning from './ServicePlanning';

const PlanManagement = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [expandedPlans, setExpandedPlans] = useState(new Set());
  const [selectedCampus, setSelectedCampus] = useState('all');
  const [campuses, setCampuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showFullPlan, setShowFullPlan] = useState(false);
  const [showAssignments, setShowAssignments] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showServicePlanning, setShowServicePlanning] = useState(false);
  const [planFormData, setPlanFormData] = useState({
    title: '',
    campus: '',
    date: '',
    serviceTime: '',
    rehearsalTime: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchCampuses(),
        fetchPlans()
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

  const fetchPlans = async () => {
    try {
      // Mock data for now - would come from API
      const mockPlans = [
        {
          id: 1,
          title: 'Sunday Service - Worship Focus',
          campus: 'Futures Copper Coast',
          date: '2025-08-17',
          serviceTime: '10:00 AM',
          rehearsalTime: '9:00 AM',
          status: 'draft',
          lastUpdated: '2 days ago',
          updatedBy: 'Shannon Langberg',
          teams: [
            { name: 'Worship Team', members: 6, needed: 2, roles: ['Lead Vocal', 'Backup Vocal', 'Guitar', 'Keys', 'Bass', 'Drums'] },
            { name: 'Hosting Team', members: 4, needed: 3, roles: ['Welcome', 'Announcements', 'Prayer', 'Communion', 'Giving Host'] },
            { name: 'Technical Team', members: 3, needed: 1, roles: ['Sound Engineer', 'Lighting', 'Video', 'Livestream'] }
          ],
          totalPositions: 15,
          filledPositions: 10,
          notes: 'Focus on contemporary worship with full band setup. Special emphasis on new worship songs. Need backup vocalists for harmonies.',
          specialRequirements: ['Full band setup', 'New worship songs', 'Backup vocals'],
          equipment: ['PA System', 'Instruments', 'Microphones', 'Lighting rig'],
          timeline: [
            { time: '9:00 AM', activity: 'Team Arrival & Setup' },
            { time: '9:30 AM', activity: 'Rehearsal' },
            { time: '10:00 AM', activity: 'Service Start' },
            { time: '11:30 AM', activity: 'Service End' }
          ]
        },
        {
          id: 2,
          title: 'Sunday Service - Communion',
          campus: 'Futures Copper Coast',
          date: '2025-08-24',
          serviceTime: '10:00 AM',
          rehearsalTime: '9:00 AM',
          status: 'planning',
          lastUpdated: '9 days ago',
          updatedBy: 'Shannon Langberg',
          teams: [
            { name: 'Worship Team', members: 5, needed: 1, roles: ['Acoustic Guitar', 'Piano', 'Lead Vocal', 'Backup Vocal', 'Cajon'] },
            { name: 'Hosting Team', members: 3, needed: 4, roles: ['Welcome', 'Communion Leader', 'Prayer', 'Giving Host', 'Ushers'] },
            { name: 'Technical Team', members: 2, needed: 2, roles: ['Sound Engineer', 'Video Operator'] }
          ],
          totalPositions: 12,
          filledPositions: 7,
          notes: 'Communion service with acoustic worship setup. Intimate atmosphere with focus on reflection and prayer.',
          specialRequirements: ['Communion setup', 'Acoustic atmosphere', 'Reflection time'],
          equipment: ['Communion elements', 'Acoustic instruments', 'Candles'],
          timeline: [
            { time: '9:00 AM', activity: 'Setup & Rehearsal' },
            { time: '10:00 AM', activity: 'Service Start' },
            { time: '10:30 AM', activity: 'Communion' },
            { time: '11:30 AM', activity: 'Service End' }
          ]
        },
        {
          id: 3,
          title: 'Sunday Service - Guest Speaker',
          campus: 'Futures Copper Coast',
          date: '2025-08-31',
          serviceTime: '10:00 AM',
          rehearsalTime: '9:00 AM',
          status: 'confirmed',
          lastUpdated: '19 days ago',
          updatedBy: 'Shannon Langberg',
          teams: [
            { name: 'Worship Team', members: 7, needed: 0, roles: ['Lead Vocal', 'Backup Vocal', 'Guitar', 'Keys', 'Bass', 'Drums', 'Saxophone'] },
            { name: 'Hosting Team', members: 6, needed: 1, roles: ['Welcome', 'Guest Speaker Intro', 'Prayer', 'Giving Host', 'Ushers', 'Hospitality'] },
            { name: 'Technical Team', members: 4, needed: 0, roles: ['Sound Engineer', 'Lighting', 'Video', 'Livestream'] }
          ],
          totalPositions: 18,
          filledPositions: 17,
          notes: 'Guest speaker from national ministry team. Full production with special lighting and video elements.',
          specialRequirements: ['Guest speaker setup', 'Enhanced production', 'Hospitality team'],
          equipment: ['Enhanced PA', 'Video projector', 'Special lighting', 'Guest speaker mic'],
          timeline: [
            { time: '8:30 AM', activity: 'Early Setup' },
            { time: '9:00 AM', activity: 'Team Rehearsal' },
            { time: '10:00 AM', activity: 'Service Start' },
            { time: '11:45 AM', activity: 'Service End' }
          ]
        },
        {
          id: 4,
          title: 'Sunday Service - Youth Focus',
          campus: 'Futures Copper Coast',
          date: '2025-09-07',
          serviceTime: '10:00 AM',
          rehearsalTime: '9:00 AM',
          status: 'planning',
          lastUpdated: '19 days ago',
          updatedBy: 'Shannon Langberg',
          teams: [
            { name: 'Youth Worship', members: 4, needed: 2, roles: ['Youth Lead Vocal', 'Youth Guitar', 'Youth Keys', 'Youth Drums', 'Youth Bass', 'Youth Backup'] },
            { name: 'Youth Hosting', members: 2, needed: 5, roles: ['Youth Welcome', 'Youth Prayer', 'Youth Testimony', 'Youth Games', 'Youth Leaders', 'Youth Ushers'] },
            { name: 'Technical Team', members: 1, needed: 3, roles: ['Youth Sound Tech', 'Youth Video', 'Youth Lighting'] }
          ],
          totalPositions: 17,
          filledPositions: 7,
          notes: 'Youth-led service with contemporary music and interactive elements. Focus on engaging young people.',
          specialRequirements: ['Youth leadership', 'Interactive elements', 'Contemporary music'],
          equipment: ['Youth instruments', 'Interactive tech', 'Games equipment'],
          timeline: [
            { time: '9:00 AM', activity: 'Youth Team Setup' },
            { time: '9:30 AM', activity: 'Youth Rehearsal' },
            { time: '10:00 AM', activity: 'Youth Service Start' },
            { time: '11:30 AM', activity: 'Service End' }
          ]
        },
        {
          id: 5,
          title: 'Wednesday Prayer Night',
          campus: 'Futures Mt Barker',
          date: '2025-08-20',
          serviceTime: '7:00 PM',
          rehearsalTime: '6:30 PM',
          status: 'confirmed',
          lastUpdated: '1 day ago',
          updatedBy: 'Sarah Johnson',
          teams: [
            { name: 'Prayer Team', members: 8, needed: 0, roles: ['Prayer Leaders', 'Intercessors', 'Prayer Partners'] },
            { name: 'Worship Team', members: 3, needed: 0, roles: ['Acoustic Guitar', 'Piano', 'Lead Vocal'] },
            { name: 'Hospitality Team', members: 2, needed: 0, roles: ['Welcome', 'Refreshments'] }
          ],
          totalPositions: 13,
          filledPositions: 13,
          notes: 'Intimate prayer night with acoustic worship. Focus on corporate prayer and intercession.',
          specialRequirements: ['Prayer focus', 'Intimate atmosphere', 'Corporate prayer'],
          equipment: ['Prayer room setup', 'Acoustic instruments', 'Refreshments'],
          timeline: [
            { time: '6:30 PM', activity: 'Setup & Rehearsal' },
            { time: '7:00 PM', activity: 'Prayer Night Start' },
            { time: '8:30 PM', activity: 'Prayer Night End' }
          ]
        },
        {
          id: 6,
          title: 'Friday Youth Service',
          campus: 'Futures Mt Barker',
          date: '2025-08-22',
          serviceTime: '7:00 PM',
          rehearsalTime: '6:00 PM',
          status: 'planning',
          lastUpdated: '3 days ago',
          updatedBy: 'Mike Chen',
          teams: [
            { name: 'Youth Worship', members: 5, needed: 1, roles: ['Youth Lead Vocal', 'Youth Guitar', 'Youth Keys', 'Youth Drums', 'Youth Bass', 'Youth Backup'] },
            { name: 'Youth Ministry', members: 4, needed: 2, roles: ['Youth Leaders', 'Small Group Leaders', 'Activity Coordinators'] },
            { name: 'Technical Team', members: 2, needed: 1, roles: ['Sound Tech', 'Video', 'Lighting'] }
          ],
          totalPositions: 15,
          filledPositions: 11,
          notes: 'High-energy youth service with contemporary worship and interactive activities.',
          specialRequirements: ['High energy', 'Interactive activities', 'Contemporary worship'],
          equipment: ['Youth instruments', 'Interactive tech', 'Activity materials'],
          timeline: [
            { time: '6:00 PM', activity: 'Youth Team Setup' },
            { time: '6:30 PM', activity: 'Youth Rehearsal' },
            { time: '7:00 PM', activity: 'Youth Service Start' },
            { time: '9:00 PM', activity: 'Service End' }
          ]
        },
        {
          id: 7,
          title: 'Sunday Service - Family Focus',
          campus: 'Futures Adelaide City',
          date: '2025-08-17',
          serviceTime: '9:30 AM',
          rehearsalTime: '8:30 AM',
          status: 'draft',
          lastUpdated: '5 days ago',
          updatedBy: 'David Wilson',
          teams: [
            { name: 'Family Worship', members: 6, needed: 1, roles: ['Family Vocal', 'Family Guitar', 'Family Keys', 'Family Drums', 'Family Bass', 'Family Backup'] },
            { name: 'Children\'s Ministry', members: 8, needed: 2, roles: ['Children\'s Leaders', 'Teachers', 'Helpers', 'Nursery Workers'] },
            { name: 'Family Hosting', members: 5, needed: 1, roles: ['Family Welcome', 'Family Prayer', 'Family Activities', 'Family Ushers'] }
          ],
          totalPositions: 22,
          filledPositions: 19,
          notes: 'Family-focused service with children\'s ministry and family activities. Emphasis on multi-generational worship.',
          specialRequirements: ['Family focus', 'Children\'s ministry', 'Multi-generational'],
          equipment: ['Children\'s materials', 'Family activities', 'Nursery setup'],
          timeline: [
            { time: '8:30 AM', activity: 'Family Team Setup' },
            { time: '9:00 AM', activity: 'Family Rehearsal' },
            { time: '9:30 AM', activity: 'Family Service Start' },
            { time: '11:00 AM', activity: 'Service End' }
          ]
        },
        {
          id: 8,
          title: 'Sunday Service - Contemporary',
          campus: 'Futures Salisbury',
          date: '2025-08-17',
          serviceTime: '11:00 AM',
          rehearsalTime: '10:00 AM',
          status: 'confirmed',
          lastUpdated: '1 week ago',
          updatedBy: 'Lisa Thompson',
          teams: [
            { name: 'Contemporary Worship', members: 7, needed: 0, roles: ['Lead Vocal', 'Backup Vocal', 'Electric Guitar', 'Acoustic Guitar', 'Keys', 'Bass', 'Drums'] },
            { name: 'Contemporary Hosting', members: 6, needed: 0, roles: ['Welcome', 'Prayer', 'Giving Host', 'Ushers', 'Hospitality', 'Communion'] },
            { name: 'Contemporary Tech', members: 4, needed: 0, roles: ['Sound Engineer', 'Lighting', 'Video', 'Livestream'] }
          ],
          totalPositions: 17,
          filledPositions: 17,
          notes: 'Contemporary service with full band and modern worship songs. High-energy atmosphere with professional production.',
          specialRequirements: ['Contemporary style', 'Full band', 'Professional production'],
          equipment: ['Full band setup', 'Professional PA', 'Lighting rig', 'Video system'],
          timeline: [
            { time: '10:00 AM', activity: 'Band Setup & Rehearsal' },
            { time: '10:45 AM', activity: 'Final Sound Check' },
            { time: '11:00 AM', activity: 'Service Start' },
            { time: '12:30 PM', activity: 'Service End' }
          ]
        }
      ];
      setPlans(mockPlans);
    } catch (err) {
      console.error('Error fetching plans:', err);
    }
  };

  const togglePlanExpansion = (planId) => {
    const newExpanded = new Set(expandedPlans);
    if (newExpanded.has(planId)) {
      newExpanded.delete(planId);
    } else {
      newExpanded.add(planId);
    }
    setExpandedPlans(newExpanded);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'planning': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'draft': return '📝';
      case 'planning': return '🔄';
      case 'confirmed': return '✅';
      case 'completed': return '🏁';
      default: return '❓';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const getDaysUntil = (dateString) => {
    const today = new Date();
    const planDate = new Date(dateString);
    const diffTime = planDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Past';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return `${diffDays} days`;
  };

  const handleCreatePlan = async () => {
    try {
      // TODO: API call to create plan
      console.log('Creating plan:', planFormData);
      setShowCreatePlan(false);
      setPlanFormData({
        title: '',
        campus: '',
        date: '',
        serviceTime: '',
        rehearsalTime: '',
        notes: ''
      });
    } catch (err) {
      console.error('Error creating plan:', err);
    }
  };

  const handleDuplicatePlan = (plan) => {
    setPlanFormData({
      title: `${plan.title} (Copy)`,
      campus: plan.campus,
      date: '',
      serviceTime: plan.serviceTime,
      rehearsalTime: plan.rehearsalTime,
      notes: plan.notes
    });
    setShowCreatePlan(true);
  };

  const handleDeletePlan = async (planId) => {
    if (window.confirm('Are you sure you want to delete this plan?')) {
      try {
        // TODO: API call to delete plan
        console.log('Deleting plan:', planId);
        setPlans(prev => prev.filter(p => p.id !== planId));
      } catch (err) {
        console.error('Error deleting plan:', err);
      }
    }
  };

  const getFilteredPlans = () => {
    if (selectedCampus === 'all') return plans;
    return plans.filter(plan => plan.campus === selectedCampus);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Service Plan Management</h2>
          <p className="text-slate-400">Manage and organize upcoming service plans across all campuses</p>
        </div>
        <button
          onClick={() => setShowCreatePlan(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <PlusIcon className="h-5 w-5 text-white" />
          <span className="text-white font-medium">Create Plan</span>
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

      {/* Plans List */}
      <div className="space-y-4">
        {getFilteredPlans().map((plan) => (
          <div key={plan.id} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            {/* Plan Header - Always Visible */}
            <div 
              className="p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
              onClick={() => togglePlanExpansion(plan.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button className="text-slate-400 hover:text-slate-300">
                    {expandedPlans.has(plan.id) ? (
                      <ChevronDownIcon className="h-5 w-5" />
                    ) : (
                      <ChevronRightIcon className="h-5 w-5" />
                    )}
                  </button>
                  
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(plan.status)}`}>
                      {getStatusIcon(plan.status)} {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                    </span>
                    <h3 className="text-lg font-semibold text-white">{plan.title}</h3>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm text-slate-400">{getDaysUntil(plan.date)}</div>
                    <div className="text-white font-medium">{formatDate(plan.date)}</div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicatePlan(plan);
                      }}
                      className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors"
                      title="Duplicate Plan"
                    >
                      <DocumentDuplicateIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Edit plan
                      }}
                      className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors"
                      title="Edit Plan"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePlan(plan.id);
                      }}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                      title="Delete Plan"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="flex items-center space-x-6 mt-3 text-sm text-slate-400">
                <div className="flex items-center space-x-1">
                  <MapPinIcon className="h-4 w-4" />
                  <span>{plan.campus}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <ClockIcon className="h-4 w-4" />
                  <span>{plan.serviceTime}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <UserGroupIcon className="h-4 w-4" />
                  <span>{plan.filledPositions}/{plan.totalPositions} positions filled</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span>Updated {plan.lastUpdated} by {plan.updatedBy}</span>
                </div>
              </div>
            </div>

            {/* Expanded Content */}
            {expandedPlans.has(plan.id) && (
              <div className="border-t border-slate-600 bg-slate-700/30">
                <div className="p-4 space-y-4">
                  {/* Teams Overview */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-3">Teams & Positions</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {plan.teams.map((team, index) => (
                        <div key={index} className="bg-slate-800 rounded-lg p-3 border border-slate-600">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-white">{team.name}</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              team.needed === 0 
                                ? 'bg-green-900/50 text-green-300 border border-green-700' 
                                : 'bg-red-900/50 text-red-300 border border-red-700'
                            }`}>
                              {team.needed === 0 ? 'Complete' : `${team.needed} needed`}
                            </span>
                          </div>
                          <div className="text-sm text-slate-400">
                            {team.members} members assigned
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  {plan.notes && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-300 mb-2">Notes</h4>
                      <p className="text-slate-300 bg-slate-800 rounded-lg p-3 border border-slate-600">
                        {plan.notes}
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-3 pt-2">
                    <button 
                      onClick={() => {
                        setSelectedPlan(plan);
                        setShowFullPlan(true);
                      }}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      <EyeIcon className="h-4 w-4" />
                      <span>View Details</span>
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedPlan(plan);
                        setShowServicePlanning(true);
                      }}
                      className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                    >
                      <ClockIcon className="h-4 w-4" />
                      <span>Edit & Manage</span>
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedPlan(plan);
                        setShowAssignments(true);
                      }}
                      className="flex items-center space-x-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
                    >
                      <UserGroupIcon className="h-4 w-4" />
                      <span>Manage Assignments</span>
                    </button>
                    <button 
                      onClick={() => {
                        if (window.confirm(`Mark "${plan.title}" as complete?`)) {
                          const updatedPlans = plans.map(p => 
                            p.id === plan.id ? { ...p, status: 'completed' } : p
                          );
                          setPlans(updatedPlans);
                          alert('Plan marked as complete!');
                        }
                      }}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                      <CheckIcon className="h-4 w-4" />
                      <span>Mark Complete</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Plan Modal */}
      {showCreatePlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-700">
            <div className="flex items-center justify-between p-6 border-b border-slate-600">
              <h2 className="text-xl font-semibold text-white">Create New Service Plan</h2>
              <button
                onClick={() => setShowCreatePlan(false)}
                className="text-slate-400 hover:text-slate-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Plan Title *</label>
                  <input
                    type="text"
                    value={planFormData.title}
                    onChange={(e) => setPlanFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
                    placeholder="e.g., Sunday Service - Worship Focus"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Campus *</label>
                  <select
                    value={planFormData.campus}
                    onChange={(e) => setPlanFormData(prev => ({ ...prev, campus: e.target.value }))}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Date *</label>
                  <input
                    type="date"
                    value={planFormData.date}
                    onChange={(e) => setPlanFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Service Time</label>
                  <input
                    type="time"
                    value={planFormData.serviceTime}
                    onChange={(e) => setPlanFormData(prev => ({ ...prev, serviceTime: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Rehearsal Time</label>
                <input
                  type="time"
                  value={planFormData.rehearsalTime}
                  onChange={(e) => setPlanFormData(prev => ({ ...prev, rehearsalTime: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
                <textarea
                  value={planFormData.notes}
                  onChange={(e) => setPlanFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
                  placeholder="Add any special notes or requirements for this service..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-600 bg-slate-700/50">
              <button
                onClick={() => setShowCreatePlan(false)}
                className="px-4 py-2 text-slate-300 bg-slate-700 border border-slate-600 rounded-lg hover:bg-slate-600 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlan}
                disabled={!planFormData.title || !planFormData.campus || !planFormData.date}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  planFormData.title && planFormData.campus && planFormData.date
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                }`}
              >
                Create Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Full Plan Modal */}
      {showFullPlan && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-700">
            <div className="flex items-center justify-between p-6 border-b border-slate-600">
              <div>
                <h2 className="text-xl font-semibold text-white">{selectedPlan.title}</h2>
                <p className="text-sm text-slate-400">{selectedPlan.campus} • {formatDate(selectedPlan.date)}</p>
              </div>
              <button
                onClick={() => setShowFullPlan(false)}
                className="text-slate-400 hover:text-slate-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Plan Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400">{selectedPlan.filledPositions}/{selectedPlan.totalPositions}</div>
                  <div className="text-sm text-slate-400">Positions Filled</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{selectedPlan.teams.length}</div>
                  <div className="text-sm text-slate-400">Teams</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{selectedPlan.serviceTime}</div>
                  <div className="text-sm text-slate-400">Service Time</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400">{selectedPlan.rehearsalTime}</div>
                  <div className="text-sm text-slate-400">Rehearsal</div>
                </div>
              </div>

              {/* Detailed Teams */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Detailed Team Breakdown</h3>
                <div className="space-y-4">
                  {selectedPlan.teams.map((team, index) => (
                    <div key={index} className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-lg font-medium text-white">{team.name}</h4>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          team.needed === 0 
                            ? 'bg-green-900/50 text-green-300 border border-green-700' 
                            : 'bg-red-900/50 text-red-300 border border-red-700'
                        }`}>
                          {team.needed === 0 ? 'Complete' : `${team.needed} needed`}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="text-sm font-medium text-slate-300 mb-2">Roles</h5>
                          <div className="space-y-1">
                            {team.roles.map((role, roleIndex) => (
                              <div key={roleIndex} className="text-sm text-slate-400 bg-slate-800 rounded px-2 py-1">
                                {role}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium text-slate-300 mb-2">Status</h5>
                          <div className="text-sm text-slate-400">
                            <div>{team.members} members assigned</div>
                            <div>{team.needed} positions needed</div>
                            <div className="mt-2">
                              <div className="w-full bg-slate-700 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${((team.members) / (team.members + team.needed)) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              {selectedPlan.timeline && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Service Timeline</h3>
                  <div className="space-y-2">
                    {selectedPlan.timeline.map((item, index) => (
                      <div key={index} className="flex items-center space-x-4 bg-slate-700/30 rounded-lg p-3 border border-slate-600">
                        <div className="w-20 text-sm font-medium text-blue-400">{item.time}</div>
                        <div className="flex-1 text-slate-300">{item.activity}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Special Requirements & Equipment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedPlan.specialRequirements && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Special Requirements</h3>
                    <div className="space-y-2">
                      {selectedPlan.specialRequirements.map((req, index) => (
                        <div key={index} className="flex items-center space-x-2 text-slate-300">
                          <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                          <span>{req}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {selectedPlan.equipment && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Equipment Needed</h3>
                    <div className="space-y-2">
                      {selectedPlan.equipment.map((item, index) => (
                        <div key={index} className="flex items-center space-x-2 text-slate-300">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedPlan.notes && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Notes</h3>
                  <p className="text-slate-300 bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                    {selectedPlan.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manage Assignments Modal */}
      {showAssignments && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-700">
            <div className="flex items-center justify-between p-6 border-b border-slate-600">
              <div>
                <h2 className="text-xl font-semibold text-white">Manage Assignments</h2>
                <p className="text-sm text-slate-400">{selectedPlan.title} • {selectedPlan.campus}</p>
              </div>
              <button
                onClick={() => setShowAssignments(false)}
                className="text-slate-400 hover:text-slate-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Assignment Overview */}
              <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-400">{selectedPlan.filledPositions}</div>
                    <div className="text-sm text-slate-400">Filled</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-400">{selectedPlan.totalPositions - selectedPlan.filledPositions}</div>
                    <div className="text-sm text-slate-400">Needed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-400">{selectedPlan.teams.length}</div>
                    <div className="text-sm text-slate-400">Teams</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-400">{Math.round((selectedPlan.filledPositions / selectedPlan.totalPositions) * 100)}%</div>
                    <div className="text-sm text-slate-400">Complete</div>
                  </div>
                </div>
              </div>

              {/* Team Assignments */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Team Assignments</h3>
                <div className="space-y-4">
                  {selectedPlan.teams.map((team, index) => (
                    <div key={index} className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-lg font-medium text-white">{team.name}</h4>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          team.needed === 0 
                            ? 'bg-green-900/50 text-green-300 border border-green-700' 
                            : 'bg-red-900/50 text-red-300 border border-red-700'
                        }`}>
                          {team.needed === 0 ? 'Complete' : `${team.needed} needed`}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="text-sm font-medium text-slate-300 mb-2">Roles & Assignments</h5>
                          <div className="space-y-2">
                            {team.roles.map((role, roleIndex) => (
                              <div key={roleIndex} className="flex items-center justify-between bg-slate-800 rounded px-3 py-2">
                                <span className="text-sm text-slate-300">{role}</span>
                                <button className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors">
                                  Assign
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <h5 className="text-sm font-medium text-slate-300 mb-2">Quick Actions</h5>
                          <div className="space-y-2">
                            <button className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors">
                              Auto-Assign Team
                            </button>
                            <button className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors">
                              Send Team Invites
                            </button>
                            <button className="w-full px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded transition-colors">
                              View Team Schedule
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Global Actions */}
              <div className="flex items-center justify-center space-x-4 pt-4 border-t border-slate-600">
                <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                  Auto-Assign All Teams
                </button>
                <button className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                  Send All Invites
                </button>
                <button className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                  Export Assignments
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Service Planning Interface */}
      {showServicePlanning && selectedPlan && (
        <div className="fixed inset-0 bg-slate-900 z-50 overflow-y-auto">
          {/* Header with Back Button */}
          <div className="bg-slate-800 border-b border-slate-700 p-4 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowServicePlanning(false)}
                  className="flex items-center space-x-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                  <span>Back to Plans</span>
                </button>
                <div className="h-6 w-px bg-slate-600"></div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{selectedPlan.title}</h1>
                  <p className="text-slate-400">{selectedPlan.campus} • {formatDate(selectedPlan.date)}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedPlan.status)}`}>
                  {getStatusIcon(selectedPlan.status)} {selectedPlan.status.charAt(0).toUpperCase() + selectedPlan.status.slice(1)}
                </span>
                <button
                  onClick={() => {
                    // TODO: Save plan changes
                    alert('Plan changes saved!');
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>

          {/* Full Service Planning Interface */}
          <div className="p-6">
            <ServicePlanning planId={selectedPlan.id} />
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanManagement;
