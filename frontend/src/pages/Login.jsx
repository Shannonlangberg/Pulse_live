import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserIcon, LockClosedIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });

      const responseText = await response.text();
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (jsonError) {
        setError(!response.ok ? `Server error: ${response.status} ${response.statusText}` : 'Invalid response from server');
        return;
      }

      if (response.ok && data.success) {
        if (onLogin) onLogin();
        navigate('/');
      } else {
        setError(data.error || 'Invalid username or password');
      }
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError('Unable to connect to server. Please check your connection and try again.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-fc-cream flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Quiet pulse-ring backdrop, brand olive at a whisper */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 -right-40 w-[560px] h-[560px] opacity-[0.05]">
        <img src="/assets/pulse-mark.svg" alt="" className="w-full h-full" />
      </div>

      <div className="w-full max-w-[400px] relative">
        {/* Brand lockup - one voice */}
        <div className="text-center mb-9">
          <img src="/assets/pulse-mark.svg" alt="" className="w-14 h-14 mx-auto mb-5" />
          <div className="fc-label mb-2">Futures Church</div>
          <div className="fc-display text-5xl sm:text-[56px] leading-none tracking-tight mb-3">Pulse</div>
          <p className="m-0 text-[15px] text-fc-brown">
            The weekend, counted.
          </p>
        </div>

        {/* Login Form */}
        <div className="fc-card p-6 sm:p-[26px]">
          <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-[13px] text-fc-brown mb-[7px]">
                Username or email
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
                  autoComplete="username"
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
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  className="fc-input pl-10 pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                <p className="text-fc-copper text-sm font-medium m-0">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="fc-btn-primary w-full justify-center"
            >
              {isLoading ? (
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
        <p className="mt-[22px] mb-0 text-xs text-fc-brown text-center">
          © {new Date().getFullYear()} Futures Church
        </p>
      </div>
    </div>
  );
};

export default Login;
