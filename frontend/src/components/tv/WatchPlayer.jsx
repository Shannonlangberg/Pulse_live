import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';

const WatchPlayer = ({ episode, series }) => {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const progressIntervalRef = useRef(null);
  const lastSavedPosition = useRef(0);

  // Load progress on mount
  useEffect(() => {
    fetchProgress();
  }, [episodeId]);

  // Save progress every 15 seconds
  useEffect(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = setInterval(() => {
      if (progress && progress.last_position_seconds !== lastSavedPosition.current) {
        saveProgress(progress.last_position_seconds, false);
      }
    }, 15000); // Every 15 seconds

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [progress]);

  const fetchProgress = async () => {
    try {
      const response = await fetch(`/api/tv/episode/${episodeId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.episode?.progress) {
          setProgress(data.episode.progress);
          lastSavedPosition.current = data.episode.progress.last_position_seconds || 0;
        }
      }
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching progress:', err);
      setIsLoading(false);
    }
  };

  const saveProgress = async (position, completed = false) => {
    try {
      const response = await fetch(`/api/tv/episode/${episodeId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          position: Math.floor(position),
          completed: completed
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.progress) {
          setProgress(data.progress);
          lastSavedPosition.current = data.progress.last_position_seconds || 0;
          
          // If completed, show success message
          if (completed && data.progress.completed) {
            // Could show a toast notification here
            console.log('Episode completed!');
          }
        }
      }
    } catch (err) {
      console.error('Error saving progress:', err);
      setError('Failed to save progress');
    }
  };

  const handleVideoTimeUpdate = (event) => {
    if (event.target) {
      const currentTime = event.target.currentTime || 0;
      const duration = event.target.duration || episode?.duration_seconds || 0;
      
      // Update local progress state
      setProgress(prev => ({
        ...prev,
        last_position_seconds: Math.floor(currentTime),
        completed: currentTime >= duration * 0.95 // 95% watched = completed
      }));

      // Check if video is near completion
      if (duration > 0 && currentTime >= duration * 0.95 && progress && !progress.completed) {
        saveProgress(currentTime, true);
      }
    }
  };

  const getVideoEmbedUrl = (videoUrl) => {
    if (!videoUrl) return null;
    
    // YouTube
    if (videoUrl.includes('youtube.com/watch') || videoUrl.includes('youtu.be/')) {
      const videoId = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
      }
    }
    
    // Vimeo
    if (videoUrl.includes('vimeo.com/')) {
      const videoId = videoUrl.match(/vimeo\.com\/(\d+)/)?.[1];
      if (videoId) {
        return `https://player.vimeo.com/video/${videoId}?autoplay=1`;
      }
    }
    
    // Direct video URL or other embed
    return videoUrl;
  };

  const embedUrl = getVideoEmbedUrl(episode?.video_url);
  const startTime = progress?.last_position_seconds || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!episode || !embedUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl">Episode not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white hover:text-purple-300 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span>Back</span>
          </button>
          
          <div className="text-center">
            <h1 className="text-white font-semibold text-lg">{episode.title}</h1>
            {series && (
              <p className="text-sm text-slate-400">{series.title}</p>
            )}
          </div>
          
          <div className="w-20" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Video Player */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6">
          {embedUrl.includes('youtube.com') || embedUrl.includes('youtu.be') || embedUrl.includes('vimeo.com') ? (
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={episode.title}
            />
          ) : (
            <video
              src={embedUrl}
              controls
              className="w-full h-full"
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={() => saveProgress(episode.duration_seconds || 0, true)}
              autoPlay
            />
          )}
        </div>

        {/* Episode Info */}
        <div className="bg-slate-800/50 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">{episode.title}</h2>
              {episode.description && (
                <p className="text-slate-300">{episode.description}</p>
              )}
            </div>
            
            {episode.downloadable_notes_url && (
              <a
                href={episode.downloadable_notes_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <DocumentArrowDownIcon className="w-5 h-5" />
                <span>Download Notes</span>
              </a>
            )}
          </div>

          {/* Progress Info */}
          {progress && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>
                  {progress.completed ? 'Completed' : 'In Progress'}
                </span>
                {progress.last_position_seconds > 0 && (
                  <span>
                    Watched: {Math.floor(progress.last_position_seconds / 60)}:{(progress.last_position_seconds % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/40 text-red-200 rounded-xl px-4 py-3 mb-6">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default WatchPlayer;

