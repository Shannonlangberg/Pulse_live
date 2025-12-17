import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ConnectGroups from './ConnectGroups';
import Groups from './Groups';

const GroupsWrapper = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Determine active tab from URL or default to 'connect-groups'
  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/groups' || path.startsWith('/groups/connect-groups')) {
      return 'connect-groups';
    }
    if (path.startsWith('/groups/regular')) {
      return 'regular';
    }
    return 'connect-groups'; // default
  };

  const [activeTab, setActiveTab] = useState(getActiveTab());

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'connect-groups') {
      navigate('/groups');
    } else {
      navigate('/groups/regular');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-slate-700/50">
        <nav className="flex space-x-1" aria-label="Tabs">
          <button
            onClick={() => handleTabChange('connect-groups')}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'connect-groups'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-300'
            }`}
          >
            Connect Groups
          </button>
          <button
            onClick={() => handleTabChange('regular')}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'regular'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-300'
            }`}
          >
            Groups
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'connect-groups' ? <ConnectGroups /> : <Groups />}
      </div>
    </div>
  );
};

export default GroupsWrapper;











