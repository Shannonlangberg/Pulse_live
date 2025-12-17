import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import EnhancedNavigation from './EnhancedNavigation';
import TopNavigation from './TopNavigation';

const MainLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userRole, setUserRole] = useState('user');
  const [userName, setUserName] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [customPermissions, setCustomPermissions] = useState({});
  const [railwayBranch, setRailwayBranch] = useState(null);
  const location = useLocation();

  // Fetch user session data on component mount
  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        // Add cache-busting timestamp and no-cache headers
        const response = await fetch('/api/session', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
          credentials: 'include'
        });
        const data = await response.json();
        if (data.authenticated) {
          setUserRole(data.role || 'user');
          setUserName(data.full_name || 'User');
          setCustomPermissions(data.custom_permissions || {});
          setCurrentUser({
            id: data.id || 'unknown',
            username: data.username || 'User',
            full_name: data.full_name || 'User',
            role: data.role || 'user',
            campus: data.campus || 'all_campuses',
            custom_permissions: data.custom_permissions || {}
          });
        }
        // Set branch info - critical for navigation filtering
        // The backend will return 'main' or 'beta' based on detection
        const detectedBranch = data.railway_branch || 'beta';
        console.log('[MainLayout] Railway Branch:', detectedBranch);
        setRailwayBranch(detectedBranch);
      } catch (error) {
        console.error('Error fetching session data:', error);
      }
    };

    fetchSessionData();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout on client side even if server fails
      window.location.href = '/login';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <EnhancedNavigation
        userRole={userRole}
        customPermissions={customPermissions}
        userName={userName}
        onLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
      />

      {/* Top Navigation Bar */}
      <TopNavigation
        userRole={userRole}
        customPermissions={customPermissions}
      />

      {/* Main content */}
      <div className="lg:pl-64 pt-16">
        {/* Mobile header - simplified since we have top nav */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-slate-700/50 bg-slate-900/95 backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <Link to="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <img 
              src="/static/logo.png?v=2" 
              alt="Futures PULSE Logo" 
              className="h-6 w-auto object-contain"
            />
            <span className="text-white font-semibold">Futures PULSE</span>
          </Link>
          <button
            onClick={handleLogout}
            className="p-2 rounded-md text-red-400 hover:text-red-300 hover:bg-red-900/20"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout; 