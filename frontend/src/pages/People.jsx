import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  UserGroupIcon, 
  PlusIcon, 
  PencilIcon, 
  XMarkIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  HeartIcon,
  ArchiveBoxIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ListBulletIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

const People = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [persons, setPersons] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [connectGroups, setConnectGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [campusFilter, setCampusFilter] = useState('all_campuses');
  const [pulseFilter, setPulseFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [archiveFilter, setArchiveFilter] = useState('active'); // 'active', 'archived', 'all'
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(null);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [tempDepartment, setTempDepartment] = useState('');
  const [isSavingDepartment, setIsSavingDepartment] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [statusFilterTab, setStatusFilterTab] = useState('all'); // 'all', 'healthy', 'watch', 'at_risk', 'critical', 'new_people', 'new_christians', 'in_groups'
  const [formData, setFormData] = useState({
    full_name: '',
    preferred_name: '',
    email: '',
    phone: '',
    campus: 'all_campuses',
    department: '',
    connect_group: '',
    dream_team_roles: [],
    birthday: '',
    pastoral_notes: '',
    tags: []
  });

  // Sync statusFilterTab with pulseFilter for API calls
  useEffect(() => {
    if (statusFilterTab === 'healthy') {
      setPulseFilter('healthy'); // Use heartbeat status directly
    } else if (statusFilterTab === 'watch') {
      setPulseFilter('watch'); // Use heartbeat status directly
    } else if (statusFilterTab === 'at_risk') {
      setPulseFilter('at_risk'); // Use heartbeat status directly
    } else if (statusFilterTab === 'critical') {
      setPulseFilter('critical'); // Use heartbeat status directly
    } else if (statusFilterTab === 'all') {
      setPulseFilter('all');
    } else if (statusFilterTab === 'new_people' || statusFilterTab === 'new_christians' || statusFilterTab === 'in_groups') {
      // These filters are handled client-side, but we still need to load all persons
      setPulseFilter('all');
    }
  }, [statusFilterTab]);

  useEffect(() => {
    loadCampuses();
    loadPersons();
  }, [campusFilter, pulseFilter, departmentFilter, searchTerm, archiveFilter]);

  // Refresh data when window regains focus (in case mobile app updated data)
  useEffect(() => {
    const handleFocus = () => {
      loadPersons();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);
  

  // Check for edit query parameter and open modal
  useEffect(() => {
    const editPersonId = searchParams.get('edit');
    if (editPersonId && persons.length > 0 && !showModal) {
      const personToEdit = persons.find(p => p.id === editPersonId);
      if (personToEdit) {
        handleOpenModal(personToEdit);
        // Remove the query parameter from URL
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('edit');
        setSearchParams(newSearchParams, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, persons, showModal]);

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

  const loadConnectGroups = async (campus = null) => {
    try {
      const params = new URLSearchParams();
      if (campus && campus !== 'all_campuses') {
        params.append('campus', campus);
      }
      params.append('is_active', 'true');
      
      const response = await fetch(`/api/connect-groups?${params.toString()}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setConnectGroups(data.groups || []);
      }
    } catch (err) {
      console.error('Error loading connect groups:', err);
    }
  };

  const loadPersons = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (campusFilter && campusFilter !== 'all_campuses') {
        params.append('campus', campusFilter);
      }
      if (pulseFilter && pulseFilter !== 'all') {
        params.append('pulse_status', pulseFilter);
      }
      if (departmentFilter && departmentFilter !== 'all') {
        params.append('department', departmentFilter);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      // Archive filter: 'active', 'archived', 'all'
      params.append('archive_filter', archiveFilter);

      // Add cache-busting timestamp
      params.append('_t', Date.now().toString());
      
      const response = await fetch(`/api/persons?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPersons(data.persons || []);
        setError('');
      } else if (response.status === 403) {
        setError('You do not have permission to view people data');
      } else {
        setError('Failed to load people');
      }
    } catch (err) {
      console.error('Error loading persons:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = async (person = null) => {
    if (person) {
      // CRITICAL: Fetch by EMAIL not ID to ensure we get the same record as mobile app
      // Mobile app updates by email, so we must also fetch by email to see those changes
      try {
        const freshResponse = await fetch(`/api/persons/email/${person.email}?_t=${Date.now()}&_r=${Math.random().toString(36).substr(2, 9)}`, {
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        if (freshResponse.ok) {
          const freshData = await freshResponse.json();
          console.log('Fresh person data from /api/persons/email:', freshData);
          // /api/persons/email returns person directly, not nested
          person = freshData;
        }
      } catch (err) {
        console.error('Error fetching person data by email:', err);
      }
      
      setEditingPerson(person);
      setFormData({
        full_name: person.full_name || '',
        preferred_name: person.preferred_name || '',
        email: person.email || '',
        phone: person.phone || '',
        campus: person.campus || 'all_campuses',
        department: person.department || '',
        connect_group: person.connect_group || '',
        dream_team_roles: person.dream_team_roles || [],
        birthday: person.birthday ? person.birthday.split('T')[0] : '',
        pastoral_notes: person.pastoral_notes || '',
        tags: person.tags || []
      });
      // Load connect groups for this person's campus
      await loadConnectGroups(person.campus || 'all_campuses');
    } else {
      setEditingPerson(null);
      setFormData({
        full_name: '',
        preferred_name: '',
        email: '',
        phone: '',
        campus: 'all_campuses',
        department: '',
        connect_group: '',
        dream_team_roles: [],
        birthday: '',
        pastoral_notes: '',
        tags: []
      });
      // Load all connect groups for new person
      await loadConnectGroups('all_campuses');
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingPerson(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.full_name) {
      alert('Full name is required');
      return;
    }

    if (!formData.campus || formData.campus === 'all_campuses') {
      alert('Campus is required');
      return;
    }

    try {
      // Use person ID for updates (backend handles both ID and email)
      const url = editingPerson 
        ? `/api/persons/${editingPerson.id}`  // Use ID (backend accepts both ID and email)
        : '/api/persons';
      
      const method = editingPerson ? 'PUT' : 'POST';
      console.log(`${method} ${url}`, formData);
      
      const payload = {
        ...formData,
        dream_team_roles: Array.isArray(formData.dream_team_roles) 
          ? formData.dream_team_roles 
          : [],
        tags: Array.isArray(formData.tags) ? formData.tags : []
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        // Force reload persons with cache-busting
        await loadPersons();
        handleCloseModal();
        alert(editingPerson ? 'Person updated successfully' : 'Person created successfully');
      } else {
        alert(data.error || 'Failed to save person');
      }
    } catch (err) {
      console.error('Error saving person:', err);
      alert('Failed to save person');
    }
  };

  const getPulseStatusColor = (status) => {
    const colors = {
      'green': 'bg-green-500/20 text-green-400 border-green-500/30',
      'amber': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'red': 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return colors[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  const getPulseStatusLabel = (status) => {
    const labels = {
      'green': 'Active',
      'amber': 'At Risk',
      'red': 'Critical'
    };
    return labels[status] || 'Unknown';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return '1 day ago';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
      }
      if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} ${months === 1 ? 'month' : 'months'} ago`;
      }
      return date.toLocaleDateString();
    } catch {
      return 'Never';
    }
  };
  
  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  
  // Get heartbeat score color
  const getHeartbeatColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };
  
  // Get heartbeat score from person
  const getHeartbeatScore = (person) => {
    // Use heartbeat_score from API if available
    if (person.heartbeat_score !== undefined) {
      return person.heartbeat_score;
    }
    // Fallback calculation from pulse_status
    if (person.pulse_status === 'green') return 85;
    if (person.pulse_status === 'amber') return 65;
    if (person.pulse_status === 'red') return 35;
    return 50;
  };
  
  // Get serving roles from person
  const getServingRoles = (person) => {
    try {
      if (person.dream_team_roles) {
        const roles = typeof person.dream_team_roles === 'string' 
          ? JSON.parse(person.dream_team_roles) 
          : person.dream_team_roles;
        if (Array.isArray(roles) && roles.length > 0) {
          return roles.join(', ');
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
    return 'No Group';
  };
  
  // Get connect group name
  const getConnectGroupName = (person) => {
    if (person.connect_group_name) return person.connect_group_name;
    if (person.connect_group) return person.connect_group;
    return 'No Group';
  };
  
  // Filter persons based on statusFilterTab
  const filteredPersons = useMemo(() => {
    let filtered = persons;
    
    if (statusFilterTab === 'new_people') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filtered = filtered.filter(p => {
        if (!p.created_at) return false;
        const created = new Date(p.created_at);
        return created >= thirtyDaysAgo;
      });
    } else if (statusFilterTab === 'new_christians') {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      filtered = filtered.filter(p => {
        if (p.is_new_christian) return true;
        if (p.baptised_on) {
          const baptised = new Date(p.baptised_on);
          return baptised >= twoYearsAgo;
        }
        return false;
      });
    } else if (statusFilterTab === 'in_groups') {
      filtered = filtered.filter(p => {
        if (p.connect_group) return true;
        try {
          const roles = typeof p.dream_team_roles === 'string' 
            ? JSON.parse(p.dream_team_roles || '[]') 
            : (p.dream_team_roles || []);
          return Array.isArray(roles) && roles.length > 0;
        } catch {
          return false;
        }
      });
    } else if (statusFilterTab === 'healthy') {
      filtered = filtered.filter(p => p.heartbeat_status === 'healthy' || (p.heartbeat_score >= 80 && !p.heartbeat_status));
    } else if (statusFilterTab === 'watch') {
      filtered = filtered.filter(p => p.heartbeat_status === 'watch' || (p.heartbeat_score >= 60 && p.heartbeat_score < 80 && !p.heartbeat_status));
    } else if (statusFilterTab === 'at_risk') {
      filtered = filtered.filter(p => p.heartbeat_status === 'at_risk' || (p.heartbeat_score >= 40 && p.heartbeat_score < 60 && !p.heartbeat_status));
    } else if (statusFilterTab === 'critical') {
      filtered = filtered.filter(p => p.heartbeat_status === 'critical' || (p.heartbeat_score < 40 && !p.heartbeat_status));
    }
    
    return filtered;
  }, [persons, statusFilterTab]);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilterTab, campusFilter, departmentFilter, searchTerm]);
  
  const totalPages = Math.ceil(filteredPersons.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFilteredPersons = filteredPersons.slice(startIndex, endIndex);

  const handleViewPerson = (personId) => {
    navigate(`/persons/${personId}`);
  };

  const handleArchive = async (person) => {
    try {
      const response = await fetch(`/api/persons/${person.id}/archive`, {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        await loadPersons();
        setShowArchiveConfirm(null);
        alert('Person archived successfully');
      } else {
        alert(data.error || 'Failed to archive person');
      }
    } catch (err) {
      console.error('Error archiving person:', err);
      alert('Failed to archive person');
    }
  };

  const handleRestore = async (person) => {
    try {
      const response = await fetch(`/api/persons/${person.id}/restore`, {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        await loadPersons();
        alert('Person restored successfully');
      } else {
        alert(data.error || 'Failed to restore person');
      }
    } catch (err) {
      console.error('Error restoring person:', err);
      alert('Failed to restore person');
    }
  };

  const handleDelete = async (person) => {
    try {
      const response = await fetch(`/api/persons/${person.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        await loadPersons();
        setShowDeleteConfirm(null);
        alert('Person permanently deleted');
      } else {
        alert(data.error || 'Failed to delete person');
      }
    } catch (err) {
      console.error('Error deleting person:', err);
      alert('Failed to delete person');
    }
  };

  const handleDepartmentEdit = (person) => {
    setEditingDepartment(person.id);
    setTempDepartment(person.department || '');
  };

  const handleDepartmentSave = async (person) => {
    if (isSavingDepartment) return;
    setIsSavingDepartment(true);
    try {
      const response = await fetch(`/api/persons/${person.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          department: tempDepartment || null
        })
      });

      const data = await response.json();

      if (response.ok) {
        await loadPersons();
        setEditingDepartment(null);
        setTempDepartment('');
      } else {
        alert(data.error || 'Failed to update department');
      }
    } catch (err) {
      console.error('Error updating department:', err);
      alert('Failed to update department');
    } finally {
      setIsSavingDepartment(false);
    }
  };

  const handleDepartmentCancel = () => {
    setIsSavingDepartment(true); // Prevent blur save
    setEditingDepartment(null);
    setTempDepartment('');
    setTimeout(() => setIsSavingDepartment(false), 100);
  };

  const handleImportCSV = async () => {
    if (!importFile) {
      alert('Please select a CSV file');
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);

      const response = await fetch('/api/persons/import_pco', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message || `Import completed: ${data.added} added, ${data.skipped} skipped`);
        setShowImportModal(false);
        setImportFile(null);
        await loadPersons();
      } else {
        alert(data.error || 'Failed to import CSV');
      }
    } catch (err) {
      console.error('Error importing CSV:', err);
      alert('Failed to import CSV');
    } finally {
      setImporting(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadPersons();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Stats (only count active people unless showing archived)
  // Filter persons based on archive filter
  const activePersons = archiveFilter === 'archived' 
    ? persons.filter(p => !p.is_active)
    : archiveFilter === 'all'
    ? persons
    : persons.filter(p => p.is_active);
  const stats = {
    total: activePersons.length,
    green: activePersons.filter(p => p.pulse_status === 'green').length,
    amber: activePersons.filter(p => p.pulse_status === 'amber').length,
    red: activePersons.filter(p => p.pulse_status === 'red').length
  };
  
  // Pulse status labels
  const pulseLabels = {
    'green': 'Active',
    'amber': 'At Risk',
    'red': 'Critical'
  };

  if (loading && persons.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-white text-xl">Loading people...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">People</h1>
              <p className="text-slate-400 text-sm">Manage church members and track engagement</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/lists')}
                className="flex items-center px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-lg transition-colors text-sm"
              >
                <ListBulletIcon className="w-4 h-4 mr-2" />
                Lists
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-500/30 rounded-lg transition-colors text-sm"
              >
                <ArrowPathIcon className="w-4 h-4 mr-2" />
                Import CSV
              </button>
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg transition-all text-sm font-medium"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Person
              </button>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search people, families..."
                className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              />
            </div>
          </div>
          
          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setStatusFilterTab('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilterTab === 'all'
                  ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-blue-500/30'
                  : 'bg-slate-800/50 text-slate-300 border border-slate-700/50 hover:bg-slate-700/50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilterTab('healthy')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilterTab === 'healthy'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800/50 text-slate-300 border border-slate-700/50 hover:bg-slate-700/50'
              }`}
            >
              Healthy
            </button>
            <button
              onClick={() => setStatusFilterTab('watch')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilterTab === 'watch'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-slate-800/50 text-slate-300 border border-slate-700/50 hover:bg-slate-700/50'
              }`}
            >
              Watch
            </button>
            <button
              onClick={() => setStatusFilterTab('at_risk')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilterTab === 'at_risk'
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                  : 'bg-slate-800/50 text-slate-300 border border-slate-700/50 hover:bg-slate-700/50'
              }`}
            >
              At Risk
            </button>
            <button
              onClick={() => setStatusFilterTab('critical')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilterTab === 'critical'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : 'bg-slate-800/50 text-slate-300 border border-slate-700/50 hover:bg-slate-700/50'
              }`}
            >
              Critical
            </button>
            <button
              onClick={() => setStatusFilterTab('new_people')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilterTab === 'new_people'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-slate-800/50 text-slate-300 border border-slate-700/50 hover:bg-slate-700/50'
              }`}
            >
              New People
            </button>
            <button
              onClick={() => setStatusFilterTab('new_christians')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilterTab === 'new_christians'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'bg-slate-800/50 text-slate-300 border border-slate-700/50 hover:bg-slate-700/50'
              }`}
            >
              New Christians
            </button>
            <button
              onClick={() => setStatusFilterTab('in_groups')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilterTab === 'in_groups'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'bg-slate-800/50 text-slate-300 border border-slate-700/50 hover:bg-slate-700/50'
              }`}
            >
              In Groups
            </button>
          </div>
          
          {/* Advanced Filters (Collapsible) */}
          <div className="mb-4 bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
            <div className="flex flex-wrap gap-4 items-end">
              {/* Campus Filter */}
              <div className="min-w-[180px]">
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Campus
                </label>
                <select
                  value={campusFilter}
                  onChange={(e) => setCampusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
                >
                  <option value="all_campuses">All Campuses</option>
                  {campuses.map(campus => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Department Filter */}
              <div className="min-w-[150px]">
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Department
                </label>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
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

              {/* Archive Filter */}
              <div className="min-w-[180px]">
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Show
                </label>
                <select
                  value={archiveFilter}
                  onChange={(e) => setArchiveFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
                >
                  <option value="active">Active Only</option>
                  <option value="archived">Archived Only</option>
                  <option value="all">All</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Search
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Campus Filter */}
            <div className="min-w-[180px]">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Campus
              </label>
              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all_campuses">All Campuses</option>
                {campuses.map(campus => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Heartbeat Status Filter */}
            <div className="min-w-[150px]">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Heartbeat Status
              </label>
              <select
                value={pulseFilter}
                onChange={(e) => setPulseFilter(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="healthy">Healthy</option>
                <option value="watch">Watch</option>
                <option value="at_risk">At Risk</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {/* Department Filter */}
            <div className="min-w-[150px]">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Department
              </label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
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

            {/* Archive Filter */}
            <div className="min-w-[180px]">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Show
              </label>
              <select
                value={archiveFilter}
                onChange={(e) => setArchiveFilter(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="active">Active Only</option>
                <option value="archived">Archived Only</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
        </div>

        {/* People Table */}
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/30">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Heartbeat</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Group</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Serving</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Campus</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                      Loading...
                    </td>
                  </tr>
                ) : paginatedFilteredPersons.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                      No people found matching your filters
                    </td>
                  </tr>
                ) : (
                  paginatedFilteredPersons.map((person) => {
                    const heartbeatScore = getHeartbeatScore(person);
                    const servingRoles = getServingRoles(person);
                    const groupName = getConnectGroupName(person);
                    const initials = getInitials(person.preferred_name || person.full_name);
                    
                    return (
                    <tr 
                      key={person.id} 
                        className={`hover:bg-slate-700/20 transition-colors ${
                        !person.is_active ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                              {initials}
                            </div>
                            <div>
                        <div className="text-white font-medium">
                          {person.preferred_name || person.full_name}
                        </div>
                              {person.preferred_name && person.full_name && (
                                <div className="text-slate-400 text-xs">{person.full_name}</div>
                        )}
                            </div>
                          </div>
                      </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {/* Circular Heartbeat Score */}
                            <div className="relative w-12 h-12">
                              <svg className="w-12 h-12 transform -rotate-90">
                                <circle
                                  cx="24"
                                  cy="24"
                                  r="20"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  fill="none"
                                  className="text-slate-700"
                                />
                                <circle
                                  cx="24"
                                  cy="24"
                                  r="20"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  fill="none"
                                  strokeDasharray={`${2 * Math.PI * 20}`}
                                  strokeDashoffset={`${2 * Math.PI * 20 * (1 - heartbeatScore / 100)}`}
                                  className={getHeartbeatColor(heartbeatScore)}
                                  strokeLinecap="round"
                                />
                              </svg>
                              <div className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${getHeartbeatColor(heartbeatScore)}`}>
                                {Math.round(heartbeatScore)}
                          </div>
                          </div>
                          </div>
                      </td>
                      <td className="px-6 py-4">
                          <div className="text-slate-300 text-sm">
                            {groupName === 'No Group' ? (
                              <span className="text-slate-500 italic">{formatDate(person.last_seen)}</span>
                            ) : (
                              groupName
                          )}
                        </div>
                      </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-300 text-sm">
                            {servingRoles}
                          </div>
                      </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleViewPerson(person.id)}
                            className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-medium transition-colors"
                          >
                            View Profile
                          </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(person)}
                            title="Edit Person"
                            className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                          >
                              <PencilIcon className="w-4 h-4" />
                          </button>
                          {person.is_active ? (
                            <>
                              <button
                                onClick={() => setShowArchiveConfirm(person)}
                                title="Archive Person"
                                className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 rounded-lg transition-colors"
                              >
                                  <ArchiveBoxIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(person)}
                                title="Delete Person"
                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                              >
                                  <TrashIcon className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleRestore(person)}
                              title="Restore Person"
                              className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition-colors"
                            >
                                <ArrowPathIcon className="w-4 h-4" />
                            </button>
                          )}
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
          {filteredPersons.length > itemsPerPage && (
            <div className="px-6 py-4 border-t border-slate-700/50 flex items-center justify-between">
              <div className="text-sm text-slate-400">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredPersons.length)} of {filteredPersons.length} people
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Person Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800 z-10">
              <h2 className="text-2xl font-bold text-white">
                {editingPerson ? 'Edit Person' : 'Add New Person'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="John Smith"
                />
              </div>

              {/* Preferred Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Preferred Name
                </label>
                <input
                  type="text"
                  value={formData.preferred_name}
                  onChange={(e) => setFormData({ ...formData, preferred_name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="John"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="john.smith@example.com (optional)"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="+61 400 000 000"
                />
              </div>

              {/* Campus */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Campus <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={formData.campus}
                  onChange={async (e) => {
                    const newCampus = e.target.value;
                    setFormData({ ...formData, campus: newCampus, connect_group: '' }); // Clear connect group when campus changes
                    await loadConnectGroups(newCampus);
                  }}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all_campuses">Select Campus</option>
                  {campuses.map(campus => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Department
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select Department</option>
                  <option value="Kids">Kids</option>
                  <option value="Youth">Youth</option>
                  <option value="Young Adults">Young Adults</option>
                  <option value="Families">Families</option>
                  <option value="Adults">Adults</option>
                  <option value="Seniors">Seniors</option>
                </select>
              </div>

              {/* Connect Group */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Connect Group
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.connect_group || ''}
                    onChange={(e) => {
                      if (e.target.value === '__create_new__') {
                        // Reset to empty and show message
                        setFormData({ ...formData, connect_group: '' });
                        alert('Please use the Connect Groups page to create new groups. You can access it from the navigation menu.');
                      } else {
                        setFormData({ ...formData, connect_group: e.target.value || '' });
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">No Connect Group</option>
                    {connectGroups
                      .filter(g => !formData.campus || formData.campus === 'all_campuses' || g.campus === formData.campus)
                      .map(group => (
                        <option key={group.id} value={group.id}>
                          {group.name} ({group.campus})
                        </option>
                      ))}
                    <option value="__create_new__" className="text-blue-400 font-semibold">
                      + Create New Group
                    </option>
                  </select>
                </div>
                {formData.connect_group && (
                  <p className="mt-1 text-xs text-slate-400">
                    Selected: {connectGroups.find(g => g.id === formData.connect_group)?.name || formData.connect_group}
                  </p>
                )}
                {formData.connect_group === '__create_new__' && (
                  <p className="mt-2 text-xs text-blue-400">
                    Note: Use the Connect Groups page to create new groups, then refresh this dropdown.
                  </p>
                )}
              </div>

              {/* Birthday */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Birthday
                </label>
                <input
                  type="date"
                  value={formData.birthday}
                  onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Pastoral Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Pastoral Notes
                </label>
                <textarea
                  value={formData.pastoral_notes}
                  onChange={(e) => setFormData({ ...formData, pastoral_notes: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Notes about this person..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {editingPerson ? 'Update Person' : 'Create Person'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-md w-full">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-2xl font-bold text-white mb-2">Import PCO CSV</h2>
              <p className="text-slate-400">
                Upload a CSV file exported from Planning Center Online to import people into the database.
              </p>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files[0])}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                  }}
                  className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  disabled={importing}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImportCSV}
                  disabled={!importFile || importing}
                  className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {importing ? 'Importing...' : 'Import CSV'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-md w-full">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-2xl font-bold text-white mb-2">Archive Person</h2>
              <p className="text-slate-400">
                Are you sure you want to archive <strong className="text-white">{showArchiveConfirm.preferred_name || showArchiveConfirm.full_name}</strong>?
              </p>
              <p className="text-slate-500 text-sm mt-2">
                Archived people can be restored later. They will be hidden from the main list unless you check "Include Archived".
              </p>
            </div>
            <div className="p-6 flex gap-3">
              <button
                onClick={() => setShowArchiveConfirm(null)}
                className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleArchive(showArchiveConfirm)}
                className="flex-1 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl border border-red-500/50 max-w-md w-full">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-2xl font-bold text-red-400 mb-2">Delete Person</h2>
              <p className="text-slate-400 mb-2">
                Are you sure you want to <strong className="text-red-400">permanently delete</strong> <strong className="text-white">{showDeleteConfirm.preferred_name || showDeleteConfirm.full_name}</strong>?
              </p>
              <p className="text-red-400 text-sm font-semibold mb-2">
                ⚠️ This action cannot be undone!
              </p>
              <p className="text-slate-500 text-sm">
                This will permanently remove the person and all their engagement data from the database. Consider archiving instead if you might need this data later.
              </p>
            </div>
            <div className="p-6 flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default People;

