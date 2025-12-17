import React, { useState, useEffect } from 'react';
import {
  DevicePhoneMobileIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  PaperAirplaneIcon,
  ClockIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const SMSActivity = () => {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateRange: '30',
    type: 'all',
    status: 'all'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchActivity();
  }, [filters]);

  const fetchActivity = async () => {
    try {
      setLoading(true);
      let url = `/api/communication/sms/activity?date_range=${filters.dateRange}&status=${filters.status}&limit=${itemsPerPage}&offset=${(currentPage - 1) * itemsPerPage}`;
      
      const response = await fetch(url, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setActivity(data.activity || []);
      }
    } catch (error) {
      console.error('Error fetching SMS activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      // Export functionality would go here
      alert('Export functionality coming soon!');
    } catch (error) {
      console.error('Error exporting:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status, sentCount) => {
    if (status.includes('Sent')) {
      return (
        <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-xs font-semibold">
          {sentCount} Sent
        </span>
      );
    }
    return (
      <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-xs font-semibold">
        Pending
      </span>
    );
  };

  const filteredActivity = activity.filter(item =>
    item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.message_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.from?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">SMS Activity</h1>
              <p className="text-white/60 text-base sm:text-lg">View and manage SMS campaigns</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <button className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold shadow-lg text-sm sm:text-base">
              <DevicePhoneMobileIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">SMS Activity</span>
              <span className="sm:hidden">SMS</span>
            </button>
            <button className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-white/5 text-white/60 hover:bg-white/10 rounded-xl font-semibold transition-all text-sm sm:text-base">
              <span className="hidden sm:inline">MMS Activity</span>
              <span className="sm:hidden">MMS</span>
            </button>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex flex-wrap items-center gap-2">
              <FunnelIcon className="w-5 h-5 text-white/60 hidden sm:block" />
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                className="px-3 sm:px-4 py-2 sm:py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7" className="bg-slate-800">Last 7 Days</option>
                <option value="30" className="bg-slate-800">Last 30 Days</option>
                <option value="90" className="bg-slate-800">Last 90 Days</option>
                <option value="365" className="bg-slate-800">Last Year</option>
              </select>
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                className="px-3 sm:px-4 py-2 sm:py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all" className="bg-slate-800">All Types</option>
                <option value="campaign" className="bg-slate-800">Campaign</option>
                <option value="single" className="bg-slate-800">Single</option>
              </select>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="px-3 sm:px-4 py-2 sm:py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all" className="bg-slate-800">All Status</option>
                <option value="sent" className="bg-slate-800">Sent</option>
                <option value="scheduled" className="bg-slate-800">Scheduled</option>
                <option value="draft" className="bg-slate-800">Draft</option>
              </select>
            </div>
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-white/40" />
              <input
                type="text"
                placeholder="Number Lookup"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-4 py-2 sm:py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-white/40 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/10 transition-all"
              />
            </div>
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold transition-all border border-white/10 text-sm sm:text-base"
            >
              <ArrowDownTrayIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              Export
            </button>
            <button className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors">
              SEARCH
            </button>
          </div>
        </div>

        {/* Activity Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-white text-xl">Loading activity...</div>
          </div>
        ) : (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
            {/* Mobile Card View */}
            <div className="block md:hidden space-y-4 p-4">
              {filteredActivity.length === 0 ? (
                <div className="text-center py-12 text-white/60">
                  No SMS activity found
                </div>
              ) : (
                filteredActivity.map((item) => (
                  <div key={item.id} className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-white font-medium text-sm mb-1">{item.from}</div>
                        <div className="text-blue-400 text-xs mb-2">To: {item.to}</div>
                        <div className="text-white/80 text-xs mb-2">{formatDate(item.date_time)}</div>
                      </div>
                      <div className="ml-2">
                        {getStatusBadge(item.status, item.sent_count)}
                      </div>
                    </div>
                    <div className="text-white/80 text-sm line-clamp-2">{item.message_text}</div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <div className="flex items-center gap-4 text-xs text-white/60">
                        <span>{item.type}</span>
                        <span>•</span>
                        <span>Replies: {item.replied_count || 0}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="text-blue-400 hover:text-blue-300 text-xs font-medium px-2 py-1">
                          Resend
                        </button>
                        <button className="text-purple-400 hover:text-purple-300 text-xs font-medium px-2 py-1">
                          Report
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="px-4 lg:px-6 py-4 text-left text-white/80 font-semibold text-sm">Date / Time</th>
                    <th className="px-4 lg:px-6 py-4 text-left text-white/80 font-semibold text-sm">From</th>
                    <th className="px-4 lg:px-6 py-4 text-left text-white/80 font-semibold text-sm">To</th>
                    <th className="px-4 lg:px-6 py-4 text-left text-white/80 font-semibold text-sm">Message Text</th>
                    <th className="px-4 lg:px-6 py-4 text-left text-white/80 font-semibold text-sm">Type</th>
                    <th className="px-4 lg:px-6 py-4 text-left text-white/80 font-semibold text-sm">Status</th>
                    <th className="px-4 lg:px-6 py-4 text-left text-white/80 font-semibold text-sm">Resp.</th>
                    <th className="px-4 lg:px-6 py-4 text-left text-white/80 font-semibold text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivity.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-12 text-center text-white/60">
                        No SMS activity found
                      </td>
                    </tr>
                  ) : (
                    filteredActivity.map((item) => (
                      <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 lg:px-6 py-3 lg:py-4 text-white/80 text-sm">{formatDate(item.date_time)}</td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 text-white font-medium text-sm">{item.from}</td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4">
                          <span className="text-blue-400 hover:text-blue-300 cursor-pointer text-sm">
                            {item.to}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 text-white/80 text-sm max-w-xs truncate">
                          {item.message_text}
                        </td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 text-white/60 text-sm">{item.type}</td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4">
                          {getStatusBadge(item.status, item.sent_count)}
                        </td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 text-white/60 text-sm">{item.replied_count || 0}</td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4">
                          <div className="flex items-center gap-2 lg:gap-3">
                            <button className="text-blue-400 hover:text-blue-300 text-xs lg:text-sm font-medium">
                              Resend
                            </button>
                            <button className="text-purple-400 hover:text-purple-300 text-xs lg:text-sm font-medium">
                              Report
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-white/60 text-sm">Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="10" className="bg-slate-800">10</option>
                  <option value="25" className="bg-slate-800">25</option>
                  <option value="50" className="bg-slate-800">50</option>
                  <option value="100" className="bg-slate-800">100</option>
                </select>
                <span className="text-white/60 text-sm">items per page</span>
              </div>
              <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SMSActivity;


