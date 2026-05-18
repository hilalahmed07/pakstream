import React, { useState, useRef } from 'react';
import patchService from '../../services/patchService';
import { Patch, PatchVerificationData } from '../../types/patch';
import { calculateFileHash, isCryptoSubtleAvailable } from '../../utils/hashUtils';
import { useNotification } from '../../contexts/NotificationContext';
import { PATCH_FILE_TYPES } from '../../utils/assetValidation';

interface PatchVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  patch: Patch | null;
}

const PatchVerificationModal: React.FC<PatchVerificationModalProps> = ({
  isOpen,
  onClose,
  patch
}) => {
  const { showSuccess, showError } = useNotification();
  const [verificationMethod, setVerificationMethod] = useState<'file' | 'hash'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [calculatedHash, setCalculatedHash] = useState<string | null>(null);
  const [calculatingHash, setCalculatingHash] = useState(false);
  const [hashInput, setHashInput] = useState<string>('');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<PatchVerificationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [originalHash, setOriginalHash] = useState<string | null>(null);
  const [loadingHash, setLoadingHash] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track view when modal opens
  React.useEffect(() => {
    if (isOpen && patch) {
      patchService.trackView(patch._id);
    }
  }, [isOpen, patch]);

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
    if (!patch) return;

    setLoadingHash(true);
    setError(null);
    try {
      const response = await patchService.getPatchHash(patch._id);
      setOriginalHash(response.data.sha256Hash);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve patch hash');
    } finally {
      setLoadingHash(false);
    }
  };

  const handleVerify = async () => {
    if (!patch) return;

    setVerifying(true);
    setError(null);
    setVerificationResult(null);

    try {
      if (verificationMethod === 'file') {
        if (!selectedFile) {
          setError('Please select a patch file');
          setVerifying(false);
          return;
        }
        
        // If hash was calculated client-side, use it; otherwise upload file
        if (calculatedHash) {
          const result = await patchService.verifyPatchIntegrity(patch._id, calculatedHash);
          setVerificationResult(result.data);
        } else {
          // Upload file for server-side hash calculation
          const result = await patchService.verifyPatchIntegrity(patch._id, undefined, selectedFile);
          setVerificationResult(result.data);
        }
      } else {
        if (!hashInput.trim()) {
          setError('Please enter a hash value');
          setVerifying(false);
          return;
        }
        const result = await patchService.verifyPatchIntegrity(patch._id, hashInput.trim());
        setVerificationResult(result.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify patch integrity');
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
    setOriginalHash(null);
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

  if (!isOpen || !patch) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div 
        className="rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border"
        style={{ 
          backgroundColor: 'var(--color-secondary)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text)'
        }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 border-b pb-4" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              Verify Patch Integrity
            </h2>
            <button
              onClick={handleClose}
              className="text-2xl transition-all hover:scale-110"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              ×
            </button>
          </div>

          {/* Patch Info */}
          <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-primary)' }}>
            <p className="mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Patch: <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{patch.title}</span>
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Verify that a downloaded patch file matches the original by comparing its SHA-256 hash.
            </p>
          </div>

          {/* Get Hash Section */}
          <div className="mb-6 p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                Original Patch Hash
              </h3>
              <button
                onClick={handleGetHash}
                disabled={loadingHash}
                className="px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold transition-all hover:opacity-90"
                style={{ 
                  backgroundColor: 'var(--color-accent)', 
                  color: 'var(--color-accent-text)' 
                }}
              >
                {loadingHash ? 'Loading...' : 'Get Hash'}
              </button>
            </div>
            {(originalHash || patch.sha256Hash) && (
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 rounded-lg text-xs font-mono break-all border"
                    style={{ 
                      backgroundColor: 'var(--color-primary)', 
                      borderColor: 'var(--color-border)',
                      color: originalHash ? '#60a5fa' : 'var(--color-text-secondary)'
                    }}
                  >
                    {originalHash || patch.sha256Hash}
                  </code>
                  {/* <button
                    onClick={() => copyHashToClipboard((originalHash || patch.sha256Hash)!)}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80 shadow-md hover:shadow-lg active:shadow-sm"
                    style={{ 
                      backgroundColor: 'var(--color-button-bg)',
                      color: 'var(--color-button-text)'
                    }}
                    title="Copy hash"
                  >
                    Copy
                  </button> */}
                </div>
              </div>
            )}
          </div>

          {/* Verification Method Selection */}
          <div className="mb-6">
            <label className="block text-sm font-bold mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Verification Method
            </label>
            <div className="flex gap-6">
              <label className="flex items-center cursor-pointer group">
                <input
                  type="radio"
                  value="file"
                  checked={verificationMethod === 'file'}
                  onChange={(e) => setVerificationMethod(e.target.value as 'file')}
                  className="mr-3 w-4 h-4"
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                <span className="font-medium" style={{ color: verificationMethod === 'file' ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>
                  Upload Patch File
                </span>
              </label>
              <label className="flex items-center cursor-pointer group">
                <input
                  type="radio"
                  value="hash"
                  checked={verificationMethod === 'hash'}
                  onChange={(e) => setVerificationMethod(e.target.value as 'hash')}
                  className="mr-3 w-4 h-4"
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                <span className="font-medium" style={{ color: verificationMethod === 'hash' ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>
                  Enter Hash Manually
                </span>
              </label>
            </div>
          </div>

          {/* File Upload Method */}
          {verificationMethod === 'file' && (
            <div className="mb-6">
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Select Patch File
              </label>
              <div className="relative group">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={PATCH_FILE_TYPES.map((t) => `.${t}`).join(',')}
                  onChange={handleFileSelect}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:font-bold file:cursor-pointer"
                  style={{ 
                    backgroundColor: 'var(--color-primary)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                />
              </div>
              {selectedFile && (
                <div className="mt-3 p-3 rounded-lg border border-dashed" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-sm font-medium mb-2 text-green-500">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                  {calculatingHash && (
                    <p className="text-sm animate-pulse text-blue-400">Calculating hash... Please wait...</p>
                  )}
                  {calculatedHash && (
                    <div className="mt-2">
                      <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>Calculated Hash:</p>
                      <code className="block p-3 rounded text-xs font-mono break-all border"
                        style={{ 
                          backgroundColor: 'var(--color-primary)', 
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text)'
                        }}
                      >
                        {calculatedHash}
                      </code>
                    </div>
                  )}
                  {!isCryptoSubtleAvailable() && !calculatingHash && (
                    <p className="text-sm mt-2 italic" style={{ color: 'var(--color-text-secondary)' }}>
                      ⚠️ Hash will be calculated on the server (Web Crypto API not available over HTTP)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Hash Input Method */}
          {verificationMethod === 'hash' && (
            <div className="mb-6">
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Enter SHA-256 Hash
              </label>
              <input
                type="text"
                value={hashInput}
                onChange={(e) => setHashInput(e.target.value)}
                placeholder="Enter 64-character hexadecimal hash"
                className="w-full px-4 py-3 rounded-lg border outline-none focus:ring-2 font-mono text-sm"
                style={{ 
                  backgroundColor: 'var(--color-primary)', 
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                  boxShadow: 'none'
                }}
              />
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/50">
              <p className="text-red-500 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Verification Result */}
          {verificationResult && (
            <div className={`mb-6 p-5 rounded-lg border-l-4 shadow-sm ${
              verificationResult.verified
                ? 'bg-green-500/10 border-green-500'
                : 'bg-red-500/10 border-red-500'
            }`}>
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  {verificationResult.verified ? (
                    <span className="text-2xl text-green-500">✓</span>
                  ) : (
                    <span className="text-2xl text-red-500">✗</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-bold text-lg mb-1 ${
                    verificationResult.verified ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {verificationResult.verified ? 'Verification Successful' : 'Verification Failed'}
                  </p>
                  <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                    {verificationResult.message}
                  </p>
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Provided Hash:</span>
                      <code className="block mt-1 p-3 rounded font-mono text-xs break-all"
                        style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)' }}
                      >
                        {verificationResult.providedHash}
                      </code>
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Stored Hash:</span>
                      <code className="block mt-1 p-3 rounded font-mono text-xs break-all"
                        style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)' }}
                      >
                        {verificationResult.storedHash}
                      </code>
                    </div>
                    <p className="text-[10px] text-right italic" style={{ color: 'var(--color-text-secondary)' }}>
                      Attempted on: {new Date(verificationResult.verifiedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <button
              onClick={handleClose}
              className="px-6 py-2 rounded-lg font-bold transition-all hover:bg-opacity-80"
              style={{ 
                backgroundColor: 'var(--color-button-bg)',
                color: 'var(--color-button-text)'
              }}
            >
              Close
            </button>
            <button
              onClick={handleVerify}
              disabled={verifying || calculatingHash || (verificationMethod === 'file' && !selectedFile) || (verificationMethod === 'hash' && !hashInput.trim())}
              className="px-8 py-2 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              style={{ 
                backgroundColor: 'var(--color-accent)', 
                color: 'var(--color-accent-text)',
                boxShadow: '0 4px 14px 0 rgba(0,0,0,0.3)'
              }}
            >
              {verifying ? 'Verifying...' : calculatingHash ? 'Processing...' : 'Verify'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatchVerificationModal;
