import React from 'react';
import { Link } from 'react-router-dom';
import VideoCard from './VideoCard';

const SeriesRow = ({ series, title, episodes = null }) => {
  // If episodes not provided, use series episodes
  const seriesEpisodes = episodes || (series?.episodes || []);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        {series && (
          <Link
            to={`/tv/series/${series.id}`}
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            View All →
          </Link>
        )}
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {seriesEpisodes.length > 0 ? (
          seriesEpisodes.map((episode) => (
            <VideoCard
              key={episode.id}
              episode={episode}
              series={series}
              showProgress={true}
              progress={episode.progress}
            />
          ))
        ) : (
          <div className="col-span-full text-center text-slate-400 py-8">
            No episodes available
          </div>
        )}
      </div>
    </div>
  );
};

export default SeriesRow;

