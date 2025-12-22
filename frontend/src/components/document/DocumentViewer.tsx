import React from 'react';
import { Document } from '../../types/document';
import documentService from '../../services/documentService';

interface DocumentViewerProps {
  document: Document;
  onClose: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ document, onClose }) => {
  React.useEffect(() => {
    // Track view when document is opened
    documentService.trackView(document._id).catch(err => {
      console.warn('Failed to track view:', err);
    });
  }, [document._id]);

  const handleDownload = () => {
    const fileUrl = documentService.getDocumentDownloadUrl(document._id);
    const link = window.document.createElement('a');
    link.href = fileUrl;
    link.download = document.originalFile.filename || `${document.title}.pdf`;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
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
          
          {/* Download Button */}
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-netflix-red hover:bg-red-700 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            <span>Download</span>
          </button>
          
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

      {/* PDF Viewer */}
      <div className="flex-1 overflow-hidden">
        <iframe
          src={documentService.getDocumentFileUrl(document._id)}
          className="w-full h-full"
          title={document.title}
        />
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

