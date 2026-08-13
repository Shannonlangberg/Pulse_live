import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import EnhancedNavigation from './EnhancedNavigation';
import TopNavigation from './TopNavigation';
import { useSession } from '../lib/useSession';

const MainLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const { authenticated, fullName } = useSession();

  const userName = authenticated ? (fullName || 'User') : '';

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
        userName={userName}
        onLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />

      {/* Top Navigation Bar */}
      <TopNavigation
        activeSection={activeSection}
      />

      {/* Main content */}
      <div className={`lg:pl-64 ${activeSection !== 'home' ? 'lg:pt-16' : ''}`}>
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-slate-700/50 bg-slate-900/95 backdrop-blur-sm sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
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
            className="p-2 rounded-md text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Page content */}
        <main className="p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout; 