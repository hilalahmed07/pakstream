import React, { useState } from 'react';
import { Video } from '../../types/video';
import videoService from '../../services/videoService';
import downloadService from '../../services/downloadService';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../hooks';
import { formatVideoDuration } from '../../utils/videoUtils';

interface VideoGridProps {
  videos: Video[];
  loading: boolean;
  onVideoClick: (video: Video) => void;
  onDeleteClick?: (video: Video) => void;
  showDeleteButton?: boolean;
  onLikesCountClick?: (video: Video) => void;
}

const VideoGrid: React.FC<VideoGridProps> = ({ 
  videos, 
  loading, 
  onVideoClick, 
  onDeleteClick,
  showDeleteButton = false,
  onLikesCountClick
}) => {
  const { user } = useAuth();
  const { showError } = useNotification();
  const [downloadingVideoId, setDownloadingVideoId] = useState<string | null>(null);
  const [localVideos, setLocalVideos] = useState<Map<string, { views: number; likes: number; isLiked: boolean }>>(new Map());

  // Initialize local state from videos when they change
  React.useEffect(() => {
    const newMap = new Map<string, { views: number; likes: number; isLiked: boolean }>();
    videos.forEach(video => {
      newMap.set(video._id, {
        views: video.views,
        likes: video.likes,
        isLiked: video.isLiked ?? false
      });
    });
    setLocalVideos(newMap);
  }, [videos]);

  const getLocalData = (id: string, defaultViews: number, defaultLikes: number, defaultIsLiked: boolean) => {
    const local = localVideos.get(id);
    return {
      views: local?.views ?? defaultViews,
      likes: local?.likes ?? defaultLikes,
      isLiked: local?.isLiked ?? defaultIsLiked
    };
  };

  const handleDownload = async (e: React.MouseEvent, video: Video) => {
    e.stopPropagation();
    
    if (!video || !video._id || video.status !== 'ready') {
      return;
    }

    try {
      setDownloadingVideoId(video._id);
      await downloadService.downloadVideo(video._id);
    } catch (error) {
      console.error('Download failed:', error);
      showError(error instanceof Error ? error.message : 'Failed to download video');
    } finally {
      setDownloadingVideoId(null);
    }
  };

  const handleLikeClick = async (e: React.MouseEvent, video: Video) => {
    e.stopPropagation();

    if (!user) {
      showError('Please login to like videos');
      return;
    }

    const local = getLocalData(video._id, video.views, video.likes, video.isLiked ?? false);
    const action = local.isLiked ? 'unlike' : 'like';

    try {
      const result = await videoService.toggleLike(video._id, action);
      setLocalVideos(prev => {
        const newMap = new Map(prev);
        newMap.set(video._id, {
          ...local,
          likes: result.likes,
          isLiked: result.isLiked
        });
        return newMap;
      });
    } catch (error) {
      console.error('Failed to toggle like:', error);
      showError(error instanceof Error ? error.message : 'Failed to toggle like');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'text-green-400';
      case 'processing':
        return 'text-yellow-400';
      case 'uploading':
        return 'text-blue-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, index) => (
          <div key={index} className="bg-card rounded-lg overflow-hidden animate-pulse">
            <div className="aspect-video bg-secondary"></div>
            <div className="p-4">
              <div className="h-4 bg-secondary rounded mb-2"></div>
              <div className="h-3 bg-secondary rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-text-secondary text-lg mb-4">No videos found</div>
        <p className="text-text-secondary opacity-70">Try adjusting your filters or upload a new video</p>
      </div>
    );
  }

  return (
  <>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {videos.map((video) => {
        const local = getLocalData(video._id, video.views, video.likes, video.isLiked ?? false);
        return (
        <div key={video._id} className="bg-card rounded-lg overflow-hidden group hover:scale-105 hover:bg-card-hover transition-all">
          <div className="relative aspect-video bg-black">
            {video.processedFiles?.poster ? (
              <img
                src={videoService.getPosterUrl(video)}
                alt={video.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-text-secondary text-center">
                  <div className="text-4xl mb-2">🎬</div>
                  <div className="text-sm">No thumbnail</div>
                </div>
              </div>
            )}
            
            {/* Status Badge */}
            <div className="absolute top-2 left-2">
              <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(video.status)} bg-black bg-opacity-75`}>
                {video.status.toUpperCase()}
              </span>
            </div>

            {/* Duration Badge */}
            <div className="absolute top-2 right-2">
            <span className="px-2 py-1 rounded text-xs font-semibold text-white bg-black/80">                {formatVideoDuration(video.duration)}
              </span>
            </div>

            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-30">
              <button
                onClick={() => onVideoClick(video)}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-text-primary p-3 rounded-full transition-colors"
                title="Play video"
              >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
              
              {/* Download Button - only show if user is logged in and video is ready */}
              {user && video.status === 'ready' && (
                <button
                  onClick={(e) => handleDownload(e, video)}
                  disabled={downloadingVideoId === video._id}
                  className="bg-white bg-opacity-20 hover:bg-opacity-30 text-text-primary p-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={downloadingVideoId === video._id ? 'Downloading...' : 'Download video'}
                >
                  {downloadingVideoId === video._id ? (
                    <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                    </svg>
                  )}
                </button>
              )}
            </div>

            {/* Delete Button (Admin only) */}
            {showDeleteButton && onDeleteClick && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteClick(video);
                  }}
                  className="bg-accent hover:opacity-90 text-accent-text p-2 rounded-full transition-colors"
                  title="Delete video"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
            )}
          </div>

          <div className="p-4">
            <h3 className="text-text-primary font-semibold mb-2 line-clamp-2">{video.title}</h3>
            <p className="text-text-secondary text-sm mb-3 line-clamp-2">{video.description}</p>
            
            <div className="flex items-center justify-between text-sm text-text-secondary">
              <span className="capitalize">{video.category}</span>
              <div className="flex items-center space-x-3">
                <span>{local.views} views</span>

                {/* Like button */}
                <button
                  onClick={(e) => handleLikeClick(e, video)}
                  className={`flex items-center transition-colors ${
                    local.isLiked ? 'text-red-500' : 'text-text-secondary hover:text-red-500'
                  }`}
                  title={
                    !user
                      ? 'Login to like this video'
                      : local.isLiked
                      ? 'Unlike'
                      : 'Like'
                  }
                >
                  <svg
                    className={`w-4 h-4 ${local.isLiked ? 'fill-current' : ''}`}
                    fill={local.isLiked ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </button>

                {onLikesCountClick ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onLikesCountClick(video);
                    }}
                    disabled={local.likes === 0}
                    className={`text-sm transition-colors ${local.likes === 0 ? 'cursor-default opacity-70' : 'cursor-pointer hover:underline'} ${local.isLiked ? 'text-red-500' : 'text-text-secondary hover:text-red-400'}`}
                    title="View who liked this video"
                  >
                    {local.likes}
                  </button>
                ) : (
                  <span className="text-sm">
                    {local.likes}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-2 text-xs text-text-secondary opacity-70">
              <div>Size: {formatFileSize(video.fileSize)}</div>
              <div>Resolution: {video.resolution}</div>
              <div>Uploaded by: {video.uploadedBy.username}</div>
            </div>

            {video.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {video.tags.slice(0, 3).map((tag, index) => (
                  <span key={index} className="px-2 py-1 bg-secondary text-text-secondary text-xs rounded">
                    {tag}
                  </span>
                ))}
                {video.tags.length > 3 && (
                  <span className="px-2 py-1 bg-secondary text-text-secondary text-xs rounded">
                    +{video.tags.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      );})}
    </div>
  </>
  );
};

export default VideoGrid;
