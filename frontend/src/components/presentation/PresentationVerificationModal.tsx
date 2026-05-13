import React, { useState, useRef } from 'react';
import presentationService from '../../services/presentationService';
import { Presentation } from '../../types/presentation';
import { calculateFileHash, isCryptoSubtleAvailable } from '../../utils/hashUtils';
import { useNotification } from '../../contexts/NotificationContext';

interface PresentationVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  presentation: Presentation | null;
}

interface VerificationResult {
  verified: boolean;
  providedHash: string;
  storedHash: string;
  message: string;
  verifiedAt: string;
}

const PresentationVerificationModal: React.FC<PresentationVerificationModalProps> = ({
  isOpen,
  onClose,
  presentation
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
  const [presentationHash, setPresentationHash] = useState<string | null>(null);
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
    if (!presentation) return;

    setLoadingHash(true);
    setError(null);
    try {
      const response = await presentationService.getPresentationHash(presentation._id);
      setPresentationHash(response.data.sha256Hash);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve presentation hash');
    } finally {
      setLoadingHash(false);
    }
  };

  const handleVerify = async () => {
    if (!presentation) return;

    setVerifying(true);
    setError(null);
    setVerificationResult(null);

    try {
      if (verificationMethod === 'file') {
        if (!selectedFile) {
          setError('Please select a presentation file');
          setVerifying(false);
          return;
        }
        
        // If hash was calculated client-side, use it; otherwise upload file
        if (calculatedHash) {
          const result = await presentationService.verifyPresentationIntegrity(presentation._id, calculatedHash);
          setVerificationResult(result.data);
        } else {
          // Upload file for server-side hash calculation
          const result = await presentationService.verifyPresentationIntegrity(presentation._id, undefined, selectedFile);
          setVerificationResult(result.data);
        }
      } else {
        if (!hashInput.trim()) {
          setError('Please enter a hash value');
          setVerifying(false);
          return;
        }
        const result = await presentationService.verifyPresentationIntegrity(presentation._id, hashInput.trim());
        setVerificationResult(result.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify presentation integrity');
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
    setPresentationHash(null);
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

  if (!isOpen || !presentation) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">
              Verify Presentation Integrity
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white text-2xl transition-colors"
            >
              ×
            </button>
          </div>

          {/* Presentation Info */}
          <div className="mb-6">
            <p className="text-gray-300 mb-1">
              Presentation: <span className="font-semibold text-white">{presentation.title}</span>
            </p>
            <p className="text-sm text-gray-400">
              Verify that a downloaded presentation file matches the original by comparing its SHA-256 hash.
            </p>
          </div>

          {/* Get Hash Section */}
          <div className="mb-6 p-4 bg-gray-700 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">
                Original Presentation Hash
              </h3>
              <button
                onClick={handleGetHash}
                disabled={loadingHash}
                className="px-4 py-2 bg-netflix-red text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
              >
                {loadingHash ? 'Loading...' : 'Get Hash'}
              </button>
            </div>
            {presentationHash && (
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 bg-gray-900 rounded-lg text-xs font-mono text-green-400 break-all border border-gray-600">
                    {presentationHash}
                  </code>
                  {/* <button
                    onClick={() => copyHashToClipboard(presentationHash)}
                    className="px-3 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-500 transition-all shadow-md hover:shadow-lg active:shadow-sm"
                    title="Copy hash"
                  >
                    Copy
                  </button> */}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Use this hash to manually verify presentations using command-line tools (e.g., sha256sum)
                </p>
              </div>
            )}
          </div>

          {/* Verification Method Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Verification Method
            </label>
            <div className="flex gap-6">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="file"
                  checked={verificationMethod === 'file'}
                  onChange={(e) => setVerificationMethod(e.target.value as 'file')}
                  className="mr-2 accent-netflix-red"
                />
                <span className="text-gray-300">Upload Presentation File</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="hash"
                  checked={verificationMethod === 'hash'}
                  onChange={(e) => setVerificationMethod(e.target.value as 'hash')}
                  className="mr-2 accent-netflix-red"
                />
                <span className="text-gray-300">Enter Hash Manually</span>
              </label>
            </div>
          </div>

          {/* File Upload Method */}
          {verificationMethod === 'file' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Presentation File
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".ppt,.pptx,.odp"
                onChange={handleFileSelect}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-netflix-red file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-netflix-red file:text-white hover:file:bg-red-700 file:cursor-pointer"
              />
              {selectedFile && (
                <div className="mt-2">
                  <p className="text-sm text-green-400 mb-2">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                  {calculatingHash && (
                    <p className="text-sm text-yellow-400">Calculating hash... Please wait...</p>
                  )}
                  {calculatedHash && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-400 mb-1">Calculated Hash:</p>
                      <code className="block p-2 bg-gray-900 rounded text-xs font-mono text-green-400 break-all border border-gray-600">
                        {calculatedHash}
                      </code>
                    </div>
                  )}
                  {!isCryptoSubtleAvailable() && !calculatingHash && (
                    <p className="text-sm text-yellow-400 mt-2">
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
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Enter SHA-256 Hash
              </label>
              <input
                type="text"
                value={hashInput}
                onChange={(e) => setHashInput(e.target.value)}
                placeholder="Enter 64-character hexadecimal hash"
                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-netflix-red font-mono text-sm placeholder-gray-500"
              />
              {presentationHash && (
                <button
                  onClick={() => {
                    setHashInput(presentationHash);
                    setVerificationMethod('hash');
                  }}
                  className="mt-2 text-sm text-netflix-red hover:underline"
                >
                  Use original hash for testing
                </button>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-900/30 border border-red-600 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Verification Result */}
          {verificationResult && (
            <div className={`mb-4 p-4 rounded-lg border ${
              verificationResult.verified
                ? 'bg-green-900/30 border-green-600'
                : 'bg-red-900/30 border-red-600'
            }`}>
              <div className="flex items-start gap-3">
                {verificationResult.verified ? (
                  <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <div className="flex-1">
                  <p className={`font-semibold text-lg mb-2 ${
                    verificationResult.verified ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {verificationResult.verified ? '✓ Verification Successful' : '✗ Verification Failed'}
                  </p>
                  <p className="text-gray-300 mb-4">
                    {verificationResult.message}
                  </p>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-semibold text-gray-400">Provided Hash:</span>
                      <code className="block mt-1 p-2 bg-gray-900 rounded text-xs font-mono text-gray-300 break-all border border-gray-600">
                        {verificationResult.providedHash}
                      </code>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-400">Stored Hash:</span>
                      <code className="block mt-1 p-2 bg-gray-900 rounded text-xs font-mono text-gray-300 break-all border border-gray-600">
                        {verificationResult.storedHash}
                      </code>
                    </div>
                    <p className="text-gray-500 mt-3">
                      Verified at: {new Date(verificationResult.verifiedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-700">
            <button
              onClick={handleClose}
              className="px-5 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleVerify}
              disabled={verifying || calculatingHash || (verificationMethod === 'file' && !selectedFile) || (verificationMethod === 'hash' && !hashInput.trim())}
              className="px-5 py-2 bg-netflix-red text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {verifying ? 'Verifying...' : calculatingHash ? 'Calculating Hash...' : 'Verify'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresentationVerificationModal;

