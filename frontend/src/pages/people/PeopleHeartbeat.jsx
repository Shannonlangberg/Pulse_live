import React, { useState, useEffect } from 'react';
import { HeartIcon, ChartBarIcon, StarIcon, UserGroupIcon } from '@heroicons/react/24/outline';

const PeopleHeartbeat = () => {
  const [healthOverview, setHealthOverview] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [pastorFocusList, setPastorFocusList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHeartbeatData();
  }, []);

  const loadHeartbeatData = async () => {
    try {
      setLoading(true);
      // Load heartbeat dashboard data
      const response = await fetch('/api/heartbeat/dashboard', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setHealthOverview(data.health_overview || {});
        setAiAnalysis(data.ai_analysis || {});
        setPastorFocusList(data.pastor_focus_list || []);
      }
    } catch (err) {
      console.error('Error loading heartbeat data:', err);
    } finally {
      setLoading(false);
    }
  };

  const healthCategories = [
    { key: 'healthy', label: 'Healthy', color: 'bg-green-500/20 text-green-400 border-green-500/50', icon: HeartIcon },
    { key: 'watch', label: 'Watch', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50', icon: ChartBarIcon },
    { key: 'at_risk', label: 'At Risk', color: 'bg-orange-500/20 text-orange-400 border-orange-500/50', icon: HeartIcon },
    { key: 'critical', label: 'Critical', color: 'bg-red-500/20 text-red-400 border-red-500/50', icon: HeartIcon },
    { key: 'new_people', label: 'New People', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50', icon: UserGroupIcon },
    { key: 'new_christians', label: 'New Christians', color: 'bg-purple-500/20 text-purple-400 border-purple-500/50', icon: StarIcon },
  ];

  return (
    <div className="h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">Heartbeat Dashboard</h2>
        <p className="text-white/60">Real-time spiritual health overview powered by AI</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/60">Loading heartbeat data...</div>
      ) : (
        <div className="space-y-6">
          {/* Health Overview */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Health Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {healthCategories.map((category) => {
                const Icon = category.icon;
                const count = healthOverview?.[category.key] || 0;
                return (
                  <div
                    key={category.key}
                    className={`${category.color} border-2 rounded-xl p-4 text-center`}
                  >
                    <Icon className="h-8 w-8 mx-auto mb-2" />
                    <div className="text-2xl font-bold mb-1">{count}</div>
                    <div className="text-sm font-medium">{category.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Analysis */}
          {aiAnalysis && (
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <StarIcon className="h-6 w-6 text-purple-400" />
                AI Analysis
              </h3>
              <div className="space-y-4">
                {aiAnalysis.positive_shifts && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                    <div className="text-green-400 font-semibold mb-2">Biggest Positive Shifts</div>
                    <div className="text-white/80">{aiAnalysis.positive_shifts}</div>
                  </div>
                )}
                {aiAnalysis.health_drops && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <div className="text-red-400 font-semibold mb-2">Health Drops</div>
                    <div className="text-white/80">{aiAnalysis.health_drops}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pastor Focus List */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Weekly Pastor Focus List</h3>
            <div className="space-y-3">
              {pastorFocusList.length > 0 ? (
                pastorFocusList.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white/5 border border-white/10 rounded-lg p-4"
                  >
                    <div className="text-white font-medium">{item.name}</div>
                    <div className="text-white/60 text-sm mt-1">{item.reason}</div>
                    <div className="text-blue-400 text-sm mt-2">{item.action}</div>
                  </div>
                ))
              ) : (
                <div className="text-white/60 text-center py-8">
                  No focus items this week
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PeopleHeartbeat;

