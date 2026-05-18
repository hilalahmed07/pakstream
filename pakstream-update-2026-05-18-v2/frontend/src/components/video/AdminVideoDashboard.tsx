import React, { useState, useEffect, useRef } from 'react';
import { Video } from '../../types/video';
import videoService from '../../services/videoService';
import uploadManager, { UploadProgress } from '../../services/uploadManager';
import { useNotification } from '../../contexts/NotificationContext';
import VideoGrid from './VideoGrid';
import VideoUploadModal from './VideoUploadModal';
import VideoVerificationModal from './VideoVerificationModal';
import VerificationTabLayout from '../common/VerificationTabLayout';
import Pagination from '../common/Pagination';
import LikesModal from '../common/LikesModal';
import ConfirmationDialog from '../common/ConfirmationDialog';
import ProtectedRoute from '../ProtectedRoute';
import {
  validateVideoUpload,
  MAX_ASSET_TITLE_LENGTH,
  MAX_ASSET_DESCRIPTION_LENGTH,
  MAX_TAGS,
  MAX_TAG_LENGTH,
  MIN_TAG_LENGTH,
  SINGLE_TAG_REGEX,
  TAGS_MESSAGE,
  sanitizeAssetText,
} from '../../utils/assetValidation';

const requiredLabelClass = 'ml-1';

