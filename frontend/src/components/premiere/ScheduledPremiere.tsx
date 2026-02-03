import React, { useState, useEffect } from 'react';
import { Premiere } from '../../types/premiere';
import premiereService from '../../services/premiereService';
import { formatVideoDuration } from '../../utils/videoUtils';

interface ScheduledPremiereProps {
  premiere: Premiere;
  onClose?: () => void;
  onCountdownFinish?: () => void;
  isDismissed?: boolean;
}

const ScheduledPremiere: React.FC<ScheduledPremiereProps> = ({ premiere, onClose, onCountdownFinish, isDismissed = false }) => {
  const [timeUntilStart, setTimeUntilStart] = useState(0);
  const hasFinishedRef = React.useRef(false);
  const recheckIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const updateTimeUntilStart = () => {
      const remaining = premiereService.getTimeUntilStart(premiere.startTime);
      setTimeUntilStart(remaining);
      
      // When countdown reaches 0, trigger callback to check if premiere is live
      if (remaining <= 0 && !hasFinishedRef.current) {
        hasFinishedRef.current = true;
        console.log('🎬 Countdown finished! Checking if premiere is live...');
        
        // Immediately trigger parent to re-check premiere status
        // The backend will auto-update status from 'scheduled' to 'live'
        if (onCountdownFinish) {
          onCountdownFinish();
          
          // Keep checking every 3 seconds for up to 9 seconds
          // in case there's a delay in status update
          let attempts = 0;
          recheckIntervalRef.current = setInterval(() => {
            attempts++;
            console.log(`🔄 Re-checking premiere status (attempt ${attempts}/3)...`);
            onCountdownFinish();
            
            if (attempts >= 3 && recheckIntervalRef.current) {
              clearInterval(recheckIntervalRef.current);
              recheckIntervalRef.current = null;
              console.log('✅ Finished re-checking premiere status');
            }
          }, 3000);
        }
      }
    };

    updateTimeUntilStart();
    const interval = setInterval(updateTimeUntilStart, 1000);

    return () => {
      clearInterval(interval);
      if (recheckIntervalRef.current) {
        clearInterval(recheckIntervalRef.current);
      }
    };
  }, [premiere.startTime, onCountdownFinish]);

  const formatTimeUntilStart = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Helper function to get poster URL for premiere video
  const getPremierePosterUrl = (premiere: Premiere): string => {
    if (!premiere.video?.processedFiles?.poster) {
      return '';
    }
    return premiereService.getPosterUrl(premiere.video);
  };

  // If dismissed, show in bottom-right corner as a smaller notification
  if (isDismissed) {
    return (
      <div className="fixed bottom-6 right-6 z-50 max-w-md w-full mx-4 animate-slide-up">
        <div className="bg-netflix-gray rounded-lg p-6 shadow-2xl border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-white">Upcoming Premiere</h1>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white mb-1 line-clamp-1">{premiere.title}</h2>
              <p className="text-gray-300 text-sm line-clamp-2">{premiere.description}</p>
            </div>

            <div className={`${timeUntilStart <= 0 ? 'bg-gradient-to-r from-green-900/30 to-green-700/30 border border-green-500' : 'bg-gradient-to-r from-yellow-900/30 to-yellow-700/30 border border-yellow-500'} rounded-lg p-3 transition-all duration-500`}>
              <div className="text-center">
                {timeUntilStart <= 0 ? (
                  <>
                    <h3 className="text-sm font-bold text-green-400 mb-1 animate-pulse">🎬 Starting...</h3>
                    <div className="text-xs text-white">
                      Loading video player...
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-xs font-semibold text-yellow-400 mb-1">Starts In</h3>
                    <div className="text-lg font-mono text-white">
                      {formatTimeUntilStart(timeUntilStart)}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // First time: show in center as full modal
  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <div className="bg-netflix-gray rounded-lg p-8 max-w-4xl w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Upcoming Premiere</h1>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Video Preview */}
          <div className="aspect-video bg-gray-700 rounded-lg overflow-hidden">
            {premiere.video?.processedFiles?.poster ? (
              <img
                src={getPremierePosterUrl(premiere)}
                alt={premiere.title}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
                🎬
              </div>
            )}
          </div>

          {/* Premiere Info */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">{premiere.title}</h2>
              <p className="text-gray-300 text-lg">{premiere.description}</p>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-2">Premiere Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Start Time:</span>
                    <span className="text-white">{new Date(premiere.startTime).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Duration:</span>
                    <span className="text-white">
                      {formatVideoDuration(premiere.video?.duration || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Quality:</span>
                    <span className="text-white">{premiere.video?.resolution}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Created by:</span>
                    <span className="text-white">{premiere.createdBy.username}</span>
                  </div>
                </div>
              </div>

              <div className={`${timeUntilStart <= 0 ? 'bg-gradient-to-r from-green-900/30 to-green-700/30 border border-green-500' : 'bg-gradient-to-r from-yellow-900/30 to-yellow-700/30 border border-yellow-500'} rounded-lg p-4 transition-all duration-500`}>
                <div className="text-center">
                  {timeUntilStart <= 0 ? (
                    <>
                      <h3 className="text-xl font-bold text-green-400 mb-2 animate-pulse">🎬 Starting Premiere...</h3>
                      <div className="text-lg text-white">
                        Please wait, loading video player...
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-xl font-bold text-yellow-400 mb-2">Premiere Starts In</h3>
                      <div className="text-3xl font-mono text-white">
                        {formatTimeUntilStart(timeUntilStart)}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="text-center">
                <p className="text-gray-400 text-sm">
                  This premiere will start automatically when the time comes.
                </p>
                <p className="text-gray-500 text-xs mt-2">
                  You'll be notified when it begins!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduledPremiere;
