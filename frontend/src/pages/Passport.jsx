import React, { useState, useEffect } from 'react';
import { 
  UserGroupIcon, 
  CheckCircleIcon, 
  ClockIcon,
  ArrowRightIcon,
  AcademicCapIcon,
  HeartIcon,
  ExclamationTriangleIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

const Passport = () => {
  const [loading, setLoading] = useState(true);
  const [campuses, setCampuses] = useState([]);
  const [selectedCampus, setSelectedCampus] = useState('all_campuses');
  const [campusData, setCampusData] = useState(null);
  const [peopleNeedingAttention, setPeopleNeedingAttention] = useState([]);
  const [allPeopleNeedingAttention, setAllPeopleNeedingAttention] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const navigate = useNavigate();

  useEffect(() => {
    loadCampuses();
  }, []);

  const loadCampuses = async () => {
    try {
      const response = await fetch('/api/campuses/public', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setCampuses(data.campuses || []);
      }
    } catch (err) {
      console.error('Error loading campuses:', err);
    }
  };

  const loadCampusData = async () => {
    try {
      setLoading(true);
      
      // Load people data for the selected campus
      const params = new URLSearchParams();
      if (selectedCampus !== 'all_campuses') {
        params.append('campus', selectedCampus);
      }
      
      const response = await fetch(`/api/persons?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const persons = data.persons || [];
        
        // Calculate campus overview
        const total = persons.length;
        const healthy = persons.filter(p => p.pulse_status === 'green').length;
        const watch = persons.filter(p => p.pulse_status === 'amber').length;
        const atRisk = persons.filter(p => p.pulse_status === 'red').length;
        
        setCampusData({
          total,
          healthy,
          watch,
          atRisk,
          pulseDistribution: {
            green: healthy,
            amber: watch,
            red: atRisk
          }
        });
        
        // Get people needing attention (red and amber) - ALL of them
        const needingAttention = persons
          .filter(p => p.pulse_status === 'red' || p.pulse_status === 'amber')
          .sort((a, b) => {
            // Sort red first, then amber, then by last_seen (most recent first)
            if (a.pulse_status === 'red' && b.pulse_status !== 'red') return -1;
            if (a.pulse_status !== 'red' && b.pulse_status === 'red') return 1;
            // If same status, sort by last_seen (most recent first)
            const aDate = a.last_seen ? new Date(a.last_seen) : new Date(0);
            const bDate = b.last_seen ? new Date(b.last_seen) : new Date(0);
            return bDate - aDate;
          });
        
        setAllPeopleNeedingAttention(needingAttention);
        
        // Calculate pagination
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        setPeopleNeedingAttention(needingAttention.slice(startIndex, endIndex));
      }
    } catch (err) {
      console.error('Error loading campus data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (campuses.length > 0) {
      setCurrentPage(1); // Reset to first page when campus changes
      loadCampusData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampus, campuses]);

  useEffect(() => {
    // Recalculate pagination when page changes
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setPeopleNeedingAttention(allPeopleNeedingAttention.slice(startIndex, endIndex));
  }, [currentPage, allPeopleNeedingAttention, itemsPerPage]);

  const getPulseColor = (status) => {
    switch (status) {
      case 'green': return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'amber': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'red': return 'text-red-400 bg-red-500/20 border-red-500/30';
      default: return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
    }
  };

  const getPulseLabel = (status) => {
    switch (status) {
      case 'green': return 'Healthy';
      case 'amber': return 'Watch';
      case 'red': return 'At Risk';
      default: return 'Unknown';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return 'Never';
    }
  };

  if (loading && !campusData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="text-white text-xl">Loading Passport Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Header */}
      <div className="relative bg-gradient-to-r from-blue-600/90 via-purple-600/90 to-pink-600/90 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <AcademicCapIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-5xl font-bold text-white tracking-tight">
                  Futures Pulse Passport
                </h1>
                <p className="text-white/80 text-xl font-medium">
                  Discipleship & Leadership Tracking
                </p>
              </div>
            </div>
            
            {/* Campus Selector */}
            <div className="min-w-[200px]">
              <select
                value={selectedCampus}
                onChange={(e) => setSelectedCampus(e.target.value)}
                className="w-full px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-white focus:outline-none focus:border-white/50"
              >
                <option value="all_campuses">All Campuses</option>
                {campuses.map(campus => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-12">
        {/* Summary Cards */}
        {campusData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="text-slate-400 text-sm mb-2">Total People</div>
              <div className="text-4xl font-bold text-white">{campusData.total}</div>
            </div>
            <div className="bg-green-500/10 backdrop-blur-sm rounded-2xl p-6 border border-green-500/30">
              <div className="text-green-400 text-sm mb-2">Healthy</div>
              <div className="text-4xl font-bold text-green-400">{campusData.healthy}</div>
            </div>
            <div className="bg-yellow-500/10 backdrop-blur-sm rounded-2xl p-6 border border-yellow-500/30">
              <div className="text-yellow-400 text-sm mb-2">Watch</div>
              <div className="text-4xl font-bold text-yellow-400">{campusData.watch}</div>
            </div>
            <div className="bg-red-500/10 backdrop-blur-sm rounded-2xl p-6 border border-red-500/30">
              <div className="text-red-400 text-sm mb-2">At Risk</div>
              <div className="text-4xl font-bold text-red-400">{campusData.atRisk}</div>
            </div>
          </div>
        )}

        {/* Pulse Distribution Chart */}
        {campusData && (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <ChartBarIcon className="w-6 h-6" />
              Pulse Status Distribution
            </h2>
            <div className="flex items-end gap-4 h-32">
              {campusData.total > 0 ? (
                <>
                  <div className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-green-500/30 rounded-t-lg transition-all hover:bg-green-500/40"
                      style={{ height: `${(campusData.healthy / campusData.total) * 100}%` }}
                    ></div>
                    <div className="text-white text-sm mt-2">{campusData.healthy}</div>
                    <div className="text-slate-400 text-xs">Healthy</div>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-yellow-500/30 rounded-t-lg transition-all hover:bg-yellow-500/40"
                      style={{ height: `${(campusData.watch / campusData.total) * 100}%` }}
                    ></div>
                    <div className="text-white text-sm mt-2">{campusData.watch}</div>
                    <div className="text-slate-400 text-xs">Watch</div>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-red-500/30 rounded-t-lg transition-all hover:bg-red-500/40"
                      style={{ height: `${(campusData.atRisk / campusData.total) * 100}%` }}
                    ></div>
                    <div className="text-white text-sm mt-2">{campusData.atRisk}</div>
                    <div className="text-slate-400 text-xs">At Risk</div>
                  </div>
                </>
              ) : (
                <div className="w-full text-center text-slate-400">No data available</div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* People Needing Attention */}
          <div className="lg:col-span-2 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <ExclamationTriangleIcon className="w-6 h-6 text-yellow-400" />
                People Needing Attention
              </h2>
              {allPeopleNeedingAttention.length > 0 && (
                <span className="text-slate-400 text-sm">
                  Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, allPeopleNeedingAttention.length)} of {allPeopleNeedingAttention.length}
                </span>
              )}
            </div>
            {peopleNeedingAttention.length > 0 ? (
              <>
                <div className="space-y-3 mb-4">
                  {peopleNeedingAttention.map((person) => (
                    <div
                      key={person.id}
                      onClick={() => navigate(`/persons/${person.id}`)}
                      className="bg-slate-800/50 p-4 rounded-lg hover:bg-slate-800/70 transition-all cursor-pointer border border-slate-700/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getPulseColor(person.pulse_status)}`}>
                              {getPulseLabel(person.pulse_status)}
                            </span>
                            <span className="text-white font-semibold">
                              {person.preferred_name || person.full_name}
                            </span>
                          </div>
                          {person.pulse_reasons && person.pulse_reasons.length > 0 && (
                            <div className="text-sm text-slate-400">
                              {person.pulse_reasons[0]}
                            </div>
                          )}
                          <div className="text-xs text-slate-500 mt-1">
                            Last seen: {formatDate(person.last_seen)}
                          </div>
                        </div>
                        <ArrowRightIcon className="w-5 h-5 text-slate-400" />
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Pagination */}
                {allPeopleNeedingAttention.length > itemsPerPage && (
                  <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all"
                    >
                      Previous
                    </button>
                    <span className="text-slate-400 text-sm">
                      Page {currentPage} of {Math.ceil(allPeopleNeedingAttention.length / itemsPerPage)}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(allPeopleNeedingAttention.length / itemsPerPage), prev + 1))}
                      disabled={currentPage >= Math.ceil(allPeopleNeedingAttention.length / itemsPerPage)}
                      className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-slate-800/50 p-4 rounded-lg">
                <p className="text-white">No people need attention at this time</p>
                <p className="text-sm text-slate-400 mt-1">All people are healthy!</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <h2 className="text-2xl font-bold text-white mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/people')}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2"
              >
                <UserGroupIcon className="w-5 h-5" />
                View People
              </button>
              <button
                onClick={() => navigate('/people?pulse=red')}
                className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 py-3 px-4 rounded-lg transition-all border border-red-500/30 flex items-center justify-center gap-2"
              >
                <ExclamationTriangleIcon className="w-5 h-5" />
                At Risk People
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full bg-slate-700/50 hover:bg-slate-700 text-white py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <ChartBarIcon className="w-5 h-5" />
                View Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Passport;

