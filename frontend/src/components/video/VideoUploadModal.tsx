import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import videoService from '../../services/videoService';
import uploadManager from '../../services/uploadManager';
import { VideoUploadData } from '../../types/video';
import {
  validateVideoUpload,
  MAX_ASSET_TITLE_LENGTH,
  MAX_ASSET_DESCRIPTION_LENGTH,
  sanitizeAssetText,
  sanitizeAssetTags,
} from '../../utils/assetValidation';

interface VideoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
  onUploadStart?: () => void;
  onUploadProgress?: (progress: number, speed: number, timeRemaining: number, uploadedSize: number) => void;
  onUploadComplete?: (videoId: string) => void;
  uploading?: boolean;
}

const VideoUploadModal: React.FC<VideoUploadModalProps> = ({ 
  isOpen, 
  onClose, 
  onUploadSuccess,
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  uploading: parentUploading = false
}) => {
  const { user } = useAuth();
  const [uploadData, setUploadData] = useState<VideoUploadData>({
    title: '',
    description: '',
    category: 'other',
    tags: '',
    isForPremiere: false
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const categories = [
    { value: 'movie', label: 'Movie' },
    { value: 'tv-show', label: 'TV Show' },
    { value: 'documentary', label: 'Documentary' },
    { value: 'short-film', label: 'Short Film' },
    { value: 'other', label: 'Other' }
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const sanitizedValue =
      name === 'title' || name === 'description'
        ? sanitizeAssetText(value)
        : name === 'tags'
        ? sanitizeAssetTags(value)
        : value;
    setUploadData(prev => ({
      ...prev,
      [name]: sanitizedValue
    }));
  };

  // The parent keeps this component mounted and toggles isOpen, so state
  // persists across opens. Reset it each time the modal is freshly opened
  // so a prior upload's isUploading/selectedFile doesn't leak into a new session.
  useEffect(() => {
    if (isOpen) {
      setUploadData({
        title: '',
        description: '',
        category: 'other',
        tags: '',
        isForPremiere: false
      });
      setSelectedFile(null);
      setError(null);
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  // Setup UploadManager event listeners.
  // Progress state is owned by the dashboard's floating panel — the modal
  // doesn't subscribe to 'progress' to avoid showing stale state from an
  // in-flight upload if the user reopens the modal while one is running.
  useEffect(() => {
    const offComplete = uploadManager.on('complete', (videoId: string) => {
      onUploadComplete?.(videoId);
      onUploadSuccess?.();
    });

    const offError = uploadManager.on('error', (error: string) => {
      setError(error);
      setIsUploading(false);
    });

    const offCancel = uploadManager.on('cancel', () => {
      setIsUploading(false);
      resetForm();
      onClose();
    });

    return () => {
      offComplete();
      offError();
      offCancel();
    };
  }, [onUploadComplete, onUploadSuccess, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = uploadData.title.trim();
    const trimmedDescription = uploadData.description.trim();

    if (!trimmedTitle) {
      titleInputRef.current?.setCustomValidity('Title is required.');
      titleInputRef.current?.reportValidity();
      return;
    }

    if (!trimmedDescription) {
      descriptionInputRef.current?.setCustomValidity('Description is required.');
      descriptionInputRef.current?.reportValidity();
      return;
    }
    
    // Validate all fields
    const validationResult = validateVideoUpload({
      title: trimmedTitle,
      description: trimmedDescription,
      category: uploadData.category,
      tags: uploadData.tags,
      file: selectedFile || undefined
    });

    if (validationResult) {
      setError(validationResult);
      return;
    }

    if (!selectedFile) {
      setError('Please select a video file');
      return;
    }

    try {
      setIsUploading(true);

      // Notify parent that upload is starting
      onUploadStart?.();

      // Use UploadManager for upload
      await uploadManager.uploadVideo(selectedFile, {
        ...uploadData,
        title: trimmedTitle,
        description: trimmedDescription
      });
      
    } catch (error: any) {
      // Error handling is done by UploadManager through events
      console.error('Upload failed:', error);
    }
  };

  const resetForm = () => {
    setUploadData({
      title: '',
      description: '',
      category: 'other',
      tags: '',
      isForPremiere: false
    });
    setSelectedFile(null);
    setError(null);
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCancel = () => {
    if (isUploading) {
      // Cancel upload through UploadManager
      uploadManager.cancelUpload();
    } else {
      // Just close the modal if not uploading
      resetForm();
      onClose();
    }
  };

  const handleClose = () => {
    handleCancel();
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Disable body scroll
      document.body.style.overflow = 'hidden';
      
      // Handle wheel events on the modal to prevent propagation
      const handleWheel = (e: WheelEvent) => {
        if (modalRef.current && modalRef.current.contains(e.target as Node)) {
          // Allow scrolling within the modal
          const modalContent = modalRef.current.querySelector('.overflow-y-auto') as HTMLElement;
          if (modalContent) {
            const { scrollTop, scrollHeight, clientHeight } = modalContent;
            const isScrollingUp = e.deltaY < 0;
            const isScrollingDown = e.deltaY > 0;
            
            // Prevent scroll propagation if at bounds
            if ((isScrollingUp && scrollTop === 0) || (isScrollingDown && scrollTop + clientHeight >= scrollHeight)) {
              e.preventDefault();
            }
          }
        } else {
          // Prevent scrolling outside modal
          e.preventDefault();
        }
      };

      // Add wheel event listener
      document.addEventListener('wheel', handleWheel, { passive: false });
      
      return () => {
        // Re-enable body scroll and remove event listener
        document.body.style.overflow = '';
        document.removeEventListener('wheel', handleWheel);
      };
    }
  }, [isOpen]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      // The polling logic is now handled by the parent component.
      // This useEffect is no longer needed for polling.
    };
  }, []);

  if (!isOpen) return null;

  // Admin-only check - only allow admin users to access upload modal
  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="rounded-lg p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-secondary)' }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Upload Video</h2>
          <button
            onClick={handleClose}
            className="text-2xl hover:opacity-75 transition-opacity"
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
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Video File *
            </label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-hover)' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="hidden"
              />
              {selectedFile ? (
                <div style={{ color: 'var(--color-text)' }}>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {(selectedFile.size / (1024 * 1024 * 1024)).toFixed(2)} GB
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    disabled={parentUploading}
                    className="mt-2 hover:underline disabled:opacity-50"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={parentUploading}
                    className="px-4 py-2 rounded-lg transition-colors hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
                  >
                    Select Video File
                  </button>
                  <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                    Max size: 2GB. Supported formats: MP4, AVI, MOV, WMV, FLV, WebM, MKV, 3GP
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Progress for an in-flight upload is shown by the dashboard's
              floating panel — don't duplicate it inside the modal form. */}
          {parentUploading && (
            <div className="flex items-start gap-2 p-3 rounded-md text-sm bg-blue-500/10 ring-1 ring-blue-500/30" style={{ color: 'var(--color-text)' }}>
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                <strong className="text-blue-300">Note:</strong> Please upload one video at a time. Starting a new upload will cancel the video already in progress.
              </span>
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Title *
            </label>
            <input
              ref={titleInputRef}
              type="text"
              id="title"
              name="title"
              value={uploadData.title}
              onChange={handleInputChange}
              onInput={() => titleInputRef.current?.setCustomValidity('')}
              onInvalid={(event) => {
                const target = event.currentTarget;
                if (!target.value.trim()) {
                  target.setCustomValidity('Title is required.');
                } else {
                  target.setCustomValidity('');
                }
              }}
              maxLength={MAX_ASSET_TITLE_LENGTH}
              required
              disabled={isUploading}
              className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 disabled:opacity-50"
              style={{ 
                backgroundColor: 'var(--color-hover)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                '--tw-ring-color': 'var(--color-accent)'
              } as React.CSSProperties}
              placeholder="Enter video title"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Description *
            </label>
            <textarea
              ref={descriptionInputRef}
              id="description"
              name="description"
              value={uploadData.description}
              onChange={handleInputChange}
              onInput={() => descriptionInputRef.current?.setCustomValidity('')}
              onInvalid={(event) => {
                const target = event.currentTarget;
                if (!target.value.trim()) {
                  target.setCustomValidity('Description is required.');
                } else {
                  target.setCustomValidity('');
                }
              }}
              maxLength={MAX_ASSET_DESCRIPTION_LENGTH}
              required
              disabled={isUploading}
              rows={4}
              className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 disabled:opacity-50"
              style={{ 
                backgroundColor: 'var(--color-hover)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                '--tw-ring-color': 'var(--color-accent)'
              } as React.CSSProperties}
              placeholder="Enter video description"
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Category *
            </label>
            <select
              id="category"
              name="category"
              value={uploadData.category}
              onChange={handleInputChange}
              disabled={isUploading}
              className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 disabled:opacity-50"
              style={{ 
                backgroundColor: 'var(--color-hover)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                '--tw-ring-color': 'var(--color-accent)'
              } as React.CSSProperties}
            >
              {categories.map(category => (
                <option key={category.value} value={category.value} style={{ backgroundColor: 'var(--color-secondary)', color: 'var(--color-text)' }}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          {/* Video Type - Premiere or Direct View */}
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Video Type
            </label>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="isForPremiere"
                  checked={!uploadData.isForPremiere}
                  onChange={() => setUploadData(prev => ({ ...prev, isForPremiere: false }))}
                  disabled={isUploading}
                  className="w-4 h-4 disabled:opacity-50"
                  style={{ 
                    accentColor: 'var(--color-accent)'
                  }}
                />
                <div>
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>Direct View</span>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Users can view this video directly in the video library</p>
                </div>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="isForPremiere"
                  checked={uploadData.isForPremiere === true}
                  onChange={() => setUploadData(prev => ({ ...prev, isForPremiere: true }))}
                  disabled={isUploading}
                  className="w-4 h-4 disabled:opacity-50"
                  style={{ 
                    accentColor: 'var(--color-accent)'
                  }}
                />
                <div>
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>For Premiere</span>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>This video is intended for a premiere event and will be hidden from regular listings</p>
                </div>
              </label>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tags" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Tags
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={uploadData.tags}
              onChange={handleInputChange}
              disabled={isUploading}
              className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 disabled:opacity-50"
              style={{ 
                backgroundColor: 'var(--color-hover)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                '--tw-ring-color': 'var(--color-accent)'
              } as React.CSSProperties}
              placeholder="Enter tags separated by commas"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Separate tags with commas (e.g., action, adventure, thriller)
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2 rounded-lg transition-colors hover:opacity-90"
              style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
            >
              {isUploading ? 'Cancel Upload' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="flex-1 px-4 py-2 rounded-lg transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
            >
              {isUploading ? 'Uploading...' : 'Upload Video'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VideoUploadModal;
