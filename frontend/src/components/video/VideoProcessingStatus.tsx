import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../../config/api';

interface ProcessingVideo {
  videoId: string;
  title: string;
  progress: number;
  message: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  timestamp: string;
}

interface VideoProcessingStatusProps {
  onVideoReady?: (videoId: string) => void;
}

const VideoProcessingStatus: React.FC<VideoProcessingStatusProps> = ({ onVideoReady }) => {
  const [processingVideos, setProcessingVideos] = useState<Map<string, ProcessingVideo>>(new Map());
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    // Connect to socket
    const newSocket = io(SOCKET_URL);

    newSocket.on('connect', () => {
      console.log('Connected to processing status socket');
    });

    // Listen for video processing progress
    newSocket.on('videoProcessingProgress', (data: {
      videoId: string;
      progress: number;
      message: string;
      timestamp: string;
    }) => {
      console.log('Processing progress:', data);
      setProcessingVideos(prev => {
        const updated = new Map(prev);
        const existing = updated.get(data.videoId) || {
          videoId: data.videoId,
          title: 'Video',
          status: 'processing' as const
        };
        
        // Extract quality information from message
        let displayMessage = data.message;
        if (data.message.includes('Processing')) {
          // Highlight quality being processed
          displayMessage = data.message.replace(/(\d+p)/g, '🎬 $1');
        }
        
        updated.set(data.videoId, {
          ...existing,
          progress: data.progress,
          message: displayMessage,
          timestamp: data.timestamp
        });
        
        return updated;
      });
    });

    // Listen for video processing completion
    newSocket.on('videoProcessingComplete', (data: {
      videoId: string;
      status: string;
      timestamp: string;
    }) => {
      console.log('Processing complete:', data);
      setProcessingVideos(prev => {
        const updated = new Map(prev);
        const existing = updated.get(data.videoId);
        
        if (existing) {
          updated.set(data.videoId, {
            ...existing,
            status: 'ready',
            progress: 100,
            message: 'Processing complete!',
            timestamp: data.timestamp
          });

          // Auto-remove after 5 seconds
          setTimeout(() => {
            setProcessingVideos(current => {
              const newMap = new Map(current);
              newMap.delete(data.videoId);
              return newMap;
            });
          }, 5000);

          // Notify parent component
          onVideoReady?.(data.videoId);
        }
        
        return updated;
      });
    });

    // Listen for video processing errors
    newSocket.on('videoProcessingError', (data: {
      videoId: string;
      error: string;
      timestamp: string;
    }) => {
      console.error('Processing error:', data);
      setProcessingVideos(prev => {
        const updated = new Map(prev);
        const existing = updated.get(data.videoId);
        
        if (existing) {
          updated.set(data.videoId, {
            ...existing,
            status: 'error',
            message: `Error: ${data.error}`,
            timestamp: data.timestamp
          });
        }
        
        return updated;
      });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from processing status socket');
    });

    return () => {
      newSocket.close();
    };
  }, [onVideoReady]);

  // Remove video from tracking
  const removeVideo = (videoId: string) => {
    setProcessingVideos(prev => {
      const updated = new Map(prev);
      updated.delete(videoId);
      return updated;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploading':
        return 'bg-blue-500';
      case 'processing':
        return 'bg-yellow-500';
      case 'ready':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading':
        return '⬆️';
      case 'processing':
        return '⚙️';
      case 'ready':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '⏳';
    }
  };

  const videosArray = Array.from(processingVideos.values());

  if (videosArray.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-w-full">
      <div className="bg-gray-900 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
        {/* Header */}
        <div 
          className="bg-gray-800 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-750"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center space-x-2">
            <div className="animate-pulse">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            </div>
            <h3 className="text-white font-semibold">
              Processing Videos ({videosArray.length})
            </h3>
          </div>
          <button className="text-gray-400 hover:text-white transition-colors">
            {isExpanded ? '▼' : '▲'}
          </button>
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="max-h-96 overflow-y-auto">
            {videosArray.map((video) => (
              <div 
                key={video.videoId} 
                className="px-4 py-3 border-b border-gray-800 hover:bg-gray-850 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <span className="text-2xl flex-shrink-0">
                      {getStatusIcon(video.status)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        {video.title}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {video.message}
                      </p>
                    </div>
                  </div>
                  {video.status !== 'ready' && (
                    <button
                      onClick={() => removeVideo(video.videoId)}
                      className="text-gray-500 hover:text-red-500 transition-colors ml-2 flex-shrink-0"
                      title="Remove from list"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Progress Bar */}
                {video.status === 'processing' && (
                  <div className="relative">
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full ${getStatusColor(video.status)} transition-all duration-300 ease-out`}
                        style={{ width: `${Math.max(0, Math.min(100, video.progress))}%` }}
                      >
                        <div className="h-full w-full bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-gray-400">
                        {video.message.includes('360p') && '📺 Generating 360p, 720p, 1080p'}
                        {video.message.includes('Getting') && '🔍 Analyzing video...'}
                        {video.message.includes('thumbnail') && '📸 Creating thumbnails...'}
                        {!video.message.includes('360p') && !video.message.includes('Getting') && !video.message.includes('thumbnail') && 'Processing...'}
                      </p>
                      <p className="text-xs text-gray-400 font-semibold">
                        {Math.round(video.progress)}%
                      </p>
                    </div>
                  </div>
                )}

                {/* Status Badge */}
                {video.status === 'ready' && (
                  <div className="mt-2 flex items-center space-x-2">
                    <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
                      Ready to watch
                    </span>
                    <button
                      onClick={() => removeVideo(video.videoId)}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {video.status === 'error' && (
                  <div className="mt-2">
                    <span className="text-xs bg-red-600 text-white px-2 py-1 rounded">
                      Processing failed
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Export helper function to add videos from other components
export const useVideoProcessingStatus = () => {
  const [statusComponent, setStatusComponent] = useState<{
    addVideo: (videoId: string, title: string) => void;
  } | null>(null);

  return {
    statusComponent,
    setStatusComponent
  };
};

export default VideoProcessingStatus;

