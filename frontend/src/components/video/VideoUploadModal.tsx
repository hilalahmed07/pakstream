import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks';
import videoService from '../../services/videoService';
import { VideoUploadData } from '../../types/video';

interface VideoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
  onUploadStart?: () => void;
  onUploadProgress?: (progress: number) => void;
  onUploadComplete?: (videoId: string) => void;
  uploading?: boolean;
  uploadProgress?: number;
}

const VideoUploadModal: React.FC<VideoUploadModalProps> = ({ 
  isOpen, 
  onClose, 
  onUploadSuccess,
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  uploading: parentUploading = false,
  uploadProgress: parentUploadProgress = 0
}) => {
  const { user } = useAuth();
  const [uploadData, setUploadData] = useState<VideoUploadData>({
    title: '',
    description: '',
    category: 'other',
    tags: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // Validate file type
      const allowedTypes = [
        'video/mp4',
        'video/avi',
        'video/mov',
        'video/wmv',
        'video/flv',
        'video/webm',
        'video/mkv',
        'video/3gp'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        setError('Invalid file type. Please select a video file.');
        return;
      }

      // Validate file size (2GB limit)
      if (file.size > 2 * 1024 * 1024 * 1024) {
        setError('File too large. Maximum size is 2GB.');
        return;
      }

      setSelectedFile(file);
      setError(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUploadData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setError('Please select a video file.');
      return;
    }

    if (!uploadData.title.trim() || !uploadData.description.trim()) {
      setError('Title and description are required.');
      return;
    }

    try {
      setError(null);
      
      // Notify parent that upload is starting
      onUploadStart?.();
      
      // Close modal immediately when upload starts
      onClose();

      // Upload with real progress tracking (0-90% for upload phase)
      const response = await videoService.uploadVideo(
        selectedFile, 
        uploadData,
        (progress) => {
          // Progress is already scaled to 0-90% in videoService
          onUploadProgress?.(progress);
        }
      );
      
      // Notify parent that upload is complete, pass videoId for polling
      const videoId = response.data.video._id;
      onUploadComplete?.(videoId);
      
      // Reset form
      setUploadData({
        title: '',
        description: '',
        category: 'other',
        tags: ''
      });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error: any) {
      onUploadProgress?.(0);
      setError(error.message || 'Upload failed. Please try again.');
    }
  };

  const handleClose = () => {
    if (!parentUploading) {
      setUploadData({
        title: '',
        description: '',
        category: 'other',
        tags: ''
      });
      setSelectedFile(null);
      setError(null);
      onUploadProgress?.(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onClose();
    }
  };

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
      <div className="bg-netflix-gray rounded-lg p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Upload Video</h2>
          <button
            onClick={handleClose}
            disabled={parentUploading}
            className="text-gray-400 hover:text-white text-2xl disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="bg-red-600 text-white p-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Video File *
            </label>
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                disabled={parentUploading}
                className="hidden"
              />
              {selectedFile ? (
                <div className="text-white">
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-gray-400">
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
                    className="mt-2 text-netflix-red hover:underline disabled:opacity-50"
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
                    className="btn-primary disabled:opacity-50"
                  >
                    Select Video File
                  </button>
                  <p className="text-sm text-gray-400 mt-2">
                    Max size: 2GB. Supported formats: MP4, AVI, MOV, WMV, FLV, WebM, MKV, 3GP
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Upload Progress - Always visible when uploading */}
          {parentUploading && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-300 mb-2">
                <span className="font-medium">Uploading video...</span>
                <span className="font-semibold">{Math.round(parentUploadProgress)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-netflix-red h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(0, Math.min(100, parentUploadProgress))}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Please wait while your video is being uploaded. Do not close this window.
              </p>
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
              Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={uploadData.title}
              onChange={handleInputChange}
              required
              disabled={parentUploading}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-netflix-red disabled:opacity-50"
              placeholder="Enter video title"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              value={uploadData.description}
              onChange={handleInputChange}
              required
              disabled={parentUploading}
              rows={4}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-netflix-red disabled:opacity-50"
              placeholder="Enter video description"
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-2">
              Category
            </label>
            <select
              id="category"
              name="category"
              value={uploadData.category}
              onChange={handleInputChange}
              disabled={parentUploading}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-netflix-red disabled:opacity-50"
            >
              {categories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-300 mb-2">
              Tags
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={uploadData.tags}
              onChange={handleInputChange}
              disabled={parentUploading}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-netflix-red disabled:opacity-50"
              placeholder="Enter tags separated by commas"
            />
            <p className="text-xs text-gray-400 mt-1">
              Separate tags with commas (e.g., action, adventure, thriller)
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={parentUploading}
              className="flex-1 btn-secondary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={parentUploading || !selectedFile}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {parentUploading ? 'Uploading...' : 'Upload Video'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VideoUploadModal;
