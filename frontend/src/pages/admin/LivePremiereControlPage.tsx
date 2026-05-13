import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Premiere } from '../../types/premiere';
import { Video, VideoVariant } from '../../types/video';
import premiereService from '../../services/premiereService';
import socketService from '../../services/socketService';
import { useAuth } from '../../hooks';
import { useNotification } from '../../contexts/NotificationContext';
import { formatVideoDuration } from '../../utils/videoUtils';
import VideoPlayer, { VideoPlayerRef } from '../../components/video/VideoPlayer';
import PremiereChat from '../../components/premiere/PremiereChat';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';

interface AdminViewer {
  id: string;
  userId?: string;
  joinedAt: Date;
}

const LivePremiereControlPage: React.FC = () => {
  const { premiereId } = useParams<{ premiereId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const [premiere, setPremiere] = useState<Premiere | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [viewers, setViewers] = useState<AdminViewer[]>([]);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);

  const videoRef = useRef<VideoPlayerRef>(null);
  const hasJoinedRef = useRef(false);
  const isApplyingServerCommandRef = useRef(false);

  // Fetch the premiere record + initial counters.
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/admin');
      return;
    }

    if (!premiereId) {
      navigate('/admin/premieres');
      return;
    }

    const fetchPremiere = async () => {
      try {
        const response = await premiereService.getPremiereById(premiereId);
        setPremiere(response.data.premiere);
        setViewerCount(response.data.premiere.totalViewers || 0);
        if (response.data.premiere.status === 'live') {
          setIsPlaying(true);
        }
      } catch (error) {
        console.error('Failed to fetch premiere:', error);
        showError('Failed to load premiere');
        navigate('/admin/premieres');
      } finally {
        setLoading(false);
      }
    };

    fetchPremiere();
  }, [premiereId, user, navigate, showError]);

  // Join the room, subscribe to sync events, follow server commands on the
  // local preview so the admin sees the same frame viewers see.
  useEffect(() => {
    if (!premiere) return;
    if (hasJoinedRef.current) return;

    hasJoinedRef.current = true;
    socketService.joinPremiere(premiere._id);

    const handlePremiereJoined = (data: any) => {
      setViewerCount(data.viewerCount);
      setIsPlaying(!!data.isPlaying);
      if (typeof data.currentTime === 'number') {
        setCurrentTime(data.currentTime);
        if (videoRef.current && data.currentTime > 0 && isVideoReady) {
          isApplyingServerCommandRef.current = true;
          videoRef.current.seek(data.currentTime);
          setTimeout(() => {
            isApplyingServerCommandRef.current = false;
          }, 300);
        }
      }
    };

    const handleViewerJoined = (data: any) => {
      setViewerCount(data.viewerCount);
    };

    const handleViewerLeft = (data: any) => {
      setViewerCount(data.viewerCount);
    };

    const handleVideoPlay = () => {
      setIsPlaying(true);
      if (!videoRef.current) return;
      isApplyingServerCommandRef.current = true;
      const p = videoRef.current.play();
      const release = () => setTimeout(() => { isApplyingServerCommandRef.current = false; }, 300);
      if (p instanceof Promise) p.finally(release); else release();
    };

    const handleVideoPause = () => {
      setIsPlaying(false);
      if (!videoRef.current) return;
      isApplyingServerCommandRef.current = true;
      videoRef.current.pause();
      setTimeout(() => { isApplyingServerCommandRef.current = false; }, 300);
    };

    const handleVideoSeek = (data: { time: number }) => {
      setCurrentTime(data.time);
      if (!videoRef.current) return;
      isApplyingServerCommandRef.current = true;
      videoRef.current.seek(data.time);
      setTimeout(() => { isApplyingServerCommandRef.current = false; }, 300);
    };

    const handlePremiereEnded = () => {
      showSuccess('Premiere ended');
      navigate('/admin/premieres');
    };
    const handleStatusUpdated = (data: any) => {
      if (data?.premiereId === premiere._id && data?.action === 'ended') {
        showSuccess('Premiere ended');
        navigate('/admin/premieres');
      }
    };

    socketService.onPremiereJoined(handlePremiereJoined);
    socketService.onViewerJoined(handleViewerJoined);
    socketService.onViewerLeft(handleViewerLeft);
    socketService.onVideoPlay(handleVideoPlay);
    socketService.onVideoPause(handleVideoPause);
    socketService.onVideoSeek(handleVideoSeek);
    socketService.onPremiereEnded(handlePremiereEnded);
    socketService.on('premiere-status-updated', handleStatusUpdated);

    return () => {
      socketService.leavePremiere(premiere._id);
      hasJoinedRef.current = false;
      socketService.removeListener('premiere-joined', handlePremiereJoined);
      socketService.removeListener('viewer-joined', handleViewerJoined);
      socketService.removeListener('viewer-left', handleViewerLeft);
      socketService.removeListener('video-play', handleVideoPlay);
      socketService.removeListener('video-pause', handleVideoPause);
      socketService.removeListener('video-seek', handleVideoSeek);
      socketService.removeListener('premiere-ended', handlePremiereEnded);
      socketService.removeListener('premiere-status-updated', handleStatusUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premiere?._id]);

  // Sample the preview's current time every second for the admin readout.
  useEffect(() => {
    const id = setInterval(() => {
      if (videoRef.current) {
        const t = videoRef.current.getCurrentTime?.();
        if (typeof t === 'number' && !Number.isNaN(t)) {
          setCurrentTime(t);
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Validate video data.
  useEffect(() => {
    if (!premiere) return;
    if (!premiere.video) {
      setVideoError('Video data is missing from this premiere');
      return;
    }
    if (!premiere.video.processedFiles?.hls?.masterPlaylist) {
      setVideoError('Video has not been fully processed yet');
      return;
    }
    if (!premiere.video.processedFiles.hls.variants?.length) {
      setVideoError('No quality variants available for this video');
      return;
    }
    setVideoError(null);
    setIsVideoReady(true);
  }, [premiere]);

  // Ack-based control handlers — on failure surface a toast so the admin
  // isn't left guessing. Backend emits targeted errors for FORBIDDEN /
  // NOT_FOUND / INVALID_STATE.
  const handlePlay = async () => {
    if (!premiere) return;
    const ack = await socketService.playVideoWithAck(premiere._id);
    if (!ack.ok) showError(ack.error?.message ?? 'Play failed');
  };

  const handlePause = async () => {
    if (!premiere) return;
    const ack = await socketService.pauseVideoWithAck(premiere._id);
    if (!ack.ok) showError(ack.error?.message ?? 'Pause failed');
  };

  const handleSeekBy = async (delta: number) => {
    if (!premiere) return;
    const current = videoRef.current?.getCurrentTime?.() ?? currentTime;
    const duration = premiere.video?.duration ?? 0;
    const target = Math.max(0, Math.min(duration, current + delta));
    const ack = await socketService.seekVideoWithAck(premiere._id, target);
    if (!ack.ok) showError(ack.error?.message ?? 'Seek failed');
  };

  const handleEndPremiere = () => {
    if (!premiere) return;
    setEndConfirmOpen(true);
  };

  const confirmEndPremiere = async () => {
    if (!premiere) return;
    try {
      await premiereService.endPremiere(premiere._id);
      socketService.endPremiere(premiere._id);
      setEndConfirmOpen(false);
      showSuccess('Premiere ended');
      navigate('/admin/premieres');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to end premiere');
    }
  };

  // Shape the premiere's video into the Video type VideoPlayer expects.
  const videoForPlayer: Video | null = premiere && !videoError ? {
    _id: premiere.video._id,
    title: premiere.video.title,
    description: premiere.video.description,
    duration: premiere.video.duration,
    resolution: premiere.video.resolution,
    fileSize: 0,
    uploadedBy: {
      _id: premiere.createdBy._id,
      username: premiere.createdBy.username,
      email: premiere.video.uploadedBy?.email || 'premiere@pakstream.com',
    },
    originalFile: {
      filename: premiere.video.originalFile?.filename || '',
      path: premiere.video.originalFile?.path || '',
      size: premiere.video.originalFile?.size || 0,
      mimetype: premiere.video.originalFile?.mimetype || 'video/mp4',
      duration: premiere.video.duration,
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
          segments: v.segments || [],
        })) as VideoVariant[],
      },
      thumbnails: premiere.video.processedFiles.thumbnails || [],
      poster: premiere.video.processedFiles.poster || '',
    },
  } : null;

  // Passive local player callbacks — admin's preview mirrors the broadcast,
  // not the other way around. Ignore user interactions on the preview.
  const noop = () => {};

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
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

  const duration = premiere.video?.duration ?? 0;

  return (
    <div className="min-h-screen bg-black">
      <div className="ml-64 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Premiere Control</h1>
            <p className="text-gray-400">
              {premiere.title}{' '}
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-700">
                {premiere.status === 'live' ? 'LIVE' : premiere.status.toUpperCase()}
              </span>
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/premieres')}
            className="text-gray-400 hover:text-white"
          >
            ← Back
          </button>
        </div>

        {/* Two-column layout: preview + controls on the left, chat + viewers on the right. */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-4">
            {/* Video Preview (muted; admin sees what viewers see) */}
            <div className="aspect-video rounded-lg overflow-hidden bg-gray-900 relative">
              {videoError ? (
                <div className="h-full flex items-center justify-center text-center p-6">
                  <div>
                    <div className="text-5xl mb-3">⚠️</div>
                    <p className="text-red-400 font-semibold">{videoError}</p>
                  </div>
                </div>
              ) : videoForPlayer ? (
                <VideoPlayer
                  video={videoForPlayer}
                  autoPlay={false}
                  controls={false}
                  showProgressBar={false}
                  className="h-full w-full"
                  onPlay={noop}
                  onPause={noop}
                  onSeek={noop}
                  ref={videoRef}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-white">Loading video...</div>
              )}
              <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/70 text-white text-xs font-semibold">
                Admin preview · muted
              </div>
            </div>

            {/* Transport row */}
            <div className="bg-netflix-gray rounded-lg p-4">
              <div className="flex items-center gap-3 mb-4">
                {premiere.status === 'scheduled' && (
                  <div className="px-5 py-2 bg-blue-600/20 text-blue-200 font-semibold rounded-lg">
                    Auto-starts at scheduled time
                  </div>
                )}
                {premiere.status === 'live' && (
                  <>
                    {isPlaying ? (
                      <button
                        onClick={handlePause}
                        className="px-5 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg"
                      >
                        ⏸ Pause
                      </button>
                    ) : (
                      <button
                        onClick={handlePlay}
                        className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg"
                      >
                        ▶ Play
                      </button>
                    )}
                    <button
                      onClick={() => handleSeekBy(-10)}
                      className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                      title="Skip back 10s"
                    >
                      ⏪ 10s
                    </button>
                    <button
                      onClick={() => handleSeekBy(10)}
                      className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                      title="Skip forward 10s"
                    >
                      10s ⏩
                    </button>
                    <button
                      onClick={handleEndPremiere}
                      className="ml-auto px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg"
                    >
                      ⏹ End Premiere
                    </button>
                  </>
                )}
              </div>

              {/* Progress + time readout */}
              <div className="flex items-center gap-3 text-sm text-gray-300">
                <span className="font-mono">{formatTime(currentTime)}</span>
                <div className="flex-1 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                  <div
                    className="h-full bg-netflix-red transition-all duration-300"
                    style={{ width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%` }}
                  />
                </div>
                <span className="font-mono">{formatTime(duration)}</span>
              </div>

              {/* Meta + sync indicator */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 text-sm">
                <div>
                  <div className="text-gray-400">Status</div>
                  <div className={premiere.status === 'live' ? 'text-green-400 font-semibold' : 'text-yellow-400 font-semibold'}>
                    {premiere.status === 'live' ? `🔴 LIVE · ${isPlaying ? 'Playing' : 'Paused'}` : '⏸ Scheduled'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Viewers</div>
                  <div className="text-white font-semibold">{viewerCount}</div>
                </div>
                <div>
                  <div className="text-gray-400">Duration</div>
                  <div className="text-white font-semibold">{formatVideoDuration(duration)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Started</div>
                  <div className="text-white font-semibold">
                    {premiere.status === 'live' ? new Date(premiere.startTime).toLocaleTimeString() : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chat sidebar — admin sees viewer chat in real time. */}
          <PremiereChat
            premiereId={premiere._id}
            currentUsername={user?.username}
            viewerCount={viewerCount}
            heading="Live Chat (admin)"
            className="h-[680px] rounded-lg overflow-hidden"
          />
        </div>
      </div>

      <ConfirmationDialog
        isOpen={endConfirmOpen}
        title="End Premiere"
        message="Are you sure you want to end this premiere? All viewers will be disconnected."
        confirmText="End Premiere"
        cancelText="Keep Live"
        type="danger"
        onConfirm={confirmEndPremiere}
        onCancel={() => setEndConfirmOpen(false)}
      />
    </div>
  );
};

export default LivePremiereControlPage;
