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
    <div className="min-h-screen bg-fc-cream font-sans">
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
      <div className={`lg:pl-56 ${activeSection !== 'home' ? 'lg:pt-16' : ''}`}>
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-fc-cream2 bg-fc-cream/95 backdrop-blur-sm sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-fc-brown hover:text-fc-midnight hover:bg-fc-cream2 transition-colors"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <Link to="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <img
              src="/static/logo.png?v=2"
              alt="Futures Church"
              className="h-6 w-auto object-contain"
            />
            <span className="text-fc-midnight font-display italic font-light text-lg">Pulse</span>
          </Link>
          <button
            onClick={handleLogout}
            className="p-2 rounded-md text-fc-copper hover:text-fc-brown hover:bg-fc-cream2 transition-colors"
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
