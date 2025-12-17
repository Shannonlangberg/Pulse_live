import React, { useState, useEffect } from 'react';
import {
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  PlusIcon,
  ChartBarIcon,
  CalendarIcon,
  PaperAirplaneIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  FunnelIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import CampaignList from '../components/communication/CampaignList';
import CreateCampaignModal from '../components/communication/CreateCampaignModal';
import CampaignAnalytics from '../components/communication/CampaignAnalytics';

const CommunicationDashboard = () => {
  const [activeTab, setActiveTab] = useState('email'); // 'email' or 'sms'
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'draft', 'scheduled', 'active', 'completed'
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchStats();
    fetchCampaigns();
  }, [activeTab, filter]);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/communication/stats/overview', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats || {});
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      let url = `/api/communication/campaigns?type=${activeTab}`;
      if (filter !== 'all') {
        url += `&status=${filter}`;
      }
      
      const response = await fetch(url, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        let campaignsList = data.campaigns || [];
        
        // Filter by search term if provided
        if (searchTerm) {
          campaignsList = campaignsList.filter(campaign =>
            campaign.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            campaign.subject_line?.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        
        setCampaigns(campaignsList);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = () => {
    if (activeTab === 'email') {
      // Navigate to full-page email editor
      window.location.href = '/communication/email-editor';
    } else {
      // SMS campaigns still use modal
      setSelectedCampaign(null);
      setShowCreateModal(true);
    }
  };

  const handleCampaignCreated = () => {
    setShowCreateModal(false);
    fetchCampaigns();
    fetchStats();
  };

  const handleSendCampaign = async (campaignId) => {
    if (!window.confirm('Are you sure you want to send this campaign immediately?')) {
      return;
    }

    try {
      const response = await fetch(`/api/communication/campaigns/${campaignId}/send`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('Campaign sent successfully!');
          fetchCampaigns();
          fetchStats();
        } else {
          alert(`Error: ${data.error || 'Failed to send campaign'}`);
        }
      } else {
        alert('Failed to send campaign');
      }
    } catch (error) {
      console.error('Error sending campaign:', error);
      alert('Error sending campaign');
    }
  };

  const handleViewAnalytics = (campaign) => {
    setSelectedCampaign(campaign);
    setShowAnalytics(true);
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: { bg: 'bg-gray-500/20', text: 'text-gray-300', label: 'Draft' },
      scheduled: { bg: 'bg-blue-500/20', text: 'text-blue-300', label: 'Scheduled' },
      active: { bg: 'bg-green-500/20', text: 'text-green-300', label: 'Active' },
      completed: { bg: 'bg-purple-500/20', text: 'text-purple-300', label: 'Completed' },
      paused: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', label: 'Paused' },
      cancelled: { bg: 'bg-red-500/20', text: 'text-red-300', label: 'Cancelled' }
    };

    const badge = badges[status] || badges.draft;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Communications</h1>
              <p className="text-white/60 text-base sm:text-lg">Manage email and SMS campaigns</p>
            </div>
            <button
              onClick={handleCreateCampaign}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-blue-500/50 text-sm sm:text-base"
            >
              <PlusIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Create Campaign</span>
              <span className="sm:hidden">Create</span>
            </button>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/60 text-sm">Total Campaigns</span>
                  <ChartBarIcon className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-3xl font-bold text-white">{stats.total_campaigns || 0}</div>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/60 text-sm">Active</span>
                  <PaperAirplaneIcon className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-3xl font-bold text-white">{stats.active_campaigns || 0}</div>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/60 text-sm">Draft</span>
                  <ClockIcon className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="text-3xl font-bold text-white">{stats.draft_campaigns || 0}</div>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/60 text-sm">Completed</span>
                  <CheckCircleIcon className="w-5 h-5 text-purple-400" />
                </div>
                <div className="text-3xl font-bold text-white">{stats.completed_campaigns || 0}</div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <button
              onClick={() => {
                setActiveTab('email');
                setSearchTerm('');
              }}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold transition-all duration-300 text-sm sm:text-base ${
                activeTab === 'email'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              <EnvelopeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Email Campaigns</span>
              <span className="sm:hidden">Email</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('sms');
                setSearchTerm('');
              }}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold transition-all duration-300 text-sm sm:text-base ${
                activeTab === 'sms'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              <DevicePhoneMobileIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">SMS Campaigns</span>
              <span className="sm:hidden">SMS</span>
            </button>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/10 transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <FunnelIcon className="w-5 h-5 text-white/60" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all" className="bg-slate-800">All Status</option>
                <option value="draft" className="bg-slate-800">Draft</option>
                <option value="scheduled" className="bg-slate-800">Scheduled</option>
                <option value="active" className="bg-slate-800">Active</option>
                <option value="completed" className="bg-slate-800">Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Campaigns List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-white text-xl">Loading campaigns...</div>
          </div>
        ) : (
          <CampaignList
            campaigns={campaigns}
            campaignType={activeTab}
            onSend={handleSendCampaign}
            onViewAnalytics={handleViewAnalytics}
            onRefresh={fetchCampaigns}
          />
        )}
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <CreateCampaignModal
          campaignType={activeTab}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCampaignCreated}
          existingCampaign={selectedCampaign}
        />
      )}

      {/* Analytics Modal */}
      {showAnalytics && selectedCampaign && (
        <CampaignAnalytics
          campaign={selectedCampaign}
          onClose={() => {
            setShowAnalytics(false);
            setSelectedCampaign(null);
          }}
        />
      )}
    </div>
  );
};

export default CommunicationDashboard;

