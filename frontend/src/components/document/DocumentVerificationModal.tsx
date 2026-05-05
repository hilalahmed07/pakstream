import React, { useState, useRef } from 'react';
import documentService from '../../services/documentService';
import { Document } from '../../types/document';
import { calculateFileHash, isCryptoSubtleAvailable } from '../../utils/hashUtils';
import { useNotification } from '../../contexts/NotificationContext';

interface DocumentVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
}

interface VerificationResult {
  verified: boolean;
  providedHash: string;
  storedHash: string;
  message: string;
  verifiedAt: string;
}

const DocumentVerificationModal: React.FC<DocumentVerificationModalProps> = ({
  isOpen,
  onClose,
  document
}) => {
  const { showSuccess, showError } = useNotification();
  const [verificationMethod, setVerificationMethod] = useState<'file' | 'hash'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [calculatedHash, setCalculatedHash] = useState<string | null>(null);
  const [calculatingHash, setCalculatingHash] = useState(false);
  const [hashInput, setHashInput] = useState<string>('');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documentHash, setDocumentHash] = useState<string | null>(null);
  const [loadingHash, setLoadingHash] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setVerificationResult(null);
      setCalculatedHash(null);
      
      // Check if crypto.subtle is available
      if (isCryptoSubtleAvailable()) {
        // Calculate hash client-side
        setCalculatingHash(true);
        try {
          const hash = await calculateFileHash(file);
          setCalculatedHash(hash);
        } catch (err: any) {
          setError(err.message || 'Failed to calculate file hash');
          setCalculatingHash(false);
          return;
        }
        setCalculatingHash(false);
      } else {
        // crypto.subtle not available - will upload file to server for hash calculation
        setCalculatedHash(null);
        setError(null);
      }
    }
  };

  const handleGetHash = async () => {
    if (!document) return;

    setLoadingHash(true);
    setError(null);
    try {
      const response = await documentService.getDocumentHash(document._id);
      setDocumentHash(response.data.sha256Hash);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve document hash');
    } finally {
      setLoadingHash(false);
    }
  };

  const handleVerify = async () => {
    if (!document) return;

    setVerifying(true);
    setError(null);
    setVerificationResult(null);

    try {
      if (verificationMethod === 'file') {
        if (!selectedFile) {
          setError('Please select a document file');
          setVerifying(false);
          return;
        }
        
        // If hash was calculated client-side, use it; otherwise upload file
        if (calculatedHash) {
          const result = await documentService.verifyDocumentIntegrity(document._id, calculatedHash);
          setVerificationResult(result.data);
        } else {
          // Upload file for server-side hash calculation
          const result = await documentService.verifyDocumentIntegrity(document._id, undefined, selectedFile);
          setVerificationResult(result.data);
        }
      } else {
        if (!hashInput.trim()) {
          setError('Please enter a hash value');
          setVerifying(false);
          return;
        }
        const result = await documentService.verifyDocumentIntegrity(document._id, hashInput.trim());
        setVerificationResult(result.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify document integrity');
    } finally {
      setVerifying(false);
    }
  };

  const handleClose = () => {
    setVerificationMethod('file');
    setSelectedFile(null);
    setCalculatedHash(null);
    setCalculatingHash(false);
    setHashInput('');
    setVerificationResult(null);
    setError(null);
    setDocumentHash(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const copyHashToClipboard = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      showSuccess('Hash copied to clipboard');
    } catch (clipboardError) {
      console.error('Failed to copy hash:', clipboardError);
      showError('Failed to copy hash');
    }
  };

  if (!isOpen || !document) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div
        className="rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border"
        style={{
          backgroundColor: 'var(--color-secondary)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              Verify Document Integrity
            </h2>
            <button
              onClick={handleClose}
              className="text-2xl transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              ×
            </button>
          </div>

          {/* Document Info */}
          <div className="mb-6">
            <p className="mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Document: <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{document.title}</span>
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Verify that a downloaded document file matches the original by comparing its SHA-256 hash.
            </p>
          </div>

          {/* Get Hash Section */}
          <div
            className="mb-6 p-4 rounded-lg border"
            style={{
              backgroundColor: 'var(--color-card)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                Original Document Hash
              </h3>
              <button
                onClick={handleGetHash}
                disabled={loadingHash}
                className="px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
                style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
              >
                {loadingHash ? 'Loading...' : 'Get Hash'}
              </button>
            </div>
            {documentHash && (
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <code
                    className="flex-1 p-3 rounded-lg text-xs font-mono break-all border"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                  >
                    {documentHash}
                  </code>
                  <button
                    onClick={() => copyHashToClipboard(documentHash)}
                    className="px-3 py-2 rounded-lg text-sm hover:opacity-90 transition-all shadow-md hover:shadow-lg active:shadow-sm"
                    style={{ backgroundColor: 'var(--color-button-bg)', color: 'var(--color-button-text)' }}
                    title="Copy hash"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Use this hash to manually verify documents using command-line tools (e.g., sha256sum)
                </p>
              </div>
            )}
          </div>

          {/* Verification Method Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Verification Method
            </label>
            <div className="flex gap-6">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="file"
                  checked={verificationMethod === 'file'}
                  onChange={(e) => setVerificationMethod(e.target.value as 'file')}
                  className="mr-2"
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                <span style={{ color: 'var(--color-text)' }}>Upload Document File</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="hash"
                  checked={verificationMethod === 'hash'}
                  onChange={(e) => setVerificationMethod(e.target.value as 'hash')}
                  className="mr-2"
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                <span style={{ color: 'var(--color-text)' }}>Enter Hash Manually</span>
              </label>
            </div>
          </div>

          {/* File Upload Method */}
          {verificationMethod === 'file' && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Select Document File
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:cursor-pointer"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text)',
                  borderColor: 'var(--color-border)',
                }}
              />
              {selectedFile && (
                <div className="mt-2">
                  <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                  {calculatingHash && (
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Calculating hash... Please wait...</p>
                  )}
                  {calculatedHash && (
                    <div className="mt-2">
                      <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>Calculated Hash:</p>
                      <code
                        className="block p-2 rounded text-xs font-mono break-all border"
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          color: 'var(--color-text)',
                          borderColor: 'var(--color-border)',
                        }}
                      >
                        {calculatedHash}
                      </code>
                    </div>
                  )}
                  {!isCryptoSubtleAvailable() && !calculatingHash && (
                    <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                      ⚠️ Hash will be calculated on the server (Web Crypto API not available over HTTP)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Hash Input Method */}
          {verificationMethod === 'hash' && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Enter SHA-256 Hash
              </label>
              <input
                type="text"
                value={hashInput}
                onChange={(e) => setHashInput(e.target.value)}
                placeholder="Enter 64-character hexadecimal hash"
                className="w-full px-4 py-3 rounded-lg border focus:outline-none font-mono text-sm"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text)',
                  borderColor: 'var(--color-border)',
                }}
              />
              {documentHash && (
                <button
                  onClick={() => {
                    setHashInput(documentHash);
                    setVerificationMethod('hash');
                  }}
                  className="mt-2 text-sm hover:underline"
                  style={{ color: 'var(--color-accent)' }}
                >
                  Use original hash for testing
                </button>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.45)' }}>
              <p style={{ color: '#dc2626' }}>{error}</p>
            </div>
          )}

          {/* Verification Result */}
          {verificationResult && (
            <div
              className="mb-4 p-4 rounded-lg border"
              style={{
                backgroundColor: verificationResult.verified ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                borderColor: verificationResult.verified ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)',
              }}
            >
              <div className="flex items-start gap-3">
                {verificationResult.verified ? (
                  <svg className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: '#16a34a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: '#dc2626' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <div className="flex-1">
                  <p
                    className="font-semibold text-lg mb-2"
                    style={{ color: verificationResult.verified ? '#16a34a' : '#dc2626' }}
                  >
                    {verificationResult.verified ? '✓ Verification Successful' : '✗ Verification Failed'}
                  </p>
                  <p className="mb-4" style={{ color: 'var(--color-text)' }}>
                    {verificationResult.message}
                  </p>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Provided Hash:</span>
                      <code
                        className="block mt-1 p-2 rounded text-xs font-mono break-all border"
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          color: 'var(--color-text)',
                          borderColor: 'var(--color-border)',
                        }}
                      >
                        {verificationResult.providedHash}
                      </code>
                    </div>
                    <div>
                      <span className="font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Stored Hash:</span>
                      <code
                        className="block mt-1 p-2 rounded text-xs font-mono break-all border"
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          color: 'var(--color-text)',
                          borderColor: 'var(--color-border)',
                        }}
                      >
                        {verificationResult.storedHash}
                      </code>
                    </div>
                    <p className="mt-3" style={{ color: 'var(--color-text-secondary)' }}>
                      Verified at: {new Date(verificationResult.verifiedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <button
              onClick={handleClose}
              className="px-5 py-2 rounded-lg hover:opacity-90 transition-colors"
              style={{ backgroundColor: 'var(--color-button-bg)', color: 'var(--color-button-text)' }}
            >
              Close
            </button>
            <button
              onClick={handleVerify}
              disabled={verifying || calculatingHash || (verificationMethod === 'file' && !selectedFile) || (verificationMethod === 'hash' && !hashInput.trim())}
              className="px-5 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
            >
              {verifying ? 'Verifying...' : calculatingHash ? 'Calculating Hash...' : 'Verify'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentVerificationModal;

