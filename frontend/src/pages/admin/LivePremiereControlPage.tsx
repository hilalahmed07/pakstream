import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Premiere } from '../../types/premiere';
import premiereService from '../../services/premiereService';
import socketService from '../../services/socketService';
import { useAuth } from '../../hooks';

const LivePremiereControlPage: React.FC = () => {
  const { premiereId } = useParams<{ premiereId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [premiere, setPremiere] = useState<Premiere | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/admin');
      return;
    }

    if (!premiereId) {
      navigate('/admin/premieres');
      return;
    }

    // Fetch premiere data
    const fetchPremiere = async () => {
      try {
        const response = await premiereService.getPremiereById(premiereId);
        setPremiere(response.data.premiere);
        setViewerCount(response.data.premiere.totalViewers || 0);
      } catch (error) {
        console.error('Failed to fetch premiere:', error);
        navigate('/admin/premieres');
      } finally {
        setLoading(false);
      }
    };

    fetchPremiere();
  }, [premiereId, user, navigate]);

  useEffect(() => {
    if (!premiere) return;

    // Join the premiere room as admin
    socketService.joinPremiere(premiere._id);

    // Listen for premiere events
    const handlePremiereStarted = (data: any) => {
      console.log('Premiere started:', data);
      setIsPlaying(true);
    };

    const handleVideoPlay = () => {
      setIsPlaying(true);
    };

    const handleVideoPause = () => {
      setIsPlaying(false);
    };

    const handleViewerJoined = (data: any) => {
      setViewerCount(data.viewerCount);
    };

    const handleViewerLeft = (data: any) => {
      setViewerCount(data.viewerCount);
    };

    socketService.onPremiereStarted(handlePremiereStarted);
    socketService.onVideoPlay(handleVideoPlay);
    socketService.onVideoPause(handleVideoPause);
    socketService.onViewerJoined(handleViewerJoined);
    socketService.onViewerLeft(handleViewerLeft);

    // Check initial status
    if (premiere.status === 'live') {
      setIsPlaying(true);
    }

    return () => {
      if (premiere) {
        socketService.leavePremiere(premiere._id);
      }
      socketService.removeListener('premiere-started', handlePremiereStarted);
      socketService.removeListener('video-play', handleVideoPlay);
      socketService.removeListener('video-pause', handleVideoPause);
      socketService.removeListener('viewer-joined', handleViewerJoined);
      socketService.removeListener('viewer-left', handleViewerLeft);
    };
  }, [premiere]);

  const handlePlay = () => {
    if (!premiere) return;
    try {
      socketService.playVideo(premiere._id);
      setIsPlaying(true);
      setError(null);
    } catch (err) {
      setError('Failed to play video');
      console.error('Error playing video:', err);
    }
  };

  const handlePause = () => {
    if (!premiere) return;
    try {
      socketService.pauseVideo(premiere._id);
      setIsPlaying(false);
      setError(null);
    } catch (err) {
      setError('Failed to pause video');
      console.error('Error pausing video:', err);
    }
  };

  const handleStartPremiere = () => {
    if (!premiere) return;
    try {
      socketService.startPremiere(premiere._id);
      setIsPlaying(true);
      setError(null);
    } catch (err) {
      setError('Failed to start premiere');
      console.error('Error starting premiere:', err);
    }
  };

  const handleEndPremiere = () => {
    if (!premiere) return;
    if (window.confirm('Are you sure you want to end this premiere?')) {
      try {
        socketService.endPremiere(premiere._id);
        navigate('/admin/premieres');
      } catch (err) {
        setError('Failed to end premiere');
        console.error('Error ending premiere:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!premiere) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Premiere Not Found</h2>
          <button
            onClick={() => navigate('/admin/premieres')}
            className="px-6 py-3 bg-netflix-red hover:bg-red-700 text-white rounded-lg"
          >
            Back to Premieres
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Premiere Control</h1>
          <p className="text-gray-400">Control video playback for all viewers</p>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Premiere Info */}
        <div className="bg-netflix-gray rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">{premiere.title}</h2>
              <p className="text-gray-300">{premiere.description}</p>
            </div>
            <div className="text-right">
              <div className="text-white font-bold text-2xl mb-1">{viewerCount}</div>
              <div className="text-gray-400 text-sm">Viewers</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <div className="text-gray-400 text-sm">Status</div>
              <div className={`text-white font-semibold ${
                premiere.status === 'live' ? 'text-green-500' : 'text-yellow-500'
              }`}>
                {premiere.status === 'live' ? '🔴 LIVE' : '⏸ Scheduled'}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Video</div>
              <div className="text-white font-semibold">{premiere.video?.title || 'N/A'}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Duration</div>
              <div className="text-white font-semibold">
                {premiere.video?.duration 
                  ? `${Math.floor(premiere.video.duration / 60)}:${(premiere.video.duration % 60).toString().padStart(2, '0')}`
                  : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Resolution</div>
              <div className="text-white font-semibold">{premiere.video?.resolution || 'N/A'}</div>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex flex-wrap gap-4">
            {premiere.status === 'scheduled' && (
              <button
                onClick={handleStartPremiere}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors flex items-center space-x-2"
              >
                <span>▶</span>
                <span>Start Premiere</span>
              </button>
            )}

            {premiere.status === 'live' && (
              <>
                {!isPlaying ? (
                  <button
                    onClick={handlePlay}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <span>▶</span>
                    <span>Play Video</span>
                  </button>
                ) : (
                  <button
                    onClick={handlePause}
                    className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <span>⏸</span>
                    <span>Pause Video</span>
                  </button>
                )}

                <button
                  onClick={handleEndPremiere}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center space-x-2"
                >
                  <span>⏹</span>
                  <span>End Premiere</span>
                </button>
              </>
            )}
          </div>

          {/* Video Preview */}
          {premiere.video?.processedFiles?.poster && (
            <div className="mt-6">
              <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden">
                <img
                  src={premiereService.getPosterUrl(premiere.video)}
                  alt={premiere.title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
        </div>

        {/* Status Info */}
        <div className="bg-netflix-gray rounded-lg p-4">
          <div className="text-gray-400 text-sm">
            <p className="mb-2">
              <strong className="text-white">Current Status:</strong> {isPlaying ? 'Playing' : 'Paused'}
            </p>
            <p className="mb-2">
              <strong className="text-white">Started:</strong> {new Date(premiere.startTime).toLocaleString()}
            </p>
            <p>
              <strong className="text-white">Note:</strong> All viewers will see the video play/pause when you control it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivePremiereControlPage;

