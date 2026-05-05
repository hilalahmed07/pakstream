import React from 'react';
import { Document } from '../../types/document';
import documentService from '../../services/documentService';
import { useAuth } from '../../hooks';

interface DocumentViewerProps {
  document: Document;
  onClose: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ document, onClose }) => {
  const { user } = useAuth();

  React.useEffect(() => {
    // Track view when document is opened (only once per session)
    const sessionKey = `document_view_${document._id}`;
    const hasTracked = sessionStorage.getItem(sessionKey);

    if (!hasTracked) {
      documentService.trackView(document._id).catch(err => {
        console.warn('Failed to track view:', err);
      });
      sessionStorage.setItem(sessionKey, 'true');
    }
  }, [document._id]);

  const handleDownload = async () => {
    try {
      await documentService.downloadDocument(document._id);
    } catch (error) {
      console.error('Failed to download document:', error);
      alert(error instanceof Error ? error.message : 'Failed to download document');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 px-6 py-4 flex items-center justify-between border-b border-gray-800">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-white truncate">{document.title}</h2>
          <p className="text-sm text-gray-400 mt-1 truncate">{document.description}</p>
        </div>
        <div className="flex items-center space-x-4 ml-4">
          {/* Document Info */}
          <div className="text-sm text-gray-300 hidden md:block">
            {document.pageCount > 0 && <span>{document.pageCount} pages</span>}
            {document.originalFile?.size && (
              <span className="ml-2">• {formatFileSize(document.originalFile.size)}</span>
            )}
          </div>

          {/* Download — only for signed-in users (API requires auth) */}
          {user && (
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-netflix-red hover:bg-red-700 text-white rounded-lg transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
              <span>Download</span>
            </button>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 text-white rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* PDF Viewer — inline /file is public; ?download=true requires auth.
          For guests we paint over the native PDF toolbar (download/print/menu)
          and block the right-click menu so the obvious save paths are hidden.
          This is UI-level suppression, not real protection — a determined user
          can still read the iframe URL and curl the inline bytes. */}
      <div
        className="flex-1 min-h-0 overflow-hidden bg-gray-950 relative"
        onContextMenu={user ? undefined : (e) => e.preventDefault()}
      >
        <iframe
          src={documentService.getDocumentFileUrl(document._id)}
          className="absolute inset-0 w-full h-full border-0"
          title={document.title}
        />
        {!user && (
          <div
            className="absolute top-0 left-0 right-0 h-12 bg-[#323639] pointer-events-auto"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-900 px-6 py-3 border-t border-gray-800 flex items-center justify-between text-sm text-gray-400">
        <div className="flex items-center space-x-4">
          <span>Uploaded by: {document.uploadedBy.username}</span>
          <span>•</span>
          <span>{document.views} views</span>
          {document.likes > 0 && (
            <>
              <span>•</span>
              <span>{document.likes} likes</span>
            </>
          )}
        </div>
        <div>
          <span className="capitalize">{document.category}</span>
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
