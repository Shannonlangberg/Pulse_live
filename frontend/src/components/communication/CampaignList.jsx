import React from 'react';
import {
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  PaperAirplaneIcon,
  ChartBarIcon,
  CalendarIcon,
  UserGroupIcon,
  EyeIcon,
  CursorArrowRaysIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';

const CampaignList = ({ campaigns, campaignType, onSend, onViewAnalytics, onRefresh }) => {
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

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (campaigns.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-12 border border-white/10 text-center">
        <div className="text-6xl mb-4">
          {campaignType === 'email' ? '📧' : '📱'}
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">No campaigns yet</h3>
        <p className="text-white/60 mb-6">
          Create your first {campaignType === 'email' ? 'email' : 'SMS'} campaign to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {campaigns.map((campaign) => (
        <div
          key={campaign.id}
          className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-all duration-300"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {campaignType === 'email' ? (
                  <EnvelopeIcon className="w-6 h-6 text-blue-400" />
                ) : (
                  <DevicePhoneMobileIcon className="w-6 h-6 text-green-400" />
                )}
                <h3 className="text-xl font-bold text-white">{campaign.name}</h3>
                {getStatusBadge(campaign.status)}
              </div>
              {campaign.subject_line && (
                <p className="text-white/70 mb-2">{campaign.subject_line}</p>
              )}
              {campaign.description && (
                <p className="text-white/50 text-sm">{campaign.description}</p>
              )}
            </div>
          </div>

          {/* Campaign Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 text-white/60 text-sm mb-1">
                <UserGroupIcon className="w-4 h-4" />
                Recipients
              </div>
              <div className="text-lg font-bold text-white">{campaign.total_recipients || 0}</div>
            </div>
            {campaign.open_count !== undefined && (
              <div className="bg-white/5 rounded-xl p-3">
                <div className="flex items-center gap-2 text-white/60 text-sm mb-1">
                  <EyeIcon className="w-4 h-4" />
                  Opens
                </div>
                <div className="text-lg font-bold text-white">{campaign.open_count || 0}</div>
                {campaign.total_recipients > 0 && (
                  <div className="text-xs text-white/50">
                    {Math.round((campaign.open_count / campaign.total_recipients) * 100)}%
                  </div>
                )}
              </div>
            )}
            {campaign.click_count !== undefined && (
              <div className="bg-white/5 rounded-xl p-3">
                <div className="flex items-center gap-2 text-white/60 text-sm mb-1">
                  <CursorArrowRaysIcon className="w-4 h-4" />
                  Clicks
                </div>
                <div className="text-lg font-bold text-white">{campaign.click_count || 0}</div>
                {campaign.total_recipients > 0 && (
                  <div className="text-xs text-white/50">
                    {Math.round((campaign.click_count / campaign.total_recipients) * 100)}%
                  </div>
                )}
              </div>
            )}
            {campaign.reply_count !== undefined && (
              <div className="bg-white/5 rounded-xl p-3">
                <div className="flex items-center gap-2 text-white/60 text-sm mb-1">
                  <ChatBubbleLeftRightIcon className="w-4 h-4" />
                  Replies
                </div>
                <div className="text-lg font-bold text-white">{campaign.reply_count || 0}</div>
              </div>
            )}
          </div>

          {/* Campaign Metadata */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/60 mb-4">
            {campaign.created_at && (
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-4 h-4" />
                Created: {formatDate(campaign.created_at)}
              </div>
            )}
            {campaign.scheduled_at && (
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-4 h-4" />
                Scheduled: {formatDate(campaign.scheduled_at)}
              </div>
            )}
            {campaign.sent_at && (
              <div className="flex items-center gap-1">
                <PaperAirplaneIcon className="w-4 h-4" />
                Sent: {formatDate(campaign.sent_at)}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
              <button
                onClick={() => onSend(campaign.id)}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg font-semibold transition-all duration-300"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
                Send Now
              </button>
            )}
            <button
              onClick={() => onViewAnalytics(campaign)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg font-semibold transition-all duration-300"
            >
              <ChartBarIcon className="w-4 h-4" />
              Analytics
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CampaignList;

