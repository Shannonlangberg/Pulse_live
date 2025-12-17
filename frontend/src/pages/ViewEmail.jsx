import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const ViewEmail = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [emailContent, setEmailContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEmail = async () => {
      try {
        const response = await fetch(`/api/communication/view-email/${token}`, {
          credentials: 'include',
          redirect: 'manual' // Don't follow redirects automatically
        });

        // Check if we got a redirect (302/301)
        if (response.type === 'opaqueredirect' || response.status === 302 || response.status === 301) {
          // Redirect to login
          window.location.href = `/login?redirect=/view-email/${token}`;
          return;
        }

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setError(data.error || 'Failed to load email');
          setLoading(false);
          return;
        }

        const html = await response.text();
        setEmailContent(html);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching email:', err);
        setError('Error loading email. Please try again.');
        setLoading(false);
      }
    };

    if (token) {
      fetchEmail();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading email...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-6 max-w-md">
          <h2 className="text-xl font-bold text-white mb-2">Error</h2>
          <p className="text-white/80">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div dangerouslySetInnerHTML={{ __html: emailContent }} />
      </div>
    </div>
  );
};

export default ViewEmail;

