import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, LinkIcon } from '@heroicons/react/24/outline';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDriveAuthRequired, setIsDriveAuthRequired] = useState(false);
  const [isDriveConnecting, setIsDriveConnecting] = useState(false);
  const [driveError, setDriveError] = useState('');
  const navigate = useNavigate();

  // Check if returning from OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('oauth_success');
    const oauthInProgress = sessionStorage.getItem('google_oauth_in_progress');
    
    if (oauthSuccess || oauthInProgress) {
      // Clean up URL and sessionStorage
      window.history.replaceState({}, '', '/login');
      sessionStorage.removeItem('google_oauth_in_progress');
      
      // Check if user is authenticated, then redirect to dashboard
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
            // User is authenticated, redirect to landing page
            if (onLogin) {
              onLogin();
            }
            navigate('/');
          } else {
            // Not authenticated yet, refresh to check again
            setTimeout(() => {
              window.location.reload();
            }, 500);
          }
        })
        .catch(() => {
          // On error, refresh to check auth status
          setTimeout(() => {
            window.location.reload();
          }, 500);
        });
    }
  }, [navigate, onLogin]);

  // Start Google Drive OAuth for all users
  const startGoogleAuth = async () => {
    try {
      setDriveError('');
      setIsDriveConnecting(true);

      const response = await fetch('/api/google/auth-url', {
        credentials: 'include'
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const errorMsg = payload.error || 'Unable to begin Google authentication. Please try again.';

        if (response.status === 503 && errorMsg.toLowerCase().includes('disabled')) {
          setDriveError('Google Drive integration needs to be enabled. Please contact your administrator.');
        } else if (response.status === 403) {
          setDriveError('You do not have permission to connect Google Drive for this account.');
        } else {
          setDriveError(errorMsg);
        }
        setIsDriveConnecting(false);
        return;
      }

      const data = await response.json();
      const authUrl = data.auth_url || data.authUrl;
      if (!authUrl) {
        setDriveError('Missing Google authentication URL.');
        setIsDriveConnecting(false);
        return;
      }

      // Always use full-page redirect (no popup)
      sessionStorage.setItem('google_oauth_in_progress', 'true');
      sessionStorage.setItem('google_oauth_redirect', '/');
      window.location.href = authUrl;
      return; // Don't set connecting to false - we're navigating away
    } catch (err) {
      console.error('Google auth error during login:', err);
      setDriveError('Unable to complete Google authentication. Please try again.');
      setIsDriveConnecting(false);
      // Don't navigate on error - let user try again or contact admin
    }
  };

  // Handle OAuth redirect - check for success flag in URL or sessionStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('oauth_success');
    const oauthSuccessStorage = sessionStorage.getItem('google_oauth_success');
    
    if (oauthSuccess || oauthSuccessStorage) {
      // Clean up
      sessionStorage.removeItem('google_oauth_success');
      window.history.replaceState({}, '', '/login');
      
      setIsDriveConnecting(false);
      setDriveError('');
      setIsDriveAuthRequired(false);
      
      if (onLogin) {
        onLogin();
      }
      navigate('/');
    }
  }, [navigate, onLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setDriveError('');
    setIsDriveAuthRequired(false);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          password: password,
        }),
        credentials: 'include',
      });

      // Check if response has content before parsing JSON
      const responseText = await response.text();
      let data;
      
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError, 'Response text:', responseText);
        if (!response.ok) {
          setError(`Server error: ${response.status} ${response.statusText}`);
        } else {
          setError('Invalid response from server');
        }
        return;
      }

      if (response.ok && data.success) {
        const needsDriveAuth = !!data.needs_drive_auth;

        if (needsDriveAuth) {
          // For admins needing Drive, show prompt and start Google auth
          setIsDriveAuthRequired(true);
          // Don't navigate yet - wait for Google auth to complete
          // The startGoogleAuth function will handle navigation after success
        } else {
          // Normal login flow - no Drive auth needed
          if (onLogin) {
            onLogin();
          }
          navigate('/');
        }
      } else {
        setError(data.error || 'Invalid username or password');
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setError('Unable to connect to server. Please check your connection and try again.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-fc-cream flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[400px]">
        {/* Logo/Brand */}
        <div className="mb-8 sm:mb-9">
          <img
            src="/static/logo.png?v=3"
            alt="Futures Church"
            className="h-10 sm:h-[46px] w-auto object-contain mb-5 sm:mb-6"
          />
          <div className="fc-label mb-3">Futures Church</div>
          <div className="flex items-center gap-3.5 mb-3.5">
            <img src="/assets/pulse-mark.svg" alt="" className="w-10 h-10 sm:w-[46px] sm:h-[46px] flex-shrink-0" />
            <span className="fc-display text-4xl sm:text-[56px] leading-none tracking-tight">Pulse</span>
          </div>
          <p className="m-0 text-[15px] text-fc-brown">
            The weekend, counted. Sign in to log your campus.
          </p>
        </div>

        {/* Login Form */}
        <div className="fc-card p-6 sm:p-[26px]">
          <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-[13px] text-fc-brown mb-[7px]">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <UserIcon className="h-4 w-4 text-fc-thistle" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="fc-input pl-10"
                  placeholder="ashley.peters"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-[13px] text-fc-brown mb-[7px]">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-4 w-4 text-fc-thistle" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="fc-input pl-10 pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-4 w-4 text-fc-thistle hover:text-fc-brown transition-colors" />
                  ) : (
                    <EyeIcon className="h-4 w-4 text-fc-thistle hover:text-fc-brown transition-colors" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-fc-wash-peach border border-fc-wash-peach-border rounded-lg p-3.5">
                <p className="text-fc-copper text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Google Drive Auth Prompt */}
            {isDriveAuthRequired && !isDriveConnecting && (
              <div className="bg-fc-wash-sky border border-fc-wash-sky-border rounded-lg p-3.5 space-y-3">
                <div>
                  <p className="text-fc-midnight text-sm font-medium mb-1">
                    Connect Google Account
                  </p>
                  <p className="text-fc-brown text-xs">
                    Please connect your Google account to access Pulse resources and features. Click below to authorize.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startGoogleAuth}
                  className="fc-btn-secondary w-full justify-center bg-white"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  Connect with Google
                </button>
              </div>
            )}

            {/* Google Drive Connecting Status */}
            {isDriveConnecting && (
              <div className="bg-fc-wash-sky border border-fc-wash-sky-border rounded-lg p-3.5 space-y-1">
                <p className="text-fc-midnight text-sm font-medium">
                  Connecting Google Drive for your admin account…
                </p>
                <p className="text-fc-brown text-xs">
                  You will be redirected to Google to authorize access. Once you approve, you'll be returned to the app.
                </p>
              </div>
            )}

            {driveError && (
              <div className="bg-fc-wash-butter border border-fc-wash-butter-border rounded-lg p-3.5">
                <p className="text-fc-brown text-sm font-medium">{driveError}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isDriveConnecting}
              className="fc-btn-primary w-full justify-center"
            >
              {isLoading || isDriveConnecting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-3"></div>
                  Signing in...
                </div>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-[22px] mb-0 text-xs text-fc-brown">
          © 2025 Futures Church
        </p>
      </div>
    </div>
  );
};

export default Login; 