const AdminVideoDashboard: React.FC = () => {
  const { showError, showSuccess } = useNotification();
  const [activeTab, setActiveTab] = useState<'videos' | 'verification'>('videos');
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(() => uploadManager.isUploadInProgress());
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [uploadedSize, setUploadedSize] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'uploading' | 'processing' | 'completed' | 'error' | 'cancelled'>('uploading');
  const [processingMessage, setProcessingMessage] = useState<string>('');
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<Video | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState({
    status: '',
    category: '',
    search: ''
  });
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [videoToVerify, setVideoToVerify] = useState<Video | null>(null);
  const [verificationSearch, setVerificationSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [likesModalOpen, setLikesModalOpen] = useState(false);
  const [likesModalData, setLikesModalData] = useState<{ title: string; totalLikes: number; likedBy: Array<{ _id: string; username: string; email: string; profile?: { firstName?: string; lastName?: string; avatar?: string } }> }>({ title: '', totalLikes: 0, likedBy: [] });
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [videoToEdit, setVideoToEdit] = useState<Video | null>(null);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const response = await videoService.getAdminVideos({
        ...filter,
        page: currentPage,
        // limit: 10 for testing
        limit: 4
      });
      setVideos(response.data.videos);
      setPagination(response.data.pagination || { current: 1, pages: 1, total: 0 });
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  useEffect(() => {
    fetchVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, currentPage]);

  // If a video is still processing (e.g. the user refreshed the page during
  // processing), re-attach the progress panel to it. resumeProcessing is
  // idempotent so this is safe to run on every videos change.
  useEffect(() => {
    const processingVideo = videos.find(v => v.status === 'processing');
    if (processingVideo) {
      uploadManager.resumeProcessing(processingVideo._id);
    }
  }, [videos]);

  // Setup UploadManager event listeners
  useEffect(() => {
    const offProgress = uploadManager.on('progress', (progress: UploadProgress) => {
      setUploadProgress(progress.progress);
      setUploadSpeed(progress.speed);
      setTimeRemaining(progress.timeRemaining);
      setUploadedSize(progress.uploadedBytes);
      setUploadStatus(progress.status);
      setProcessingMessage(progress.message || '');
      setUploading(progress.status === 'uploading' || progress.status === 'processing');

      if (progress.status === 'completed' || progress.status === 'error' || progress.status === 'cancelled') {
        fetchVideos();
      }
    });

    const offComplete = uploadManager.on('complete', (videoId: string) => {
      handleUploadComplete(videoId);
    });

    const offError = uploadManager.on('error', (error: string) => {
      showError(error);
      setUploading(false);
    });

    const offCancel = uploadManager.on('cancel', () => {
      setUploading(false);
    });

    return () => {
      offProgress();
      offComplete();
      offError();
      offCancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showError]);

  const handleUploadStart = () => {
    setUploading(true);
    setUploadProgress(0);
    setShowUploadModal(false);
  };

  const handleUploadProgress = () => {
    // Progress is handled by UploadManager events
  };

  const handleUploadComplete = (videoId: string) => {
    // Processing is handled by UploadManager
    console.log('Upload completed for video:', videoId);
  };

  const handleVideoClick = (video: Video) => {
    setSelectedVideo(video);
  };

  const handleCloseVideo = () => {
    setSelectedVideo(null);
  };

  const handleDeleteClick = (video: Video) => {
    setVideoToDelete(video);
    setShowDeleteModal(true);
  };

  const handleEditClick = (video: Video) => {
    setVideoToEdit(video);
    setShowEditModal(true);
  };

  const handleEditSave = async (videoId: string, payload: { title: string; description: string; category: Video['category']; tags: string[] }) => {
    try {
      console.log('[handleEditSave] Updating video with payload:', { videoId, payload });
      await videoService.updateVideo(videoId, payload);
      console.log('[handleEditSave] Video updated successfully');
      setShowEditModal(false);
      setVideoToEdit(null);
      await fetchVideos();
    } catch (error) {
      console.error('[handleEditSave] Failed to update video:', error);
      console.error('[handleEditSave] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'N/A',
      });
      throw error;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!videoToDelete) return;

    try {
      setDeleting(true);
      await videoService.deleteVideo(videoToDelete._id);
      setShowDeleteModal(false);
      setVideoToDelete(null);
      showSuccess('Video deleted successfully.');
      console.log('Video deleted successfully by administrator');
      // If we just removed the only row on a non-first page, step back one
      // page — otherwise the user is stranded on an empty page. Changing
      // currentPage triggers the fetch effect; only re-fetch directly when
      // we're staying on the same page.
      if (videos.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else {
        fetchVideos();
      }
    } catch (error) {
      console.error('Failed to delete video:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleUploadSuccess = () => {
    fetchVideos();
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setVideoToDelete(null);
  };

  const handleLikesCountClick = async (video: Video) => {
    setLoadingLikes(true);
    try {
      const result = await videoService.getLikedByUsers(video._id);
      setLikesModalData({
        title: video.title,
        totalLikes: result.totalLikes,
        likedBy: result.likedBy
      });
      setLikesModalOpen(true);
    } catch (error) {
      console.error('Failed to get liked by users:', error);
      showError(error instanceof Error ? error.message : 'Failed to load likes');
      setLikesModalOpen(false);
    } finally {
      setLoadingLikes(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilter(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const getStats = () => {
    const total = pagination.total || videos.length;
    const ready = videos.filter(v => v.status === 'ready').length;
    const processing = videos.filter(v => v.status === 'processing').length;
    const error = videos.filter(v => v.status === 'error').length;
    const totalViews = videos.reduce((sum, v) => sum + v.views, 0);

    return { total, ready, processing, error, totalViews };
  };

  const stats = getStats();

  const handleVerifyClick = (video: Video) => {
    setVideoToVerify(video);
    setShowVerificationModal(true);
  };

  const handleCloseVerification = () => {
    setShowVerificationModal(false);
    setVideoToVerify(null);
  };

  const filteredVideosForVerification = videos.filter(video => {
    if (!verificationSearch.trim()) return true;
    const searchLower = verificationSearch.toLowerCase();
    return (
      video.title.toLowerCase().includes(searchLower) ||
      video.description.toLowerCase().includes(searchLower) ||
      video._id.toLowerCase().includes(searchLower)
    );
  });

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen pt-16" style={{ backgroundColor: 'var(--color-primary)' }}>
        <div className="container mx-auto px-4 py-8">
          {activeTab === 'videos' && (
            <div className="flex justify-end mb-6">
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 rounded-lg transition-colors hover:opacity-90"
                style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
              >
                Upload Video
              </button>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="mb-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab('videos')}
                className="px-6 py-3 font-medium text-sm transition-colors"
                style={{
                  color: activeTab === 'videos' ? 'var(--color-text)' : 'var(--color-text-secondary)',
                  borderBottom: activeTab === 'videos' ? '2px solid var(--color-accent)' : '2px solid transparent'
                }}
              >
                📹 Videos
              </button>
              <button
                onClick={() => setActiveTab('verification')}
                className="px-6 py-3 font-medium text-sm transition-colors"
                style={{
                  color: activeTab === 'verification' ? 'var(--color-text)' : 'var(--color-text-secondary)',
                  borderBottom: activeTab === 'verification' ? '2px solid var(--color-accent)' : '2px solid transparent'
                }}
              >
                ✓ Verification
              </button>
            </div>
          </div>

          {/* Videos Tab Content */}
          {activeTab === 'videos' && (
            <div className="space-y-6">
              
              {/* Show the floating panel only during the processing phase.
                  The upload phase is handled by the modal; we skip showing a
                  second panel for it to keep the UI clean. */}
              {uploadStatus === 'processing' && (
                <div className="fixed top-4 right-4 z-50 rounded-lg p-4 shadow-lg" style={{ backgroundColor: 'var(--color-secondary)', minWidth: '320px' }}>
                  <div className="flex items-center mb-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 mr-3" style={{ borderColor: 'var(--color-accent)' }}></div>
                    <span style={{ color: 'var(--color-text)' }}>Processing video...</span>
                    <span className="ml-2 font-semibold" style={{ color: 'var(--color-accent)' }}>{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full rounded-full h-2 overflow-hidden mb-3" style={{ backgroundColor: 'var(--color-hover)' }}>
                    <div
                      className="h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.max(0, Math.min(100, uploadProgress))}%`, backgroundColor: 'var(--color-accent)' }}
                    ></div>
                  </div>

                  <div className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                    <div>
                      <span className="font-medium">Stage:</span>
                      <span className="ml-1" style={{ color: 'var(--color-accent)' }}>
                        {processingMessage || 'Starting processing...'}
                      </span>
                    </div>
                    <div className="mt-1 opacity-75">
                      Encoding HLS variants. This can take a few minutes depending on video length.
                    </div>
                  </div>

                  <button
                    disabled
                    className="w-full px-3 py-2 rounded text-sm opacity-50 cursor-not-allowed"
                    style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
                  >
                    Processing — please wait
                  </button>
                </div>
              )}

              {/* Admin Notice
              <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: 'rgba(234, 179, 8, 0.2)', border: '1px solid rgb(202, 138, 4)' }}>
                <div className="flex items-center">
                  <div className="text-yellow-400 text-xl mr-3">⚠️</div>
                  <div>
                    <h3 className="text-yellow-400 font-semibold">Administrator Only</h3>
                    <p className="text-yellow-200 text-sm">
                      Only users with administrator role can delete videos. Regular users cannot delete any videos, including their own.
                    </p>
                  </div>
                </div>
              </div> */}

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-secondary)' }}>
                  <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{stats.total}</div>
                  <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Total Videos</div>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-secondary)' }}>
                  <div className="text-2xl font-bold text-green-400">{stats.ready}</div>
                  <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Ready</div>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-secondary)' }}>
                  <div className="text-2xl font-bold text-yellow-400">{stats.processing}</div>
                  <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Processing</div>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-secondary)' }}>
                  <div className="text-2xl font-bold text-red-400">{stats.error}</div>
                  <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Errors</div>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-secondary)' }}>
                  <div className="text-2xl font-bold text-blue-400">{stats.totalViews}</div>
                  <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Total Views</div>
                </div>
              </div>

              {/* Filters */}
              <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: 'var(--color-secondary)' }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Status
                    </label>
                    <select
                      value={filter.status}
                      onChange={(e) => handleFilterChange('status', e.target.value)}
                      className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: 'var(--color-hover)', 
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)'
                      }}
                    >
                      <option value="">All Status</option>
                      <option value="ready">Ready</option>
                      <option value="processing">Processing</option>
                      <option value="uploading">Uploading</option>
                      <option value="error">Error</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Category
                    </label>
                    <select
                      value={filter.category}
                      onChange={(e) => handleFilterChange('category', e.target.value)}
                      className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: 'var(--color-hover)', 
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)'
                      }}
                    >
                      <option value="">All Categories</option>
                      <option value="movie">Movie</option>
                      <option value="tv-show">TV Show</option>
                      <option value="documentary">Documentary</option>
                      <option value="short-film">Short Film</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Search
                    </label>
                    <input
                      type="text"
                      value={filter.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      placeholder="Search videos..."
                      className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: 'var(--color-hover)', 
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Video Grid */}
              <VideoGrid
                videos={videos}
                loading={loading}
                onVideoClick={handleVideoClick}
                onDeleteClick={handleDeleteClick}
                onEditClick={handleEditClick}
                showDeleteButton={true}
                showEditButton={true}
                onLikesCountClick={handleLikesCountClick}
                hidePlayButton={true}
              />
              <Pagination
                currentPage={pagination.current}
                totalPages={pagination.pages}
                total={pagination.total}
                // limit={10} for testing
                limit={4}
                onPageChange={setCurrentPage}
              />

              {/* Video Detail Modal */}
              {selectedVideo && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
                  <div className="rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-secondary)' }}>
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{selectedVideo.title}</h2>
                      <button
                        onClick={handleCloseVideo}
                        className="text-2xl transition-colors"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        ×
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Video Details</h3>
                        <div className="space-y-2 text-sm">
                          <div><span style={{ color: 'var(--color-text-secondary)' }}>Status:</span> <span style={{ color: 'var(--color-text)' }}>{selectedVideo.status}</span></div>
                          <div><span style={{ color: 'var(--color-text-secondary)' }}>Category:</span> <span style={{ color: 'var(--color-text)' }}>{selectedVideo.category}</span></div>
                          <div><span style={{ color: 'var(--color-text-secondary)' }}>Duration:</span> <span style={{ color: 'var(--color-text)' }}>{selectedVideo.duration}s</span></div>
                          <div><span style={{ color: 'var(--color-text-secondary)' }}>Resolution:</span> <span style={{ color: 'var(--color-text)' }}>{selectedVideo.resolution}</span></div>
                          <div><span style={{ color: 'var(--color-text-secondary)' }}>Views:</span> <span style={{ color: 'var(--color-text)' }}>{selectedVideo.views}</span></div>
                          <div><span style={{ color: 'var(--color-text-secondary)' }}>Uploaded by:</span> <span style={{ color: 'var(--color-text)' }}>{selectedVideo.uploadedBy.username}</span></div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Description</h3>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{selectedVideo.description}</p>
                        
                        {selectedVideo.tags.length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Tags</h4>
                            <div className="flex flex-wrap gap-2">
                              {selectedVideo.tags.map((tag, index) => (
                                <span key={index} className="px-2 py-1 text-xs rounded" style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Admin Actions */}
                    <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--color-border)' }}>
                      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Administrator Actions</h3>
                      {selectedVideo.status === 'ready' && selectedVideo.processingProgress === 100 && (
                        <div className="flex space-x-4">
                          <button
                            onClick={() => {
                              handleEditClick(selectedVideo);
                              handleCloseVideo();
                            }}
                            className="px-4 py-2 rounded-lg border text-blue-400 border-blue-400 hover:bg-blue-400/10 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              handleDeleteClick(selectedVideo);
                              handleCloseVideo();
                            }}
                            className="px-4 py-2 rounded-lg border text-red-400 border-red-400 hover:bg-red-400/10 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                      <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Only administrators can delete videos. Regular users cannot delete any videos.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Delete Confirmation Dialog */}
              <ConfirmationDialog
                isOpen={showDeleteModal && !!videoToDelete}
                title="Delete Video"
                message="Are you sure you want to delete this video? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                type="danger"
                onConfirm={handleDeleteConfirm}
                onCancel={handleDeleteCancel}
              />

              {/* Likes Modal */}
              <LikesModal
                isOpen={likesModalOpen}
                title={likesModalData.title}
                totalLikes={likesModalData.totalLikes}
                likedBy={likesModalData.likedBy}
                contentType="video"
                onClose={() => setLikesModalOpen(false)}
              />

              {/* Edit Video Modal */}
              {showEditModal && videoToEdit && (
                <VideoEditModal
                  video={videoToEdit}
                  onClose={() => {
                    setShowEditModal(false);
                    setVideoToEdit(null);
                  }}
                  onSave={handleEditSave}
                />
              )}

              {/* Upload Modal */}
              <VideoUploadModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                onUploadSuccess={handleUploadSuccess}
                onUploadStart={handleUploadStart}
                onUploadProgress={handleUploadProgress}
                onUploadComplete={handleUploadComplete}
                uploading={uploading}
              />
            </div>
          )}

          {/* Verification Tab Content */}
          {activeTab === 'verification' && (
            <VerificationTabLayout
              header={{
                icon: '🔒',
                title: 'Video Integrity Verification',
                description: 'Verify that downloaded video files match the original by comparing SHA-256 hashes.',
              }}
              search={{
                label: 'Search Videos for Verification',
                placeholder: 'Search by title, description, or video ID...',
                value: verificationSearch,
                onChange: setVerificationSearch,
              }}
              table={
                <table className="w-full">
                  <thead style={{ backgroundColor: 'var(--color-hover)' }}>
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: 'var(--color-text-secondary)' }}>Video</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: 'var(--color-text-secondary)' }}>Hash</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center opacity-60" style={{ color: 'var(--color-text-secondary)' }}>
                          Loading videos...
                        </td>
                      </tr>
                    ) : filteredVideosForVerification.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center opacity-60" style={{ color: 'var(--color-text-secondary)' }}>
                          No videos found
                        </td>
                      </tr>
                    ) : (
                      filteredVideosForVerification.map((video) => (
                        <tr key={video._id} className="hover:bg-black/5 transition-colors align-top">
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold line-clamp-1 max-w-md" style={{ color: 'var(--color-text)' }} title={video.title}>{video.title}</div>
                            <div className="text-xs line-clamp-2 max-w-md" style={{ color: 'var(--color-text-secondary)' }} title={video.description}>{video.description}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ring-1 ${
                              video.status === 'ready' ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40' :
                              video.status === 'processing' ? 'bg-amber-500/15 text-amber-300 ring-amber-500/40' :
                              'bg-rose-500/15 text-rose-300 ring-rose-500/40'
                            }`}>
                              {video.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {video.sha256Hash ? (
                              <div className="text-sm font-mono max-w-xs truncate" style={{ color: 'var(--color-text)' }} title={video.sha256Hash}>
                                {video.sha256Hash.substring(0, 16)}...
                              </div>
                            ) : (
                              <span className="text-sm opacity-70" style={{ color: 'var(--color-text-secondary)' }}>Not available</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {video.status === 'ready' && video.sha256Hash ? (
                              <button
                                onClick={() => handleVerifyClick(video)}
                                className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/40 hover:bg-blue-500/25 transition-all shadow-sm hover:shadow-md active:shadow-sm"
                              >
                                Verify
                              </button>
                            ) : (
                              <span className="text-sm opacity-70" style={{ color: 'var(--color-text-secondary)' }}>
                                {video.status !== 'ready' ? 'Not ready' : 'No hash'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              }
              stats={
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-border)' }}>
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{filteredVideosForVerification.length}</div>
                    <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Total Videos</div>
                  </div>
                  <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-border)' }}>
                    <div className="text-2xl font-bold text-green-400">
                      {filteredVideosForVerification.filter(v => v.sha256Hash).length}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>With Hash</div>
                  </div>
                  <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-border)' }}>
                    <div className="text-2xl font-bold text-blue-400">
                      {filteredVideosForVerification.filter(v => v.status === 'ready' && v.sha256Hash).length}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Ready to Verify</div>
                  </div>
                </div>
              }
            />
          )}

          {/* Verification Modal */}
          {videoToVerify && (
            <VideoVerificationModal
              isOpen={showVerificationModal}
              onClose={handleCloseVerification}
              video={videoToVerify}
            />
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

interface VideoEditModalProps {
  video: Video;
  onClose: () => void;
  onSave: (videoId: string, payload: { title: string; description: string; category: Video['category']; tags: string[] }) => Promise<void>;
}

type VideoEditFormData = {
  title: string;
  description: string;
  category: Video['category'];
  tags: string;
};

const VideoEditModal: React.FC<VideoEditModalProps> = ({ video, onClose, onSave }) => {
  const { showError, showSuccess } = useNotification();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<VideoEditFormData>({
    title: video.title,
    description: video.description,
    category: video.category,
    tags: video.tags.join(','),
  });
  const [tagInput, setTagInput] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);

  const tagsArr = formData.tags.split(',').map(t => t.trim()).filter(Boolean);

  const addTag = () => {
    const nextTag = tagInput.trim();
    if (!nextTag) return;
    if (tagsArr.length >= MAX_TAGS) {
      tagInputRef.current?.setCustomValidity(TAGS_MESSAGE);
      tagInputRef.current?.reportValidity();
      return;
    }
    if (
      nextTag.length < MIN_TAG_LENGTH ||
      nextTag.length > MAX_TAG_LENGTH ||
      !SINGLE_TAG_REGEX.test(nextTag)
    ) {
      tagInputRef.current?.setCustomValidity(TAGS_MESSAGE);
      tagInputRef.current?.reportValidity();
      return;
    }
    if (!tagsArr.includes(nextTag)) {
      setFormData(prev => ({ ...prev, tags: [...tagsArr, nextTag].join(',') }));
      tagInputRef.current?.setCustomValidity('');
      setTagInput('');
      setError(null);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: tagsArr.filter(t => t !== tagToRemove).join(','),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationMessage = validateVideoUpload({
      title: formData.title,
      description: formData.description,
      category: formData.category,
      tags: formData.tags,
    });

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    try {
      setSaving(true);
      const payload: { title: string; description: string; category: Video['category']; tags: string[] } = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        tags: formData.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      };
      await onSave(video._id, payload);
      showSuccess('Video updated successfully');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to update video';
      setError(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-secondary)' }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Edit Video</h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-2xl hover:opacity-75 disabled:opacity-50 transition-opacity"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            ×
          </button>
        </div>

        {error && (
          <div className="p-3 rounded mb-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgb(239, 68, 68)', color: 'var(--color-text)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Title<span className={requiredLabelClass}>*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: sanitizeAssetText(e.target.value) }))}
              maxLength={MAX_ASSET_TITLE_LENGTH}
              required
              disabled={saving}
              className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 disabled:opacity-50"
              style={{
                backgroundColor: 'var(--color-hover)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                '--tw-ring-color': 'var(--color-accent)',
              } as React.CSSProperties}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Description<span className={requiredLabelClass}>*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: sanitizeAssetText(e.target.value) }))}
              maxLength={MAX_ASSET_DESCRIPTION_LENGTH}
              required
              rows={4}
              disabled={saving}
              className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 disabled:opacity-50"
              style={{
                backgroundColor: 'var(--color-hover)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                '--tw-ring-color': 'var(--color-accent)',
              } as React.CSSProperties}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Category<span className={requiredLabelClass}>*</span>
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value as Video['category'] }))}
              disabled={saving}
              className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 disabled:opacity-50"
              style={{
                backgroundColor: 'var(--color-hover)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                '--tw-ring-color': 'var(--color-accent)',
              } as React.CSSProperties}
            >
              <option value="movie">Movie</option>
              <option value="tv-show">TV Show</option>
              <option value="documentary">Documentary</option>
              <option value="short-film">Short Film</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Tags
            </label>
            <div className="flex space-x-2 mb-2">
              <input
                ref={tagInputRef}
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, MAX_TAG_LENGTH))}
                maxLength={MAX_TAG_LENGTH}
                onInput={(e) => e.currentTarget.setCustomValidity('')}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder={`Add tag (${MIN_TAG_LENGTH}-${MAX_TAG_LENGTH} chars)`}
                className="flex-1 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--color-hover)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
                disabled={saving}
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
                disabled={saving || tagsArr.length >= MAX_TAGS}
              >
                Add
              </button>
            </div>
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              {tagsArr.length}/{MAX_TAGS} tags
            </p>
            <div className="flex flex-wrap gap-2">
              {tagsArr.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 text-sm rounded flex items-center space-x-1"
                  style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:opacity-70 disabled:opacity-50"
                    disabled={saving}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex space-x-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminVideoDashboard;
