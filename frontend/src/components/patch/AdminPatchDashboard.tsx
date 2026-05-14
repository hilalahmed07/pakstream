import React, { useState, useEffect, useRef } from 'react';
import { Patch, PatchUploadData } from '../../types/patch';
import patchService from '../../services/patchService';
import PatchVerificationModal from './PatchVerificationModal';
import Pagination from '../common/Pagination';
import LikesModal from '../common/LikesModal';
import ProtectedRoute from '../ProtectedRoute';
import { useNotification } from '../../contexts/NotificationContext';
import ConfirmationDialog from '../common/ConfirmationDialog';
import VerificationTabLayout from '../common/VerificationTabLayout';
import {
  validatePatchUpload,
  sanitizeAssetText,
  sanitizeAssetTags,
  MAX_PATCH_TITLE_LENGTH,
  MAX_ASSET_DESCRIPTION_LENGTH,
  MAX_TAGS,
  MAX_TAG_LENGTH,
} from '../../utils/assetValidation';

const PATCH_CATEGORIES = ['security', 'system', 'application', 'driver', 'other'] as const;
const PATCH_TYPES = ['security', 'feature', 'bugfix', 'driver', 'update', 'other'] as const;
const PATCH_ARCHITECTURES = ['x86', 'x64', 'arm64', 'all'] as const;
const PATCH_TARGET_OS_OPTIONS = ['windows 10', 'windows 11', 'windows server 2019', 'windows server 2022', 'all'] as const;
const sanitizePatchTitle = (value: string) => value.replace(/[^a-zA-Z0-9\s_-]/g, '');
const sanitizePatchVersion = (value: string) => {
  const cleaned = value.replace(/[^0-9.]/g, '').replace(/\.{2,}/g, '.');
  return cleaned.split('.').slice(0, 3).map(s => s.slice(0, 3)).join('.');
};
const PATCH_VERSION_PATTERN = /^(?:0|[1-9][0-9]?|100)\.(?:0|[1-9][0-9]?|100)\.(?:0|[1-9][0-9]?|100)$/;
const PATCH_VERSION_MESSAGE = 'Version must be in the format N.N.N with exactly 2 dots and each N between 0 and 100 (e.g. 2.0.100).';
const isValidPatchVersion = (value: string) => value === '' || PATCH_VERSION_PATTERN.test(value);
const requiredLabelClass = 'ml-1';

const toggleTargetOs = (current: string[], value: string): string[] => {
  if (value === 'all') {
    return current.includes('all') ? [] : ['all'];
  }

  const withoutAll = current.filter((item) => item !== 'all');
  if (withoutAll.includes(value)) {
    return withoutAll.filter((item) => item !== value);
  }

  return [...withoutAll, value];
};

