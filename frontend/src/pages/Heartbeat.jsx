import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Status badge component with new Heartbeat statuses
const StatusBadge = ({ status, score }) => {
  const statusConfig = {
    healthy: {
      color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      label: 'Healthy',
      icon: '✓'
    },
    watch: {
      color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      label: 'Watch',
      icon: '⚠'
    },
    at_risk: {
      color: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
      label: 'At Risk',
      icon: '⚡'
    },
    critical: {
      color: 'bg-red-500/20 text-red-300 border-red-500/40',
      label: 'Critical',
      icon: '🚨'
    }
  };

  const config = statusConfig[status] || statusConfig.watch;

  return (
    <div
      className={`inline-flex items-center px-3 py-1.5 rounded-full border text-xs font-semibold ${config.color}`}
    >
      <span className="mr-2">{config.icon}</span>
      <span className="uppercase tracking-wide">{config.label}</span>
      {typeof score === 'number' && (
        <span className="ml-2 font-bold">{Math.round(score)}</span>
      )}
    </div>
  );
};

// Score breakdown component
const ScoreBreakdown = ({ snapshot }) => {
  if (!snapshot) return null;

  const scores = [
    { label: 'Gather', value: snapshot.gather_score, color: 'blue', weight: '35%' },
    { label: 'Engagement', value: snapshot.engagement_score, color: 'purple', weight: '25%' },
    { label: 'Spiritual', value: snapshot.spiritual_score, color: 'indigo', weight: '25%' },
    { label: 'Care', value: snapshot.care_score, color: 'pink', weight: '15%' }
  ];

  return (
    <div className="space-y-2">
      {scores.map((score) => (
        <div key={score.label} className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-300">{score.label}</span>
              <span className="text-xs text-slate-400">{score.weight}</span>
            </div>
            <div className="w-full bg-slate-700/50 rounded-full h-2">
              <div
                className={`bg-${score.color}-500 h-2 rounded-full transition-all duration-500`}
                style={{ width: `${Math.min(score.value, 100)}%` }}
              />
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-200 w-12 text-right">
            {Math.round(score.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

// Person card component
const PersonCard = ({ person, onClick }) => {
  const heartbeat = person.heartbeat;
  const hasSnapshot = heartbeat !== null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-gradient-to-br from-slate-800/80 to-slate-900/80 hover:from-slate-700 hover:to-slate-800 border border-slate-700/60 hover:border-slate-600 rounded-xl p-5 transition-all shadow-md hover:shadow-xl hover:scale-[1.02] group"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white mb-1 truncate group-hover:text-blue-300 transition">
            {person.full_name || person.preferred_name || 'Unknown'}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {person.email && (
              <span className="text-xs text-slate-400 truncate">{person.email}</span>
            )}
            {person.phone && (
              <span className="text-xs text-slate-500">• {person.phone}</span>
            )}
          </div>
        </div>
        {hasSnapshot && (
          <StatusBadge status={heartbeat.status} score={heartbeat.total_score} />
        )}
      </div>

      {hasSnapshot ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Total Score</span>
            <span className="text-2xl font-bold text-white">
              {Math.round(heartbeat.total_score)}
            </span>
          </div>
          <ScoreBreakdown snapshot={heartbeat} />
          {heartbeat.risk_reasons && heartbeat.risk_reasons.length > 0 && (
            <div className="pt-2 border-t border-slate-700/50">
              <div className="text-xs text-slate-400 mb-1">Risk Factors:</div>
              <div className="flex flex-wrap gap-1">
                {heartbeat.risk_reasons.slice(0, 3).map((reason, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-0.5 bg-red-500/20 text-red-300 rounded border border-red-500/30"
                  >
                    {reason.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-slate-500">No heartbeat data</p>
          <p className="text-xs text-slate-600 mt-1">Run recalculation to generate</p>
        </div>
      )}
    </button>
  );
};

const Heartbeat = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [people, setPeople] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [selectedCampus, setSelectedCampus] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [recalculating, setRecalculating] = useState(false);
  const [viewMode, setViewMode] = useState('all'); // 'all', 'next-steps', 'department', 'campus-overview'
  const [departmentStats, setDepartmentStats] = useState([]);
  const [campusOverview, setCampusOverview] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    healthy: 0,
    watch: 0,
    at_risk: 0,
    critical: 0
  });

  // Load campuses
  useEffect(() => {
    const fetchCampuses = async () => {
      try {
        const response = await fetch('/api/campuses', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          const items = data.campuses || [];
          setCampuses(items);
          if (items.length > 0 && !selectedCampus) {
            // Default to first campus or user's campus
            const defaultCampus = data.default && items.find(c => c.id === data.default)
              ? items.find(c => c.id === data.default)
              : items[0];
            setSelectedCampus(defaultCampus);
          }
        }
      } catch (err) {
        console.error('Error loading campuses:', err);
      }
    };

    fetchCampuses();
  }, []);

  // Load heartbeat data based on view mode
  useEffect(() => {
    const fetchHeartbeat = async () => {
      try {
        setLoading(true);
        setError('');

        if (viewMode === 'campus-overview') {
          // Load campus overview
          const response = await fetch('/api/heartbeat/campus-overview', {
            credentials: 'include'
          });

          if (!response.ok) {
            throw new Error('Failed to load campus overview');
          }

          const data = await response.json();
          setCampusOverview(data.campuses || []);
          setPeople([]);
        } else if (viewMode === 'department') {
          // Load department overview
          const params = new URLSearchParams();
          if (selectedCampus) {
            params.append('campus_id', selectedCampus.id);
          }

          const response = await fetch(
            `/api/heartbeat/department-overview?${params.toString()}`,
            {
              credentials: 'include'
            }
          );

          if (!response.ok) {
            throw new Error('Failed to load department overview');
          }

          const data = await response.json();
          setDepartmentStats(data.departments || []);
          setPeople([]);
        } else if (viewMode === 'next-steps') {
          // Load next steps
          if (!selectedCampus) return;

          const params = new URLSearchParams();
          params.append('campus_id', selectedCampus.id);
          if (departmentFilter) {
            params.append('department', departmentFilter);
          }

          const response = await fetch(
            `/api/heartbeat/next-steps?${params.toString()}`,
            {
              credentials: 'include'
            }
          );

          if (!response.ok) {
            throw new Error('Failed to load next steps');
          }

          const data = await response.json();
          let peopleList = data.people || [];

          // Apply search filter
          if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            peopleList = peopleList.filter(
              (p) =>
                p.full_name?.toLowerCase().includes(query) ||
                p.email?.toLowerCase().includes(query) ||
                p.phone?.includes(query)
            );
          }

          setPeople(peopleList);

          // Calculate summary for next steps
          const counts = peopleList.reduce(
            (acc, p) => {
              acc.total += 1;
              if (p.heartbeat) {
                const status = p.heartbeat.status;
                if (status === 'healthy') acc.healthy += 1;
                else if (status === 'watch') acc.watch += 1;
                else if (status === 'at_risk') acc.at_risk += 1;
                else if (status === 'critical') acc.critical += 1;
              }
              return acc;
            },
            { total: 0, healthy: 0, watch: 0, at_risk: 0, critical: 0 }
          );
          setSummary(counts);
        } else {
          // Default: All view
          if (!selectedCampus) return;

          const params = new URLSearchParams();
          if (statusFilter) {
            params.append('status', statusFilter);
          }
          if (departmentFilter) {
            params.append('department', departmentFilter);
          }

          const response = await fetch(
            `/api/heartbeat/campus/${selectedCampus.id}/people?${params.toString()}`,
            {
              credentials: 'include'
            }
          );

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to load heartbeat data (${response.status})`);
          }

          const data = await response.json();
          
          if (data.error) {
            throw new Error(data.error);
          }
          let peopleList = data.people || [];

          // Apply search filter
          if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            peopleList = peopleList.filter(
              (p) =>
                p.full_name?.toLowerCase().includes(query) ||
                p.email?.toLowerCase().includes(query) ||
                p.phone?.includes(query)
            );
          }

          setPeople(peopleList);

          // Calculate summary
          const counts = peopleList.reduce(
            (acc, p) => {
              acc.total += 1;
              if (p.heartbeat) {
                const status = p.heartbeat.status;
                if (status === 'healthy') acc.healthy += 1;
                else if (status === 'watch') acc.watch += 1;
                else if (status === 'at_risk') acc.at_risk += 1;
                else if (status === 'critical') acc.critical += 1;
              }
              return acc;
            },
            { total: 0, healthy: 0, watch: 0, at_risk: 0, critical: 0 }
          );
          setSummary(counts);
        }
      } catch (err) {
        console.error('Heartbeat load error:', err);
        const errorMessage = err.message || 'Unable to load heartbeat data. Please try again.';
        setError(errorMessage);
        
        if (errorMessage.includes('404') || errorMessage.includes('not found')) {
          setError('Campus not found in Heartbeat system. Try running the seed script or recalculating.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchHeartbeat();
  }, [selectedCampus, statusFilter, departmentFilter, searchQuery, viewMode]);

  const handleRecalculate = async () => {
    if (!selectedCampus) return;

    try {
      setRecalculating(true);
      const response = await fetch(`/api/heartbeat/recalculate/${selectedCampus.id}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Recalculation failed');
      }

      const data = await response.json();
      alert(`Recalculation complete! Processed ${data.results.processed} people.`);
      
      // Reload data
      window.location.reload();
    } catch (err) {
      console.error('Recalculation error:', err);
      alert('Failed to recalculate. Please try again.');
    } finally {
      setRecalculating(false);
    }
  };

  const statusFilters = [
    { value: '', label: 'All' },
    { value: 'healthy', label: 'Healthy' },
    { value: 'watch', label: 'Watch' },
    { value: 'at_risk', label: 'At Risk' },
    { value: 'critical', label: 'Critical' }
  ];

  const filteredPeople = people.filter((p) => {
    if (viewMode === 'all' && statusFilter) {
      return p.heartbeat?.status === statusFilter;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-2xl shadow-lg">
                💜
              </span>
              Heartbeat Dashboard
            </h1>
            <p className="text-sm text-slate-400 mt-2">
              Track congregant health with comprehensive engagement scoring
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedCampus && (
              <button
                type="button"
                onClick={handleRecalculate}
                disabled={recalculating}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {recalculating ? 'Recalculating...' : '🔄 Recalculate Campus'}
              </button>
            )}
          </div>
        </div>

        {/* View Selector */}
        <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                View Mode
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                    viewMode === 'all'
                      ? 'bg-blue-500/20 text-blue-200 border-blue-500/60'
                      : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  All People
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('next-steps')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                    viewMode === 'next-steps'
                      ? 'bg-blue-500/20 text-blue-200 border-blue-500/60'
                      : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  Next Steps
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('department')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                    viewMode === 'department'
                      ? 'bg-blue-500/20 text-blue-200 border-blue-500/60'
                      : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  Department Overview
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('campus-overview')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                    viewMode === 'campus-overview'
                      ? 'bg-blue-500/20 text-blue-200 border-blue-500/60'
                      : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  Campus Overview
                </button>
              </div>
            </div>

            {/* Campus Selector - only show if not in campus-overview mode */}
            {viewMode !== 'campus-overview' && (
              <div className="sm:w-64">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Select Campus
                </label>
                <select
                  value={selectedCampus?.id || ''}
                  onChange={(e) => {
                    const campus = campuses.find((c) => c.id === e.target.value);
                    setSelectedCampus(campus);
                  }}
                  className="w-full bg-slate-800/70 text-slate-100 text-sm rounded-lg px-4 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60"
                >
                  <option value="">Select a campus...</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Department Filter - only show in all or next-steps mode */}
            {(viewMode === 'all' || viewMode === 'next-steps') && (
              <div className="sm:w-48">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Department
                </label>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full bg-slate-800/70 text-slate-100 text-sm rounded-lg px-4 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60"
                >
                  <option value="">All Departments</option>
                  <option value="Kids">Kids</option>
                  <option value="Youth">Youth</option>
                  <option value="Young Adults">Young Adults</option>
                  <option value="Families">Families</option>
                  <option value="Adults">Adults</option>
                  <option value="Seniors">Seniors</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Summary Cards - only show in all or next-steps mode */}
        {selectedCampus && (viewMode === 'all' || viewMode === 'next-steps') && (
          <div className="grid gap-6 md:grid-cols-5">
            <div className="md:col-span-2 bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-slate-700/70 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                    Campus Overview
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {summary.total} {summary.total === 1 ? 'Person' : 'People'}
                  </div>
                  <div className="text-sm text-slate-400 mt-1">
                    {selectedCampus.name}
                  </div>
                </div>
                <div className="text-6xl opacity-20">💜</div>
              </div>
              <div className="grid grid-cols-4 gap-3 mt-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-emerald-300">{summary.healthy}</div>
                  <div className="text-xs text-slate-400">Healthy</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-amber-300">{summary.watch}</div>
                  <div className="text-xs text-slate-400">Watch</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-orange-300">{summary.at_risk}</div>
                  <div className="text-xs text-slate-400">At Risk</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-red-300">{summary.critical}</div>
                  <div className="text-xs text-slate-400">Critical</div>
                </div>
              </div>
            </div>

            <div className="bg-emerald-900/30 border border-emerald-500/40 rounded-2xl p-6 shadow-lg">
              <div className="text-xs text-emerald-300 uppercase tracking-wide mb-2">Healthy</div>
              <div className="text-4xl font-bold text-emerald-100 mb-2">{summary.healthy}</div>
              <div className="text-sm text-emerald-400/80">
                {summary.total > 0
                  ? Math.round((summary.healthy / summary.total) * 100)
                  : 0}
                % of total
              </div>
            </div>

            <div className="bg-amber-900/30 border border-amber-500/40 rounded-2xl p-6 shadow-lg">
              <div className="text-xs text-amber-300 uppercase tracking-wide mb-2">Watch</div>
              <div className="text-4xl font-bold text-amber-100 mb-2">{summary.watch}</div>
              <div className="text-sm text-amber-400/80">
                {summary.total > 0
                  ? Math.round((summary.watch / summary.total) * 100)
                  : 0}
                % of total
              </div>
            </div>

            <div className="bg-red-900/30 border border-red-500/40 rounded-2xl p-6 shadow-lg">
              <div className="text-xs text-red-300 uppercase tracking-wide mb-2">Critical</div>
              <div className="text-4xl font-bold text-red-100 mb-2">
                {summary.critical + summary.at_risk}
              </div>
              <div className="text-sm text-red-400/80">Needs Attention</div>
            </div>
          </div>
        )}

        {/* Filters - only show in all or next-steps mode */}
        {selectedCampus && (viewMode === 'all' || viewMode === 'next-steps') && (
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {viewMode === 'all' && (
                <div className="flex flex-wrap gap-2">
                  {statusFilters.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setStatusFilter(filter.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                        statusFilter === filter.value
                          ? 'bg-blue-500/20 text-blue-200 border-blue-500/60'
                          : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              )}

              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-slate-800/70 text-slate-100 text-sm rounded-lg px-4 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 placeholder:text-slate-500"
              />
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="py-12 flex items-center justify-center">
            <div className="flex items-center gap-3 text-slate-400 text-sm">
              <span className="inline-block w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
              Loading heartbeat data...
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="py-6 text-center text-sm text-red-300 bg-red-900/20 rounded-lg border border-red-800/40">
            {error}
          </div>
        )}

        {/* Department Overview View */}
        {!loading && !error && viewMode === 'department' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {departmentStats.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <div className="text-6xl mb-4 opacity-50">💜</div>
                <p className="text-slate-400 text-lg mb-2">No departments found</p>
                <p className="text-slate-500 text-sm">
                  No people assigned to departments yet
                </p>
              </div>
            ) : (
              departmentStats.map((dept) => (
                <div
                  key={dept.department}
                  className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/60 rounded-xl p-6"
                >
                  <h3 className="text-xl font-bold text-white mb-4">{dept.department}</h3>
                  <div className="space-y-3">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-white mb-1">{dept.stats.total}</div>
                      <div className="text-xs text-slate-400">Total People</div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-700/50">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-emerald-300">{dept.stats.healthy}</div>
                        <div className="text-xs text-slate-400">Healthy</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-amber-300">{dept.stats.watch}</div>
                        <div className="text-xs text-slate-400">Watch</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-orange-300">{dept.stats.at_risk}</div>
                        <div className="text-xs text-slate-400">At Risk</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-red-300">{dept.stats.critical}</div>
                        <div className="text-xs text-slate-400">Critical</div>
                      </div>
                    </div>
                    {dept.stats.no_data > 0 && (
                      <div className="text-center pt-2 border-t border-slate-700/50">
                        <div className="text-sm font-medium text-slate-400">{dept.stats.no_data} No Data</div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Campus Overview View */}
        {!loading && !error && viewMode === 'campus-overview' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {campusOverview.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <div className="text-6xl mb-4 opacity-50">💜</div>
                <p className="text-slate-400 text-lg mb-2">No campuses found</p>
                <p className="text-slate-500 text-sm">
                  No active campuses in the system
                </p>
              </div>
            ) : (
              campusOverview.map((campus) => (
                <div
                  key={campus.campus_id}
                  className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/60 rounded-xl p-6 hover:border-slate-600 transition-colors cursor-pointer"
                  onClick={() => {
                    const foundCampus = campuses.find((c) => c.id === campus.campus_id);
                    if (foundCampus) {
                      setSelectedCampus(foundCampus);
                      setViewMode('all');
                    }
                  }}
                >
                  <h3 className="text-xl font-bold text-white mb-4">{campus.campus_name}</h3>
                  <div className="space-y-3">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-white mb-1">{campus.stats.total}</div>
                      <div className="text-xs text-slate-400">Total People</div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-700/50">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-emerald-300">{campus.stats.healthy}</div>
                        <div className="text-xs text-slate-400">Healthy</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-amber-300">{campus.stats.watch}</div>
                        <div className="text-xs text-slate-400">Watch</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-orange-300">{campus.stats.at_risk}</div>
                        <div className="text-xs text-slate-400">At Risk</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-red-300">{campus.stats.critical}</div>
                        <div className="text-xs text-slate-400">Critical</div>
                      </div>
                    </div>
                    {campus.stats.no_data > 0 && (
                      <div className="text-center pt-2 border-t border-slate-700/50">
                        <div className="text-sm font-medium text-slate-400">{campus.stats.no_data} No Data</div>
                      </div>
                    )}
                    <div className="pt-3 border-t border-slate-700/50 text-center">
                      <div className="text-xs text-blue-400">Click to view details →</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* People Grid - All and Next Steps views */}
        {!loading && !error && selectedCampus && (viewMode === 'all' || viewMode === 'next-steps') && (
          <>
            {filteredPeople.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4 opacity-50">💜</div>
                <p className="text-slate-400 text-lg mb-2">
                  {viewMode === 'next-steps' ? 'No people ready for next steps' : 'No people found'}
                </p>
                <p className="text-slate-500 text-sm mb-4">
                  {viewMode === 'next-steps'
                    ? 'Everyone is on track or no journeys assigned yet'
                    : searchQuery || statusFilter || departmentFilter
                    ? 'Try adjusting your filters'
                    : people.length === 0
                    ? 'No people found for this campus. Check that people have this campus assigned.'
                    : 'People found but no heartbeat data. Click "Recalculate Campus" to generate scores.'}
                </p>
                {!searchQuery && !statusFilter && !departmentFilter && people.length === 0 && selectedCampus && (
                  <button
                    type="button"
                    onClick={handleRecalculate}
                    disabled={recalculating}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {recalculating ? 'Recalculating...' : '🔄 Recalculate Campus (May Create Data)'}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredPeople.map((person) => {
                  // Enhanced card for next steps view
                  if (viewMode === 'next-steps') {
                    return (
                      <div key={person.person_id} className="relative">
                        <PersonCard
                          person={person}
                          onClick={() => navigate(`/persons/${person.person_id}`)}
                        />
                        {person.next_step ? (
                          <>
                            <div className="absolute top-4 right-4 bg-blue-500/20 border border-blue-500/40 rounded-lg px-3 py-1">
                              <div className="text-xs font-semibold text-blue-300">Next Step Ready</div>
                            </div>
                            <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                              <div className="text-xs text-slate-400 mb-1">Journey: {person.next_step.pathway_name || 'Unknown'}</div>
                              <div className="text-xs text-slate-300">Current: {person.next_step.current_step}</div>
                              <div className="text-sm font-semibold text-blue-300 mt-1">→ {person.next_step.next_step}</div>
                            </div>
                          </>
                        ) : person.reason === 'no_pathway_assigned' ? (
                          <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                            <div className="text-xs font-semibold text-amber-300">No Journey Assigned</div>
                            <div className="text-xs text-slate-400 mt-1">This person doesn't have a discipleship journey assigned yet</div>
                          </div>
                        ) : null}
                      </div>
                    );
                  }
                  
                  return (
                    <PersonCard
                      key={person.person_id}
                      person={person}
                      onClick={() => navigate(`/persons/${person.person_id}`)}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* No Campus Selected */}
        {!selectedCampus && !loading && viewMode !== 'campus-overview' && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4 opacity-50">💜</div>
            <p className="text-slate-400 text-lg mb-2">Select a campus to view heartbeat data</p>
            <p className="text-slate-500 text-sm">
              Choose a campus from the dropdown above to see congregant health scores
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Heartbeat;
