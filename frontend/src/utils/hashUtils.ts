/**
 * Calculate SHA-256 hash of a file in the browser
 * @param file - File object to calculate hash for
 * @returns Promise that resolves to the hexadecimal hash string (lowercase)
 */
export async function calculateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  
  // Convert ArrayBuffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex.toLowerCase();
}

