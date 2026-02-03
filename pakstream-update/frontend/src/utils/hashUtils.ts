/**
 * Check if crypto.subtle is available (requires HTTPS or localhost)
 * @returns boolean indicating if crypto.subtle is available
 */
export function isCryptoSubtleAvailable(): boolean {
  return typeof crypto !== 'undefined' && 
         typeof crypto.subtle !== 'undefined' && 
         crypto.subtle !== null;
}

/**
 * Calculate SHA-256 hash of a file in the browser
 * @param file - File object to calculate hash for
 * @returns Promise that resolves to the hexadecimal hash string (lowercase)
 * @throws Error if crypto.subtle is not available (e.g., when accessing via HTTP from remote device)
 */
export async function calculateFileHash(file: File): Promise<string> {
  // Check if crypto.subtle is available
  if (!isCryptoSubtleAvailable()) {
    const isSecureContext = window.isSecureContext;
    const protocol = window.location.protocol;
    
    let errorMessage = 'Cannot calculate file hash: Web Crypto API is not available. ';
    
    if (!isSecureContext && protocol === 'http:') {
      errorMessage += 'This feature requires HTTPS or localhost access. ';
      errorMessage += 'The file will be uploaded to the server for hash calculation instead.';
    } else {
      errorMessage += 'Your browser may not support the Web Crypto API.';
    }
    
    throw new Error(errorMessage);
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    
    // Convert ArrayBuffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex.toLowerCase();
  } catch (error: any) {
    // Provide more helpful error messages
    if (error.message && error.message.includes('crypto.subtle')) {
      throw new Error('Web Crypto API is not available. Please use HTTPS or the hash input method instead.');
    }
    throw error;
  }
}

