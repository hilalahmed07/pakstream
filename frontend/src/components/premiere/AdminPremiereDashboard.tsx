import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import { Premiere, CreatePremiereData } from '../../types/premiere';
import { Video } from '../../types/video';
import premiereService from '../../services/premiereService';
import videoService from '../../services/videoService';
import socketService from '../../services/socketService';
import { useAuth } from '../../hooks';
import { useNotification } from '../../contexts/NotificationContext';
import ConfirmationDialog from '../common/ConfirmationDialog';
import Pagination from '../common/Pagination';
import { formatVideoDuration } from '../../utils/videoUtils';
import { MAX_ASSET_TITLE_LENGTH, MAX_ASSET_DESCRIPTION_LENGTH, sanitizeAssetText } from '../../utils/assetValidation';
import 'react-datepicker/dist/react-datepicker.css';
import './premiere-datepicker.css';

const requiredLabelClass = 'ml-1';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const videosRes = await videoService.getAdminVideos({ limit: 50 });
      
      const readyVideos = videosRes.data.videos.filter(video => 
        video.status === 'ready' && 
        video.processedFiles && 
        video.processedFiles.hls && 
        video.processedFiles.hls.masterPlaylist &&
        video.processedFiles.hls.variants &&
        video.processedFiles.hls.variants.length > 0 &&
        video.isForPremiere !== false
      );
      
      setVideos(readyVideos);
      
      const [premieresRes, activeRes] = await Promise.all([
        premiereService.getAllPremieres({ page: currentPage, limit: 10 }),
        premiereService.getActivePremiere()
      ]);

      setPremieres(premieresRes.data.premieres);
      setPagination(premieresRes.data.pagination || { current: 1, pages: 1, total: premieresRes.data.premieres?.length || 0 });
      setActivePremiere(activeRes.data.premiere);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  const setupSocketListeners = useCallback(() => {
    // Ensure socket handshake carries the current JWT/user role before
    // admin control events (start/end) are emitted.
    socketService.reconnectWithCurrentAuth();

    const handlePremiereStarted = (data: any) => {
      setActivePremiere(data.premiere);
      setPremieres(prev => prev.map(p => 
        p._id === data.premiere._id ? { ...p, status: 'live', isActive: true } : p
      ));
    };

    const handlePremiereEnded = (data: any) => {
      setActivePremiere(null);
      setPremieres(prev => prev.map(p => 
        p._id === data.premiere._id ? { ...p, status: 'ended', isActive: false } : p
      ));
    };

    const handleStatusUpdated = (data: any) => {
      console.log('📡 Premiere status updated:', data);
      if (data.action === 'ended') {
        console.log('🛑 Updating premiere to ended status:', data.premiereId);
        setActivePremiere(null);
        setPremieres(prev => prev.map(p => {
          if (p._id === data.premiereId) {
            console.log('✅ Updated premiere status to ended');
            return { ...p, status: 'ended', isActive: false };
          }
          return p;
        }));
      } else if (data.action === 'started') {
        console.log('▶️ Updating premiere to live status:', data.premiereId);
        setActivePremiere(data.premiere);
        setPremieres(prev => prev.map(p => {
          if (p._id === data.premiereId) {
            console.log('✅ Updated premiere status to live');
            return { ...p, status: 'live', isActive: true };
          }
          return p;
        }));
      }
    };

    const handleError = (error: any) => {
      setError(error.message || 'Socket connection error');
    };

    // Live sync deletes across admin sessions: when another admin deletes
    // a premiere, the backend broadcasts 'premiere-deleted' globally and
    // we drop it from our local list.
    const handlePremiereDeleted = (data: { premiereId: string }) => {
      setPremieres(prev => prev.filter(p => p._id !== data.premiereId));
      setActivePremiere(prev => (prev?._id === data.premiereId ? null : prev));
    };

    socketService.onPremiereStarted(handlePremiereStarted);
    socketService.onPremiereEnded(handlePremiereEnded);
    socketService.on('premiere-status-updated', handleStatusUpdated);
    socketService.onPremiereDeleted(handlePremiereDeleted);
    socketService.onError(handleError);

    return () => {
      socketService.removeListener('premiere-started', handlePremiereStarted);
      socketService.removeListener('premiere-ended', handlePremiereEnded);
      socketService.removeListener('premiere-status-updated', handleStatusUpdated);
      socketService.removeListener('premiere-deleted', handlePremiereDeleted);
      socketService.removeListener('error', handleError);
    };
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchData();
      const cleanup = setupSocketListeners();
      return cleanup;
    }
  }, [user, fetchData, setupSocketListeners, currentPage]);

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
      // Surface the backend message directly — 409 ("active premiere exists")
      // and 400 ("Start time must be in the future") come through as-is and
      // are already user-friendly.
      const message = error instanceof Error ? error.message : 'Unknown error';
      showError(message);
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

    const premiereId = deleteConfirm.premiereId;
    const premiereToDelete = premieres.find(p => p._id === premiereId);
    const wasLive = premiereToDelete?.status === 'live';

    // Snapshot for rollback, then optimistically remove the row so the UI
    // updates instantly. The backend DELETE + socket broadcast will confirm.
    const snapshot = premieres;
    setPremieres(prev => prev.filter(p => p._id !== premiereId));
    setDeleteConfirm({ isOpen: false, premiereId: null });

    try {
      if (wasLive) {
        await premiereService.endPremiere(premiereId);
      }

      await premiereService.deletePremiere(premiereId);

      if (wasLive) {
        setActivePremiere(prev => (prev?._id === premiereId ? null : prev));
        showSuccess('Premiere has been ended and deleted');
      } else {
        showSuccess('Premiere has been deleted');
      }
    } catch (error) {
      // Roll back so the user doesn't think the delete succeeded.
      setPremieres(snapshot);

      console.error('Failed to delete premiere:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message === 'Cannot delete live premiere') {
        showError('Cannot delete a live premiere directly. Please end it first, then delete.');
      } else {
        showError('Failed to delete premiere: ' + message);
      }
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
        <div className="flex justify-end mb-6">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 rounded-lg font-medium transition-colors hover:opacity-90"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
          >
            Create Premiere
          </button>
        </div>

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
                        <div className="flex-1 px-3 py-1 rounded text-xs font-medium text-center bg-blue-600/20 text-blue-200">
                          Auto-starts at scheduled time
                        </div>
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
          <Pagination
            currentPage={pagination.current}
            totalPages={pagination.pages}
            total={pagination.total}
            limit={10}
            onPageChange={setCurrentPage}
          />
        </div>

        {showCreateModal && (
          <CreatePremiereModal
            videos={videos}
            onSubmit={handleCreatePremiere}
            onClose={() => setShowCreateModal(false)}
          />
        )}

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
  const { showError } = useNotification();
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [formData, setFormData] = useState<{ title: string; description: string; startTime: Date | null }>({
    title: '',
    description: '',
    startTime: null,
  });
  const videoSelectRef = useRef<HTMLSelectElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const getStartTimeInput = () =>
    document.querySelector('.premiere-start-time-input') as HTMLInputElement | null;
  const now = new Date();
  const isStartTimeToday = formData.startTime
    ? formData.startTime.toDateString() === now.toDateString()
    : true;
  const minSelectableTime = isStartTimeToday
    ? now
    : new Date(new Date().setHours(0, 0, 0, 0));
  const maxSelectableTime = new Date(new Date().setHours(23, 59, 59, 999));

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
    videoSelectRef.current?.setCustomValidity('');
    titleInputRef.current?.setCustomValidity('');
    descriptionInputRef.current?.setCustomValidity('');
    getStartTimeInput()?.setCustomValidity('');
    const normalizedTitle = formData.title.trim();
    const normalizedDescription = formData.description.trim();

    if (!selectedVideoId) {
      videoSelectRef.current?.setCustomValidity('Please select a video.');
      videoSelectRef.current?.reportValidity();
      return;
    }

    if (!normalizedTitle) {
      titleInputRef.current?.setCustomValidity('Premiere title is required.');
      titleInputRef.current?.reportValidity();
      return;
    }

    if (!normalizedDescription) {
      descriptionInputRef.current?.setCustomValidity('Premiere description is required.');
      descriptionInputRef.current?.reportValidity();
      return;
    }

    if (!formData.startTime) {
      const startTimeInput = getStartTimeInput();
      startTimeInput?.setCustomValidity('Start time is required.');
      startTimeInput?.reportValidity();
      return;
    }

    // Reject past dates client-side with a 1-minute grace for clock skew.
    // Backend enforces the same rule for defence in depth.
    const now = Date.now();
    if (formData.startTime.getTime() <= now - 60 * 1000) {
      const startTimeInput = getStartTimeInput();
      startTimeInput?.setCustomValidity('Start time must be in the future.');
      startTimeInput?.reportValidity();
      return;
    }

    const selectedVideo = videos.find(v => v._id === selectedVideoId);
    if (!selectedVideo) {
      showError('Selected video not found');
      return;
    }

    const premiereData: CreatePremiereData = {
      videoId: selectedVideoId,
      title: normalizedTitle || selectedVideo.title,
      description: normalizedDescription || selectedVideo.description,
      // Always send UTC ISO so timezone drift between admin machine and
      // the (possibly UTC) server doesn't shift the scheduled time.
      startTime: formData.startTime.toISOString(),
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
              Select Video for Premiere<span className={requiredLabelClass}>*</span>
            </label>
            <select
              ref={videoSelectRef}
              value={selectedVideoId}
              onChange={handleVideoChange}
              onInput={(e) => e.currentTarget.setCustomValidity('')}
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
              Premiere Title<span className={requiredLabelClass}>*</span>
            </label>
            <input
              ref={titleInputRef}
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: sanitizeAssetText(e.target.value) })}
              onInput={(e) => e.currentTarget.setCustomValidity('')}
              onInvalid={(e) => {
                if (!e.currentTarget.value.trim()) {
                  e.currentTarget.setCustomValidity('Premiere title is required.');
                }
              }}
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: 'var(--color-hover)', 
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)'
              }}
              placeholder="Enter premiere title"
              required
              maxLength={MAX_ASSET_TITLE_LENGTH}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              Premiere Description<span className={requiredLabelClass}>*</span>
            </label>
            <textarea
              ref={descriptionInputRef}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: sanitizeAssetText(e.target.value) })}
              onInput={(e) => e.currentTarget.setCustomValidity('')}
              onInvalid={(e) => {
                if (!e.currentTarget.value.trim()) {
                  e.currentTarget.setCustomValidity('Premiere description is required.');
                }
              }}
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 h-24 resize-none"
              style={{ 
                backgroundColor: 'var(--color-hover)', 
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)'
              }}
              placeholder="Enter premiere description"
              required
              maxLength={MAX_ASSET_DESCRIPTION_LENGTH}
            />
          </div>

          {/* Start Time — uses react-datepicker so the calendar/clock popup
              works on locked-down browsers (Firefox ESR on the air-gapped
              Ubuntu target) where native <input type="datetime-local"> has
              no widget. Also supports manual typing: YYYY-MM-DD HH:MM. */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              Start Time<span className={requiredLabelClass}>*</span>
            </label>
            <DatePicker
              selected={formData.startTime}
              onChange={(date: Date | null) => {
                setFormData({ ...formData, startTime: date });
                getStartTimeInput()?.setCustomValidity('');
              }}
              showTimeSelect
              timeIntervals={15}
              dateFormat="yyyy-MM-dd HH:mm"
              timeFormat="HH:mm"
              minDate={new Date()}
              minTime={minSelectableTime}
              maxTime={maxSelectableTime}
              placeholderText="YYYY-MM-DD HH:MM"
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 premiere-start-time-input"
              wrapperClassName="w-full"
              popperClassName="premiere-datepicker-popper"
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
