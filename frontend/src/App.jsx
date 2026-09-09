import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LogStats from './pages/LogStats';
import DatabaseViewer from './pages/DatabaseViewer';
import CampusManagement from './pages/CampusManagement';
import UserManagement from './pages/UserManagement';
import RoleManager from './pages/RoleManager';
import DataExport from './pages/DataExport';
import Reports from './pages/Reports';
import MinistryStatsExplorer from './pages/MinistryStatsExplorer';
import PlatformSettings from './pages/PlatformSettings';
import MyProfile from './pages/MyProfile';
import Resources from './pages/Resources';
import ResourceManager from './pages/ResourceManager';
import Landing from './pages/Landing';
import HomepageManager from './pages/HomepageManager';
import AttendanceDataViewer from './pages/AttendanceDataViewer';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/session', {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      });

      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(data.authenticated);
        return true;
      }
      setIsAuthenticated(false);
      return false;
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const handleLogin = () => {
    setIsAuthenticated(true);
    setIsLoading(true);
    checkAuthStatus();
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-fc-cream flex items-center justify-center">
        <div className="text-fc-midnight text-xl font-display italic font-light">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ?
            <Navigate to="/" replace /> :
            <Login onLogin={handleLogin} />
          }
        />

        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <MainLayout onLogout={handleLogout}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/stats" element={<LogStats />} />
                  <Route path="/database-viewer" element={<DatabaseViewer />} />
                  <Route path="/resources" element={<Resources />} />
                  <Route path="/resources/manage" element={<ResourceManager />} />
                  <Route path="/campuses" element={<CampusManagement />} />
                  <Route path="/users" element={<UserManagement />} />
                  <Route path="/platform-settings" element={<PlatformSettings />} />
                  <Route path="/role-manager" element={<RoleManager />} />
                  <Route path="/export" element={<DataExport />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/ministry-stats" element={<MinistryStatsExplorer />} />
                  <Route path="/attendance-data" element={<AttendanceDataViewer />} />
                  <Route path="/profile" element={<MyProfile />} />
                  <Route path="/settings" element={<Navigate to="/profile" replace />} />
                  <Route path="/homepage-manager" element={<HomepageManager />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </MainLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
