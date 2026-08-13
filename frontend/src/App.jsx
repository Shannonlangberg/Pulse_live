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

const RESOURCE_ALLOWED_ROLES = ['superadmin', 'admin'];

const DriveAuthModal = ({ onConnect, connecting, error }) => {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-fc-midnight/60 backdrop-blur-sm p-4">
      <div className="bg-white border border-fc-cream2 rounded-3xl shadow-pop max-w-lg w-full p-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-fc-wash-butter flex items-center justify-center text-3xl">
            🔐
          </div>
          <div>
            <h2 className="text-fc-midnight text-2xl font-semibold">Connect Google Drive</h2>
            <p className="text-fc-brown text-sm">
              Futures PULSE needs access to the shared Drive folders before you continue. Authorise with your Futures Church Google account to unlock Resources.
            </p>
          </div>
        </div>

        <div className="bg-fc-cream border border-fc-cream2 rounded-2xl px-4 py-3 text-fc-brown text-sm">
          You will be redirected to Google to authorize access. Once you approve, you&apos;ll be returned to the app automatically.
        </div>

        {error && (
          <div className="bg-fc-wash-peach border border-fc-wash-peach-border text-fc-copper rounded-2xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={onConnect}
          disabled={connecting}
          className={`w-full inline-flex items-center justify-center gap-3 px-5 py-3 rounded-2xl font-semibold transition-all duration-300
            ${connecting ? 'bg-fc-cream2 text-fc-brown cursor-not-allowed' : 'bg-fc-copper text-white hover:brightness-95'}
          `}
        >
          <span className="text-xl">🔗</span>
          {connecting ? 'Redirecting to Google...' : 'Connect with Google'}
        </button>
      </div>
    </div>
  );
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [needsDriveAuth, setNeedsDriveAuth] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [driveError, setDriveError] = useState('');
  const [userRole, setUserRole] = useState(null);
  const [railwayBranch, setRailwayBranch] = useState(null);

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
        const role = data.role || null;
        setUserRole(role);
        // Get branch detection from backend
        const detectedBranch = data.railway_branch || 'beta';
        console.log('[App] Railway Branch:', detectedBranch);
        setRailwayBranch(detectedBranch);
        const allowsDriveAuth = role ? RESOURCE_ALLOWED_ROLES.includes(role) : false;
        const requiresDrive = allowsDriveAuth && Boolean(data.needs_drive_auth);
        setNeedsDriveAuth(requiresDrive);
        setShowDriveModal(requiresDrive);
        return true;
      } else {
        setIsAuthenticated(false);
        setUserRole(null);
        setRailwayBranch(null);
        setNeedsDriveAuth(false);
        setShowDriveModal(false);
        return false;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      setUserRole(null);
      setRailwayBranch(null);
      setNeedsDriveAuth(false);
      setShowDriveModal(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
    
    // Check if we're returning from mobile OAuth redirect
    const oauthInProgress = sessionStorage.getItem('google_oauth_in_progress');
    const oauthSuccess = sessionStorage.getItem('google_oauth_success');
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccessParam = urlParams.get('oauth_success');
    
    if (oauthInProgress || oauthSuccess || oauthSuccessParam) {
      sessionStorage.removeItem('google_oauth_in_progress');
      sessionStorage.removeItem('google_oauth_success');
      
      // Clean up URL parameter
      if (oauthSuccessParam) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      
      // Wait a moment for session to be updated, then check auth multiple times
      // This ensures the session cookie is properly set
      let attempts = 0;
      const maxAttempts = 5;
      
      const checkAuthWithRetry = () => {
        attempts++;
        fetch('/api/session', { 
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          }
        })
          .then(res => res.json())
          .then((sessionData) => {
            if (sessionData && sessionData.authenticated) {
              setIsAuthenticated(true);
              setNeedsDriveAuth(false);
              setShowDriveModal(false);
              setDriveError('');
              
              // Force a page refresh to ensure all components see the new auth state
              if (attempts === 1) {
                // Only refresh on first successful check
                setTimeout(() => {
                  window.location.reload();
                }, 500);
              }
            } else if (attempts < maxAttempts) {
              // Retry if not authenticated yet
              setTimeout(checkAuthWithRetry, 500);
            }
          }).catch(() => {
            if (attempts < maxAttempts) {
              setTimeout(checkAuthWithRetry, 500);
            }
          });
      };
      
      setTimeout(checkAuthWithRetry, 1000);
    }
  }, [checkAuthStatus]);
  
  useEffect(() => {
    // Check for OAuth success from redirect
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('oauth_success');
    const oauthSuccessStorage = sessionStorage.getItem('google_oauth_success');
    
    if (oauthSuccess || oauthSuccessStorage) {
      // Clean up
      sessionStorage.removeItem('google_oauth_success');
      window.history.replaceState({}, '', window.location.pathname);
      
      // OAuth completed successfully - close modal and refresh auth status
      setNeedsDriveAuth(false);
      setShowDriveModal(false);
      setDriveError('');
      setDriveConnecting(false);
      
      // Refresh auth status to pick up the new Google Drive auth
      checkAuthStatus();
    }
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
    setUserRole(null);
    setNeedsDriveAuth(false);
    setShowDriveModal(false);
    setDriveError('');
  };

  const handleDriveConnect = useCallback(async () => {
    try {
      setDriveError('');
      setDriveConnecting(true);

      const response = await fetch('/api/google/auth-url', {
        credentials: 'include'
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const errorMsg = payload.error || 'Unable to begin Google authentication. Please try again.';
        
        // If OAuth is disabled, show a more helpful message
        if (response.status === 503 && errorMsg.includes('disabled')) {
          setDriveError('Google Drive integration needs to be enabled. Please contact your administrator.');
        } else {
          setDriveError(errorMsg);
        }
        setDriveConnecting(false);
        return;
      }

      const data = await response.json();
      const authUrl = data.auth_url || data.authUrl;
      if (!authUrl) {
        setDriveError('Missing Google authentication URL.');
        setDriveConnecting(false);
        return;
      }

      // Always use full-page redirect (no popup)
      // Store redirect URL and OAuth in progress flag
      const currentPath = window.location.pathname;
      sessionStorage.setItem('google_oauth_in_progress', 'true');
      sessionStorage.setItem('google_oauth_redirect', currentPath || '/');
      window.location.href = authUrl;
      return; // Don't set connecting to false - we're navigating away
    } catch (error) {
      setDriveError(error.message || 'Unable to begin Google authentication.');
      setDriveConnecting(false);
    }
  }, [checkAuthStatus]);

  useEffect(() => {
    // This handler is for the Drive auth modal specifically
    const handleDriveAuthMessage = (event) => {
      // Allow messages from the same origin
      const allowedOrigins = [
        window.location.origin,
        'https://futures-pulse-production.up.railway.app',
        'https://futures.pulse.com',
        'https://pulse.futures.church'
      ];
      
      if (!allowedOrigins.some(origin => event.origin === origin || event.origin.startsWith(origin))) {
        return;
      }

      if (event.data && event.data.type === 'googleAuthSuccess') {
        // OAuth completed successfully - close modal and refresh page
        setDriveConnecting(false);
        setDriveError('');
        setNeedsDriveAuth(false);
        setShowDriveModal(false);
        
        // Refresh the page to ensure all components see the updated auth state
        setTimeout(() => {
          window.location.reload();
        }, 300);
      }
    };

    window.addEventListener('message', handleDriveAuthMessage);
    return () => {
      window.removeEventListener('message', handleDriveAuthMessage);
    };
  }, [checkAuthStatus]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-fc-cream flex items-center justify-center">
        <div className="text-fc-midnight text-xl font-display italic font-light">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      {isAuthenticated && showDriveModal && (
        <DriveAuthModal
          onConnect={handleDriveConnect}
          connecting={driveConnecting}
          error={driveError}
        />
      )}
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
