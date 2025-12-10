import React, { useState, useEffect } from 'react';
import { Document, DocumentUploadData } from '../../types/document';
import documentService from '../../services/documentService';
import DocumentVerificationModal from './DocumentVerificationModal';
import ProtectedRoute from '../ProtectedRoute';

const AdminDocumentDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'documents' | 'verification'>('documents');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [documentToVerify, setDocumentToVerify] = useState<Document | null>(null);
  const [verificationSearch, setVerificationSearch] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await documentService.getAdminDocuments();
      setDocuments(response.documents);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file: File, uploadData: DocumentUploadData) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      setShowUploadModal(false);
      
      const response = await documentService.uploadDocument(
        file,
        uploadData,
        (progress) => {
          setUploadProgress((progress * 0.9));
        }
      );
      
      const documentId = response.document.id;
      let pollCount = 0;
      const maxPolls = 60;
      
      const pollInterval = setInterval(async () => {
        try {
          pollCount++;
          const updatedDocuments = await documentService.getAdminDocuments();
          const uploadedDocument = updatedDocuments.documents.find(
            d => d._id === documentId
          );
          
          if (uploadedDocument) {
            setDocuments(updatedDocuments.documents);
            
            if (uploadedDocument.status === 'ready' || uploadedDocument.status === 'error') {
              clearInterval(pollInterval);
              setUploadProgress(100);
              setUploading(false);
              setUploadProgress(0);
              return;
            }
            
            if (uploadedDocument.processingProgress !== undefined) {
              const processingProgressScaled = 90 + (uploadedDocument.processingProgress * 0.1);
              setUploadProgress(processingProgressScaled);
            } else {
              setUploadProgress(90);
            }
          }
          
          if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            setUploading(false);
            setUploadProgress(0);
            fetchDocuments();
          }
        } catch (error) {
          console.error('Error polling document status:', error);
        }
      }, 5000);
      
      fetchDocuments();

    } catch (error) {
      console.error('Upload failed:', error);
      setUploading(false);
      setUploadProgress(0);
      alert('Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await documentService.deleteDocument(id);
      fetchDocuments();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleVerifyClick = (document: Document) => {
    setDocumentToVerify(document);
    setShowVerificationModal(true);
  };

  const handleCloseVerification = () => {
    setShowVerificationModal(false);
    setDocumentToVerify(null);
  };

  const filteredDocumentsForVerification = documents.filter(document => {
    const searchLower = verificationSearch.toLowerCase();
    return (
      document.title.toLowerCase().includes(searchLower) ||
      document.description.toLowerCase().includes(searchLower) ||
      document._id.toLowerCase().includes(searchLower)
    );
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div 
          className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
          style={{ borderColor: 'var(--color-accent)' }}
        ></div>
        <p style={{ color: 'var(--color-text)' }}>Loading documents...</p>
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
                Admin Document Management
              </h1>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                Administrators can manage and verify all documents
              </p>
            </div>
            {activeTab === 'documents' && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 hover:opacity-90"
                style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)' }}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                <span>Upload Document</span>
              </button>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="mb-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab('documents')}
                className="px-6 py-3 font-medium text-sm transition-colors"
                style={{
                  color: activeTab === 'documents' ? 'var(--color-text)' : 'var(--color-text-secondary)',
                  borderBottom: activeTab === 'documents' ? '2px solid var(--color-accent)' : '2px solid transparent'
                }}
              >
                📄 Documents
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

          {/* Documents Tab Content */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              {/* Documents Table */}
              <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--color-secondary)' }}>
                <table className="w-full">
                  <thead style={{ backgroundColor: 'var(--color-hover)' }}>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Size</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Views</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Uploaded By</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {documents.map((document) => (
                      <tr key={document._id} className="transition-colors" style={{ backgroundColor: 'var(--color-secondary)' }}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{document.title}</div>
                          <div className="text-sm truncate max-w-xs" style={{ color: 'var(--color-text-secondary)' }}>{document.description}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium rounded bg-blue-600 text-white">
                            {document.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            document.status === 'ready' 
                              ? 'bg-green-600 text-white' 
                              : document.status === 'processing'
                              ? 'bg-yellow-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}>
                            {document.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {document.originalFile?.size ? formatFileSize(document.originalFile.size) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {document.views}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {typeof document.uploadedBy === 'object' ? document.uploadedBy.username : 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleDelete(document._id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Upload Modal */}
              {showUploadModal && (
                <DocumentUploadModal
                  onClose={() => !uploading && setShowUploadModal(false)}
                  onUpload={handleUpload}
                  uploading={uploading}
                  uploadProgress={uploadProgress}
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
                    <h3 className="text-blue-400 font-semibold">Document Integrity Verification</h3>
                    <p className="text-blue-200 text-sm">
                      Verify that downloaded document files match the original by comparing SHA-256 hashes.
                    </p>
                  </div>
                </div>
              </div>

              {/* Verification Search */}
              <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: 'var(--color-secondary)' }}>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Search Documents for Verification
                </label>
                <input
                  type="text"
                  value={verificationSearch}
                  onChange={(e) => setVerificationSearch(e.target.value)}
                  placeholder="Search by title, description, or document ID..."
                  className="w-full px-4 py-2 rounded-md focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: 'var(--color-hover)', 
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                />
              </div>

              {/* Documents List for Verification */}
              <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--color-secondary)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead style={{ backgroundColor: 'var(--color-hover)' }}>
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Document</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Hash</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                      {loading ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center" style={{ color: 'var(--color-text-secondary)' }}>
                            Loading documents...
                          </td>
                        </tr>
                      ) : filteredDocumentsForVerification.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center" style={{ color: 'var(--color-text-secondary)' }}>
                            No documents found
                          </td>
                        </tr>
                      ) : (
                        filteredDocumentsForVerification.map((document) => (
                          <tr key={document._id} className="transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{document.title}</div>
                              <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{document.description.substring(0, 60)}...</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                document.status === 'ready' ? 'bg-green-900 text-green-200' :
                                document.status === 'processing' ? 'bg-yellow-900 text-yellow-200' :
                                'bg-red-900 text-red-200'
                              }`}>
                                {document.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {document.sha256Hash ? (
                                <div className="text-xs font-mono max-w-xs truncate" style={{ color: 'var(--color-text-secondary)' }} title={document.sha256Hash}>
                                  {document.sha256Hash.substring(0, 16)}...
                                </div>
                              ) : (
                                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Not available</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {document.status === 'ready' && document.sha256Hash ? (
                                <button
                                  onClick={() => handleVerifyClick(document)}
                                  className="text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                  Verify
                                </button>
                              ) : (
                                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                  {document.status !== 'ready' ? 'Not ready' : 'No hash'}
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
                  <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{filteredDocumentsForVerification.length}</div>
                  <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Total Documents</div>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-secondary)' }}>
                  <div className="text-2xl font-bold text-green-400">
                    {filteredDocumentsForVerification.filter(d => d.sha256Hash).length}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>With Hash</div>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-secondary)' }}>
                  <div className="text-2xl font-bold text-blue-400">
                    {filteredDocumentsForVerification.filter(d => d.status === 'ready' && d.sha256Hash).length}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Ready to Verify</div>
                </div>
              </div>
            </div>
          )}

          {/* Verification Modal */}
          {documentToVerify && (
            <DocumentVerificationModal
              isOpen={showVerificationModal}
              onClose={handleCloseVerification}
              document={documentToVerify}
            />
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

// Upload Modal Component
interface DocumentUploadModalProps {
  onClose: () => void;
  onUpload: (file: File, uploadData: DocumentUploadData) => void;
  uploading: boolean;
  uploadProgress: number;
}

const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({ onClose, onUpload, uploading, uploadProgress }) => {
  const [formData, setFormData] = useState<DocumentUploadData>({
    title: '',
    description: '',
    category: 'other',
    tags: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setError('Invalid file type. Please select a PDF file.');
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        setError('File too large. Maximum size is 50MB.');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a PDF file');
      return;
    }
    if (!formData.title.trim() || !formData.description.trim()) {
      setError('Title and description are required');
      return;
    }
    onUpload(selectedFile, formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
      <div className="rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-secondary)' }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Upload Document</h2>
            <button
              onClick={onClose}
              disabled={uploading}
              className="text-2xl disabled:opacity-50 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              ×
            </button>
          </div>

          {uploading && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Uploading...</span>
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full rounded-full h-2" style={{ backgroundColor: 'var(--color-hover)' }}>
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%`, backgroundColor: 'var(--color-accent)' }}
                />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                PDF Document
              </label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                disabled={uploading}
                className="w-full px-3 py-2 rounded-lg disabled:opacity-50"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
                required
              />
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                Supported format: PDF (Max 50MB)
              </p>
              {selectedFile && (
                <p className="text-xs text-green-400 mt-1">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                disabled={uploading}
                className="w-full px-3 py-2 rounded-lg disabled:opacity-50 focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                disabled={uploading}
                className="w-full px-3 py-2 rounded-lg disabled:opacity-50 focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                disabled={uploading}
                className="w-full px-3 py-2 rounded-lg disabled:opacity-50 focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
              >
                <option value="academic">Academic</option>
                <option value="business">Business</option>
                <option value="legal">Legal</option>
                <option value="technical">Technical</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                disabled={uploading}
                placeholder="e.g., research, report, analysis"
                className="w-full px-3 py-2 rounded-lg disabled:opacity-50 focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-900 bg-opacity-50 border border-red-600 rounded-lg text-red-200 text-sm">
                {error}
              </div>
            )}

            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="flex-1 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading || !selectedFile}
                className="flex-1 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 hover:opacity-90"
                style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)' }}
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminDocumentDashboard;
