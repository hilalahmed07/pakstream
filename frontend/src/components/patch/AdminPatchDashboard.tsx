import React, { useState, useEffect } from 'react';
import { Patch, PatchUploadData } from '../../types/patch';
import patchService from '../../services/patchService';
import PatchVerificationModal from './PatchVerificationModal';
import Pagination from '../common/Pagination';
import LikesModal from '../common/LikesModal';
import ProtectedRoute from '../ProtectedRoute';
import { useNotification } from '../../contexts/NotificationContext';
import ConfirmationDialog from '../common/ConfirmationDialog';
import VerificationTabLayout from '../common/VerificationTabLayout';

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

  const fetchPatches = async () => {
    try {
      setLoading(true);
      const response = await patchService.getAdminPatches({ page: currentPage, limit: 10 });
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
  }, [currentPage]);

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
      await patchService.updatePatch(patchId, updateData);
      showSuccess('Patch updated successfully');
      await fetchPatches();
      setShowEditModal(false);
      setEditingPatch(null);
    } catch (error) {
      console.error('Update failed:', error);
      showError('Failed to update patch');
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
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
                Admin Patch Management
              </h1>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                Administrators can manage and verify all Windows patches
              </p>
            </div>
            {activeTab === 'patches' && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 rounded-lg font-bold transition-all flex items-center space-x-2 hover:opacity-90"
                style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
                disabled={uploading}
              >
                <span className="text-xl">+</span>
                <span>Upload Patch</span>
              </button>
            )}
          </div>

          {/* Progress Bar */}
          {uploading && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Uploading...</span>
                <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full rounded-full h-2" style={{ backgroundColor: 'var(--color-hover)' }}>
                <div 
                  className="h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%`, backgroundColor: 'var(--color-accent)' }}
                />
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
    <div
      className="rounded-lg overflow-hidden"
      style={{ backgroundColor: 'var(--color-secondary)' }}
    >
      <table className="w-full table-auto" style={{ margin: '-10px' }}>
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
                  <div className="flex items-center gap-4 justify-start">
                    
                    {/* Edit */}
                    <button
                      onClick={() => {
                        setEditingPatch(patch);
                        setShowEditModal(true);
                      }}
                      className="text-blue-400 hover:text-blue-300 transition-colors p-1 rounded hover:bg-blue-400/10"
                      title="Edit Patch"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(patch._id)}
                      className="text-red-400 hover:text-red-300 transition-colors p-1 rounded hover:bg-red-400/10"
                      title="Delete Patch"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>

                  </div>
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
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: 'var(--color-text-secondary)' }}>Patch Details</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: 'var(--color-text-secondary)' }}>Type / OS Support</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: 'var(--color-text-secondary)' }}>Integrity Status</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: 'var(--color-text-secondary)' }}>Compliance Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {filteredPatchesForVerification.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center opacity-60" style={{ color: 'var(--color-text-secondary)' }}>
                          No records match search query
                        </td>
                      </tr>
                    ) : (
                      filteredPatchesForVerification.map((patch) => (
                        <tr key={patch._id} className="hover:bg-black/5 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{patch.title}</div>
                            <div className="text-[10px] font-mono opacity-50 uppercase">ID: {patch._id}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2 mb-1">
                              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase border border-blue-500/20">{patch.patchType}</span>
                              <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase border border-purple-500/20">{patch.architecture}</span>
                            </div>
                            <div className="text-[10px] opacity-60">{patch.targetOs.join(', ')}</div>
                          </td>
                          <td className="px-6 py-4">
                            {patch.sha256Hash ? (
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-green-500 font-black flex items-center gap-1">
                                  ● HASH IDENTIFIED
                                </span>
                                <code
                                  className="text-[10px] bg-black/20 p-1.5 rounded font-mono truncate max-w-[220px] opacity-70"
                                  title={patch.sha256Hash}
                                >
                                  {patch.sha256Hash}
                                </code>
                              </div>
                            ) : (
                              <span className="text-[10px] text-red-500 font-black flex items-center gap-1">
                                ● ALERT: MISSING HASH
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => {
                                setPatchToVerify(patch);
                                setShowVerificationModal(true);
                              }}
                              className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:opacity-90"
                              style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
                            >
                              Run Audit
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
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border" style={{ backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-border)' }}>
        <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-primary)' }}>
          <h2 className="text-xl font-bold">Upload New Patch</h2>
          <button onClick={onClose} className="text-2xl opacity-50 hover:opacity-100">×</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (file) onUpload(file, formData); }} className="p-6 space-y-4">
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full p-6 border-2 border-dashed rounded-lg text-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-primary)' }} required />
          <div className="grid grid-cols-2 gap-4">
            <input type="text" placeholder="Title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full p-2.5 rounded border outline-none" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} required />
            <input type="text" placeholder="Version" value={formData.version} onChange={e => setFormData({...formData, version: e.target.value})} className="w-full p-2.5 rounded border outline-none" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
          </div>
          <textarea placeholder="Description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-2.5 rounded border outline-none h-24" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} required />
          <div className="grid grid-cols-3 gap-4">
            <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="p-2 rounded border" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              <option value="security">Security</option><option value="system">System</option><option value="application">Application</option><option value="driver">Driver</option><option value="other">Other</option>
            </select>
            <select value={formData.patchType} onChange={e => setFormData({...formData, patchType: e.target.value})} className="p-2 rounded border" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              <option value="security">Security</option><option value="feature">Feature</option><option value="bugfix">Bug Fix</option><option value="driver">Driver</option><option value="update">Update</option>
            </select>
            <select value={formData.architecture} onChange={e => setFormData({...formData, architecture: e.target.value})} className="p-2 rounded border" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              <option value="x86">x86</option><option value="x64">x64</option><option value="arm64">ARM64</option><option value="all">All</option>
            </select>
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

