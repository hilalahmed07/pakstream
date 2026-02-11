import React, { useState, useEffect } from 'react';
import { Video } from '../../types/video';
import videoService from '../../services/videoService';
import VideoGrid from './VideoGrid';
import VideoUploadModal from './VideoUploadModal';
import VideoVerificationModal from './VideoVerificationModal';
import Pagination from '../common/Pagination';
import ProtectedRoute from '../ProtectedRoute';

const AdminVideoDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'videos' | 'verification'>('videos');
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const response = await videoService.getAdminVideos({
        ...filter,
        page: currentPage,
        // limit: 10 for testing
        limit: 3
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

  const handleUploadStart = () => {
    setUploading(true);
    setUploadProgress(0);
    setShowUploadModal(false);
  };

  const handleUploadProgress = (progress: number) => {
    setUploadProgress(progress);
  };

  const handleUploadComplete = (videoId: string) => {
    let pollCount = 0;
    const maxPolls = 120;
    
    const pollInterval = setInterval(async () => {
      try {
        pollCount++;
        const updatedVideos = await videoService.getAdminVideos({
          ...filter,
          page: currentPage,
          // limit: 10 for testing
          limit: 3
        });
        const uploadedVideo = updatedVideos.data.videos.find(
          v => v._id === videoId
        );
        
        if (uploadedVideo) {
          setVideos(updatedVideos.data.videos);
          
          if (uploadedVideo.status === 'ready' || uploadedVideo.status === 'error' || uploadedVideo.status === 'failed') {
            clearInterval(pollInterval);
            setUploadProgress(100);
            setTimeout(() => {
              setUploading(false);
              setUploadProgress(0);
            }, 1000);
            return;
          }
          
          if (uploadedVideo.processingProgress !== undefined) {
            const processingProgressScaled = 90 + (uploadedVideo.processingProgress * 0.1);
            setUploadProgress(processingProgressScaled);
          } else {
            setUploadProgress(90);
          }
        }
        
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          setUploading(false);
          setUploadProgress(0);
          fetchVideos();
        }
      } catch (error) {
        console.error('Error polling video status:', error);
      }
    }, 5000);
    
    fetchVideos();
  };

  const handleUploadSuccess = () => {
    fetchVideos();
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

  const handleDeleteConfirm = async () => {
    if (!videoToDelete) return;

    try {
      setDeleting(true);
      await videoService.deleteVideo(videoToDelete._id);
      setVideos(prev => prev.filter(v => v._id !== videoToDelete._id));
      setShowDeleteModal(false);
      setVideoToDelete(null);
      console.log('Video deleted successfully by administrator');
    } catch (error) {
      console.error('Failed to delete video:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setVideoToDelete(null);
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
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
                Admin Video Management
              </h1>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                Administrators can manage and verify all videos
              </p>
            </div>
            {activeTab === 'videos' && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 rounded-lg transition-colors hover:opacity-90"
                style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
              >
                Upload Video
              </button>
            )}
          </div>

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
              
              {/* Upload Progress */}
              {uploading && (
                <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-secondary)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ color: 'var(--color-text)' }}>Uploading video...</span>
                    <span style={{ color: 'var(--color-text)' }}>{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full rounded-full h-2" style={{ backgroundColor: 'var(--color-hover)' }}>
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%`, backgroundColor: 'var(--color-accent)' }}
                    />
                  </div>
                </div>
              )}

              {/* Admin Notice */}
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
              </div>

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
                showDeleteButton={true}
              />
              <Pagination
                currentPage={pagination.current}
                totalPages={pagination.pages}
                total={pagination.total}
                // limit={10} for testing
                limit={3}
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
                      <div className="flex space-x-4">
                        <button
                          onClick={() => {
                            handleDeleteClick(selectedVideo);
                            handleCloseVideo();
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                          🗑️ Delete Video (Admin Only)
                        </button>
                      </div>
                      <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Only administrators can delete videos. Regular users cannot delete any videos.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Delete Confirmation Modal */}
              {showDeleteModal && videoToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
                  <div className="rounded-lg p-6 w-full max-w-md" style={{ backgroundColor: 'var(--color-secondary)' }}>
                    <div className="flex items-center mb-4">
                      <div className="text-red-500 text-4xl mr-4">⚠️</div>
                      <div>
                        <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Admin Delete Video</h2>
                        <p style={{ color: 'var(--color-text-secondary)' }}>Administrator action - cannot be undone</p>
                      </div>
                    </div>

                    <div className="mb-6">
                      <p className="mb-2" style={{ color: 'var(--color-text)' }}>
                        Are you sure you want to delete this video as an administrator?
                      </p>
                      <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-hover)' }}>
                        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>{videoToDelete.title}</h3>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{videoToDelete.description}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                          Uploaded by: {videoToDelete.uploadedBy.username}
                        </p>
                      </div>
                    </div>

                    <div className="flex space-x-4">
                      <button
                        onClick={handleDeleteCancel}
                        disabled={deleting}
                        className="flex-1 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                        style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteConfirm}
                        disabled={deleting}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {deleting ? 'Deleting...' : 'Delete as Admin'}
                      </button>
                    </div>
                  </div>
                </div>
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
                uploadProgress={uploadProgress}
              />
            </div>
          )}

          {/* Verification Tab Content */}
          {activeTab === 'verification' && (
            <div>
              <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgb(59, 130, 246)' }}>
                <div className="flex items-center">
                  <div className="text-blue-400 text-xl mr-3">🔒</div>
                  <div>
                    <h3 className="text-blue-400 font-semibold">Video Integrity Verification</h3>
                    <p className="text-blue-200 text-sm">
                      Verify that downloaded video files match the original by comparing SHA-256 hashes.
                    </p>
                  </div>
                </div>
              </div>

              {/* Verification Search */}
              <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: 'var(--color-secondary)' }}>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Search Videos for Verification
                </label>
                <input
                  type="text"
                  value={verificationSearch}
                  onChange={(e) => setVerificationSearch(e.target.value)}
                  placeholder="Search by title, description, or video ID..."
                  className="w-full px-4 py-2 rounded-md focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: 'var(--color-hover)', 
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                />
              </div>

              {/* Videos List for Verification */}
              <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--color-secondary)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead style={{ backgroundColor: 'var(--color-hover)' }}>
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Video</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Hash</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                      {loading ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center" style={{ color: 'var(--color-text-secondary)' }}>
                            Loading videos...
                          </td>
                        </tr>
                      ) : filteredVideosForVerification.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center" style={{ color: 'var(--color-text-secondary)' }}>
                            No videos found
                          </td>
                        </tr>
                      ) : (
                        filteredVideosForVerification.map((video) => (
                          <tr key={video._id} className="transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{video.title}</div>
                              <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{video.description.substring(0, 60)}...</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                video.status === 'ready' ? 'bg-green-900 text-green-200' :
                                video.status === 'processing' ? 'bg-yellow-900 text-yellow-200' :
                                'bg-red-900 text-red-200'
                              }`}>
                                {video.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {video.sha256Hash ? (
                                <div className="text-xs font-mono max-w-xs truncate" style={{ color: 'var(--color-text-secondary)' }} title={video.sha256Hash}>
                                  {video.sha256Hash.substring(0, 16)}...
                                </div>
                              ) : (
                                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Not available</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {video.status === 'ready' && video.sha256Hash ? (
                                <button
                                  onClick={() => handleVerifyClick(video)}
                                  className="text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                  Verify
                                </button>
                              ) : (
                                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                  {video.status !== 'ready' ? 'Not ready' : 'No hash'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Verification Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-secondary)' }}>
                  <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{filteredVideosForVerification.length}</div>
                  <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Total Videos</div>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-secondary)' }}>
                  <div className="text-2xl font-bold text-green-400">
                    {filteredVideosForVerification.filter(v => v.sha256Hash).length}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>With Hash</div>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-secondary)' }}>
                  <div className="text-2xl font-bold text-blue-400">
                    {filteredVideosForVerification.filter(v => v.status === 'ready' && v.sha256Hash).length}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Ready to Verify</div>
                </div>
              </div>
            </div>
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

export default AdminVideoDashboard;
