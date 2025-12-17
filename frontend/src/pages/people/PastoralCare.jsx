import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  UserCircleIcon, 
  ExclamationTriangleIcon, 
  ClockIcon,
  PlusIcon,
  PencilIcon,
  XMarkIcon,
  CheckCircleIcon,
  UserGroupIcon,
  HeartIcon,
  FunnelIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  HandRaisedIcon,
  MagnifyingGlassIcon,
  LinkIcon,
  QrCodeIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';
// Removed CampusSelector import - using inline selector instead

const PastoralCare = () => {
  // Debug: Log that component is rendering
  console.log('🔵 PastoralCare component is rendering!');
  
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  const navigate = useNavigate();
  const [careCases, setCareCases] = useState([]);
  const [prayerRequests, setPrayerRequests] = useState([]);
  const [praiseReports, setPraiseReports] = useState([]);
  const [prayerLinks, setPrayerLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(null);
  // Initialize tab from URL parameter, default to 'cases'
  const [selectedTab, setSelectedTab] = useState(tabParam && ['cases', 'prayer', 'all'].includes(tabParam) ? tabParam : 'cases');
  // Sub-tab for prayer section: 'requests', 'praise', 'links'
  const [prayerSubTab, setPrayerSubTab] = useState('requests');
  const [statusFilter, setStatusFilter] = useState('all'); // 'open', 'resolved', 'all' - Start with 'all' to show everything
  const [priorityFilter, setPriorityFilter] = useState('all'); // 'all', 'high', 'medium', 'low'
  const [campusFilter, setCampusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userCampus, setUserCampus] = useState('');
  const [selectedCampus, setSelectedCampus] = useState(null);
  const [campuses, setCampuses] = useState([]);
  const [showCampusSelector, setShowCampusSelector] = useState(false);
  const [pastors, setPastors] = useState([]);
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [personSearchTerm, setPersonSearchTerm] = useState('');
  const [showPeopleDropdown, setShowPeopleDropdown] = useState(false);
  const [showCreateLink, setShowCreateLink] = useState(false);
  const [newLink, setNewLink] = useState({
    link_type: 'both',
    campus: '',
    department: '',
    location: '',
    description: '',
    code_type: 'qr'
  });
  
  const [formData, setFormData] = useState({
    person_id: '',
    person_name: '',
    priority: 'medium',
    notes: '',
    assigned_leader: '',
    follow_up_date: '',
    ai_summary: ''
  });

  // Update tab when URL parameter changes
  useEffect(() => {
    if (tabParam && ['cases', 'prayer', 'all'].includes(tabParam)) {
      setSelectedTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    fetchUserSession();
    loadCampuses();
    loadPastors();
    loadPeople();
  }, []);

  // Close people dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showPeopleDropdown && !event.target.closest('.people-selector-container')) {
        setShowPeopleDropdown(false);
      }
    };

    if (showPeopleDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPeopleDropdown]);

  const loadPeople = async () => {
    try {
      setPeopleLoading(true);
      const response = await fetch('/api/persons?page_size=500&is_active=true', {
        credentials: 'include',
        cache: 'no-store'
      });
      
      if (response.ok) {
        const data = await response.json();
        setPeople(data.persons || []);
      }
    } catch (err) {
      console.error('Error loading people:', err);
      setPeople([]);
    } finally {
      setPeopleLoading(false);
    }
  };

  useEffect(() => {
    if (userRole) { // Only load when we have user role
      loadCareCases();
      if (selectedTab === 'prayer' || selectedTab === 'all') {
        if (prayerSubTab === 'requests' || prayerSubTab === 'praise') {
          loadPrayerRequests();
        } else if (prayerSubTab === 'links') {
          loadPrayerLinks();
        }
      }
    }
  }, [selectedTab, prayerSubTab, statusFilter, priorityFilter, campusFilter, selectedCampus, userRole, searchTerm]);

  const fetchUserSession = async () => {
    try {
      const response = await fetch('/api/session', {
        credentials: 'include',
        cache: 'no-store'
      });
      const data = await response.json();
      if (data.authenticated) {
        setUserRole(data.role || 'user');
        setUserCampus(data.campus || 'all_campuses');
        
        // Show campus selector for senior leadership - DISABLED for now to avoid dashboard selector
        const hasFullAccess = ['admin', 'senior_leadership', 'senior_pastor', 'lead_pastor'].includes(data.role);
        setShowCampusSelector(false); // Temporarily disabled - will show simple dropdown instead
        
        // Auto-select campus for campus pastors
        if (data.role === 'campus_pastor' && data.campus && data.campus !== 'all_campuses') {
          const normalizedCampus = data.campus.toLowerCase().trim().replace(/\s+/g, '_');
          // Will be set when campuses load
        }
      }
    } catch (error) {
      console.error('Error fetching user session:', error);
    }
  };

  const loadCampuses = async () => {
    try {
      const response = await fetch('/api/campuses/public');
      if (response.ok) {
        const data = await response.json();
        const campusesList = data.campuses || [];
        setCampuses(campusesList);
        
        // Auto-select campus for campus pastors
        if (userRole === 'campus_pastor' && userCampus && userCampus !== 'all_campuses') {
          const normalizedCampus = userCampus.toLowerCase().trim().replace(/\s+/g, '_');
          const foundCampus = campusesList.find(c => {
            const campusId = (c.id || '').toLowerCase().trim();
            return campusId === normalizedCampus || campusId === userCampus.toLowerCase().trim();
          });
          if (foundCampus) {
            setSelectedCampus({ id: foundCampus.id, name: foundCampus.name || foundCampus.display_name });
          }
        } else if (campusesList.length > 0 && !selectedCampus) {
          // Default to all campuses for admins
          setSelectedCampus({ id: 'all_campuses', name: 'All Campuses' });
        }
      }
    } catch (error) {
      console.error('Error loading campuses:', error);
    }
  };

  const loadPastors = async () => {
    try {
      const response = await fetch('/api/users', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        const users = data.users || [];
        // Filter to pastors/leaders
        const pastorRoles = ['admin', 'senior_leadership', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'staff'];
        const pastorList = users
          .filter(u => pastorRoles.includes(u.role))
          .map(u => ({ id: u.id, name: u.full_name || u.username, role: u.role }));
        setPastors(pastorList);
      }
    } catch (error) {
      console.error('Error loading pastors:', error);
    }
  };

  const loadCareCases = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (priorityFilter !== 'all') {
        params.append('priority', priorityFilter);
      }
      
      const response = await fetch(`/api/pastoral-care/cases?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store'
      });
      
      if (response.ok) {
        const data = await response.json();
        let cases = data.cases || [];
        
        console.log('Loaded care cases:', cases.length, cases);
        
        // Apply campus filter
        if (campusFilter !== 'all') {
          cases = cases.filter(c => {
            if (!c.campus) return false;
            const caseCampus = (c.campus || '').toLowerCase().trim().replace(/\s+/g, '_');
            const filterCampus = (campusFilter || '').toLowerCase().trim();
            return caseCampus === filterCampus || caseCampus.includes(filterCampus) || filterCampus.includes(caseCampus);
          });
        } else if (selectedCampus && selectedCampus.id !== 'all_campuses') {
          // Fallback to selectedCampus if campusFilter is 'all' but user has a selected campus
          const selectedCampusId = (selectedCampus.id || '').toLowerCase().trim();
          cases = cases.filter(c => {
            if (!c.campus) return false;
            const caseCampus = (c.campus || '').toLowerCase().trim().replace(/\s+/g, '_');
            return caseCampus === selectedCampusId || caseCampus.includes(selectedCampusId) || selectedCampusId.includes(caseCampus);
          });
        }
        
        // Apply search filter
        if (searchTerm) {
          cases = cases.filter(c => 
            (c.person_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.assigned_leader || '').toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        
        console.log('Filtered care cases:', cases.length);
        setCareCases(cases);
      } else {
        console.error('Failed to load care cases:', response.status, response.statusText);
        setCareCases([]);
      }
    } catch (err) {
      console.error('Error loading care cases:', err);
      setCareCases([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPrayerRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/prayer/submissions', {
        credentials: 'include',
        cache: 'no-store'
      });
      
      if (response.ok) {
        const data = await response.json();
        let allSubmissions = data.submissions || [];
        
        // Separate prayer requests and praise reports
        let prayers = allSubmissions.filter(r => r.type === 'prayer_request') || [];
        let praise = allSubmissions.filter(r => r.type === 'praise_report') || [];
        
        // Apply campus filter
        if (campusFilter !== 'all') {
          prayers = prayers.filter(p => p.campus === campusFilter);
          praise = praise.filter(p => p.campus === campusFilter);
        } else if (selectedCampus && selectedCampus.id !== 'all_campuses') {
          const selectedCampusId = (selectedCampus.id || '').toLowerCase().trim();
          prayers = prayers.filter(r => {
            const requestCampus = (r.campus || '').toLowerCase().trim().replace(/\s+/g, '_');
            return requestCampus === selectedCampusId;
          });
          praise = praise.filter(r => {
            const requestCampus = (r.campus || '').toLowerCase().trim().replace(/\s+/g, '_');
            return requestCampus === selectedCampusId;
          });
        }
        
        // Apply status filter
        if (statusFilter !== 'all') {
          prayers = prayers.filter(p => p.status === statusFilter);
          praise = praise.filter(p => p.status === statusFilter);
        }
        
        // Apply search filter
        if (searchTerm) {
          prayers = prayers.filter(r => 
            (r.person_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.summary || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.details || '').toLowerCase().includes(searchTerm.toLowerCase())
          );
          praise = praise.filter(r => 
            (r.person_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.summary || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.details || '').toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        
        setPrayerRequests(prayers);
        setPraiseReports(praise);
      }
    } catch (err) {
      console.error('Error loading prayer requests:', err);
      setPrayerRequests([]);
      setPraiseReports([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPrayerLinks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/prayer/links', {
        credentials: 'include',
        cache: 'no-store'
      });

      if (response.ok) {
        const data = await response.json();
        setPrayerLinks(data.links || []);
      }
    } catch (err) {
      console.error('Error loading prayer links:', err);
      setPrayerLinks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCase = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/pastoral-care/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          person_id: formData.person_id,
          priority: formData.priority,
          notes: formData.notes,
          assigned_leader: formData.assigned_leader || null,
          follow_up_date: formData.follow_up_date || null,
          status: 'open'
        })
      });
      
      if (response.ok) {
        setShowCreateModal(false);
        setFormData({
          person_id: '',
          person_name: '',
          priority: 'medium',
          notes: '',
          assigned_leader: '',
          follow_up_date: '',
          ai_summary: ''
        });
        setPersonSearchTerm('');
        setShowPeopleDropdown(false);
        loadCareCases();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || 'Failed to create case'}`);
      }
    } catch (err) {
      console.error('Error creating case:', err);
      alert('Failed to create case');
    }
  };

  const handleAssignLeader = async (caseId, leaderName) => {
    try {
      const response = await fetch(`/api/pastoral-care/cases/${caseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          assigned_leader: leaderName
        })
      });
      
      if (response.ok) {
        setShowAssignModal(null);
        loadCareCases();
      }
    } catch (err) {
      console.error('Error assigning leader:', err);
      alert('Failed to assign leader');
    }
  };

  const updatePrayerStatus = async (submissionId, newStatus) => {
    try {
      const response = await fetch(`/api/prayer/submissions/${submissionId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      // Refresh the list
      loadPrayerRequests();
    } catch (err) {
      console.error('Error updating prayer status:', err);
      alert('Failed to update status');
    }
  };

  const createPrayerLink = async () => {
    try {
      const response = await fetch('/api/prayer/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newLink)
      });

      if (!response.ok) {
        throw new Error('Failed to create prayer link');
      }

      const data = await response.json();
      
      // Refresh links
      loadPrayerLinks();
      setShowCreateLink(false);
      
      // Reset form
      setNewLink({
        link_type: 'both',
        campus: '',
        department: '',
        location: '',
        description: '',
        code_type: 'qr'
      });
    } catch (err) {
      console.error('Error creating prayer link:', err);
      alert('Failed to create prayer link');
    }
  };

  const toggleLinkActive = async (linkId, isActive) => {
    try {
      const response = await fetch(`/api/prayer/links/${linkId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ is_active: !isActive })
      });

      if (!response.ok) {
        throw new Error('Failed to update link');
      }

      // Refresh links
      loadPrayerLinks();
    } catch (err) {
      console.error('Error updating link:', err);
      alert('Failed to update link');
    }
  };

  const copyLinkToClipboard = (link) => {
    const url = `${window.location.origin}/prayer/link/${link.link_id}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  const handleResolveCase = async (caseId) => {
    if (!window.confirm('Mark this case as resolved?')) return;
    
    try {
      const response = await fetch(`/api/pastoral-care/cases/${caseId}/resolve`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        loadCareCases();
      }
    } catch (err) {
      console.error('Error resolving case:', err);
      alert('Failed to resolve case');
    }
  };

  const handleCreateCaseFromPrayer = async (prayerRequest) => {
    setFormData({
      person_id: prayerRequest.person_id || '',
      person_name: prayerRequest.person_name || '',
      priority: 'medium',
      notes: `Prayer Request: ${prayerRequest.summary || prayerRequest.details || ''}`,
      assigned_leader: '',
      follow_up_date: '',
      ai_summary: ''
    });
    setShowCreateModal(true);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'low':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'resolved':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'closed':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  const canCreateCase = ['admin', 'senior_leadership', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'pastor', 'staff'].includes(userRole);

  const filteredCases = careCases;
  const filteredPrayerRequests = prayerRequests;
  
  // Filter people based on search term
  const filteredPeople = people.filter(person => {
    if (!personSearchTerm) return false;
    const search = personSearchTerm.toLowerCase();
    const fullName = (person.full_name || '').toLowerCase();
    const preferredName = (person.preferred_name || '').toLowerCase();
    const email = (person.email || '').toLowerCase();
    const personId = (person.id || '').toLowerCase();
    return fullName.includes(search) || 
           preferredName.includes(search) || 
           email.includes(search) || 
           personId.includes(search);
  }).slice(0, 20); // Limit to 20 results for performance

  // Debug: Log current state
  useEffect(() => {
    console.log('PastoralCare State:', {
      loading,
      careCasesCount: careCases.length,
      prayerRequestsCount: prayerRequests.length,
      selectedTab,
      statusFilter,
      priorityFilter,
      selectedCampus,
      userRole
    });
  }, [loading, careCases.length, prayerRequests.length, selectedTab, statusFilter, priorityFilter, selectedCampus, userRole]);

  // Ensure we always render the Pastoral Care UI, never CampusSelector
  console.log('🔵 PastoralCare component rendering - URL:', window.location.pathname);
  console.log('🔵 showCampusSelector:', showCampusSelector, 'campuses:', campuses.length);
  
  // CRITICAL: Never render CampusSelector - this component should ONLY show Pastoral Care UI
  return (
    <div className="h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 overflow-y-auto" data-page="pastoral-care">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Pastoral Care</h2>
            <p className="text-white/60">Care engine for tracking and managing pastoral needs</p>
            <p className="text-red-400 text-xs mt-1">⚠️ If you see "Campus Dashboard Selection" below, the frontend needs to be rebuilt!</p>
          </div>
          {canCreateCase && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              Create Case
            </button>
          )}
        </div>

        {/* Campus Selector - Simple Dropdown */}
        {showCampusSelector && campuses.length > 0 && (
          <div className="mb-4">
            <label className="block text-white/80 mb-2 text-sm font-medium">Filter by Campus</label>
            <select
              value={selectedCampus?.id || 'all_campuses'}
              onChange={(e) => {
                const campusId = e.target.value;
                if (campusId === 'all_campuses') {
                  setSelectedCampus({ id: 'all_campuses', name: 'All Campuses' });
                } else {
                  const campus = campuses.find(c => c.id === campusId || c.campus_id === campusId);
                  if (campus) {
                    setSelectedCampus({ 
                      id: campus.id || campus.campus_id, 
                      name: campus.name || campus.display_name || campusId 
                    });
                  }
                }
                loadCareCases();
                if (selectedTab === 'prayer' || selectedTab === 'all') {
                  loadPrayerRequests();
                }
              }}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500 min-w-[200px]"
            >
              <option value="all_campuses">All Campuses</option>
              {campuses.map(campus => (
                <option key={campus.id || campus.campus_id} value={campus.id || campus.campus_id}>
                  {campus.name || campus.display_name || campus.id || campus.campus_id}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-white/10">
          <button
            onClick={() => {
              setSelectedTab('cases');
              setSearchParams({ tab: 'cases' });
            }}
            className={`px-4 py-2 font-medium transition-colors ${
              selectedTab === 'cases'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Care Cases ({filteredCases.length})
          </button>
          <button
            onClick={() => {
              setSelectedTab('prayer');
              setSearchParams({ tab: 'prayer' });
            }}
            className={`px-4 py-2 font-medium transition-colors ${
              selectedTab === 'prayer'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Prayer ({filteredPrayerRequests.length + praiseReports.length})
          </button>
          <button
            onClick={() => {
              setSelectedTab('all');
              setSearchParams({ tab: 'all' });
            }}
            className={`px-4 py-2 font-medium transition-colors ${
              selectedTab === 'all'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-white/60 hover:text-white'
            }`}
          >
            All ({filteredCases.length + filteredPrayerRequests.length})
          </button>
        </div>

        {/* Prayer Sub-tabs */}
        {selectedTab === 'prayer' && (
          <div className="flex gap-2 mb-4 bg-slate-800/50 rounded-xl p-2">
            <button
              onClick={() => setPrayerSubTab('requests')}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                prayerSubTab === 'requests'
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              🙏 Prayer Requests ({prayerRequests.length})
            </button>
            <button
              onClick={() => setPrayerSubTab('praise')}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                prayerSubTab === 'praise'
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              🎉 Praise Reports ({praiseReports.length})
            </button>
            <button
              onClick={() => setPrayerSubTab('links')}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                prayerSubTab === 'links'
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              🔗 Prayer Links ({prayerLinks.length})
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/40" />
              <input
                type="text"
                placeholder="Search cases or requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
          
          {(selectedTab === 'cases' || selectedTab === 'all') && (
            <>
              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Campuses</option>
                {campuses.map(campus => (
                  <option key={campus.id || campus.campus_id} value={campus.id || campus.campus_id}>
                    {campus.name || campus.display_name}
                  </option>
                ))}
              </select>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </>
          )}
          
          {selectedTab === 'prayer' && (
            <>
              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Campuses</option>
                {campuses.map(campus => (
                  <option key={campus.id || campus.campus_id} value={campus.id || campus.campus_id}>
                    {campus.name || campus.display_name}
                  </option>
                ))}
              </select>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="closed">Closed</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-white/60">Loading...</div>
      ) : (
        <div className="space-y-4">
          {/* Care Cases */}
          {(selectedTab === 'cases' || selectedTab === 'all') && filteredCases.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Care Cases</h3>
              {filteredCases.map((case_) => (
                <div
                  key={case_.id}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-4 hover:border-purple-500/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-xl font-semibold text-white">
                          {case_.person_name || 'Unnamed Case'}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(case_.priority)}`}>
                          {case_.priority || 'medium'} priority
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(case_.status)}`}>
                          {case_.status || 'open'}
                        </span>
                      </div>
                      <div className="text-white/60 text-sm mb-4">{case_.notes}</div>
                    </div>
                    <div className="flex gap-2">
                      {canCreateCase && case_.status === 'open' && (
                        <>
                          <button
                            onClick={() => setShowAssignModal(case_.id)}
                            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Assign Leader"
                          >
                            <UserGroupIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleResolveCase(case_.id)}
                            className="p-2 text-white/60 hover:text-green-400 hover:bg-white/10 rounded-lg transition-colors"
                            title="Resolve Case"
                          >
                            <CheckCircleIcon className="h-5 w-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-white/60 text-sm mb-1">Assigned Leader</div>
                      <div className="text-white font-medium">
                        {case_.assigned_leader_name || (case_.assigned_leader ? pastors.find(p => p.id === case_.assigned_leader || String(p.id) === String(case_.assigned_leader))?.name || case_.assigned_leader : 'Unassigned')}
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-white/60 text-sm mb-1">Follow-up Date</div>
                      <div className="text-white font-medium">
                        {case_.follow_up_date ? new Date(case_.follow_up_date).toLocaleDateString() : 'No date set'}
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-white/60 text-sm mb-1">Created</div>
                      <div className="text-white font-medium">
                        {case_.created_at ? new Date(case_.created_at).toLocaleDateString() : 'Unknown'}
                      </div>
                    </div>
                  </div>

                  {/* Follow-up Steps */}
                  {case_.suggested_responses && case_.suggested_responses.length > 0 && (
                    <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                      <div className="text-blue-400 font-semibold mb-3 flex items-center gap-2">
                        <ClockIcon className="h-5 w-5" />
                        Follow-up Steps
                      </div>
                      <ul className="space-y-2">
                        {case_.suggested_responses.map((step, index) => (
                          <li key={index} className="text-white/80 flex items-start gap-2">
                            <span className="text-blue-400 font-bold mt-1">{index + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {case_.ai_summary && (
                    <div className="mt-4 bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                      <div className="text-purple-400 font-semibold mb-2">AI Care Summary</div>
                      <div className="text-white/80">{case_.ai_summary}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Prayer & Praise Content */}
          {selectedTab === 'prayer' && (
            <>
              {/* Prayer Requests Sub-tab */}
              {prayerSubTab === 'requests' && (
                <>
                  {loading ? (
                    <div className="text-center py-12 text-gray-400">Loading...</div>
                  ) : prayerRequests.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <div className="text-6xl mb-4">🙏</div>
                      <p>No prayer requests yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {prayerRequests.map((item) => (
                        <div
                          key={item.id}
                          className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl p-6 hover:border-purple-500/30 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                                item.priority === 'high' ? 'bg-red-500/20' : 
                                item.priority === 'medium' ? 'bg-yellow-500/20' : 
                                'bg-green-500/20'
                              }`}>
                                🙏
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-white font-semibold">{item.person_name || 'Anonymous'}</h3>
                                  {item.person_id && (
                                    <button
                                      onClick={() => navigate(`/persons/${item.person_id}`)}
                                      className="p-1 hover:bg-purple-500/20 rounded transition-colors"
                                      title="View Heartbeat Profile"
                                    >
                                      <HeartIcon className="h-4 w-4 text-purple-400" />
                                    </button>
                                  )}
                                </div>
                                <p className="text-sm text-gray-400">
                                  {new Date(item.created_at).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              item.status === 'open' ? 'bg-blue-500/20 text-blue-300' :
                              item.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-300' :
                              'bg-green-500/20 text-green-300'
                            }`}>
                              {item.status}
                            </span>
                          </div>
                          
                          <p className="text-gray-300 mb-3">{item.summary}</p>
                          
                          {item.details && item.details !== item.summary && (
                            <p className="text-sm text-gray-400 border-l-2 border-purple-500/30 pl-3 mb-3">
                              {item.details}
                            </p>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 text-sm text-gray-400">
                              {item.campus && (
                                <div className="flex items-center gap-1">
                                  <MapPinIcon className="h-4 w-4" />
                                  <span className="capitalize">{item.campus.replace('_', ' ')}</span>
                                </div>
                              )}
                              {item.priority && (
                                <span className={`px-2 py-1 rounded text-xs ${
                                  item.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                                  item.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                  'bg-green-500/20 text-green-300'
                                }`}>
                                  {item.priority} priority
                                </span>
                              )}
                            </div>
                            
                            {/* Status Actions */}
                            <div className="flex items-center gap-2">
                              {item.status === 'open' && (
                                <>
                                  <button
                                    onClick={() => updatePrayerStatus(item.id, 'in_progress')}
                                    className="px-3 py-1 text-xs bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30 transition-colors"
                                  >
                                    Mark In Progress
                                  </button>
                                  <button
                                    onClick={() => updatePrayerStatus(item.id, 'closed')}
                                    className="px-3 py-1 text-xs bg-green-500/20 text-green-300 rounded hover:bg-green-500/30 transition-colors"
                                  >
                                    Resolve
                                  </button>
                                </>
                              )}
                              {item.status === 'in_progress' && (
                                <button
                                  onClick={() => updatePrayerStatus(item.id, 'closed')}
                                  className="px-3 py-1 text-xs bg-green-500/20 text-green-300 rounded hover:bg-green-500/30 transition-colors"
                                >
                                  Resolve
                                </button>
                              )}
                              {item.status === 'closed' && (
                                <button
                                  onClick={() => updatePrayerStatus(item.id, 'open')}
                                  className="px-3 py-1 text-xs bg-gray-500/20 text-gray-300 rounded hover:bg-gray-500/30 transition-colors"
                                >
                                  Reopen
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Praise Reports Sub-tab */}
              {prayerSubTab === 'praise' && (
                <>
                  {loading ? (
                    <div className="text-center py-12 text-gray-400">Loading...</div>
                  ) : praiseReports.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <div className="text-6xl mb-4">🎉</div>
                      <p>No praise reports yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {praiseReports.map((item) => (
                        <div
                          key={item.id}
                          className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl p-6 hover:border-purple-500/30 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                                item.priority === 'high' ? 'bg-red-500/20' : 
                                item.priority === 'medium' ? 'bg-yellow-500/20' : 
                                'bg-green-500/20'
                              }`}>
                                🎉
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-white font-semibold">{item.person_name || 'Anonymous'}</h3>
                                  {item.person_id && (
                                    <button
                                      onClick={() => navigate(`/persons/${item.person_id}`)}
                                      className="p-1 hover:bg-purple-500/20 rounded transition-colors"
                                      title="View Heartbeat Profile"
                                    >
                                      <HeartIcon className="h-4 w-4 text-purple-400" />
                                    </button>
                                  )}
                                </div>
                                <p className="text-sm text-gray-400">
                                  {new Date(item.created_at).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              item.status === 'open' ? 'bg-blue-500/20 text-blue-300' :
                              item.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-300' :
                              'bg-green-500/20 text-green-300'
                            }`}>
                              {item.status}
                            </span>
                          </div>
                          
                          <p className="text-gray-300 mb-3">{item.summary}</p>
                          
                          {item.details && item.details !== item.summary && (
                            <p className="text-sm text-gray-400 border-l-2 border-purple-500/30 pl-3 mb-3">
                              {item.details}
                            </p>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 text-sm text-gray-400">
                              {item.campus && (
                                <div className="flex items-center gap-1">
                                  <MapPinIcon className="h-4 w-4" />
                                  <span className="capitalize">{item.campus.replace('_', ' ')}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Status Actions */}
                            <div className="flex items-center gap-2">
                              {item.status === 'closed' && (
                                <button
                                  onClick={() => updatePrayerStatus(item.id, 'open')}
                                  className="px-3 py-1 text-xs bg-gray-500/20 text-gray-300 rounded hover:bg-gray-500/30 transition-colors"
                                >
                                  Reopen
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Prayer Links Sub-tab */}
              {prayerSubTab === 'links' && (
                <>
                  {loading ? (
                    <div className="text-center py-12 text-gray-400">Loading...</div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-xl font-semibold text-white">Prayer Links</h3>
                          <p className="text-sm text-gray-400">Create QR codes, NFC tags, and shareable links for prayer submissions</p>
                        </div>
                        <button
                          onClick={() => setShowCreateLink(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all"
                        >
                          <PlusIcon className="h-5 w-5" />
                          Create Link
                        </button>
                      </div>

                      {showCreateLink && (
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl p-6">
                          <h4 className="text-lg font-semibold text-white mb-4">Create New Prayer Link</h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">Link Type</label>
                              <select
                                value={newLink.link_type}
                                onChange={(e) => setNewLink({ ...newLink, link_type: e.target.value })}
                                className="w-full bg-slate-700 border border-white/10 rounded-lg px-3 py-2 text-white"
                              >
                                <option value="both">Both (Prayer & Praise)</option>
                                <option value="prayer">Prayer Only</option>
                                <option value="praise">Praise Only</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">Code Type</label>
                              <select
                                value={newLink.code_type}
                                onChange={(e) => setNewLink({ ...newLink, code_type: e.target.value })}
                                className="w-full bg-slate-700 border border-white/10 rounded-lg px-3 py-2 text-white"
                              >
                                <option value="qr">QR Code</option>
                                <option value="nfc">NFC Tag</option>
                                <option value="link">Web Link</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
                              <input
                                type="text"
                                placeholder="e.g., Main Entrance, Youth Room"
                                value={newLink.location}
                                onChange={(e) => setNewLink({ ...newLink, location: e.target.value })}
                                className="w-full bg-slate-700 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                              <input
                                type="text"
                                placeholder="e.g., Paradise Campus Prayer Wall"
                                value={newLink.description}
                                onChange={(e) => setNewLink({ ...newLink, description: e.target.value })}
                                className="w-full bg-slate-700 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500"
                              />
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <button
                              onClick={createPrayerLink}
                              className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600"
                            >
                              Create Link
                            </button>
                            <button
                              onClick={() => setShowCreateLink(false)}
                              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {prayerLinks.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                          <QrCodeIcon className="h-16 w-16 mx-auto mb-4 text-gray-600" />
                          <p>No prayer links created yet</p>
                          <p className="text-sm mt-2">Create links for QR codes, NFC tags, or social media</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4">
                          {prayerLinks.map((link) => (
                            <div
                              key={link.id}
                              className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl p-6"
                            >
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-2xl">
                                    {link.code_type === 'nfc' ? '📡' : link.code_type === 'qr' ? '📱' : '🔗'}
                                  </div>
                                  <div>
                                    <h4 className="text-white font-semibold">{link.location || 'Unnamed Link'}</h4>
                                    <p className="text-sm text-gray-400">{link.description}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    link.is_active 
                                      ? 'bg-green-500/20 text-green-300' 
                                      : 'bg-gray-500/20 text-gray-400'
                                  }`}>
                                    {link.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                  <button
                                    onClick={() => toggleLinkActive(link.id, link.is_active)}
                                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                                    title={link.is_active ? 'Deactivate' : 'Activate'}
                                  >
                                    {link.is_active ? (
                                      <XCircleIcon className="h-5 w-5 text-red-400" />
                                    ) : (
                                      <CheckCircleIcon className="h-5 w-5 text-green-400" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Type</p>
                                  <p className="text-white">{link.link_type}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Campus</p>
                                  <p className="text-white">{link.campus || 'All'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Scans</p>
                                  <p className="text-white">{link.scan_count || 0}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase">Submissions</p>
                                  <p className="text-white">{link.submission_count || 0}</p>
                                </div>
                              </div>

                              <div className="bg-slate-700/50 rounded-lg p-3 font-mono text-sm text-gray-300 break-all">
                                {window.location.origin}/prayer/link/{link.link_id}
                              </div>

                              <button
                                onClick={() => copyLinkToClipboard(link)}
                                className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                              >
                                <LinkIcon className="h-4 w-4" />
                                Copy Link
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Prayer Requests (for 'all' tab) */}
          {selectedTab === 'all' && filteredPrayerRequests.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Prayer Requests</h3>
              {filteredPrayerRequests.map((request) => (
                <div
                  key={request.id}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-4 hover:border-purple-500/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <HeartIcon className="h-5 w-5 text-pink-400" />
                        <h3 className="text-xl font-semibold text-white">
                          {request.person_name || 'Anonymous'}
                        </h3>
                        {request.campus && (
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                            {request.campus}
                          </span>
                        )}
                      </div>
                      <div className="text-white/60 text-sm mb-4">{request.summary || request.details || 'No details'}</div>
                    </div>
                    {canCreateCase && (
                      <button
                        onClick={() => handleCreateCaseFromPrayer(request)}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Create Case
                      </button>
                    )}
                  </div>
                  <div className="text-white/40 text-xs">
                    {request.created_at ? new Date(request.created_at).toLocaleString() : 'Unknown date'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {selectedTab !== 'prayer' && (
            <>
              {((selectedTab === 'cases' && filteredCases.length === 0) ||
                (selectedTab === 'all' && filteredCases.length === 0 && filteredPrayerRequests.length === 0)) && (
                <div className="text-center py-12 text-white/60">
                  <HandRaisedIcon className="h-16 w-16 mx-auto mb-4 text-white/20" />
                  <p className="text-lg mb-2">No {selectedTab === 'all' ? 'items' : 'care cases'} found</p>
                  {canCreateCase && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Create Your First Case
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Create Case Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-white">Create Care Case</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({
                    person_id: '',
                    person_name: '',
                    priority: 'medium',
                    notes: '',
                    assigned_leader: '',
                    follow_up_date: '',
                    ai_summary: ''
                  });
                  setPersonSearchTerm('');
                  setShowPeopleDropdown(false);
                }}
                className="text-white/60 hover:text-white"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateCase} className="space-y-4">
              <div className="relative">
                <label className="block text-white/80 mb-2">Select Person</label>
                <div className="relative people-selector-container">
                  <input
                    type="text"
                    value={formData.person_name || personSearchTerm}
                    onChange={(e) => {
                      setPersonSearchTerm(e.target.value);
                      setShowPeopleDropdown(true);
                      if (!e.target.value) {
                        setFormData({ ...formData, person_id: '', person_name: '' });
                      }
                    }}
                    onFocus={() => {
                      setShowPeopleDropdown(true);
                      if (!personSearchTerm && formData.person_name) {
                        setPersonSearchTerm(formData.person_name);
                      }
                    }}
                    placeholder="Search for a person..."
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    required={!formData.person_id}
                  />
                  {peopleLoading && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/40">
                      Loading...
                    </div>
                  )}
                  {showPeopleDropdown && personSearchTerm && (
                    <div 
                      className="absolute z-50 w-full mt-1 bg-slate-800 border border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {filteredPeople.length > 0 ? (
                        filteredPeople.map((person) => (
                          <button
                            key={person.id}
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                person_id: person.id,
                                person_name: person.preferred_name || person.full_name
                              });
                              setPersonSearchTerm(person.preferred_name || person.full_name);
                              setShowPeopleDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-white/10 text-white transition-colors"
                          >
                            <div className="font-medium">{person.preferred_name || person.full_name}</div>
                            {person.full_name !== person.preferred_name && (
                              <div className="text-sm text-white/60">{person.full_name}</div>
                            )}
                            {person.email && (
                              <div className="text-xs text-white/40">{person.email}</div>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-white/60 text-sm">No people found</div>
                      )}
                    </div>
                  )}
                </div>
                {formData.person_id && (
                  <div className="mt-2 text-sm text-purple-300">
                    Selected: {formData.person_name}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-white/80 mb-2">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              
              <div>
                <label className="block text-white/80 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Describe the care need..."
                  rows={4}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-white/80 mb-2">Assign Leader</label>
                <select
                  value={formData.assigned_leader}
                  onChange={(e) => setFormData({ ...formData, assigned_leader: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">Unassigned</option>
                  {pastors.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-white/80 mb-2">Follow-up Date</label>
                <input
                  type="date"
                  value={formData.follow_up_date}
                  onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                >
                  Create Case
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Leader Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Assign Leader</h3>
              <button
                onClick={() => setShowAssignModal(null)}
                className="text-white/60 hover:text-white"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-3">
              {pastors.map(pastor => (
                <button
                  key={pastor.id}
                  onClick={() => handleAssignLeader(showAssignModal, pastor.id)}
                  className="w-full text-left px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-colors"
                >
                  {pastor.name} <span className="text-white/40 text-sm">({pastor.role})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PastoralCare;
