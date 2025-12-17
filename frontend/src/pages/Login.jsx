import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserIcon, LockClosedIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

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
            // User is authenticated, redirect to dashboard
            if (onLogin) {
              onLogin();
            }
            navigate('/dashboard');
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

  // Start Google Drive OAuth for admins who need it
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
      sessionStorage.setItem('google_oauth_redirect', '/dashboard');
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
      navigate('/dashboard');
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
          navigate('/dashboard');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 mb-6">
            <img 
              src="/static/logo.png?v=3" 
              alt="Futures PULSE Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Futures PULSE</h1>
        </div>

        {/* Login Form */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Welcome Back</h2>
            <p className="text-slate-400">Sign in to access your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-3">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="block w-full pl-12 pr-4 py-4 border border-slate-600 rounded-xl bg-slate-700/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-3">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="block w-full pl-12 pr-12 py-4 border border-slate-600 rounded-xl bg-slate-700/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-slate-400 hover:text-slate-300 transition-colors" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-slate-400 hover:text-slate-300 transition-colors" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                <p className="text-red-400 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Google Drive Auth Prompt */}
            {isDriveAuthRequired && !isDriveConnecting && (
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-blue-200 text-sm font-medium mb-1">
                    Connect Google Drive
                  </p>
                  <p className="text-blue-300/80 text-xs">
                    Your admin account needs to connect with Google Drive to access resources. Click below to authorize.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startGoogleAuth}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                >
                  <span className="text-lg">🔗</span>
                  Connect with Google
                </button>
              </div>
            )}

            {/* Google Drive Connecting Status */}
            {isDriveConnecting && (
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 space-y-1">
                <p className="text-blue-200 text-sm font-medium">
                  Connecting Google Drive for your admin account…
                </p>
                <p className="text-blue-300/80 text-xs">
                  You will be redirected to Google to authorize access. Once you approve, you'll be returned to the app.
                </p>
              </div>
            )}

            {driveError && (
              <div className="bg-amber-900/20 border border-amber-500/40 rounded-xl p-4">
                <p className="text-amber-200 text-sm font-medium">{driveError}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isDriveConnecting}
              className="w-full flex justify-center py-4 px-6 border border-transparent rounded-xl text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30"
            >
              {isLoading || isDriveConnecting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-slate-500">
            © 2025 Futures Church. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login; 