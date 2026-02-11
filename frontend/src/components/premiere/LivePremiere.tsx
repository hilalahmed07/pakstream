import React, { useState, useEffect, useRef } from 'react';
import { Premiere } from '../../types/premiere';
import { Video, VideoVariant } from '../../types/video';
import VideoPlayer, { VideoPlayerRef } from '../video/VideoPlayer';
import socketService from '../../services/socketService';
import { useAuth } from '../../hooks';
import { formatVideoDuration } from '../../utils/videoUtils';

interface LivePremiereProps {
  premiere: Premiere;
  onClose?: () => void;
}

interface ChatMessage {
  id: number;
  user: string;
  message: string;
  timestamp: Date;
}

const LivePremiere: React.FC<LivePremiereProps> = ({ premiere, onClose }) => {
  const { user } = useAuth();
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [viewerCount, setViewerCount] = useState(premiere.totalViewers);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const videoRef = useRef<VideoPlayerRef>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const hasJoinedRef = useRef(false);
  const autoPlayAttemptedRef = useRef(false);

  // Flag to ignore local player callbacks while applying server commands
  const isApplyingServerCommandRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate joins
    if (hasJoinedRef.current) {
      console.log('Already joined premiere, skipping');
      return;
    }
    
    console.log('LivePremiere: Connecting to premiere room:', premiere._id);
    hasJoinedRef.current = true;
    
    // Join the premiere room
    socketService.joinPremiere(premiere._id);

    // Set up socket event listeners
    const handlePremiereJoined = (data: any) => {
      console.log('Premiere joined:', data);
      setViewerCount(data.viewerCount);
      setChatMessages(data.chat || []);
      
      // Resume from current playback time (TV broadcast behavior)
      // User joins/refreshes and gets the current live playback position
      // Only seek if premiere is live and we have a valid positive time
      if (data.currentTime && data.currentTime > 0 && videoRef.current && isVideoReady && premiere.status === 'live') {
        console.log('Seeking to current premiere time on join:', data.currentTime, 'status:', premiere.status);
        const targetTime = data.currentTime;

        // Drift-tolerant join seek: only correct if we're far enough off
        const applyJoinSync = () => {
          if (!videoRef.current) return;
          const current = videoRef.current.getCurrentTime();
          const drift = Math.abs(current - targetTime);
          const DRIFT_TOLERANCE_SECONDS = 1.5;

          if (drift > DRIFT_TOLERANCE_SECONDS) {
            console.log('Applying join sync seek. Current:', current, 'Target:', targetTime, 'Drift:', drift);
            isApplyingServerCommandRef.current = true;
            videoRef.current.seek(targetTime);
            // Release lock shortly after applying
            setTimeout(() => {
              isApplyingServerCommandRef.current = false;
            }, 300);
          } else {
            console.log('Skipping join sync seek, drift within tolerance:', drift);
          }
        };

        // Use a small delay to ensure HLS is loaded before we inspect time/seek
        const seekTimer = setTimeout(applyJoinSync, 500);
        return () => clearTimeout(seekTimer);
      }
    };

    const handleViewerJoined = (data: any) => {
      setViewerCount(data.viewerCount);
    };

    const handleViewerLeft = (data: any) => {
      setViewerCount(data.viewerCount);
    };

    const handlePremiereStarted = (data: any) => {
      console.log('Premiere started:', data);
      // Server is the authority; clients only follow commands via video-play event
    };

    const handlePremiereEnded = (data: any) => {
      console.log('Premiere ended:', data);
      if (onClose) onClose();
    };

    const handleVideoPlay = () => {
      if (!videoRef.current) return;
      console.log('Socket command: video-play');
      isApplyingServerCommandRef.current = true;
      const playResult = videoRef.current.play();
      if (playResult instanceof Promise) {
        playResult.finally(() => {
          setTimeout(() => {
            isApplyingServerCommandRef.current = false;
          }, 300);
        });
      } else {
        setTimeout(() => {
          isApplyingServerCommandRef.current = false;
        }, 300);
      }
    };

    const handleVideoPause = () => {
      if (!videoRef.current) return;
      console.log('Socket command: video-pause');
      isApplyingServerCommandRef.current = true;
      videoRef.current.pause();
      setTimeout(() => {
        isApplyingServerCommandRef.current = false;
      }, 300);
    };

    const handleVideoSeek = (data: { time: number }) => {
      if (!videoRef.current) return;
      const targetTime = data.time;
      const current = videoRef.current.getCurrentTime();
      const drift = Math.abs(current - targetTime);
      const DRIFT_TOLERANCE_SECONDS = 1.5;

      console.log('Socket command: video-seek', { targetTime, current, drift });

      if (drift <= DRIFT_TOLERANCE_SECONDS) {
        console.log('Skipping seek, drift within tolerance');
        return;
      }

      isApplyingServerCommandRef.current = true;
      videoRef.current.seek(targetTime);
      setTimeout(() => {
        isApplyingServerCommandRef.current = false;
      }, 300);
    };

    const handleNewMessage = (message: any) => {
      setChatMessages(prev => [...prev, message]);
      scrollToBottom();
    };

    const handleError = (error: any) => {
      console.error('Socket error:', error);
    };

    // Register all event listeners
    socketService.onPremiereJoined(handlePremiereJoined);
    socketService.onViewerJoined(handleViewerJoined);
    socketService.onViewerLeft(handleViewerLeft);
    socketService.onPremiereStarted(handlePremiereStarted);
    socketService.onPremiereEnded(handlePremiereEnded);
    socketService.onVideoPlay(handleVideoPlay);
    socketService.onVideoPause(handleVideoPause);
    socketService.onVideoSeek(handleVideoSeek);
    socketService.onNewMessage(handleNewMessage);
    socketService.onError(handleError);

    // Update time remaining
    const updateTimeRemaining = () => {
      const remaining = socketService.getTimeUntilEnd(premiere.endTime);
      setTimeRemaining(remaining);
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);

    return () => {
      console.log('LivePremiere: Cleaning up and leaving premiere room:', premiere._id);
      clearInterval(interval);
      
      if (hasJoinedRef.current) {
        socketService.leavePremiere(premiere._id);
        hasJoinedRef.current = false;
      }
      
      // Remove specific listeners
      socketService.removeListener('premiere-joined', handlePremiereJoined);
      socketService.removeListener('viewer-joined', handleViewerJoined);
      socketService.removeListener('viewer-left', handleViewerLeft);
      socketService.removeListener('premiere-started', handlePremiereStarted);
      socketService.removeListener('premiere-ended', handlePremiereEnded);
      socketService.removeListener('video-play', handleVideoPlay);
      socketService.removeListener('video-pause', handleVideoPause);
      socketService.removeListener('video-seek', handleVideoSeek);
      socketService.removeListener('new-message', handleNewMessage);
      socketService.removeListener('error', handleError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  const formatTimeRemaining = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      // Pass username from user object if available
      const username = user?.username || undefined;
      socketService.sendMessage(premiere._id, newMessage.trim(), username);
      setNewMessage('');
    }
  };

  // Local player callbacks: viewers never emit socket controls; they only follow server.
  // We still accept callbacks for UI/logging if needed, but we ignore them for syncing.
  const handleVideoPlay = () => {
    if (isApplyingServerCommandRef.current) {
      // This play came from a server command; ignore.
      return;
    }
    // Viewers do not emit play-video; admin page is the only control surface.
  };

  const handleVideoPause = () => {
    if (isApplyingServerCommandRef.current) {
      return;
    }
    // Viewers do not emit pause-video.
  };

  const handleVideoSeek = (time: number) => {
    if (isApplyingServerCommandRef.current) {
      return;
    }
    // Viewers do not emit seek-video; they are passive followers.
  };

  // Validate premiere video data before rendering player (run only once on mount)
  useEffect(() => {
    if (!premiere.video) {
      setVideoError('Video data is missing from this premiere');
      return;
    }
    
    if (!premiere.video.processedFiles) {
      setVideoError('Video has not been processed yet');
      return;
    }
    
    if (!premiere.video.processedFiles.hls) {
      setVideoError('Video streaming files are not available');
      return;
    }
    
    if (!premiere.video.processedFiles.hls.masterPlaylist) {
      setVideoError('Video master playlist is missing');
      return;
    }
    
    if (!premiere.video.processedFiles.hls.variants || premiere.video.processedFiles.hls.variants.length === 0) {
      setVideoError('No video quality variants available');
      return;
    }
    
    // Clear error if all validations pass
    setVideoError(null);
    setIsVideoReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Auto-play video when ready: try muted first (browsers often allow it), then unmute; show "Click to play" if blocked
  useEffect(() => {
    if (isVideoReady && videoRef.current && !autoPlayAttemptedRef.current && premiere.status === 'live') {
      autoPlayAttemptedRef.current = true;

      const autoPlayTimer = setTimeout(async () => {
        try {
          console.log('Auto-playing premiere video (trying muted first)...');
          videoRef.current?.setMuted(true);
          const playPromise = videoRef.current?.play() as Promise<void> | undefined;

          if (playPromise instanceof Promise) {
            await playPromise
              .then(async () => {
                console.log('✅ Muted autoplay succeeded, unmuting...');
                videoRef.current?.setMuted(false);
                const unmutePlay: unknown = videoRef.current?.play();
                if (unmutePlay instanceof Promise) {
                  await unmutePlay.then(() => {
                    console.log('✅ Premiere video started with sound');
                    socketService.playVideo(premiere._id);
                  }).catch(() => {
                    setAutoplayBlocked(true);
                  });
                } else {
                  socketService.playVideo(premiere._id);
                }
              })
              .catch(() => {
                setAutoplayBlocked(true);
              });
          } else {
            socketService.playVideo(premiere._id);
          }
        } catch (error) {
          console.error('Error during autoplay:', error);
          setAutoplayBlocked(true);
        }
      }, 1500);

      return () => clearTimeout(autoPlayTimer);
    }
  }, [isVideoReady, premiere._id, premiere.status]);

  // Convert premiere video to Video type for VideoPlayer
  // Only create this if validation passed
  const videoForPlayer: Video | null = videoError ? null : {
    _id: premiere.video._id,
    title: premiere.video.title,
    description: premiere.video.description,
    duration: premiere.video.duration,
    resolution: premiere.video.resolution,
    fileSize: 0,
    uploadedBy: {
      _id: premiere.createdBy._id,
      username: premiere.createdBy.username,
      email: premiere.video.uploadedBy?.email || 'premiere@pakstream.com'
    },
    originalFile: {
      filename: premiere.video.originalFile?.filename || '',
      path: premiere.video.originalFile?.path || '',
      size: premiere.video.originalFile?.size || 0,
      mimetype: premiere.video.originalFile?.mimetype || 'video/mp4',
      duration: premiere.video.duration
    },
    status: (premiere.video.status as 'ready' | 'processing' | 'uploading' | 'failed' | 'error') || 'ready',
    processingProgress: 100,
    views: 0,
    likes: 0,
    dislikes: 0,
    tags: [],
    category: 'movie',
    isPublic: true,
    isFeatured: false,
    createdAt: premiere.createdAt,
    updatedAt: premiere.updatedAt,
    processedFiles: {
      hls: {
        masterPlaylist: premiere.video.processedFiles.hls.masterPlaylist,
        segments: premiere.video.processedFiles.hls.segments || [],
        variants: premiere.video.processedFiles.hls.variants.map(v => ({
          resolution: v.resolution,
          bitrate: v.bitrate,
          playlist: v.playlist,
          segments: v.segments || []
        })) as VideoVariant[]
      },
      thumbnails: premiere.video.processedFiles.thumbnails || [],
      poster: premiere.video.processedFiles.poster || ''
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex">
      {/* Main Video Area */}
      <div className="flex-1 flex flex-col">
        {/* Premiere Header */}
        <div className="bg-gradient-to-b from-black to-transparent p-6 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                <span className="text-red-600 font-bold text-sm">LIVE</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{premiere.title}</h1>
                <p className="text-gray-300">{premiere.description}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              {/* Viewer Count */}
              <div className="text-center">
                <div className="text-white font-bold text-lg">{viewerCount}</div>
                <div className="text-gray-400 text-sm">Viewers</div>
              </div>
              
              {/* Time Remaining */}
              <div className="text-center">
                <div className="text-white font-bold text-lg">
                  {formatTimeRemaining(timeRemaining)}
                </div>
                <div className="text-gray-400 text-sm">Remaining</div>
              </div>
              
              {/* Close Button */}
              {onClose && (
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-white text-2xl p-2"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Video Player or Error Message */}
        <div className="flex-1 pt-4 relative">
          {videoError ? (
            <div className="h-full flex items-center justify-center bg-gray-900">
              <div className="text-center p-8">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-2xl font-bold text-red-500 mb-4">Video Playback Error</h3>
                <p className="text-white text-lg mb-2">{videoError}</p>
                <p className="text-gray-400 text-sm">
                  Please contact the premiere administrator or try refreshing the page.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-6 px-6 py-3 bg-netflix-red hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          ) : videoForPlayer ? (
            <>
              <VideoPlayer
                video={videoForPlayer}
                autoPlay={true}
                controls={true}
                showProgressBar={false} // Hide progress bar for TV-like broadcast experience
                className="h-full"
                onPlay={handleVideoPlay}
                onPause={handleVideoPause}
                onSeek={handleVideoSeek}
                ref={videoRef}
              />
              {/* Play button overlay for when video is loading or autoplay is blocked */}
              {(!isVideoReady || autoplayBlocked) && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-center">
                    <button
                      onClick={() => {
                        videoRef.current?.setMuted(false);
                        videoRef.current?.play();
                        setAutoplayBlocked(false);
                      }}
                      className="bg-netflix-red hover:bg-red-700 text-white rounded-full p-4 mb-4 transition-colors"
                    >
                      <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                    </button>
                    <p className="text-white text-lg">{autoplayBlocked ? 'Click to play (sound on)' : 'Click to play'}</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-900">
              <div className="text-white text-xl">Loading video...</div>
            </div>
          )}
        </div>

        {/* Premiere Info Overlay */}
        <div className="bg-gradient-to-t from-black to-transparent p-6">
          <div className="flex items-center justify-between">
            <div className="text-white">
              <p className="text-sm text-gray-300">
                Created by {premiere.createdBy.username}
              </p>
              <p className="text-xs text-gray-400">
                Started {new Date(premiere.startTime).toLocaleString()}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-center">
                <div className="text-white font-bold">{premiere.video?.resolution}</div>
                <div className="text-gray-400 text-xs">Quality</div>
              </div>
              <div className="text-center">
                <div className="text-white font-bold">
                  {formatVideoDuration(premiere.video?.duration || 0)}
                </div>
                <div className="text-gray-400 text-xs">Duration</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Sidebar */}
      <div className="w-80 bg-gray-900 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-white font-semibold">Live Chat</h3>
          <p className="text-gray-400 text-sm">{viewerCount} viewers</p>
        </div>
        
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-2"
        >
          {chatMessages.map((message) => (
            <div key={message.id} className="text-sm">
              <span className="text-blue-400 font-medium">{message.user}:</span>
              <span className="text-white ml-2">{message.message}</span>
              <div className="text-gray-500 text-xs">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
        
        <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700">
          <div className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LivePremiere;