const AdminPatchDashboard: React.FC = () => {
  const { showError, showSuccess } = useNotification();
  const [activeTab, setActiveTab] = useState<'patches' | 'verification'>('patches');
  const [patches, setPatches] = useState<Patch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [patchToVerify, setPatchToVerify] = useState<Patch | null>(null);
  const [verificationSearch, setVerificationSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; patchId: string | null }>({
    isOpen: false,
    patchId: null,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [editingPatch, setEditingPatch] = useState<Patch | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [likesModalOpen, setLikesModalOpen] = useState(false);
  const [likesModalData, setLikesModalData] = useState<{ title: string; totalLikes: number; likedBy: Array<{ _id: string; username: string; email: string; profile?: { firstName?: string; lastName?: string; avatar?: string } }> }>({ title: '', totalLikes: 0, likedBy: [] });
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    status: '',
    patchType: '',
  });

  const fetchPatches = async () => {
    try {
      setLoading(true);
      const response = await patchService.getAdminPatches({
        page: currentPage,
        limit: 10,
        search: filters.search || undefined,
        category: filters.category || undefined,
        status: filters.status || undefined,
        patchType: filters.patchType || undefined,
      });
      setPatches(response.patches);
      setPagination(response.pagination || { current: 1, pages: 1, total: 0 });
    } catch (error) {
      console.error('Failed to fetch patches:', error);
      showError('Failed to fetch patches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, filters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.category, filters.status, filters.patchType]);

  const handleUpload = async (file: File, uploadData: PatchUploadData) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      setShowUploadModal(false);
      
      await patchService.uploadPatch(
        file,
        uploadData,
        (progress) => {
          setUploadProgress(progress);
        }
      );
      
      showSuccess('Patch uploaded successfully');
      await fetchPatches();
    } catch (error: any) {
      console.error('Upload failed:', error);
      showError(error.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (patchId: string) => {
    setDeleteConfirm({ isOpen: true, patchId });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.patchId) return;
    try {
      await patchService.deletePatch(deleteConfirm.patchId);
      showSuccess('Patch deleted successfully');
      await fetchPatches();
    } catch (error) {
      console.error('Delete failed:', error);
      showError('Failed to delete patch');
    }
    setDeleteConfirm({ isOpen: false, patchId: null });
  };

  const handleEdit = async (patchId: string, updateData: Partial<PatchUploadData>) => {
    try {
      console.log('[AdminPatchDashboard] handleEdit called with:', { patchId, updateData });
      await patchService.updatePatch(patchId, updateData);
      console.log('[AdminPatchDashboard] Patch updated successfully');
      showSuccess('Patch updated successfully');
      await fetchPatches();
      setShowEditModal(false);
      setEditingPatch(null);
    } catch (error: any) {
      console.error('[AdminPatchDashboard] Update failed:', error);
      console.error('[AdminPatchDashboard] Error details:', {
        message: error?.message,
        status: error?.status,
        stack: error?.stack,
      });
      const message = error?.message || 'Failed to update patch';
      showError(message);
      throw new Error(message);
    }
  };

  const handleLikesClick = async (patch: Patch) => {
    setLoadingLikes(true);
    try {
      const result = await patchService.getLikedByUsers(patch._id);
      setLikesModalData({
        title: patch.title,
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

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'security': return 'bg-red-600';
      case 'system': return 'bg-blue-600';
      case 'application': return 'bg-purple-600';
      case 'driver': return 'bg-green-600';
      default: return 'bg-gray-600';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredPatchesForVerification = patches.filter(patch => {
    const searchLower = verificationSearch.toLowerCase();
    return (
      patch.title.toLowerCase().includes(searchLower) ||
      patch.description.toLowerCase().includes(searchLower) ||
      patch._id.toLowerCase().includes(searchLower)
    );
  });

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen pt-16" style={{ backgroundColor: 'var(--color-primary)' }}>
        <div className="container mx-auto px-4 py-8">
          {activeTab === 'patches' && (
            <div className="flex justify-end mb-6">
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 rounded-lg font-bold transition-all flex items-center space-x-2 hover:opacity-90"
                style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
                disabled={uploading}
              >
                <span className="text-xl">+</span>
                <span>Upload Patch</span>
              </button>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="fixed top-4 right-4 z-50 rounded-lg p-4 shadow-lg" style={{ backgroundColor: 'var(--color-secondary)', minWidth: '320px' }}>
              <div className="flex items-center mb-3">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 mr-3" style={{ borderColor: 'var(--color-accent)' }}></div>
                <span style={{ color: 'var(--color-text)' }}>
                  Uploading patch...
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
                Your patch is uploading in the background.
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="mb-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab('patches')}
                className="px-6 py-3 font-medium text-sm transition-colors"
                style={{
                  color: activeTab === 'patches' ? 'var(--color-text)' : 'var(--color-text-secondary)',
                  borderBottom: activeTab === 'patches' ? '2px solid var(--color-accent)' : '2px solid transparent'
                }}
              >
                📦 Patches
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

          {/* Patches Tab Content */}
{activeTab === 'patches' && (
  <div className="space-y-6">
    <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-secondary)' }}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            {PATCH_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
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
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Patch Type
          </label>
          <select
            value={filters.patchType}
            onChange={(e) => setFilters((prev) => ({ ...prev, patchType: e.target.value }))}
            className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--color-hover)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            <option value="">All Types</option>
            {PATCH_TYPES.map((patchType) => (
              <option key={patchType} value={patchType}>
                {patchType.charAt(0).toUpperCase() + patchType.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>

    <div
      className="rounded-lg overflow-x-auto"
      style={{ backgroundColor: 'var(--color-secondary)' }}
    >
      <table className="w-full min-w-[1100px] table-auto">
        <thead style={{ backgroundColor: 'var(--color-hover)' }}>
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Title</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Category</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Size</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Views</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Likes</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Uploaded By</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
          </tr>
        </thead>

        <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {loading ? (
            <tr>
              <td colSpan={8} className="px-6 py-10 text-center" style={{ color: 'var(--color-text-secondary)' }}>
                Loading patches...
              </td>
            </tr>
          ) : patches.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-6 py-10 text-center" style={{ color: 'var(--color-text-secondary)' }}>
                No patches found
              </td>
            </tr>
          ) : (
            patches.map((patch) => (
              <tr key={patch._id} className="hover:bg-black/5 transition-colors">
                
                {/* Title */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                    {patch.title}
                  </div>
                  <div className="text-xs truncate max-w-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {patch.description}
                  </div>
                </td>

                {/* Category */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-[10px] font-bold rounded text-white uppercase ${getCategoryColor(patch.category)}`}>
                    {patch.category}
                  </span>
                </td>

                {/* Status */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-[10px] font-bold rounded text-white uppercase ${
                      patch.status === 'ready'
                        ? 'bg-green-600'
                        : patch.status === 'processing'
                        ? 'bg-yellow-600'
                        : 'bg-red-600'
                    }`}
                  >
                    {patch.status}
                  </span>
                </td>

                {/* Size */}
                <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {formatFileSize(patch.originalFile.size)}
                </td>

                {/* Views */}
                <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {patch.views}
                </td>

                {/* Likes */}
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    {patch.likes}
                  </span>
                  {patch.likes > 0 && (
                    <button
                      onClick={() => handleLikesClick(patch)}
                      className="ml-2 text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      View
                    </button>
                  )}
                </td>

                {/* Uploaded By */}
                <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {typeof patch.uploadedBy === 'object'
                    ? patch.uploadedBy.username
                    : 'Admin'}
                </td>

                {/* Actions */}
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {patch.status === 'ready' && patch.processingProgress === 100 && (
                    <div className="flex items-center gap-2 justify-start">
                      <button
                        onClick={() => {
                          setEditingPatch(patch);
                          setShowEditModal(true);
                        }}
                        className="px-3 py-1 rounded border text-blue-400 border-blue-400 hover:bg-blue-400/10 transition-colors"
                        title="Edit Patch"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(patch._id)}
                        className="px-3 py-1 rounded border text-red-400 border-red-400 hover:bg-red-400/10 transition-colors"
                        title="Delete Patch"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>

              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>

    <Pagination
      currentPage={pagination.current}
      totalPages={pagination.pages}
      total={pagination.total}
      limit={10}
      onPageChange={setCurrentPage}
    />
  </div>
)}

          {/* Verification Tab Content */}
          {activeTab === 'verification' && (
            <VerificationTabLayout
              header={{
                icon: '🔒',
                title: 'Data Integrity Dashboard',
                description: 'Ensure system security by auditing SHA-256 hashes for all deployed software patches.',
              }}
              search={{
                label: 'Quick Search',
                placeholder: 'Filter by Patch ID, Title, or Description...',
                value: verificationSearch,
                onChange: setVerificationSearch,
              }}
              table={
                <table className="w-full text-left">
                  <thead style={{ backgroundColor: 'var(--color-hover)' }}>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Patch Details</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Type / OS Support</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Integrity Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Compliance Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {filteredPatchesForVerification.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-sm opacity-70" style={{ color: 'var(--color-text-secondary)' }}>
                          No records match search query
                        </td>
                      </tr>
                    ) : (
                      filteredPatchesForVerification.map((patch) => (
                        <tr key={patch._id} className="hover:bg-black/5 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{patch.title}</div>
                            <div className="text-xs font-mono opacity-60 mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>ID: {patch._id}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2 mb-1">
                              <span className="px-2.5 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ring-1 bg-sky-500/15 text-sky-300 ring-sky-500/40">{patch.patchType}</span>
                              <span className="px-2.5 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ring-1 bg-violet-500/15 text-violet-300 ring-violet-500/40">{patch.architecture}</span>
                            </div>
                            <div className="text-xs opacity-70 mt-1" style={{ color: 'var(--color-text-secondary)' }}>{patch.targetOs.join(', ')}</div>
                          </td>
                          <td className="px-6 py-4">
                            {patch.sha256Hash ? (
                              <div className="flex flex-col gap-1.5">
                                <span className="px-2.5 py-1 inline-flex w-fit text-sm leading-5 font-semibold rounded-full ring-1 bg-emerald-500/15 text-emerald-300 ring-emerald-500/40">
                                  Hash identified
                                </span>
                                <code
                                  className="text-sm font-mono truncate max-w-[260px]"
                                  style={{ color: 'var(--color-text)' }}
                                  title={patch.sha256Hash}
                                >
                                  {patch.sha256Hash.substring(0, 16)}...
                                </code>
                              </div>
                            ) : (
                              <span className="px-2.5 py-1 inline-flex w-fit text-sm leading-5 font-semibold rounded-full ring-1 bg-rose-500/15 text-rose-300 ring-rose-500/40">
                                Missing hash
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => {
                                setPatchToVerify(patch);
                                setShowVerificationModal(true);
                              }}
                              className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/40 hover:bg-blue-500/25 transition-all shadow-sm hover:shadow-md active:shadow-sm"
                            >
                              Verify
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              }
            />
          )}
        </div>

        {/* Modals & Dialogs */}
        {showUploadModal && <PatchUploadModal onClose={() => setShowUploadModal(false)} onUpload={handleUpload} />}
        {showEditModal && editingPatch && <PatchEditModal patch={editingPatch} onClose={() => setShowEditModal(false)} onEdit={handleEdit} />}
        {showVerificationModal && patchToVerify && <PatchVerificationModal isOpen={showVerificationModal} patch={patchToVerify} onClose={() => setShowVerificationModal(false)} />}
        <LikesModal isOpen={likesModalOpen} title={likesModalData.title} totalLikes={likesModalData.totalLikes} likedBy={likesModalData.likedBy} contentType="patch" onClose={() => setLikesModalOpen(false)} />
        <ConfirmationDialog isOpen={deleteConfirm.isOpen} title="Delete Patch" message="Are you sure you want to delete this patch? This action cannot be undone." onConfirm={confirmDelete} onCancel={() => setDeleteConfirm({ isOpen: false, patchId: null })} />
      </div>
    </ProtectedRoute>
  );
};

// Sub-components (Simplified for brevity but styled consistently)
const PatchUploadModal: React.FC<{ onClose: () => void; onUpload: (file: File, data: PatchUploadData) => void }> = ({ onClose, onUpload }) => {
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<PatchUploadData>({ title: '', description: '', version: '', category: 'other', tags: '', patchType: 'other', targetOs: ['windows 10', 'windows 11'], architecture: 'x64' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const targetOsInputRef = useRef<HTMLInputElement>(null);
  const versionInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fileInputRef.current?.setCustomValidity('');
    titleInputRef.current?.setCustomValidity('');
    descriptionInputRef.current?.setCustomValidity('');
    targetOsInputRef.current?.setCustomValidity('');
    versionInputRef.current?.setCustomValidity('');

    const normalizedFormData = {
      ...formData,
      title: formData.title.trim(),
      description: formData.description.trim(),
      version: (formData.version || '').trim()
    };

    if (!isValidPatchVersion(normalizedFormData.version)) {
      versionInputRef.current?.setCustomValidity(PATCH_VERSION_MESSAGE);
      versionInputRef.current?.reportValidity();
      return;
    }

    // Validate all fields
    const validationResult = validatePatchUpload({
      title: normalizedFormData.title,
      description: normalizedFormData.description,
      category: normalizedFormData.category,
      tags: normalizedFormData.tags,
      patchType: normalizedFormData.patchType,
      version: normalizedFormData.version,
      targetOs: normalizedFormData.targetOs,
      architecture: normalizedFormData.architecture,
      file: file || undefined
    });

    if (validationResult) {
      if (!normalizedFormData.title || validationResult.toLowerCase().includes('title')) {
        titleInputRef.current?.setCustomValidity(!normalizedFormData.title ? 'Title is required.' : validationResult);
        titleInputRef.current?.reportValidity();
        return;
      }
      if (!normalizedFormData.description || validationResult.toLowerCase().includes('description')) {
        descriptionInputRef.current?.setCustomValidity(!normalizedFormData.description ? 'Description is required.' : validationResult);
        descriptionInputRef.current?.reportValidity();
        return;
      }
      if (!file || validationResult.toLowerCase().includes('patch file') || validationResult.toLowerCase().includes('file size')) {
        fileInputRef.current?.setCustomValidity(!file ? 'Patch file is required.' : validationResult);
        fileInputRef.current?.reportValidity();
        return;
      }
      if (normalizedFormData.targetOs.length === 0) {
        targetOsInputRef.current?.setCustomValidity('Target OS is required.');
        targetOsInputRef.current?.reportValidity();
        return;
      }
      return;
    }

    if (file) {
      onUpload(file, normalizedFormData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto border" style={{ backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-border)' }}>
        <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-primary)' }}>
          <h2 className="text-xl font-bold">Upload New Patch</h2>
          <button onClick={onClose} className="text-2xl opacity-50 hover:opacity-100">×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Patch File<span className={requiredLabelClass}>*</span>
            </label>
            <input ref={fileInputRef} type="file" onChange={(e) => { setFile(e.target.files?.[0] || null); e.currentTarget.setCustomValidity(''); }} className="w-full p-6 border-2 border-dashed rounded-lg text-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-primary)' }} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Title<span className={requiredLabelClass}>*</span>
              </label>
              <input ref={titleInputRef} type="text" placeholder="Title" value={formData.title} onChange={e => setFormData({...formData, title: sanitizePatchTitle(e.target.value)})} onInput={(e) => e.currentTarget.setCustomValidity('')} onInvalid={(e) => { if (!e.currentTarget.value.trim()) e.currentTarget.setCustomValidity('Title is required.'); }} maxLength={MAX_PATCH_TITLE_LENGTH} className="w-full p-2.5 rounded border outline-none" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Version
              </label>
              <input ref={versionInputRef} type="text" placeholder="e.g. 1.2.2" value={formData.version} onChange={e => setFormData({...formData, version: sanitizePatchVersion(e.target.value).slice(0, 11)})} onInput={(e) => e.currentTarget.setCustomValidity('')} title="Format: N.N.N where each N is 1–100 (e.g. 1.2.2)" maxLength={11} className="w-full p-2.5 rounded border outline-none" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Description<span className={requiredLabelClass}>*</span>
            </label>
            <textarea ref={descriptionInputRef} placeholder="Description" value={formData.description} onChange={e => setFormData({...formData, description: sanitizeAssetText(e.target.value)})} onInput={(e) => e.currentTarget.setCustomValidity('')} onInvalid={(e) => { if (!e.currentTarget.value.trim()) e.currentTarget.setCustomValidity('Description is required.'); }} maxLength={MAX_ASSET_DESCRIPTION_LENGTH} className="w-full p-2.5 rounded border outline-none h-24" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Tags
            </label>
            <input type="text" placeholder={`Tags (comma separated, max ${MAX_TAGS}, ${MAX_TAG_LENGTH} chars each)`} value={formData.tags} onChange={e => setFormData({...formData, tags: sanitizeAssetTags(e.target.value)})} maxLength={MAX_TAGS * (MAX_TAG_LENGTH + 2)} className="w-full p-2.5 rounded border outline-none" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Category<span className={requiredLabelClass}>*</span>
              </label>
              <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-2 rounded border" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              {PATCH_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category.charAt(0).toUpperCase() + category.slice(1)}</option>
              ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Patch Type<span className={requiredLabelClass}>*</span>
              </label>
              <select value={formData.patchType} onChange={e => setFormData({...formData, patchType: e.target.value})} className="w-full p-2 rounded border" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              {PATCH_TYPES.map((patchType) => (
                <option key={patchType} value={patchType}>{patchType.charAt(0).toUpperCase() + patchType.slice(1)}</option>
              ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Architecture<span className={requiredLabelClass}>*</span>
              </label>
              <select value={formData.architecture} onChange={e => setFormData({...formData, architecture: e.target.value})} className="w-full p-2 rounded border" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              {PATCH_ARCHITECTURES.map((architecture) => (
                <option key={architecture} value={architecture}>{architecture.toUpperCase()}</option>
              ))}
              </select>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Target OS<span className={requiredLabelClass}>*</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PATCH_TARGET_OS_OPTIONS.map((targetOs) => (
                <label key={targetOs} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text)' }}>
                  <input type="checkbox" checked={formData.targetOs.includes(targetOs)} onChange={() => setFormData({ ...formData, targetOs: toggleTargetOs(formData.targetOs, targetOs) })} />
                  <span>{targetOs}</span>
                </label>
              ))}
            </div>
            <input ref={targetOsInputRef} type="text" value={formData.targetOs.join(',')} onChange={() => {}} onInput={(e) => e.currentTarget.setCustomValidity('')} className="sr-only" tabIndex={-1} required />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-6 py-2 rounded bg-gray-600 font-bold">Cancel</button>
            <button type="submit" className="px-6 py-2 rounded font-bold" style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}>Deploy Patch</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PatchEditModal: React.FC<{ patch: Patch; onClose: () => void; onEdit: (id: string, data: Partial<PatchUploadData>) => Promise<void> }> = ({ patch, onClose, onEdit }) => {
  const [formData, setFormData] = useState<PatchUploadData>({ title: patch.title, description: patch.description, category: patch.category, tags: patch.tags.join(', '), patchType: patch.patchType, version: patch.version || '', targetOs: patch.targetOs, architecture: patch.architecture });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const targetOsInputRef = useRef<HTMLInputElement>(null);
  const versionInputRef = useRef<HTMLInputElement>(null);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    titleInputRef.current?.setCustomValidity('');
    descriptionInputRef.current?.setCustomValidity('');
    targetOsInputRef.current?.setCustomValidity('');
    versionInputRef.current?.setCustomValidity('');

    const normalizedFormData = {
      ...formData,
      title: formData.title.trim(),
      description: formData.description.trim(),
      version: (formData.version || '').trim()
    };

    if (!isValidPatchVersion(normalizedFormData.version)) {
      versionInputRef.current?.setCustomValidity(PATCH_VERSION_MESSAGE);
      versionInputRef.current?.reportValidity();
      return;
    }

    const validationResult = validatePatchUpload(normalizedFormData);
    console.log('[PatchEditModal] Validation result:', validationResult);
    if (validationResult) {
      if (!normalizedFormData.title || validationResult.toLowerCase().includes('title')) {
        titleInputRef.current?.setCustomValidity(!normalizedFormData.title ? 'Title is required.' : validationResult);
        titleInputRef.current?.reportValidity();
        return;
      }
      if (!normalizedFormData.description || validationResult.toLowerCase().includes('description')) {
        descriptionInputRef.current?.setCustomValidity(!normalizedFormData.description ? 'Description is required.' : validationResult);
        descriptionInputRef.current?.reportValidity();
        return;
      }
      if (normalizedFormData.targetOs.length === 0) {
        targetOsInputRef.current?.setCustomValidity('Target OS is required.');
        targetOsInputRef.current?.reportValidity();
        return;
      }
      return;
    }
    try {
      setSaving(true);
      console.log('[PatchEditModal] Submitting form data:', normalizedFormData);
      await onEdit(patch._id, normalizedFormData);
      console.log('[PatchEditModal] Edit successful');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update patch';
      console.error('[PatchEditModal] Edit failed with error:', errorMessage);
      setValidationError(errorMessage);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto border" style={{ backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-border)' }}>
        <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-primary)' }}>
          <h2 className="text-xl font-bold">Edit Patch</h2>
          <button onClick={onClose} className="text-2xl opacity-50 hover:opacity-100">×</button>
        </div>
        {validationError && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded m-4">
            {validationError}
          </div>
        )}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Title<span className={requiredLabelClass}>*</span>
              </label>
              <input ref={titleInputRef} type="text" placeholder="Title" value={formData.title} onChange={e => setFormData({...formData, title: sanitizePatchTitle(e.target.value)})} onInput={(e) => e.currentTarget.setCustomValidity('')} onInvalid={(e) => { if (!e.currentTarget.value.trim()) e.currentTarget.setCustomValidity('Title is required.'); }} maxLength={MAX_PATCH_TITLE_LENGTH} className="w-full p-2.5 rounded border outline-none" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Version
              </label>
              <input ref={versionInputRef} type="text" placeholder="e.g. 1.2.2" value={formData.version} onChange={e => setFormData({...formData, version: sanitizePatchVersion(e.target.value).slice(0, 11)})} onInput={(e) => e.currentTarget.setCustomValidity('')} title="Format: N.N.N where each N is 1–100 (e.g. 1.2.2)" maxLength={11} className="w-full p-2.5 rounded border outline-none" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Description<span className={requiredLabelClass}>*</span>
            </label>
            <textarea ref={descriptionInputRef} placeholder="Description" value={formData.description} onChange={e => setFormData({...formData, description: sanitizeAssetText(e.target.value)})} onInput={(e) => e.currentTarget.setCustomValidity('')} onInvalid={(e) => { if (!e.currentTarget.value.trim()) e.currentTarget.setCustomValidity('Description is required.'); }} maxLength={MAX_ASSET_DESCRIPTION_LENGTH} className="w-full p-2.5 rounded border outline-none h-24" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Tags
            </label>
            <input type="text" placeholder={`Tags (comma separated, max ${MAX_TAGS}, ${MAX_TAG_LENGTH} chars each)`} value={formData.tags} onChange={e => setFormData({...formData, tags: sanitizeAssetTags(e.target.value)})} maxLength={MAX_TAGS * (MAX_TAG_LENGTH + 2)} className="w-full p-2.5 rounded border outline-none" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Category<span className={requiredLabelClass}>*</span>
              </label>
              <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-2 rounded border" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              {PATCH_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category.charAt(0).toUpperCase() + category.slice(1)}</option>
              ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Patch Type<span className={requiredLabelClass}>*</span>
              </label>
              <select value={formData.patchType} onChange={e => setFormData({...formData, patchType: e.target.value})} className="w-full p-2 rounded border" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              {PATCH_TYPES.map((patchType) => (
                <option key={patchType} value={patchType}>{patchType.charAt(0).toUpperCase() + patchType.slice(1)}</option>
              ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Architecture<span className={requiredLabelClass}>*</span>
              </label>
              <select value={formData.architecture} onChange={e => setFormData({...formData, architecture: e.target.value})} className="w-full p-2 rounded border" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              {PATCH_ARCHITECTURES.map((architecture) => (
                <option key={architecture} value={architecture}>{architecture.toUpperCase()}</option>
              ))}
              </select>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Target OS<span className={requiredLabelClass}>*</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PATCH_TARGET_OS_OPTIONS.map((targetOs) => (
                <label key={targetOs} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text)' }}>
                  <input type="checkbox" checked={formData.targetOs.includes(targetOs)} onChange={() => setFormData({ ...formData, targetOs: toggleTargetOs(formData.targetOs, targetOs) })} />
                  <span>{targetOs}</span>
                </label>
              ))}
            </div>
            <input ref={targetOsInputRef} type="text" value={formData.targetOs.join(',')} onChange={() => {}} onInput={(e) => e.currentTarget.setCustomValidity('')} className="sr-only" tabIndex={-1} required />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} disabled={saving} className="px-6 py-2 rounded bg-gray-600 font-bold disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-6 py-2 rounded font-bold disabled:opacity-50" style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminPatchDashboard;
