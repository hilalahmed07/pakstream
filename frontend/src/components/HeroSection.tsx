import React, { useState, useEffect, useRef } from 'react';
import { Video } from '../types/video';
import videoService from '../services/videoService';
import Hls from 'hls.js';

const HeroSection: React.FC = () => {
  const [latestVideo, setLatestVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  // View tracking refs
  const playStartTrackedRef = useRef(false);
  const watch30TrackedRef = useRef(false);
  const currentVideoIdRef = useRef<string | null>(null);

  useEffect(() => {
    fetchLatestVideo();
  }, []);

  useEffect(() => {
    if (latestVideo && videoRef.current) {
      // Reset view tracking when video changes
      if (currentVideoIdRef.current !== latestVideo._id) {
        playStartTrackedRef.current = false;
        watch30TrackedRef.current = false;
        currentVideoIdRef.current = latestVideo._id;
      }
      setupVideoPlayer();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      // Reset view tracking when component unmounts
      playStartTrackedRef.current = false;
      watch30TrackedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestVideo]);

  const fetchLatestVideo = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get the featured video first, fallback to latest if none available
      const response = await videoService.getFeaturedVideos(1);

      if (response.data.videos.length > 0) {
        const video = response.data.videos[0];
        setLatestVideo(video);
        console.log('Featured video loaded:', video.title);
      } else {
        setError('No videos available');
      }
    } catch (error) {
      console.error('Failed to fetch featured video:', error);
      setError('Failed to load featured video');
    } finally {
      setIsLoading(false);
    }
  };

  const setupVideoPlayer = () => {
    if (!latestVideo || !videoRef.current) return;

    const video = videoRef.current;
    const masterPlaylistUrl = videoService.getMasterPlaylistUrl(latestVideo);

    if (!masterPlaylistUrl) {
      setError('Video not ready for playback');
      return;
    }

    console.log('Setting up video player with URL:', masterPlaylistUrl);

    // Clean up existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hls.loadSource(masterPlaylistUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed, starting playback');
        // Set video properties
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        
        // Start playing
        video.play().then(() => {
          setIsPlaying(true);
          console.log('Video started playing');
          
          // Track "play start" view
          if (!playStartTrackedRef.current && latestVideo?._id) {
            playStartTrackedRef.current = true;
            videoService.trackVideoView(latestVideo._id, 'start').catch(err => {
              console.warn('Failed to track play start view:', err);
            });
          }
        }).catch((error) => {
          console.error('Failed to start video:', error);
        });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Fatal network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Fatal media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              console.log('Fatal error, cannot recover');
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = masterPlaylistUrl;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      
      video.addEventListener('loadedmetadata', () => {
        video.play().then(() => {
          setIsPlaying(true);
          
          // Track "play start" view
          if (!playStartTrackedRef.current && latestVideo?._id) {
            playStartTrackedRef.current = true;
            videoService.trackVideoView(latestVideo._id, 'start').catch(err => {
              console.warn('Failed to track play start view:', err);
            });
          }
        }).catch(console.error);
      });
    } else {
      setError('HLS not supported in this browser');
    }

    // Video event listeners
    video.addEventListener('play', () => {
      setIsPlaying(true);
      console.log('Video playing');
      
      // Track "play start" view
      if (!playStartTrackedRef.current && latestVideo?._id) {
        playStartTrackedRef.current = true;
        videoService.trackVideoView(latestVideo._id, 'start').catch(err => {
          console.warn('Failed to track play start view:', err);
        });
      }
    });
    video.addEventListener('pause', () => {
      setIsPlaying(false);
      console.log('Video paused');
    });
    video.addEventListener('ended', () => {
      setIsPlaying(false);
      console.log('Video ended');
    });
    video.addEventListener('timeupdate', () => {
      // Track "30 seconds watched" view
      if (video.currentTime >= 30 && !watch30TrackedRef.current && latestVideo?._id) {
        watch30TrackedRef.current = true;
        videoService.trackVideoView(latestVideo._id, 'watch30').catch(err => {
          console.warn('Failed to track 30s view:', err);
        });
      }
    });
    video.addEventListener('error', (e) => {
      console.error('Video error:', e);
      setError('Video playback error');
    });
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(console.error);
    }
  };


  if (isLoading) {
    return (
      <section className="relative h-screen bg-gradient-to-r from-primary via-secondary to-primary">
        <div className="absolute inset-0 bg-black bg-opacity-50"></div>
        <div className="relative z-10 flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
            <p className="text-xl text-text-primary">Loading featured video...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error || !latestVideo) {
    return (
      <section className="relative h-screen bg-gradient-to-r from-primary via-secondary to-primary">
        <div className="absolute inset-0 bg-black bg-opacity-50"></div>
        <div className="relative z-10 flex items-center justify-center h-full">
          <div className="text-center max-w-4xl mx-auto px-4">
            <h2 className="text-4xl md:text-6xl font-bold mb-6 text-text-primary">
              Welcome to PakStream
            </h2>
            <p className="text-xl md:text-2xl text-text-secondary mb-8">
              {error || 'No videos available yet'}
            </p>
            <button
              onClick={fetchLatestVideo}
              className="bg-accent hover:opacity-90 text-text-primary px-8 py-3 rounded-lg text-lg font-semibold transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section 
      className="relative h-screen bg-black overflow-hidden"
    >
      {/* Video Background */}
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          loop
          playsInline
          poster={videoService.getPosterUrl(latestVideo)}
        />
        <div className="absolute inset-0 bg-black bg-opacity-30"></div>
      </div>

      {/* Content Overlay 
      <div className="relative z-10 flex items-center justify-center h-full">
        <div className="text-center max-w-4xl mx-auto px-4">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-text-primary drop-shadow-lg">
            {latestVideo.title}
          </h1>
          <p className="text-xl md:text-2xl text-text-secondary mb-8 drop-shadow-lg">
            {latestVideo.description}
          </p>
          <div className="flex items-center justify-center space-x-4 text-text-secondary">
            <span className="bg-accent px-3 py-1 rounded text-sm font-semibold text-text-primary">
              {latestVideo.category.toUpperCase()}
            </span>
            <span>•</span>
            <span>{Math.floor(latestVideo.duration / 60)} min</span>
            <span>•</span>
            <span>{latestVideo.views} views</span>
          </div>
        </div>
      </div>*/}

      {/* Video Controls */}
      {/*showControls && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-6">
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={togglePlayPause}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-text-primary p-3 rounded-full transition-colors"
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>
            
            <button
              onClick={toggleMute}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-text-primary p-3 rounded-full transition-colors"
            >
              {isMuted ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              )}
            </button>

            <div className="text-text-primary text-sm">
              {latestVideo.title}
            </div>
          </div>
        </div>
      )*/}

      {/* Play/Pause Overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={togglePlayPause}
            className="bg-white bg-opacity-20 hover:bg-opacity-30 text-text-primary p-6 rounded-full transition-colors"
          >
            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        </div>
      )}
    </section>
  );
};

export default HeroSection;