const PatchEditModal: React.FC<{ patch: Patch; onClose: () => void; onEdit: (id: string, data: Partial<PatchUploadData>) => void }> = ({ patch, onClose, onEdit }) => {
  const [formData, setFormData] = useState<Partial<PatchUploadData>>({ title: patch.title, description: patch.description, category: patch.category, tags: patch.tags.join(', '), patchType: patch.patchType, version: patch.version || '', targetOs: patch.targetOs, architecture: patch.architecture });
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border" style={{ backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-border)' }}>
        <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-primary)' }}>
          <h2 className="text-xl font-bold">Edit Patch</h2>
          <button onClick={onClose} className="text-2xl opacity-50 hover:opacity-100">×</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onEdit(patch._id, formData); }} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input type="text" placeholder="Title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full p-2.5 rounded border outline-none" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} required />
            <input type="text" placeholder="Version" value={formData.version} onChange={e => setFormData({...formData, version: e.target.value})} className="w-full p-2.5 rounded border outline-none" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
          </div>
          <textarea placeholder="Description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-2.5 rounded border outline-none h-24" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} required />
          <div className="grid grid-cols-3 gap-4">
            <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="p-2 rounded border" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              <option value="security">Security</option><option value="system">System</option><option value="application">Application</option><option value="driver">Driver</option><option value="other">Other</option>
            </select>
            <select value={formData.patchType} onChange={e => setFormData({...formData, patchType: e.target.value})} className="p-2 rounded border" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              <option value="security">Security</option><option value="feature">Feature</option><option value="bugfix">Bug Fix</option><option value="driver">Driver</option><option value="update">Update</option>
            </select>
            <select value={formData.architecture} onChange={e => setFormData({...formData, architecture: e.target.value})} className="p-2 rounded border" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              <option value="x86">x86</option><option value="x64">x64</option><option value="arm64">ARM64</option><option value="all">All</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-6 py-2 rounded bg-gray-600 font-bold">Cancel</button>
            <button type="submit" className="px-6 py-2 rounded font-bold" style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}>Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminPatchDashboard;
