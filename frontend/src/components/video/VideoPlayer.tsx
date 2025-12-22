import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import Hls from 'hls.js';
import { Video } from '../../types/video';
import videoService from '../../services/videoService';
import downloadService from '../../services/downloadService';
import { useAuth } from '../../hooks';

interface VideoPlayerProps {
  video: Video;
  autoPlay?: boolean;
  controls?: boolean;
  className?: string;
  onClose?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
}

export interface VideoPlayerRef {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  isPlaying: () => boolean;
}

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(({ 
  video, 
  autoPlay = false, 
  controls = true,
  className = '',
  onClose,
  onPlay,
  onPause,
  onSeek
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [selectedQuality, setSelectedQuality] = useState<string>('auto');
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializingRef = useRef(false);
  const retryCountRef = useRef(0);
  const MAX_RETRY_ATTEMPTS = 3;
  
  // View tracking refs
  const playStartTrackedRef = useRef(false);
  const watch30TrackedRef = useRef(false);
  const currentVideoIdRef = useRef<string | null>(null);

  // Auth hook for checking if user is logged in
  const { user } = useAuth();

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    play: () => {
      if (videoRef.current && !isInitializingRef.current) {
        videoRef.current.play().catch(err => {
          console.warn('Play interrupted:', err);
        });
        setIsPlaying(true);
        onPlay?.();
      }
    },
    pause: () => {
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
        onPause?.();
      }
    },
    seek: (time: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        setCurrentTime(time);
        onSeek?.(time);
      }
    },
    getCurrentTime: () => currentTime,
    getDuration: () => duration,
    isPlaying: () => isPlaying
  }));

  useEffect(() => {
    if (!video || !video._id) return;

    // Reset view tracking when video changes
    if (currentVideoIdRef.current !== video._id) {
      playStartTrackedRef.current = false;
      watch30TrackedRef.current = false;
      currentVideoIdRef.current = video._id;
    }

    // Prevent re-initialization if already initialized for this video
    if (isInitializingRef.current) {
      console.log('Already initializing, skipping...');
      return;
    }

    const initializeVideo = async () => {
      try {
        isInitializingRef.current = true;
        setIsLoading(true);
        setError(null);

        if (!videoRef.current) return;

        const videoElement = videoRef.current;

        // Clean up previous HLS instance
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        // Reset video element
        videoElement.src = '';
        videoElement.load();

        // Get HLS URL
        const hlsUrl = videoService.getMasterPlaylistUrl(video);
        console.log('Loading video:', video._id, 'HLS URL:', hlsUrl);
        console.log('Video status:', video.status);
        console.log('Video processedFiles:', video.processedFiles);

        if (!hlsUrl) {
          let errorMessage = 'Video not ready for playback';
          
          if (video.status !== 'ready') {
            errorMessage = `Video is ${video.status}. Please wait for processing to complete.`;
          } else if (!video.processedFiles) {
            errorMessage = 'Video processing files are missing. Please contact support.';
          } else if (!video.processedFiles.hls) {
            errorMessage = 'Video HLS files are missing. Please contact support.';
          } else if (!video.processedFiles.hls.masterPlaylist) {
            errorMessage = 'Video master playlist is missing. Please contact support.';
          }
          
          console.error('Cannot load video:', errorMessage);
          setError(errorMessage);
          setIsLoading(false);
          isInitializingRef.current = false;
          return;
        }

        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 5
          });

          hlsRef.current = hls;

          hls.loadSource(hlsUrl);
          hls.attachMedia(videoElement);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('HLS manifest parsed successfully');
            setIsLoading(false);
            isInitializingRef.current = false;
            
            // Set up quality options
            const levels = hls.levels;
            const qualities = levels
              .filter(level => level.height && level.height > 0) // Filter out invalid heights
              .map((level, index) => ({
                index,
                height: level.height,
                bitrate: level.bitrate,
                label: `${level.height}p`
              }));
            
            console.log('Available qualities:', qualities);
            setAvailableQualities(['auto', ...qualities.map(q => q.label)]);
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS error:', data);
            
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.log('Fatal network error encountered, attempting recovery...');
                  if (retryCountRef.current < MAX_RETRY_ATTEMPTS) {
                    setIsRetrying(true);
                    retryCountRef.current += 1;
                    setRetryCount(retryCountRef.current);
                    setTimeout(() => {
                      console.log(`Retry attempt ${retryCountRef.current}/${MAX_RETRY_ATTEMPTS}`);
                      hls.startLoad();
                      setIsRetrying(false);
                    }, 1000 * Math.pow(2, retryCountRef.current - 1)); // Exponential backoff
                  } else {
                    setError(`Network Error: ${data.details}. Maximum retry attempts reached. Please check your connection.`);
                    setIsLoading(false);
                    isInitializingRef.current = false;
                  }
                  break;
                  
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.log('Fatal media error encountered, attempting recovery...');
                  if (retryCountRef.current < MAX_RETRY_ATTEMPTS) {
                    setIsRetrying(true);
                    retryCountRef.current += 1;
                    setRetryCount(retryCountRef.current);
                    setTimeout(() => {
                      console.log(`Media error recovery attempt ${retryCountRef.current}/${MAX_RETRY_ATTEMPTS}`);
                      hls.recoverMediaError();
                      setIsRetrying(false);
                    }, 500);
                  } else {
                    setError(`Media Error: ${data.details}. The video file may be corrupted or incompatible.`);
                    setIsLoading(false);
                    isInitializingRef.current = false;
                  }
                  break;
                  
                default:
                  setError(`HLS Error: ${data.type} - ${data.details}`);
                  setIsLoading(false);
                  isInitializingRef.current = false;
                  break;
              }
            } else {
              // Non-fatal errors - just log them
              console.warn('Non-fatal HLS error:', data.type, data.details);
            }
          });

          hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
            const level = hls.levels[data.level];
            if (level && level.height && level.height > 0 && hls.currentLevel !== -1) {
              // Only update if not in auto mode and height is valid
              const qualityLabel = `${level.height}p`;
              setSelectedQuality(qualityLabel);
              console.log('Quality switched to:', qualityLabel, 'from level:', level);
            } else if (hls.currentLevel === -1) {
              // Auto mode
              setSelectedQuality('auto');
              console.log('Quality set to auto mode');
            }
          });

        } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS support (Safari)
          videoElement.src = hlsUrl;
          setIsLoading(false);
          isInitializingRef.current = false;
        } else {
          setError('HLS is not supported in this browser');
          setIsLoading(false);
          isInitializingRef.current = false;
        }

        // Set up event listeners
        const handleLoadedMetadata = () => {
          setDuration(videoElement.duration);
          setIsLoading(false);
          isInitializingRef.current = false;
        };

        const handleTimeUpdate = () => {
          const newTime = videoElement.currentTime;
          setCurrentTime(newTime);
          
          // Track "30 seconds watched" view
          if (newTime >= 30 && !watch30TrackedRef.current && video._id) {
            watch30TrackedRef.current = true;
            videoService.trackVideoView(video._id, 'watch30').catch(err => {
              console.warn('Failed to track 30s view:', err);
            });
          }
        };

        const handlePlay = () => {
          setIsPlaying(true);
          onPlay?.();
          
          // Track "play start" view
          if (!playStartTrackedRef.current && video._id) {
            playStartTrackedRef.current = true;
            videoService.trackVideoView(video._id, 'start').catch(err => {
              console.warn('Failed to track play start view:', err);
            });
          }
        };

        const handlePause = () => {
          setIsPlaying(false);
          onPause?.();
        };

        const handleSeeked = () => {
          setCurrentTime(videoElement.currentTime);
          onSeek?.(videoElement.currentTime);
        };

        const handleError = (e: Event) => {
          console.error('Video error:', e);
          setError('Failed to load video');
          setIsLoading(false);
          isInitializingRef.current = false;
        };

        const handleAbort = (e: Event) => {
          console.warn('Video load aborted:', e);
          // Don't set error for abort, it's usually intentional
        };

        videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
        videoElement.addEventListener('timeupdate', handleTimeUpdate);
        videoElement.addEventListener('play', handlePlay);
        videoElement.addEventListener('pause', handlePause);
        videoElement.addEventListener('seeked', handleSeeked);
        videoElement.addEventListener('error', handleError);
        videoElement.addEventListener('abort', handleAbort);

        // Auto play if requested and not initializing
        if (autoPlay && !isInitializingRef.current) {
          videoElement.play().catch(err => {
            console.warn('Auto-play failed:', err);
          });
        }

        return () => {
          videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
          videoElement.removeEventListener('timeupdate', handleTimeUpdate);
          videoElement.removeEventListener('play', handlePlay);
          videoElement.removeEventListener('pause', handlePause);
          videoElement.removeEventListener('seeked', handleSeeked);
          videoElement.removeEventListener('error', handleError);
          videoElement.removeEventListener('abort', handleAbort);
        };

      } catch (error) {
        console.error('Video initialization error:', error);
        setError('Failed to initialize video player');
        setIsLoading(false);
        isInitializingRef.current = false;
      }
    };

    initializeVideo();

    // Cleanup on unmount
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      isInitializingRef.current = false;
      retryCountRef.current = 0;
      // Reset view tracking when component unmounts
      playStartTrackedRef.current = false;
      watch30TrackedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?._id]); // Only re-initialize when video ID changes

  // Handle quality change
  const handleQualityChange = (quality: string) => {
    if (!hlsRef.current) return;
    
    if (quality === 'auto') {
      // Enable automatic quality selection
      hlsRef.current.currentLevel = -1; // -1 enables auto quality
      setSelectedQuality('auto');
      console.log('Switched to auto quality');
    } else {
      // Find the actual level index by matching the quality label with level heights
      const targetHeight = parseInt(quality.replace('p', '')); // Extract height from "360p" -> 360
      const levelIndex = hlsRef.current.levels.findIndex(level => level.height === targetHeight);
      
      if (levelIndex >= 0 && levelIndex < hlsRef.current.levels.length) {
        hlsRef.current.currentLevel = levelIndex;
        setSelectedQuality(quality);
        console.log(`Switched to quality: ${quality} (level index: ${levelIndex})`);
      } else {
        console.warn(`Could not find level for quality: ${quality}`);
      }
    }
  };

  // Handle play/pause
  const handlePlayPause = () => {
    if (!videoRef.current || isInitializingRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(err => {
        console.warn('Play failed:', err);
      });
    }
  };

  // Handle seek from progress bar click
  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
    
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    onSeek?.(newTime);
  };

  // Handle volume change
  const handleVolumeChange = (newVolume: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  // Handle mute toggle
  const handleMuteToggle = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  // Handle fullscreen toggle
  const handleFullscreenToggle = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Handle download
  const handleDownload = async () => {
    if (!video || !video._id || video.status !== 'ready') {
      return;
    }

    try {
      setIsDownloading(true);
      await downloadService.downloadVideo(video._id);
      // Download completed successfully
    } catch (error) {
      console.error('Download failed:', error);
      // Note: VideoPlayer might not have access to useNotification, so we'll keep console.error
      // The error will be handled by the download service
    } finally {
      setIsDownloading(false);
    }
  };

  // Format time
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle controls visibility
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    // Hide controls after 3 seconds of inactivity (only when playing)
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  if (error) {
    return (
      <div className={`bg-black flex items-center justify-center ${className}`}>
        <div className="text-center text-white p-8 max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-bold mb-2">Video Error</h3>
          <p className="text-gray-300 mb-4">{error}</p>
          {retryCount > 0 && (
            <p className="text-sm text-gray-400 mb-4">
              Retry attempts: {retryCount}/{MAX_RETRY_ATTEMPTS}
            </p>
          )}
          <div className="flex justify-center space-x-2">
            <button
              onClick={() => {
                setError(null);
                setRetryCount(0);
                retryCountRef.current = 0;
                setIsRetrying(false);
                window.location.reload();
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
            >
              🔄 Reload Page
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
              >
                ✕ Close
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative bg-black ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        preload="metadata"
      />
      
      {(isLoading || isRetrying) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            {isRetrying ? (
              <>
                <p>Reconnecting...</p>
                <p className="text-sm text-gray-400 mt-2">
                  Attempt {retryCount}/{MAX_RETRY_ATTEMPTS}
                </p>
              </>
            ) : (
              <p>Loading video...</p>
            )}
          </div>
        </div>
      )}

      {controls && (
        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          {/* Progress bar */}
          <div className="px-4 pt-4 pb-2">
            <div 
              className="w-full bg-gray-700 rounded-full h-1.5 cursor-pointer hover:h-2 transition-all group relative"
              onClick={handleProgressBarClick}
              title="Click to seek"
            >
              <div 
                className="bg-red-600 h-full rounded-full transition-all duration-200 relative"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              >
                {/* Seek handle */}
                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"></div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between text-white px-4 pb-4">
            <div className="flex items-center space-x-3">
              <button 
                onClick={handlePlayPause} 
                className="hover:text-gray-300 hover:scale-110 transition-transform text-2xl"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? '⏸️' : '▶️'}
              </button>
              
              <span className="text-sm font-medium">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center space-x-3">
              {/* Volume control */}
              <div className="flex items-center space-x-2">
                <button 
                  onClick={handleMuteToggle} 
                  className="hover:text-gray-300 hover:scale-110 transition-transform text-xl"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? '🔇' : '🔊'}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-20 cursor-pointer"
                />
              </div>

              {/* Quality selector - always show if we have HLS */}
              {Hls.isSupported() && availableQualities.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                    className="hover:text-gray-300 hover:bg-gray-700 px-3 py-1.5 bg-gray-800 rounded text-sm font-medium transition-colors flex items-center gap-1"
                    title="Video quality settings"
                  >
                    <span className="text-base">⚙️</span>
                    <span>{selectedQuality === 'auto' ? 'Auto' : selectedQuality}</span>
                  </button>
                  {showQualityMenu && (
                    <div className="absolute bottom-12 right-0 bg-gray-900 bg-opacity-98 rounded-lg shadow-2xl p-2 min-w-[140px] border-2 border-gray-600 z-50">
                      <div className="text-xs text-gray-400 px-3 py-1 font-semibold uppercase">Quality</div>
                      {availableQualities.map(quality => (
                        <button
                          key={quality}
                          onClick={() => {
                            handleQualityChange(quality);
                            setShowQualityMenu(false);
                          }}
                          className={`block w-full text-left px-3 py-2 rounded transition-colors text-sm ${
                            quality === selectedQuality 
                              ? 'bg-red-600 text-white font-semibold' 
                              : 'text-gray-200 hover:bg-gray-700 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{quality === 'auto' ? 'Auto (recommended)' : quality}</span>
                            {quality === selectedQuality && <span className="text-green-400">✓</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Download button - only show if user is logged in and video is ready */}
              {user && video.status === 'ready' && (
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="hover:text-gray-300 hover:scale-110 transition-transform text-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isDownloading ? 'Downloading...' : 'Download video'}
                >
                  {isDownloading ? '⏳' : '⬇️'}
                </button>
              )}


              <button 
                onClick={handleFullscreenToggle} 
                className="hover:text-gray-300 hover:scale-110 transition-transform text-xl"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? '⤢' : '⤡'}
              </button>

              {onClose && (
                <button 
                  onClick={onClose} 
                  className="hover:text-gray-300 hover:scale-110 transition-transform text-2xl"
                  title="Close player"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
