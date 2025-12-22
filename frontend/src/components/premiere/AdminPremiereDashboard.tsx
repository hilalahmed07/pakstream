import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Premiere, CreatePremiereData } from '../../types/premiere';
import { Video } from '../../types/video';
import premiereService from '../../services/premiereService';
import videoService from '../../services/videoService';
import socketService from '../../services/socketService';
import { useAuth } from '../../hooks';
import { useNotification } from '../../contexts/NotificationContext';
import ConfirmationDialog from '../common/ConfirmationDialog';
import { formatVideoDuration } from '../../utils/videoUtils';

const AdminPremiereDashboard: React.FC = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useNotification();
  const [premieres, setPremieres] = useState<Premiere[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [activePremiere, setActivePremiere] = useState<Premiere | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; premiereId: string | null }>({
    isOpen: false,
    premiereId: null,
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use admin endpoint to get all videos including premiere-only videos
      const videosRes = await videoService.getAdminVideos({ limit: 50 });
      
      const readyVideos = videosRes.data.videos.filter(video => 
        video.status === 'ready' && 
        video.processedFiles && 
        video.processedFiles.hls && 
        video.processedFiles.hls.masterPlaylist &&
        video.processedFiles.hls.variants &&
        video.processedFiles.hls.variants.length > 0
      );
      
      setVideos(readyVideos);
      
      const [premieresRes, activeRes] = await Promise.all([
        premiereService.getAllPremieres(),
        premiereService.getActivePremiere()
      ]);

      setPremieres(premieresRes.data.premieres);
      setActivePremiere(activeRes.data.premiere);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const setupSocketListeners = useCallback(() => {
    socketService.onPremiereStarted((data) => {
      setActivePremiere(data.premiere);
      fetchData();
    });

    socketService.onPremiereEnded((data) => {
      setActivePremiere(null);
      fetchData();
    });

    socketService.onError((error) => {
      setError(error.message || 'Socket connection error');
    });
  }, [fetchData]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchData();
      setupSocketListeners();
    }
  }, [user, fetchData, setupSocketListeners]);

  const handleCreatePremiere = async (premiereData: CreatePremiereData) => {
    try {
      if (!user || user.role !== 'admin') {
        showWarning('You must be logged in as an admin to create premieres');
        return;
      }
      
      await premiereService.createPremiere(premiereData);
      setShowCreateModal(false);
      fetchData();
      showSuccess('Premiere created successfully');
    } catch (error) {
      console.error('Failed to create premiere:', error);
      showError('Failed to create premiere: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleStartPremiere = async (premiereId: string) => {
    try {
      socketService.startPremiere(premiereId);
      showSuccess('Premiere started');
    } catch (error) {
      console.error('Failed to start premiere:', error);
      showError('Failed to start premiere: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleEndPremiere = async (premiereId: string) => {
    try {
      socketService.endPremiere(premiereId);
      showSuccess('Premiere ended');
    } catch (error) {
      console.error('Failed to end premiere:', error);
      showError('Failed to end premiere: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDeletePremiere = async (premiereId: string) => {
    setDeleteConfirm({ isOpen: true, premiereId });
  };

  const confirmDeletePremiere = async () => {
    if (!deleteConfirm.premiereId) return;
    
    try {
      await premiereService.deletePremiere(deleteConfirm.premiereId);
      showSuccess('Premiere has been deleted');
      fetchData();
      setDeleteConfirm({ isOpen: false, premiereId: null });
    } catch (error) {
      console.error('Failed to delete premiere:', error);
      showError('Failed to delete premiere: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setDeleteConfirm({ isOpen: false, premiereId: null });
    }
  };

  const getPremierePosterUrl = (premiere: Premiere): string => {
    if (!premiere.video?.processedFiles?.poster) {
      return '';
    }
    return premiereService.getPosterUrl(premiere.video);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)' }}>
        <div className="text-xl" style={{ color: 'var(--color-text)' }}>Loading...</div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)' }}>
        <div className="text-xl" style={{ color: 'var(--color-text)' }}>Access denied. Admin privileges required.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)' }}>
      <div className="container mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold" style={{ color: 'var(--color-text)' }}>Premiere Dashboard</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 rounded-lg font-medium transition-colors hover:opacity-90"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
          >
            Create Premiere
          </button>
        </div>

        {/* Debug Info */}
        <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-secondary)' }}>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Debug Info:</h3>
          <p style={{ color: 'var(--color-text-secondary)' }}>User: {user ? `${user.username} (${user.role})` : 'Not logged in'}</p>
          <p style={{ color: 'var(--color-text-secondary)' }}>Token: {token ? 'Present' : 'Missing'}</p>
          <p style={{ color: 'var(--color-text-secondary)' }}>Socket Connected: {socketService.isSocketConnected() ? 'Yes' : 'No'}</p>
          <p style={{ color: 'var(--color-text-secondary)' }}>LocalStorage Token: {localStorage.getItem('token') ? 'Present' : 'Missing'}</p>
          <p style={{ color: 'var(--color-text-secondary)' }}>Videos count: {videos.length}</p>
          <p style={{ color: 'var(--color-text-secondary)' }}>Premieres count: {premieres.length}</p>
          {error && <p className="text-red-400">Error: {error}</p>}
          <button 
            onClick={fetchData}
            className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            Refresh Data
          </button>
        </div>

        {/* Active Premiere */}
        {activePremiere && (
          <div className="mb-8 p-6 rounded-lg" style={{ background: 'linear-gradient(to right, rgba(185, 28, 28, 0.3), rgba(220, 38, 38, 0.3))', border: '1px solid rgb(239, 68, 68)' }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-red-400 mb-2">LIVE PREMIERE</h2>
                <h3 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>{activePremiere.title}</h3>
                <p style={{ color: 'var(--color-text-secondary)' }}>{activePremiere.description}</p>
                <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Started: {new Date(activePremiere.startTime).toLocaleString()}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEndPremiere(activePremiere._id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  End Premiere
                </button>
                <button
                  onClick={() => handleDeletePremiere(activePremiere._id)}
                  className="px-4 py-2 rounded-lg font-medium transition-colors"
                  style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Premiere List */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>All Premieres</h2>
          {premieres.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>
              <div className="text-6xl mb-4">🎬</div>
              <p className="text-xl">No premieres created yet</p>
              <p className="text-sm">Create your first premiere to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {premieres.filter(premiere => premiere.video && premiere.video.processedFiles).map((premiere) => (
                <div
                  key={premiere._id}
                  className="rounded-lg overflow-hidden hover:scale-105 transition-transform duration-200"
                  style={{ backgroundColor: 'var(--color-secondary)' }}
                >
                  <div className="aspect-video flex items-center justify-center" style={{ backgroundColor: 'var(--color-hover)' }}>
                    {premiere.video?.processedFiles?.poster ? (
                      <img
                        src={getPremierePosterUrl(premiere)}
                        alt={premiere.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-4xl" style={{ color: 'var(--color-text-secondary)' }}>🎬</div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold mb-2 line-clamp-2" style={{ color: 'var(--color-text)' }}>{premiere.title}</h3>
                    <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>{premiere.description}</p>
                    <div className="flex justify-between items-center text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                      <span>
                        {new Date(premiere.startTime).toLocaleDateString()}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        premiere.status === 'live' 
                          ? 'bg-red-600 text-white' 
                          : premiere.status === 'scheduled'
                          ? 'bg-yellow-600 text-white'
                          : 'bg-gray-600 text-white'
                      }`}>
                        {premiere.status}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      {premiere.status === 'scheduled' && (
                        <button
                          onClick={() => handleStartPremiere(premiere._id)}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                        >
                          Start
                        </button>
                      )}
                      {premiere.status === 'live' && (
                        <>
                          <button
                            onClick={() => navigate(`/admin/premieres/${premiere._id}/control`)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                          >
                            Control
                          </button>
                          <button
                            onClick={() => handleEndPremiere(premiere._id)}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                          >
                            End
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDeletePremiere(premiere._id)}
                        className="flex-1 px-3 py-1 rounded text-xs font-medium transition-colors"
                        style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Premiere Modal */}
        {showCreateModal && (
          <CreatePremiereModal
            videos={videos}
            onSubmit={handleCreatePremiere}
            onClose={() => setShowCreateModal(false)}
          />
        )}

        {/* Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={deleteConfirm.isOpen}
          title="Delete Premiere"
          message="Are you sure you want to delete this premiere? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
          onConfirm={confirmDeletePremiere}
          onCancel={() => setDeleteConfirm({ isOpen: false, premiereId: null })}
        />
      </div>
    </div>
  );
};

interface CreatePremiereModalProps {
  videos: Video[];
  onSubmit: (data: CreatePremiereData) => void;
  onClose: () => void;
}

const CreatePremiereModal: React.FC<CreatePremiereModalProps> = ({
  videos,
  onSubmit,
  onClose
}) => {
  const { showWarning, showError } = useNotification();
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: ''
  });

  const handleVideoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const videoId = e.target.value;
    setSelectedVideoId(videoId);
    
    if (videoId) {
      const selectedVideo = videos.find(v => v._id === videoId);
      if (selectedVideo) {
        setFormData(prev => ({
          ...prev,
          title: prev.title || selectedVideo.title,
          description: prev.description || selectedVideo.description
        }));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedVideoId) {
      showWarning('Please select a video');
      return;
    }

    if (!formData.startTime) {
      showWarning('Please select a start time');
      return;
    }

    const selectedVideo = videos.find(v => v._id === selectedVideoId);
    if (!selectedVideo) {
      showError('Selected video not found');
      return;
    }

    const premiereData: CreatePremiereData = {
      videoId: selectedVideoId,
      title: formData.title || selectedVideo.title,
      description: formData.description || selectedVideo.description,
      startTime: formData.startTime
    };

    onSubmit(premiereData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-secondary)' }}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Create Premiere</h3>
          <button
            onClick={onClose}
            className="text-2xl transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Video Selection - Dropdown */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              Select Video for Premiere
            </label>
            <select
              value={selectedVideoId}
              onChange={handleVideoChange}
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: 'var(--color-hover)', 
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)'
              }}
              required
            >
              <option value="">Choose a video...</option>
              {videos.map((video) => (
                <option key={video._id} value={video._id}>
                  {video.title} ({video.resolution}) - {formatVideoDuration(video.duration)}
                </option>
              ))}
            </select>
            <div className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {videos.length} ready videos available (showing only fully processed videos)
            </div>
            {videos.length === 0 && (
              <div className="mt-2 p-3 rounded-lg" style={{ backgroundColor: 'rgba(234, 179, 8, 0.2)', border: '1px solid rgb(202, 138, 4)' }}>
                <p className="text-yellow-400 text-sm">
                  ⚠️ No videos are currently ready for premiere. Please upload and process videos first.
                </p>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              Premiere Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: 'var(--color-hover)', 
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)'
              }}
              placeholder="Enter premiere title"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              Premiere Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 h-24 resize-none"
              style={{ 
                backgroundColor: 'var(--color-hover)', 
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)'
              }}
              placeholder="Enter premiere description"
              required
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              Start Time
            </label>
            <input
              type="datetime-local"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: 'var(--color-hover)', 
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)'
              }}
              required
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-lg font-medium transition-colors"
              style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-lg font-medium transition-colors hover:opacity-90"
              style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
            >
              Create Premiere
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminPremiereDashboard;
