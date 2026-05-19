import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Premiere } from '../../types/premiere';
import { Video, VideoVariant } from '../../types/video';
import premiereService from '../../services/premiereService';
import socketService from '../../services/socketService';
import { useAuth } from '../../hooks';
import { useNotification } from '../../contexts/NotificationContext';
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

  const handleEndPremiere = () => {
    if (!premiere) return;
    setEndConfirmOpen(true);
  };

  const confirmEndPremiere = async () => {
    if (!premiere) return;
    try {
      // REST goes through authenticateToken middleware (always sees the
      // current admin) and broadcasts premiere-ended via io. No need for
      // the socket emit, which depends on socket.userRole — that can be
      // unset if the socket auto-reconnected anonymously.
      await premiereService.endPremiere(premiere._id);
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
                  loop={premiere.status === 'live'}
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

            {/* Admin control row — only the End Premiere action is exposed.
                Playback (play/pause/seek) runs server-driven; the admin
                doesn't drive the stream from this page. */}
            <div className="bg-netflix-gray rounded-lg p-4 flex items-center">
              {premiere.status === 'scheduled' ? (
                <div className="px-5 py-2 bg-blue-600/20 text-blue-200 font-semibold rounded-lg">
                  Auto-starts at scheduled time
                </div>
              ) : (
                <button
                  onClick={handleEndPremiere}
                  className="ml-auto px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg"
                >
                  ⏹ End Premiere
                </button>
              )}
            </div>
          </div>

          {/* Chat sidebar — admin sees viewer chat in real time. Viewer
              count is intentionally not passed so the sidebar header doesn't
              show "X viewers". The user-facing LivePremiere still shows it. */}
          <PremiereChat
            premiereId={premiere._id}
            currentUsername={user?.username}
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
