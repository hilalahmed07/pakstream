import {
  Patch,
  PatchUploadData,
  PatchesResponse,
  PatchResponse,
  PatchVerificationData,
  PatchHashData
} from '../types/patch';
import { API_BASE_URL, getBaseUrl } from '../config/api';

class PatchService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem('token');

    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    try {
      console.log(`[PatchService] ${options.method || 'GET'} ${endpoint}`, options.body ? JSON.parse(options.body as string) : '');
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        console.error(`[PatchService] Error response (${response.status}):`, data);
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('PatchService API request failed:', error);
      throw error;
    }
  }

  async getPatches(params: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    fileType?: string;
    patchType?: string;
    targetOs?: string;
    architecture?: string;
  } = {}): Promise<PatchesResponse> {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.category) queryParams.append('category', params.category);
    if (params.search) queryParams.append('search', params.search);
    if (params.fileType) queryParams.append('fileType', params.fileType);
    if (params.patchType) queryParams.append('patchType', params.patchType);
    if (params.targetOs) queryParams.append('targetOs', params.targetOs);
    if (params.architecture) queryParams.append('architecture', params.architecture);

    const queryString = queryParams.toString();
    const endpoint = `/patches${queryString ? `?${queryString}` : ''}`;

    return this.request<PatchesResponse>(endpoint);
  }

  async getPatchById(id: string): Promise<PatchResponse> {
    return this.request<PatchResponse>(`/patches/${id}`);
  }

  async uploadPatch(
    file: File,
    uploadData: PatchUploadData,
    onProgress?: (progress: number) => void
  ): Promise<{ message: string; patch: any }> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('patch', file);
      formData.append('title', uploadData.title);
      formData.append('description', uploadData.description);
      formData.append('category', uploadData.category);
      formData.append('tags', uploadData.tags);
      formData.append('patchType', uploadData.patchType);
      if (uploadData.version) {
        formData.append('version', uploadData.version);
      }
      formData.append('targetOs', uploadData.targetOs.join(','));
      formData.append('architecture', uploadData.architecture);

      const xhr = new XMLHttpRequest();
      const url = `${API_BASE_URL}/patches/upload`;
      const token = localStorage.getItem('token');

      // Track upload progress
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress(Math.min(100, Math.max(0, percentComplete)));
        }
      };

      // Handle completion
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (onProgress) {
              onProgress(100);
            }
            resolve(data);
          } catch (error) {
            reject(new Error('Failed to parse response'));
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(new Error(errorData.message || `Upload failed with status ${xhr.status}`));
          } catch (error) {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };

      // Handle errors
      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };

      // Handle abort
      xhr.onabort = () => {
        reject(new Error('Upload was cancelled'));
      };

      // Open and send request
      xhr.open('POST', url);

      // Set authorization header if token exists
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      // Send request
      xhr.send(formData);
    });
  }

  async getAdminPatches(params?: {
    page?: number;
    limit?: number;
    category?: string;
    status?: string;
    patchType?: string;
    search?: string;
  }): Promise<{ patches: Patch[]; pagination: { current: number; pages: number; total: number } }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.category) queryParams.append('category', params.category);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.patchType) queryParams.append('patchType', params.patchType);
    if (params?.search) queryParams.append('search', params.search);
    const queryString = queryParams.toString();
    return this.request<{ patches: Patch[]; pagination: { current: number; pages: number; total: number } }>(
      `/patches/admin/all${queryString ? `?${queryString}` : ''}`
    );
  }

  async updatePatch(id: string, data: Partial<PatchUploadData>): Promise<PatchResponse> {
    return this.request<PatchResponse>(`/patches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePatch(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/patches/${id}`, {
      method: 'DELETE',
    });
  }

  getPatchFileUrl(id: string): string {
    const baseUrl = getBaseUrl();
    return `${baseUrl}/api/patches/${id}/file`;
  }

  getPatchDownloadUrl(id: string): string {
    return `${API_BASE_URL}/patches/${id}/file?download=true`;
  }

  /**
   * Get patch hash for manual verification
   * @param patchId - Patch ID
   * @returns Patch hash information
   */
  async getPatchHash(patchId: string): Promise<{
    success: boolean;
    data: PatchHashData;
  }> {
    return this.request<{
      success: boolean;
      data: PatchHashData;
    }>(`/patches/${patchId}/hash`);
  }

  /**
   * Verify patch integrity by providing a hash or file
   * @param patchId - Patch ID
   * @param hash - Hash string to verify (optional if file is provided)
   * @param file - File to verify (optional if hash is provided)
   * @returns Verification result
   */
  async verifyPatchIntegrity(
    patchId: string,
    hash?: string,
    file?: File
  ): Promise<{
    success: boolean;
    data: PatchVerificationData;
  }> {
    const url = `${API_BASE_URL}/patches/${patchId}/verify`;
    const token = localStorage.getItem('token');

    if (file) {
      // Upload file for server-side hash calculation
      const formData = new FormData();
      formData.append('patch', file);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Verification failed');
      }

      return data;
    } else if (hash) {
      // Send hash string for verification
      return this.request<{
        success: boolean;
        data: PatchVerificationData;
      }>(`/patches/${patchId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hash }),
      });
    } else {
      throw new Error('Either hash or file must be provided');
    }
  }

  /**
   * Track patch download
   * @param patchId - Patch ID
   */
  async trackDownload(patchId: string): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/patches/${patchId}/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      }).catch(err => {
        console.warn('Failed to track patch download:', err);
      });
    } catch (error) {
      console.warn('Failed to track patch download:', error);
    }
  }

  /**
   * Track patch view
   * @param patchId - Patch ID
   */
  async trackView(patchId: string): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/patches/${patchId}/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }).catch(err => {
        console.warn('Failed to track patch view:', err);
      });
    } catch (error) {
      console.warn('Failed to track patch view:', error);
    }
  }

  /**
   * Toggle patch like
   * @param patchId - Patch ID
   * @param action - 'like' or 'unlike'
   * @returns Updated likes count and isLiked status
   */
  async toggleLike(patchId: string, action: 'like' | 'unlike'): Promise<{ likes: number; isLiked: boolean }> {
    try {
      const response = await this.request<{
        success: boolean;
        data: { patchId: string; likes: number; isLiked: boolean };
      }>(`/patches/${patchId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });
      return {
        likes: response.data.likes,
        isLiked: response.data.isLiked
      };
    } catch (error) {
      console.error('Failed to toggle like:', error);
      throw error;
    }
  }

  /**
   * Get users who liked a patch
   * @param patchId - Patch ID
   * @returns List of users who liked the patch
   */
  async getLikedByUsers(patchId: string): Promise<{
    patchId: string;
    totalLikes: number;
    likedBy: Array<{
      _id: string;
      username: string;
      email: string;
      profile?: {
        firstName?: string;
        lastName?: string;
        avatar?: string;
      };
    }>;
  }> {
    try {
      const response = await this.request<{
        success: boolean;
        data: {
          patchId: string;
          totalLikes: number;
          likedBy: Array<{
            _id: string;
            username: string;
            email: string;
            profile?: {
              firstName?: string;
              lastName?: string;
              avatar?: string;
            };
          }>;
        };
      }>(`/patches/${patchId}/likedby`);
      return response.data;
    } catch (error) {
      console.error('Failed to get liked by users:', error);
      throw error;
    }
  }

  /**
   * Download patch file
   * @param patchId - Patch ID
   * @returns Promise that resolves when download starts
   */
  async downloadPatch(patchId: string): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required to download patches');
      }

      const patchResponse = await this.getPatchById(patchId);
      const patch = patchResponse.patch;

      const url = this.getPatchDownloadUrl(patchId);
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          typeof errorData.message === 'string' ? errorData.message : 'Failed to download patch file'
        );
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = patch.originalFile.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Failed to download patch:', error);
      throw error;
    }
  }
}

const patchService = new PatchService();
export default patchService;
