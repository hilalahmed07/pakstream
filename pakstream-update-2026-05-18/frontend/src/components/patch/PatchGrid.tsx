import React, { useState } from 'react';
import { Patch } from '../../types/patch';
import { useNotification } from '../../contexts/NotificationContext';
import patchService from '../../services/patchService';
import PatchVerificationModal from './PatchVerificationModal';
import { useAuth } from '../../hooks';

interface PatchGridProps {
  patches: Patch[];
  onPatchClick: (patch: Patch) => void;
  loading?: boolean;
}

const PatchGrid: React.FC<PatchGridProps> = ({ patches: initialPatches, onPatchClick, loading = false }) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [patches, setPatches] = useState<Patch[]>(initialPatches);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedPatchForVerify, setSelectedPatchForVerify] = useState<Patch | null>(null);

  // Update local patches when initialPatches change
  React.useEffect(() => {
    setPatches(initialPatches);
  }, [initialPatches]);

  const getFileIcon = (fileType: string) => {
    const icons = {
      exe: '📦',
      msi: '📦', 
      msu: '📦',
      cab: '📦',
      def: '📄'
    };
    return icons[fileType as keyof typeof icons] || '📄';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = async (patch: Patch, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await onPatchClick(patch);
      showSuccess('Patch download started');
      
      // Update download count locally
      setPatches(prev => prev.map(p => 
        p._id === patch._id ? { ...p, downloads: p.downloads + 1 } : p
      ));
    } catch (error) {
      showError('Failed to download patch');
    }
  };

  const handleLike = async (patch: Patch, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (!user) {
        showError('Please login to like patches');
        return;
      }
      const action = patch.isLiked ? 'unlike' : 'like';
      const result = await patchService.toggleLike(patch._id, action);
      
      setPatches(prev => prev.map(p => 
        p._id === patch._id ? { ...p, likes: result.likes, isLiked: result.isLiked } : p
      ));
    } catch (error: any) {
      console.error('Failed to toggle like:', error);
      showError(error.message || 'Failed to toggle like');
    }
  };

  const handleVerifyClick = (patch: Patch, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPatchForVerify(patch);
    setShowVerifyModal(true);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="rounded-lg shadow-md p-6 animate-pulse" style={{
            backgroundColor: 'var(--color-secondary)'
          }}>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 rounded-lg" style={{ backgroundColor: 'var(--color-border)' }}></div>
              <div className="flex-1">
                <div className="h-4 rounded mb-2" style={{ backgroundColor: 'var(--color-border)' }}></div>
                <div className="h-3 rounded w-3/4" style={{ backgroundColor: 'var(--color-border)' }}></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 rounded" style={{ backgroundColor: 'var(--color-border)' }}></div>
              <div className="h-3 rounded w-5/6" style={{ backgroundColor: 'var(--color-border)' }}></div>
              <div className="h-3 rounded w-4/6" style={{ backgroundColor: 'var(--color-border)' }}></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (patches.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🔧</div>
        <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>No Patches Available</h3>
        <p style={{ color: 'var(--color-text-secondary)' }}>No Windows patches have been uploaded yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {patches.map((patch) => (
          <div
            key={patch._id}
            className="rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group flex flex-col h-full"
            style={{
              backgroundColor: 'var(--color-secondary)'
            }}
          >
            {/* Header */}
            <div className="p-6 flex-grow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <span className="text-3xl group-hover:scale-110 transition-transform flex-shrink-0">
                    {getFileIcon(patch.fileType)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-accent transition-colors" style={{
                      color: 'var(--color-text)'
                    }} title={patch.title}>
                      {patch.title}
                    </h3>
                    <p className="text-xs uppercase" style={{ color: 'var(--color-text-secondary)' }}>
                      {patch.fileType} • {patch.patchType}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm mb-4 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }} title={patch.description}>
                {patch.description}
              </p>

              {/* Stats */}
              <div className="flex items-center gap-4 mb-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="flex items-center">
                  <span className="mr-1">👁️</span> {patch.views || 0}
                </span>
                <span className="flex items-center">
                  <span className="mr-1">⬇️</span> {patch.downloads || 0}
                </span>
                <button
                  onClick={(e) => handleLike(patch, e)}
                  className={`flex items-center transition-colors hover:text-accent ${patch.isLiked ? 'text-accent' : ''}`}
                >
                  <span className="mr-1">{patch.isLiked ? '❤️' : '🤍'}</span> {patch.likes || 0}
                </button>
              </div>

              {/* Metadata Tags */}
              <div className="flex flex-wrap gap-2 mt-auto">
                <span className="px-2 py-1 rounded text-[10px] bg-blue-900/30 text-blue-600 border border-blue-800">
                  {patch.architecture}
                </span>
                <span className="px-2 py-1 rounded text-[10px] bg-purple-900/30 text-purple-600 border border-purple-800">
                  {patch.version || 'v1.0'}
                </span>
                <span className="px-2 py-1 rounded text-[10px] bg-green-900/30 text-green-600 border border-green-800">
                  {formatFileSize(patch.originalFile.size)}
                </span>
              </div>
            </div>

            {/* Action Buttons — Download is for signed-in users only */}
            {user && (
              <div className="px-6 pb-6 pt-0 space-y-2">
                <button
                  onClick={(e) => handleDownload(patch, e)}
                  className="w-full py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 font-medium"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-accent-text)'
                  }}
                >
                  <span>Download</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Verification Modal */}
      {selectedPatchForVerify && (
        <PatchVerificationModal
          isOpen={showVerifyModal}
          onClose={() => {
            setShowVerifyModal(false);
            setSelectedPatchForVerify(null);
          }}
          patch={selectedPatchForVerify}
        />
      )}
    </>
  );
};

export default PatchGrid;
