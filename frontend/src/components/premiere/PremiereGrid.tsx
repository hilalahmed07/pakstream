import React from 'react';
import { Premiere } from '../../types/premiere';
import premiereService from '../../services/premiereService';
import { formatVideoDuration } from '../../utils/videoUtils';

interface PremiereGridProps {
  premieres: Premiere[];
  loading?: boolean;
  onCardClick?: (premiere: Premiere) => void;
}

const PremiereGrid: React.FC<PremiereGridProps> = ({ premieres, loading, onCardClick }) => {
  const getPremierePosterUrl = (premiere: Premiere): string => {
    if (!premiere.video?.processedFiles?.poster) {
      return '';
    }
    return premiereService.getPosterUrl(premiere.video);
  };

  const formatTimeUntilStart = (startTime: string): string => {
    const timeUntilStart = premiereService.getTimeUntilStart(startTime);
    const totalSeconds = Math.floor(timeUntilStart / 1000);
    
    if (totalSeconds <= 0) return 'Starting soon';
    
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const formatStartDate = (startTime: string): string => {
    const date = new Date(startTime);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card rounded-lg overflow-hidden animate-pulse">
            <div className="aspect-video bg-secondary"></div>
            <div className="p-4 space-y-3">
              <div className="h-4 bg-secondary rounded w-3/4"></div>
              <div className="h-3 bg-secondary rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!premieres || premieres.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🎬</div>
        <p className="text-text-secondary text-lg mb-2">No upcoming premieres scheduled</p>
        <p className="text-text-secondary opacity-70 text-sm">Check back later for exciting new content!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {premieres.map((premiere) => (
        <div
          key={premiere._id}
          role={onCardClick ? 'button' : undefined}
          tabIndex={onCardClick ? 0 : undefined}
          onClick={() => onCardClick?.(premiere)}
          onKeyDown={(e) => {
            if (onCardClick && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onCardClick(premiere);
            }
          }}
          className="group bg-card rounded-lg overflow-hidden hover:scale-105 hover:bg-card-hover transition-all duration-300 cursor-pointer"
        >
          {/* Poster Image */}
          <div className="relative aspect-video bg-secondary overflow-hidden">
            {premiere.video?.processedFiles?.poster ? (
              <img
                src={getPremierePosterUrl(premiere)}
                alt={premiere.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-secondary text-6xl">
                🎬
              </div>
            )}
            
            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            {/* Time Badge */}
            <div className="absolute top-3 left-3">
              <div className="bg-yellow-600 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1">
                <span>⏰</span>
                <span>{formatTimeUntilStart(premiere.startTime)}</span>
              </div>
            </div>

            {/* Duration Badge */}
            {premiere.video?.duration && (
              <div className="absolute top-3 right-3">
                <span className="bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs font-semibold">
                  {formatVideoDuration(premiere.video.duration)}
                </span>
              </div>
            )}

            {/* Play Icon Overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="bg-black bg-opacity-50 rounded-full p-4">
                <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Premiere Info */}
          <div className="p-4">
            <h3 className="text-lg font-semibold text-text-primary mb-2 line-clamp-2 group-hover:text-accent transition-colors">
              {premiere.title}
            </h3>
            
            {premiere.description && (
              <p className="text-text-secondary text-sm mb-3 line-clamp-2">
                {premiere.description}
              </p>
            )}

            {/* Start Time */}
            <div className="flex items-center space-x-2 text-text-secondary text-sm mb-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="font-medium">{formatStartDate(premiere.startTime)}</span>
            </div>

            {/* Video Info */}
            <div className="flex items-center justify-between text-xs text-text-secondary opacity-70 mt-3 pt-3 border-t border-border">
              {premiere.video?.resolution && (
                <span className="flex items-center space-x-1">
                  <span>📺</span>
                  <span>{premiere.video.resolution}</span>
                </span>
              )}
              {premiere.createdBy?.username && (
                <span className="flex items-center space-x-1">
                  <span>👤</span>
                  <span>{premiere.createdBy.username}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PremiereGrid;

