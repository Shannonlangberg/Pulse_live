import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import VideoCard from '../components/tv/VideoCard';

const TVSeries = () => {
  const { id } = useParams();
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSeries();
  }, [id]);

  const fetchSeries = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tv/series/${id}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setSeries(data.series);
      } else {
        setError('Series not found');
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching series:', err);
      setError('Failed to load series');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (error || !series) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-red-400 text-xl">{error || 'Series not found'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header - Netflix style with backdrop */}
      <div className="relative">
        {series.thumbnail_url ? (
          <div className="absolute inset-0 h-96 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-900">
            <img
              src={series.thumbnail_url}
              alt={series.title}
              className="w-full h-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-900" />
          </div>
        ) : (
          <div className="absolute inset-0 h-96 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-900" />
        )}
        
        <div className="relative max-w-7xl mx-auto px-6 pt-32 pb-16">
          <Link
            to="/tv"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span>Back to Pulse TV</span>
          </Link>
          
          <h1 className="text-5xl font-bold text-white mb-4">{series.title}</h1>
          {series.description && (
            <p className="text-lg text-slate-300 max-w-3xl">{series.description}</p>
          )}
        </div>
      </div>

      {/* Episodes */}
      <div className="max-w-7xl mx-auto px-6 pb-12 -mt-8 relative z-10">
        <h2 className="text-2xl font-bold text-white mb-6">
          Episodes ({series.episodes?.length || 0})
        </h2>
        
        {series.episodes && series.episodes.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {series.episodes.map((episode) => (
              <VideoCard
                key={episode.id}
                episode={episode}
                series={series}
                showProgress={true}
                progress={episode.progress}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-slate-400 text-lg">No episodes available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TVSeries;
