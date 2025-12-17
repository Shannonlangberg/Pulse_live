import React, { useState, useEffect } from 'react';
import { XMarkIcon, ChartBarIcon, EyeIcon, CursorArrowRaysIcon, ChatBubbleLeftRightIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const CampaignAnalytics = ({ campaign, onClose }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recipients, setRecipients] = useState([]);

  useEffect(() => {
    fetchAnalytics();
    fetchRecipients();
  }, [campaign.id]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/communication/campaigns/${campaign.id}/analytics/detailed`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
        if (data.analytics?.recipient_engagement) {
          setRecipients(data.analytics.recipient_engagement);
        }
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipients = async () => {
    // Recipients are now included in detailed analytics
    // This function is kept for backward compatibility
  };

  const getHeartbeatColor = (status) => {
    switch (status) {
      case 'green': return 'text-green-400';
      case 'amber': return 'text-yellow-400';
      case 'red': return 'text-red-400';
      default: return 'text-white/60';
    }
  };

  const openRate = campaign.total_recipients > 0
    ? ((campaign.open_count || 0) / campaign.total_recipients * 100).toFixed(1)
    : 0;

  const clickRate = campaign.total_recipients > 0
    ? ((campaign.click_count || 0) / campaign.total_recipients * 100).toFixed(1)
    : 0;

  const replyRate = campaign.total_recipients > 0
    ? ((campaign.reply_count || 0) / campaign.total_recipients * 100).toFixed(1)
    : 0;

  const deliveredCount = campaign.delivered_count || campaign.sent_count || 0;

  // Engagement Chart Data
  const engagementData = {
    labels: ['Opens', 'Clicks', 'Replies'],
    datasets: [{
      label: 'Engagement',
      data: [campaign.open_count || 0, campaign.click_count || 0, campaign.reply_count || 0],
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(168, 85, 247, 0.8)',
        'rgba(236, 72, 153, 0.8)'
      ],
      borderColor: [
        'rgba(59, 130, 246, 1)',
        'rgba(168, 85, 247, 1)',
        'rgba(236, 72, 153, 1)'
      ],
      borderWidth: 2
    }]
  };

  // Delivery Status Chart Data
  const deliveryData = {
    labels: ['Delivered', 'Bounced', 'Unsubscribed'],
    datasets: [{
      data: [
        deliveredCount,
        campaign.bounce_count || 0,
        campaign.unsubscribe_count || 0
      ],
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(251, 146, 60, 0.8)'
      ],
      borderColor: [
        'rgba(34, 197, 94, 1)',
        'rgba(239, 68, 68, 1)',
        'rgba(251, 146, 60, 1)'
      ],
      borderWidth: 2
    }]
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-white/10 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">{campaign.name}</h2>
            <p className="text-white/60 text-sm">Campaign Analytics</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-white/60" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-white">Loading analytics...</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 text-white/60 text-sm mb-2">
                  <UserGroupIcon className="w-4 h-4" />
                  Recipients
                </div>
                <div className="text-2xl font-bold text-white">{campaign.total_recipients || 0}</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 text-white/60 text-sm mb-2">
                  <EyeIcon className="w-4 h-4" />
                  Opens
                </div>
                <div className="text-2xl font-bold text-white">{campaign.open_count || 0}</div>
                <div className="text-xs text-white/50 mt-1">{openRate}%</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 text-white/60 text-sm mb-2">
                  <CursorArrowRaysIcon className="w-4 h-4" />
                  Clicks
                </div>
                <div className="text-2xl font-bold text-white">{campaign.click_count || 0}</div>
                <div className="text-xs text-white/50 mt-1">{clickRate}%</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 text-white/60 text-sm mb-2">
                  <ChatBubbleLeftRightIcon className="w-4 h-4" />
                  Replies
                </div>
                <div className="text-2xl font-bold text-white">{campaign.reply_count || 0}</div>
                <div className="text-xs text-white/50 mt-1">{replyRate}%</div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Engagement Chart */}
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4">Engagement</h3>
                <div className="h-64">
                  <Bar
                    data={engagementData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: { mode: 'index', intersect: false }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: { color: 'rgba(255, 255, 255, 0.6)' },
                          grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        x: {
                          ticks: { color: 'rgba(255, 255, 255, 0.6)' },
                          grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        }
                      }
                    }}
                  />
                </div>
              </div>

              {/* Delivery Status Chart */}
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4">Delivery Status</h3>
                <div className="h-64 flex items-center justify-center">
                  <Doughnut
                    data={deliveryData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: { color: 'rgba(255, 255, 255, 0.8)' }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Recipients List */}
            {recipients.length > 0 && (
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4">Recipients ({recipients.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-white/60">
                        <th className="text-left py-3 px-4">Name</th>
                        <th className="text-left py-3 px-4">Email/Phone</th>
                        <th className="text-left py-3 px-4">Campus</th>
                        <th className="text-left py-3 px-4">Sent</th>
                        <th className="text-left py-3 px-4">Opened</th>
                        <th className="text-left py-3 px-4">Clicked</th>
                        <th className="text-left py-3 px-4">Replied</th>
                        <th className="text-left py-3 px-4">Heartbeat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipients.slice(0, 20).map((recipient) => (
                        <tr key={recipient.person_id || recipient.id} className="border-b border-white/5 text-white/80">
                          <td className="py-3 px-4 font-medium">{recipient.name || '-'}</td>
                          <td className="py-3 px-4">{recipient.email || recipient.phone || '-'}</td>
                          <td className="py-3 px-4 text-white/60">{recipient.campus || '-'}</td>
                          <td className="py-3 px-4">
                            {recipient.sent_at ? new Date(recipient.sent_at).toLocaleDateString() : '-'}
                          </td>
                          <td className="py-3 px-4">
                            {recipient.opened_at ? <span className="text-green-400">✓</span> : '-'}
                          </td>
                          <td className="py-3 px-4">
                            {recipient.clicked_at ? <span className="text-blue-400">✓</span> : '-'}
                          </td>
                          <td className="py-3 px-4">
                            {recipient.replied_at ? <span className="text-purple-400">✓</span> : '-'}
                          </td>
                          <td className="py-3 px-4">
                            {recipient.heartbeat ? (
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${
                                  recipient.heartbeat.pulse_status === 'green' ? 'bg-green-400' :
                                  recipient.heartbeat.pulse_status === 'amber' ? 'bg-yellow-400' :
                                  'bg-red-400'
                                }`}></span>
                                <span className={`text-xs ${getHeartbeatColor(recipient.heartbeat.pulse_status)}`}>
                                  {recipient.heartbeat.pulse_status?.toUpperCase() || 'N/A'}
                                </span>
                              </div>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {recipients.length > 20 && (
                    <div className="text-center text-white/60 text-sm mt-4">
                      Showing first 20 of {recipients.length} recipients
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignAnalytics;

