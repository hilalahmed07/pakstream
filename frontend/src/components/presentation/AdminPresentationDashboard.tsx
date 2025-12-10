import React, { useState, useEffect } from 'react';
import { Presentation, CreatePresentationData } from '../../types/presentation';
import presentationService from '../../services/presentationService';
import PresentationVerificationModal from './PresentationVerificationModal';
import ProtectedRoute from '../ProtectedRoute';

const AdminPresentationDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'presentations' | 'verification'>('presentations');
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [presentationToVerify, setPresentationToVerify] = useState<Presentation | null>(null);
  const [verificationSearch, setVerificationSearch] = useState('');

  useEffect(() => {
    fetchPresentations();
  }, []);

  const fetchPresentations = async () => {
    try {
      setLoading(true);
      const response = await presentationService.getAdminPresentations();
      setPresentations(response.presentations);
    } catch (error) {
      console.error('Failed to fetch presentations:', error);
    } finally {
      setLoading(false);
    }
  };

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
          const updatedPresentations = await presentationService.getAdminPresentations();
          const uploadedPresentation = updatedPresentations.presentations.find(
            p => p._id === presentationId
          );
          
          if (uploadedPresentation) {
            setPresentations(updatedPresentations.presentations);
            
            if (uploadedPresentation.status === 'ready' || uploadedPresentation.status === 'error') {
              clearInterval(pollInterval);
              setUploadProgress(100);
              setUploading(false);
              setUploadProgress(0);
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
          console.error('Error polling presentation status:', error);
        }
      }, 5000);
      
      fetchPresentations();

    } catch (error) {
      console.error('Upload failed:', error);
      setUploading(false);
      setUploadProgress(0);
      alert('Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this presentation?')) {
      return;
    }

    try {
      await presentationService.deletePresentation(id);
      fetchPresentations();
    } catch (error) {
      console.error('Delete failed:', error);
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

  if (loading) {
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
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
                Admin Presentation Management
              </h1>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                Administrators can manage and verify all presentations
              </p>
            </div>
            {activeTab === 'presentations' && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 rounded-lg transition-colors hover:opacity-90"
                style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)' }}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload Presentation'}
              </button>
            )}
          </div>

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

              {/* Upload Progress */}
              {uploading && (
                <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-secondary)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ color: 'var(--color-text)' }}>Uploading presentation...</span>
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

              {/* Presentations Grid */}
              {presentations.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📊</div>
                  <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>No Presentations</h3>
                  <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>Upload your first presentation to get started.</p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-4 py-2 rounded-lg transition-colors hover:opacity-90"
                    style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)' }}
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
                            
                            <span className="flex items-center">
                              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                              </svg>
                              {presentation.likes}
                            </span>
                          </div>
                          
                          <span className="text-xs">
                            {new Date(presentation.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleDelete(presentation._id)}
                              className="text-red-400 hover:text-red-300 text-sm px-3 py-1 border border-red-400 rounded hover:bg-red-400 hover:text-white transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                          
                          <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            by {presentation.uploadedBy.username}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

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
            <div>
              <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgb(59, 130, 246)' }}>
                <div className="flex items-center">
                  <div className="text-blue-400 text-xl mr-3">🔒</div>
                  <div>
                    <h3 className="text-blue-400 font-semibold">Presentation Integrity Verification</h3>
                    <p className="text-blue-200 text-sm">
                      Verify that downloaded presentation files match the original by comparing SHA-256 hashes.
                    </p>
                  </div>
                </div>
              </div>

              {/* Verification Search */}
              <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: 'var(--color-secondary)' }}>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Search Presentations for Verification
                </label>
                <input
                  type="text"
                  value={verificationSearch}
                  onChange={(e) => setVerificationSearch(e.target.value)}
                  placeholder="Search by title, description, or presentation ID..."
                  className="w-full px-4 py-2 rounded-md focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: 'var(--color-hover)', 
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                />
              </div>

              {/* Presentations List for Verification */}
              <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--color-secondary)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead style={{ backgroundColor: 'var(--color-hover)' }}>
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Presentation</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Hash</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                      {loading ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center" style={{ color: 'var(--color-text-secondary)' }}>
                            Loading presentations...
                          </td>
                        </tr>
                      ) : filteredPresentationsForVerification.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center" style={{ color: 'var(--color-text-secondary)' }}>
                            No presentations found
                          </td>
                        </tr>
                      ) : (
                        filteredPresentationsForVerification.map((presentation) => (
                          <tr key={presentation._id} className="transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{presentation.title}</div>
                              <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{presentation.description.substring(0, 60)}...</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                presentation.status === 'ready' ? 'bg-green-900 text-green-200' :
                                presentation.status === 'processing' ? 'bg-yellow-900 text-yellow-200' :
                                'bg-red-900 text-red-200'
                              }`}>
                                {presentation.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {presentation.sha256Hash ? (
                                <div className="text-xs font-mono max-w-xs truncate" style={{ color: 'var(--color-text-secondary)' }} title={presentation.sha256Hash}>
                                  {presentation.sha256Hash.substring(0, 16)}...
                                </div>
                              ) : (
                                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Not available</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {presentation.status === 'ready' && presentation.sha256Hash ? (
                                <button
                                  onClick={() => handleVerifyClick(presentation)}
                                  className="text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                  Verify
                                </button>
                              ) : (
                                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                  {presentation.status !== 'ready' ? 'Not ready' : 'No hash'}
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
                  <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{filteredPresentationsForVerification.length}</div>
                  <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Total Presentations</div>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-secondary)' }}>
                  <div className="text-2xl font-bold text-green-400">
                    {filteredPresentationsForVerification.filter(p => p.sha256Hash).length}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>With Hash</div>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-secondary)' }}>
                  <div className="text-2xl font-bold text-blue-400">
                    {filteredPresentationsForVerification.filter(p => p.status === 'ready' && p.sha256Hash).length}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Ready to Verify</div>
                </div>
              </div>
            </div>
          )}

          {/* Verification Modal */}
          {presentationToVerify && (
            <PresentationVerificationModal
              isOpen={showVerificationModal}
              onClose={handleCloseVerification}
              presentation={presentationToVerify}
            />
          )}
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

const PresentationUploadModal: React.FC<PresentationUploadModalProps> = ({ onClose, onUpload, uploading = false }) => {
  const [formData, setFormData] = useState<CreatePresentationData>({
    title: '',
    description: '',
    category: 'other',
    tags: []
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tagInput, setTagInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      alert('Please select a presentation file');
      return;
    }

    const uploadData = new FormData();
    uploadData.append('presentation', selectedFile);
    uploadData.append('title', formData.title);
    uploadData.append('description', formData.description);
    uploadData.append('category', formData.category);
    uploadData.append('tags', formData.tags.join(','));

    onUpload(uploadData);
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
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
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Presentation File
              </label>
              <input
                type="file"
                accept=".ppt,.pptx,.odp"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
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
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
                required
                disabled={uploading}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
                required
                disabled={uploading}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Category
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
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add a tag"
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
                  disabled={uploading}
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-sm rounded flex items-center space-x-1"
                    style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)' }}
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
                style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)' }}
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

export default AdminPresentationDashboard;
