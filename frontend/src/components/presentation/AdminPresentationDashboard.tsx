import React, { useState, useEffect, useRef } from 'react';
import { Presentation, CreatePresentationData } from '../../types/presentation';
import presentationService from '../../services/presentationService';
import PresentationVerificationModal from './PresentationVerificationModal';
import Pagination from '../common/Pagination';
import LikesModal from '../common/LikesModal';
import ProtectedRoute from '../ProtectedRoute';
import { useNotification } from '../../contexts/NotificationContext';
import ConfirmationDialog from '../common/ConfirmationDialog';
import VerificationTabLayout from '../common/VerificationTabLayout';
import {
  validatePresentationUpload,
  PRESENTATION_TAGS_MESSAGE,
  MAX_PRESENTATION_TITLE_LENGTH,
  MAX_PRESENTATION_DESCRIPTION_LENGTH,
  MAX_PRESENTATION_TAGS,
  MIN_TAG_LENGTH,
  MAX_TAG_LENGTH,
  SINGLE_TAG_REGEX,
  sanitizeAssetText,
  normalizeTitle,
  normalizeDescription,
} from '../../utils/assetValidation';

const requiredLabelClass = 'ml-1';

const AdminPresentationDashboard: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState<'presentations' | 'verification'>('presentations');
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [presentationToVerify, setPresentationToVerify] = useState<Presentation | null>(null);
  const [verificationSearch, setVerificationSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; presentationId: string | null }>({
    isOpen: false,
    presentationId: null,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [likesModalOpen, setLikesModalOpen] = useState(false);
  const [likesModalData, setLikesModalData] = useState<{ title: string; totalLikes: number; likedBy: Array<{ _id: string; username: string; email: string; profile?: { firstName?: string; lastName?: string; avatar?: string } }> }>({ title: '', totalLikes: 0, likedBy: [] });
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [editingPresentation, setEditingPresentation] = useState<Presentation | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    status: '',
  });

  const fetchPresentations = async () => {
    try {
      setLoading(true);
      // const response = await presentationService.getAdminPresentations({ page: currentPage, limit: 10 }); for testing
      const response = await presentationService.getAdminPresentations({
        page: currentPage,
        limit: 4,
        search: filters.search.trim() || undefined,
        category: filters.category || undefined,
        status: filters.status || undefined,
      });
      setPresentations(response.presentations);
      setPagination(response.pagination || { current: 1, pages: 1, total: 0 });
    } catch (error) {
      console.error('Failed to fetch presentations:', error);
    } finally {
      setLoading(false);
      setHasFetchedOnce(true);
    }
  };

  useEffect(() => {
    fetchPresentations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, filters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.category, filters.status]);

  const handleUpload = async (formData: FormData) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      setShowUploadModal(false);
      
      const response = await presentationService.uploadPresentation(
        formData,
        (progress) => {
          setUploadProgress((progress * 0.9));
        }
      );
      
      const presentationId = response.presentation.id;
      let pollCount = 0;
      const maxPolls = 60;
      
      const pollInterval = setInterval(async () => {
        try {
          pollCount++;
          const presentationResponse = await presentationService.getPresentationById(presentationId);
          const uploadedPresentation = presentationResponse.presentation;
          
          if (uploadedPresentation) {
            if (uploadedPresentation.status === 'ready' || uploadedPresentation.status === 'error') {
              clearInterval(pollInterval);
              setUploadProgress(100);
              setUploading(false);
              setUploadProgress(0);
              fetchPresentations();
              return;
            }
            
            if (uploadedPresentation.processingProgress !== undefined) {
              const processingProgressScaled = 90 + (uploadedPresentation.processingProgress * 0.1);
              setUploadProgress(processingProgressScaled);
            } else {
              setUploadProgress(90);
            }
          }
          
          if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            setUploading(false);
            setUploadProgress(0);
            fetchPresentations();
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (message.toLowerCase().includes('not found')) {
            clearInterval(pollInterval);
            setUploading(false);
            setUploadProgress(0);
            fetchPresentations();
            showError('Upload tracking stopped because the presentation was removed.');
            return;
          }
          console.error('Error polling presentation status:', error);
        }
      }, 5000);
      
      fetchPresentations();

    } catch (error) {
      console.error('Upload failed:', error);
      setUploading(false);
      setUploadProgress(0);
      showError('Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirm({ isOpen: true, presentationId: id });
  };

  const handleEdit = async (presentationId: string, updateData: Partial<CreatePresentationData>) => {
    try {
      await presentationService.updatePresentation(presentationId, updateData);
      showSuccess('Presentation updated successfully');
      await fetchPresentations();
      setShowEditModal(false);
      setEditingPresentation(null);
    } catch (error) {
      console.error('Update failed:', error);
      const message = error instanceof Error ? error.message : 'Failed to update presentation';
      showError(message);
      throw new Error(message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.presentationId) return;

    try {
      await presentationService.deletePresentation(deleteConfirm.presentationId);
      showSuccess('Presentation has been deleted');
      fetchPresentations();
      setDeleteConfirm({ isOpen: false, presentationId: null });
    } catch (error) {
      console.error('Delete failed:', error);
      showError('Failed to delete presentation: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setDeleteConfirm({ isOpen: false, presentationId: null });
    }
  };

  const handleVerifyClick = (presentation: Presentation) => {
    setPresentationToVerify(presentation);
    setShowVerificationModal(true);
  };

  const handleCloseVerification = () => {
    setShowVerificationModal(false);
    setPresentationToVerify(null);
  };

  const handleLikesClick = async (presentation: Presentation) => {
    setLoadingLikes(true);
    try {
      const result = await presentationService.getLikedByUsers(presentation._id);
      setLikesModalData({
        title: presentation.title,
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

  const filteredPresentationsForVerification = presentations.filter(presentation => {
    const searchLower = verificationSearch.toLowerCase();
    return (
      presentation.title.toLowerCase().includes(searchLower) ||
      presentation.description.toLowerCase().includes(searchLower) ||
      presentation._id.toLowerCase().includes(searchLower)
    );
  });

  const getCategoryColor = (category: string) => {
    const colors = {
      business: 'bg-blue-600',
      education: 'bg-green-600',
      marketing: 'bg-purple-600',
      technology: 'bg-gray-600',
      design: 'bg-pink-600',
      other: 'bg-gray-500'
    };
    return colors[category as keyof typeof colors] || colors.other;
  };

  if (loading && !hasFetchedOnce) {
    return (
      <div className="text-center py-12">
        <div 
          className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
          style={{ borderColor: 'var(--color-accent)' }}
        ></div>
        <p style={{ color: 'var(--color-text)' }}>Loading presentations...</p>
      </div>
    );
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen pt-16" style={{ backgroundColor: 'var(--color-primary)' }}>
        <div className="container mx-auto px-4 py-8">
          {activeTab === 'presentations' && (
            <div className="flex justify-end mb-6">
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 rounded-lg transition-colors hover:opacity-90"
                style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload Presentation'}
              </button>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="mb-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab('presentations')}
                className="px-6 py-3 font-medium text-sm transition-colors"
                style={{
                  color: activeTab === 'presentations' ? 'var(--color-text)' : 'var(--color-text-secondary)',
                  borderBottom: activeTab === 'presentations' ? '2px solid var(--color-accent)' : '2px solid transparent'
                }}
              >
                📊 Presentations
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

          {/* Presentations Tab Content */}
          {activeTab === 'presentations' && (
            <div className="space-y-6">
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-secondary)' }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Search
                    </label>
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                      placeholder="Search title, description, ID..."
                      className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--color-hover)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Category
                    </label>
                    <select
                      value={filters.category}
                      onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--color-hover)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                    >
                      <option value="">All Categories</option>
                      <option value="business">Business</option>
                      <option value="education">Education</option>
                      <option value="marketing">Marketing</option>
                      <option value="technology">Technology</option>
                      <option value="design">Design</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Status
                    </label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                      className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--color-hover)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                    >
                      <option value="">All Status</option>
                      <option value="ready">Ready</option>
                      <option value="processing">Processing</option>
                      <option value="error">Error</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Upload Progress */}
              {uploading && (
                <div className="fixed top-4 right-4 z-50 rounded-lg p-4 shadow-lg" style={{ backgroundColor: 'var(--color-secondary)', minWidth: '320px' }}>
                  <div className="flex items-center mb-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 mr-3" style={{ borderColor: 'var(--color-accent)' }}></div>
                    <span style={{ color: 'var(--color-text)' }}>
                      {uploadProgress >= 90 ? 'Processing presentation...' : 'Uploading presentation...'}
                    </span>
                    <span className="ml-2 font-semibold" style={{ color: 'var(--color-accent)' }}>{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full rounded-full h-2 overflow-hidden mb-3" style={{ backgroundColor: 'var(--color-hover)' }}>
                    <div
                      className="h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.max(0, Math.min(100, uploadProgress))}%`, backgroundColor: 'var(--color-accent)' }}
                    ></div>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {uploadProgress >= 90
                      ? 'Finalizing the presentation. This can take a moment.'
                      : 'Your presentation is uploading in the background.'}
                  </div>
                </div>
              )}

              {/* Presentations Grid */}
              {presentations.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📊</div>
                  <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>No Presentations</h3>
                  <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>Upload your first presentation to get started.</p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-4 py-2 rounded-lg transition-colors hover:opacity-90"
                    style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
                  >
                    Upload Presentation
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {presentations.map((presentation) => (
                    <div key={presentation._id} className="rounded-lg overflow-hidden shadow-lg" style={{ backgroundColor: 'var(--color-secondary)' }}>
                      {/* Thumbnail */}
                      <div className="aspect-video relative" style={{ backgroundColor: 'var(--color-hover)' }}>
                        {presentation.thumbnail ? (
                          <img
                            src={presentationService.getThumbnailUrl(presentation._id)}
                            alt={presentation.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0xNzUgMTI1SDIyNVYxNzVIMTc1VjEyNVoiIGZpbGw9IiM2QjcyODAiLz4KPC9zdmc+';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="text-6xl" style={{ color: 'var(--color-text-secondary)' }}>📊</div>
                          </div>
                        )}
                        
                        {/* Status Badge */}
                        <div className="absolute top-2 left-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            presentation.status === 'ready' 
                              ? 'bg-green-600 text-white' 
                              : presentation.status === 'processing'
                              ? 'bg-yellow-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}>
                            {presentation.status === 'ready' ? 'Ready' : 
                             presentation.status === 'processing' ? 'Processing' : 'Error'}
                          </span>
                        </div>

                        {/* Category Badge */}
                        <div className="absolute top-2 right-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium text-white ${getCategoryColor(presentation.category)}`}>
                            {presentation.category}
                          </span>
                        </div>

                        {/* Slide Count */}
                        <div className="absolute bottom-2 right-2">
                          <span className="bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                            {presentation.totalSlides} slides
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4">
                        <h3 className="font-semibold text-lg mb-2 line-clamp-2" style={{ color: 'var(--color-text)' }}>
                          {presentation.title}
                        </h3>
                        
                        <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
                          {presentation.description}
                        </p>

                        {/* Stats */}
                        <div className="flex items-center justify-between text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                          <div className="flex items-center space-x-4">
                            <span className="flex items-center">
                              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                              </svg>
                              {presentation.views}
                            </span>
                            
                            {presentation.likes > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLikesClick(presentation);
                                }}
                                disabled={loadingLikes}
                                className="flex items-center transition-colors hover:underline cursor-pointer disabled:opacity-50"
                                style={{ color: 'var(--color-text-secondary)' }}
                                title="View who liked this"
                              >
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                </svg>
                                {presentation.likes}
                              </button>
                            ) : (
                              <span className="flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                </svg>
                                {presentation.likes}
                              </span>
                            )}
                          </div>
                          
                          <span className="text-xs">
                            {new Date(presentation.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between">
                          {presentation.status === 'ready' && presentation.processingProgress === 100 ? (
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  setEditingPresentation(presentation);
                                  setShowEditModal(true);
                                }}
                                className="text-blue-400 hover:text-blue-300 text-sm px-3 py-1 border border-blue-400 rounded hover:bg-blue-400 hover:text-white transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(presentation._id)}
                                className="text-red-400 hover:text-red-300 text-sm px-3 py-1 border border-red-400 rounded hover:bg-red-400 hover:text-white transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          ) : (
                            <div />
                          )}
                          
                          <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            by {presentation.uploadedBy.username}
                          </div>
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
                // limit={10} for testing
                limit={4}
                onPageChange={setCurrentPage}
              />

              {/* Upload Modal */}
              {showUploadModal && (
                <PresentationUploadModal
                  onClose={() => !uploading && setShowUploadModal(false)}
                  onUpload={handleUpload}
                  uploading={uploading}
                />
              )}
            </div>
          )}

          {/* Verification Tab Content */}
          {activeTab === 'verification' && (
            <VerificationTabLayout
              header={{
                icon: '🔒',
                title: 'Presentation Integrity Verification',
                description: 'Verify that downloaded presentation files match the original by comparing SHA-256 hashes.',
              }}
              search={{
                label: 'Search Presentations for Verification',
                placeholder: 'Search by title, description, or presentation ID...',
                value: verificationSearch,
                onChange: setVerificationSearch,
              }}
              table={
                <table className="w-full">
                  <thead style={{ backgroundColor: 'var(--color-hover)' }}>
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: 'var(--color-text-secondary)' }}>Presentation</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: 'var(--color-text-secondary)' }}>Hash</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center opacity-60" style={{ color: 'var(--color-text-secondary)' }}>
                          Loading presentations...
                        </td>
                      </tr>
                    ) : filteredPresentationsForVerification.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center opacity-60" style={{ color: 'var(--color-text-secondary)' }}>
                          No presentations found
                        </td>
                      </tr>
                    ) : (
                      filteredPresentationsForVerification.map((presentation) => (
                        <tr key={presentation._id} className="hover:bg-black/5 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{presentation.title}</div>
                            <div className="text-xs max-w-md truncate" style={{ color: 'var(--color-text-secondary)' }}>{presentation.description}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ring-1 ${
                              presentation.status === 'ready' ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40' :
                              presentation.status === 'processing' ? 'bg-amber-500/15 text-amber-300 ring-amber-500/40' :
                              'bg-rose-500/15 text-rose-300 ring-rose-500/40'
                            }`}>
                              {presentation.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {presentation.sha256Hash ? (
                              <div className="text-sm font-mono max-w-xs truncate" style={{ color: 'var(--color-text)' }} title={presentation.sha256Hash}>
                                {presentation.sha256Hash.substring(0, 16)}...
                              </div>
                            ) : (
                              <span className="text-sm opacity-70" style={{ color: 'var(--color-text-secondary)' }}>Not available</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {presentation.status === 'ready' && presentation.sha256Hash ? (
                              <button
                                onClick={() => handleVerifyClick(presentation)}
                                className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/40 hover:bg-blue-500/25 transition-all shadow-sm hover:shadow-md active:shadow-sm"
                              >
                                Verify
                              </button>
                            ) : (
                              <span className="text-sm opacity-70" style={{ color: 'var(--color-text-secondary)' }}>
                                {presentation.status !== 'ready' ? 'Not ready' : 'No hash'}
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
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{filteredPresentationsForVerification.length}</div>
                    <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Total Presentations</div>
                  </div>
                  <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-border)' }}>
                    <div className="text-2xl font-bold text-green-400">
                      {filteredPresentationsForVerification.filter(p => p.sha256Hash).length}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>With Hash</div>
                  </div>
                  <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-border)' }}>
                    <div className="text-2xl font-bold text-blue-400">
                      {filteredPresentationsForVerification.filter(p => p.status === 'ready' && p.sha256Hash).length}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Ready to Verify</div>
                  </div>
                </div>
              }
            />
          )}

          {/* Verification Modal */}
          {presentationToVerify && (
            <PresentationVerificationModal
              isOpen={showVerificationModal}
              onClose={handleCloseVerification}
              presentation={presentationToVerify}
            />
          )}

          {/* Likes Modal */}
          <LikesModal
            isOpen={likesModalOpen}
            title={likesModalData.title}
            totalLikes={likesModalData.totalLikes}
            likedBy={likesModalData.likedBy}
            contentType="presentation"
            onClose={() => setLikesModalOpen(false)}
          />

          {/* Edit Modal */}
          {showEditModal && editingPresentation && (
            <PresentationEditModal
              presentation={editingPresentation}
              onClose={() => {
                setShowEditModal(false);
                setEditingPresentation(null);
              }}
              onEdit={handleEdit}
            />
          )}

          {/* Confirmation Dialog */}
          <ConfirmationDialog
            isOpen={deleteConfirm.isOpen}
            title="Delete Presentation"
            message="Are you sure you want to delete this presentation? This action cannot be undone."
            confirmText="Delete"
            cancelText="Cancel"
            type="danger"
            onConfirm={confirmDelete}
            onCancel={() => setDeleteConfirm({ isOpen: false, presentationId: null })}
          />
        </div>
      </div>
    </ProtectedRoute>
  );
};

// Upload Modal Component
interface PresentationUploadModalProps {
  onClose: () => void;
  onUpload: (formData: FormData) => void;
  uploading?: boolean;
}

interface PresentationEditModalProps {
  presentation: Presentation;
  onClose: () => void;
  onEdit: (id: string, data: Partial<CreatePresentationData>) => Promise<void>;
}

const PresentationUploadModal: React.FC<PresentationUploadModalProps> = ({ onClose, onUpload, uploading = false }) => {
  const [formData, setFormData] = useState<CreatePresentationData>({
    title: '',
    description: '',
    category: 'other',
    tags: []
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tagInput, setTagInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fileInputRef.current?.setCustomValidity('');
    titleInputRef.current?.setCustomValidity('');
    descriptionInputRef.current?.setCustomValidity('');
    const normalizedTitle = normalizeTitle(formData.title);
    const normalizedDescription = normalizeDescription(formData.description);
    const normalizedTags = formData.tags.map((tag) => tag.trim()).filter(Boolean);

    if (!normalizedTitle) {
      titleInputRef.current?.setCustomValidity('Title is required.');
      titleInputRef.current?.reportValidity();
      return;
    }

    if (!normalizedDescription) {
      descriptionInputRef.current?.setCustomValidity('Description is required.');
      descriptionInputRef.current?.reportValidity();
      return;
    }
    
    // Validate all fields
    const validationResult = validatePresentationUpload({
      title: normalizedTitle,
      description: normalizedDescription,
      category: formData.category,
      tags: normalizedTags,
      file: selectedFile || undefined
    });

    if (validationResult) {
      if (!normalizedTitle || validationResult.toLowerCase().includes('title')) {
        titleInputRef.current?.setCustomValidity(!normalizedTitle ? 'Title is required.' : validationResult);
        titleInputRef.current?.reportValidity();
        return;
      }
      if (!normalizedDescription || validationResult.toLowerCase().includes('description')) {
        descriptionInputRef.current?.setCustomValidity(!normalizedDescription ? 'Description is required.' : validationResult);
        descriptionInputRef.current?.reportValidity();
        return;
      }
      if (!selectedFile || validationResult.toLowerCase().includes('presentation file') || validationResult.toLowerCase().includes('file size')) {
        fileInputRef.current?.setCustomValidity(!selectedFile ? 'Presentation file is required.' : validationResult);
        fileInputRef.current?.reportValidity();
        return;
      }
      return;
    }

    if (!selectedFile) {
      fileInputRef.current?.setCustomValidity('Presentation file is required.');
      fileInputRef.current?.reportValidity();
      return;
    }

    const uploadData = new FormData();
    uploadData.append('presentation', selectedFile);
    uploadData.append('title', normalizedTitle);
    uploadData.append('description', normalizedDescription);
    uploadData.append('category', formData.category);
    uploadData.append('tags', normalizedTags.join(','));

    onUpload(uploadData);
  };

  const addTag = () => {
    const nextTag = tagInput.trim();

    if (!nextTag) {
      return;
    }

    if (formData.tags.length >= MAX_PRESENTATION_TAGS) {
      tagInputRef.current?.setCustomValidity(PRESENTATION_TAGS_MESSAGE);
      tagInputRef.current?.reportValidity();
      return;
    }

    if (
      nextTag.length < MIN_TAG_LENGTH ||
      nextTag.length > MAX_TAG_LENGTH ||
      !SINGLE_TAG_REGEX.test(nextTag)
    ) {
      tagInputRef.current?.setCustomValidity(PRESENTATION_TAGS_MESSAGE);
      tagInputRef.current?.reportValidity();
      return;
    }

    if (!formData.tags.includes(nextTag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, nextTag]
      }));
      tagInputRef.current?.setCustomValidity('');
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
      <div className="rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-secondary)' }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Upload Presentation</h2>
            <button
              onClick={onClose}
              className="text-2xl transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              disabled={uploading}
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* File Upload */}
            <div>
              {/* <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Presentation File<span className={requiredLabelClass}>*</span>
              </label> */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".ppt,.pptx,.odp"
                onChange={(e) => {
                  setSelectedFile(e.target.files?.[0] || null);
                  e.currentTarget.setCustomValidity('');
                }}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
                required
                disabled={uploading}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                Supported formats: .ppt, .pptx, .odp (Max 100MB)
              </p>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Title<span className={requiredLabelClass}>*</span>
              </label>
              <input
                ref={titleInputRef}
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: sanitizeAssetText(e.target.value) }))}
                onInput={(e) => e.currentTarget.setCustomValidity('')}
                onInvalid={(e) => {
                  if (!e.currentTarget.value.trim()) {
                    e.currentTarget.setCustomValidity('Title is required.');
                  }
                }}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
                required
                disabled={uploading}
                maxLength={MAX_PRESENTATION_TITLE_LENGTH}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Description<span className={requiredLabelClass}>*</span>
              </label>
              <textarea
                ref={descriptionInputRef}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: sanitizeAssetText(e.target.value) }))}
                onInput={(e) => e.currentTarget.setCustomValidity('')}
                onInvalid={(e) => {
                  if (!e.currentTarget.value.trim()) {
                    e.currentTarget.setCustomValidity('Description is required.');
                  }
                }}
                rows={3}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
                required
                disabled={uploading}
                maxLength={MAX_PRESENTATION_DESCRIPTION_LENGTH}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Category<span className={requiredLabelClass}>*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
                disabled={uploading}
              >
                <option value="business">Business</option>
                <option value="education">Education</option>
                <option value="marketing">Marketing</option>
                <option value="technology">Technology</option>
                <option value="design">Design</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Tags */}
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
                  className="flex-1 px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: 'var(--color-hover)', 
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                  disabled={uploading}
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2 rounded-lg transition-colors"
                  style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
                  disabled={uploading || formData.tags.length >= MAX_PRESENTATION_TAGS}
                >
                  Add
                </button>
              </div>
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                {formData.tags.length}/{MAX_PRESENTATION_TAGS} tags
              </p>
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-sm rounded flex items-center space-x-1"
                    style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:opacity-70"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 rounded-lg transition-colors hover:opacity-90"
                style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
                disabled={uploading}
              >
                Upload
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const PresentationEditModal: React.FC<PresentationEditModalProps> = ({ presentation, onClose, onEdit }) => {
  const [formData, setFormData] = useState<CreatePresentationData>({
    title: presentation.title,
    description: presentation.description,
    category: presentation.category,
    tags: presentation.tags,
  });
  const [tagInput, setTagInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    titleInputRef.current?.setCustomValidity('');
    descriptionInputRef.current?.setCustomValidity('');
    tagInputRef.current?.setCustomValidity('');
    const normalizedTitle = normalizeTitle(formData.title);
    const normalizedDescription = normalizeDescription(formData.description);
    const normalizedTags = formData.tags.map((tag) => tag.trim()).filter(Boolean);

    if (!normalizedTitle) {
      titleInputRef.current?.setCustomValidity('Title is required.');
      titleInputRef.current?.reportValidity();
      return;
    }

    if (!normalizedDescription) {
      descriptionInputRef.current?.setCustomValidity('Description is required.');
      descriptionInputRef.current?.reportValidity();
      return;
    }

    const validationResult = validatePresentationUpload({
      title: normalizedTitle,
      description: normalizedDescription,
      category: formData.category,
      tags: normalizedTags,
    });

    if (validationResult) {
      if (!normalizedTitle || validationResult.toLowerCase().includes('title')) {
        titleInputRef.current?.setCustomValidity(!normalizedTitle ? 'Title is required.' : validationResult);
        titleInputRef.current?.reportValidity();
        return;
      }
      if (!normalizedDescription || validationResult.toLowerCase().includes('description')) {
        descriptionInputRef.current?.setCustomValidity(!normalizedDescription ? 'Description is required.' : validationResult);
        descriptionInputRef.current?.reportValidity();
        return;
      }
      if (validationResult.toLowerCase().includes('tag')) {
        tagInputRef.current?.setCustomValidity(validationResult);
        tagInputRef.current?.reportValidity();
        return;
      }
      return;
    }

    try {
      setSaving(true);
      await onEdit(presentation._id, {
        ...formData,
        title: normalizedTitle,
        description: normalizedDescription,
        tags: normalizedTags,
      });
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Failed to update presentation');
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    const nextTag = tagInput.trim();

    if (!nextTag) {
      return;
    }

    if (formData.tags.length >= MAX_PRESENTATION_TAGS) {
      tagInputRef.current?.setCustomValidity(PRESENTATION_TAGS_MESSAGE);
      tagInputRef.current?.reportValidity();
      return;
    }

    if (
      nextTag.length < MIN_TAG_LENGTH ||
      nextTag.length > MAX_TAG_LENGTH ||
      !SINGLE_TAG_REGEX.test(nextTag)
    ) {
      tagInputRef.current?.setCustomValidity(PRESENTATION_TAGS_MESSAGE);
      tagInputRef.current?.reportValidity();
      return;
    }

    if (!formData.tags.includes(nextTag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, nextTag],
      }));
      setValidationError(null);
      tagInputRef.current?.setCustomValidity('');
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
    setValidationError(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
      <div className="rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-secondary)' }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Edit Presentation</h2>
            <button
              onClick={onClose}
              className="text-2xl transition-colors disabled:opacity-50"
              style={{ color: 'var(--color-text-secondary)' }}
              disabled={saving}
            >
              ×
            </button>
          </div>

          {validationError && (
            <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
              {validationError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Title<span className={requiredLabelClass}>*</span>
              </label>
              <input
                ref={titleInputRef}
                type="text"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: sanitizeAssetText(e.target.value) }))}
                onInput={(e) => e.currentTarget.setCustomValidity('')}
                onInvalid={(e) => {
                  if (!e.currentTarget.value.trim()) {
                    e.currentTarget.setCustomValidity('Title is required.');
                  }
                }}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--color-hover)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
                required
                disabled={saving}
                maxLength={MAX_PRESENTATION_TITLE_LENGTH}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Description<span className={requiredLabelClass}>*</span>
              </label>
              <textarea
                ref={descriptionInputRef}
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: sanitizeAssetText(e.target.value) }))}
                onInput={(e) => e.currentTarget.setCustomValidity('')}
                onInvalid={(e) => {
                  if (!e.currentTarget.value.trim()) {
                    e.currentTarget.setCustomValidity('Description is required.');
                  }
                }}
                rows={3}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--color-hover)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
                required
                disabled={saving}
                maxLength={MAX_PRESENTATION_DESCRIPTION_LENGTH}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Category<span className={requiredLabelClass}>*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--color-hover)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
                disabled={saving}
              >
                <option value="business">Business</option>
                <option value="education">Education</option>
                <option value="marketing">Marketing</option>
                <option value="technology">Technology</option>
                <option value="design">Design</option>
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
                  disabled={saving || formData.tags.length >= MAX_PRESENTATION_TAGS}
                >
                  Add
                </button>
              </div>
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                {formData.tags.length}/{MAX_PRESENTATION_TAGS} tags
              </p>
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag, index) => (
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

            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 rounded-lg transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminPresentationDashboard;
