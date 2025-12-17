import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import WatchPlayer from '../components/tv/WatchPlayer';

const TVWatch = () => {
  const { episodeId } = useParams();
  const [episode, setEpisode] = useState(null);
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEpisode();
  }, [episodeId]);

  const fetchEpisode = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tv/episode/${episodeId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setEpisode(data.episode);
        
        // Fetch series if we have series_id
        if (data.episode?.series_id) {
          const seriesResponse = await fetch(`/api/tv/series/${data.episode.series_id}`, {
            credentials: 'include'
          });
          
          if (seriesResponse.ok) {
            const seriesData = await seriesResponse.json();
            setSeries(seriesData.series);
          }
        }
      } else {
        setError('Episode not found');
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching episode:', err);
      setError('Failed to load episode');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-white text-xl">Loading episode...</div>
      </div>
    );
  }

  if (error || !episode) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-red-400 text-xl">{error || 'Episode not found'}</div>
      </div>
    );
  }

  return <WatchPlayer episode={episode} series={series} />;
};

export default TVWatch;

