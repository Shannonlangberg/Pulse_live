import React, { useState, useEffect } from 'react';
import { CalendarIcon, ChartBarIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const Attendance = () => {
  const [attendanceData, setAttendanceData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAttendanceData();
  }, []);

  const loadAttendanceData = async () => {
    try {
      setLoading(true);
      // TODO: Implement attendance API endpoint
      const response = await fetch('/api/attendance/patterns', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setAttendanceData(data);
      }
    } catch (err) {
      console.error('Error loading attendance data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">Attendance</h2>
        <p className="text-white/60">Track attendance patterns and engagement</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/60">Loading attendance data...</div>
      ) : (
        <div className="space-y-6">
          {/* Sunday Attendance */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Sunday Attendance</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-white/60 text-sm mb-1">Average Attendance</div>
                <div className="text-white text-2xl font-bold">
                  {attendanceData?.sunday_avg || '0'}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-white/60 text-sm mb-1">This Month</div>
                <div className="text-white text-2xl font-bold">
                  {attendanceData?.sunday_month || '0'}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-white/60 text-sm mb-1">Trend</div>
                <div className={`text-2xl font-bold ${
                  (attendanceData?.sunday_trend || 0) > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {(attendanceData?.sunday_trend || 0) > 0 ? '+' : ''}
                  {attendanceData?.sunday_trend || 0}%
                </div>
              </div>
            </div>
          </div>

          {/* Missing Streaks */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Missing Streaks</h3>
            <div className="space-y-3">
              {attendanceData?.missing_streaks && attendanceData.missing_streaks.length > 0 ? (
                attendanceData.missing_streaks.map((streak, idx) => (
                  <div
                    key={idx}
                    className="bg-white/5 border border-white/10 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">{streak.name}</div>
                        <div className="text-white/60 text-sm">
                          {streak.days} days without attendance
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        streak.days > 30 ? 'bg-red-500/20 text-red-400' :
                        streak.days > 14 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {streak.days > 30 ? 'Critical' :
                         streak.days > 14 ? 'At Risk' : 'Watch'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-white/60">
                  No significant missing streaks
                </div>
              )}
            </div>
          </div>

          {/* First-time Visitors */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">First-time Visitors</h3>
            <div className="text-white text-2xl font-bold">
              {attendanceData?.first_time_visitors || 0} this month
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;

