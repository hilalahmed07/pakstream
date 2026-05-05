import { Presentation, CreatePresentationData, PresentationResponse, SinglePresentationResponse, SlidesResponse } from '../types/presentation';
import { API_BASE_URL, getBaseUrl } from '../config/api';

class PresentationService {
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
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('PresentationService API request failed:', error);
      throw error;
    }
  }

  downloadPresentation = async (id: string) => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required to download presentations');
    }

    const response = await fetch(`${API_BASE_URL}/presentations/${id}/download`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        typeof errorData.message === 'string' ? errorData.message : 'Failed to download presentation'
      );
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `presentation-${id}.pptx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };


  async getPresentations(params: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
  } = {}): Promise<PresentationResponse> {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.category) queryParams.append('category', params.category);
    if (params.search) queryParams.append('search', params.search);

    const queryString = queryParams.toString();
    const endpoint = `/presentations${queryString ? `?${queryString}` : ''}`;

    return this.request<PresentationResponse>(endpoint);
  }

  async getPresentationById(id: string): Promise<SinglePresentationResponse> {
    return this.request<SinglePresentationResponse>(`/presentations/${id}`);
  }

  async getPresentationSlides(id: string): Promise<SlidesResponse> {
    return this.request<SlidesResponse>(`/presentations/${id}/slides`);
  }

  async uploadPresentation(
    formData: FormData,
    onProgress?: (progress: number) => void
  ): Promise<{ message: string; presentation: any }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${API_BASE_URL}/presentations/upload`;
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
            // Don't set to 100% here - let the component handle the transition
            // Upload phase is 0-90%, processing will be 90-100%
            if (onProgress) {
              onProgress(90); // Set to 90% when upload completes, processing will take it to 100%
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

  async getAdminPresentations(params?: {
    page?: number;
    limit?: number;
    category?: string;
    status?: string;
    search?: string;
  }): Promise<{ presentations: Presentation[]; pagination: { current: number; pages: number; total: number } }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.category) queryParams.append('category', params.category);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.search) queryParams.append('search', params.search);
    const queryString = queryParams.toString();
    return this.request<{ presentations: Presentation[]; pagination: { current: number; pages: number; total: number } }>(
      `/presentations/admin/all${queryString ? `?${queryString}` : ''}`
    );
  }

  async updatePresentation(id: string, data: Partial<CreatePresentationData>): Promise<SinglePresentationResponse> {
    return this.request<SinglePresentationResponse>(`/presentations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePresentation(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/presentations/${id}`, {
      method: 'DELETE',
    });
  }

  getImageUrl(presentationId: string, slideNumber: number): string {
    const baseUrl = getBaseUrl();
    return `${baseUrl}/uploads/presentations/processed/${presentationId}/slides/slide_${slideNumber}.jpg`;
  }

  getThumbnailUrl(presentationId: string): string {
    const baseUrl = getBaseUrl();
    return `${baseUrl}/uploads/presentations/processed/${presentationId}/thumbnail.jpg`;
  }

  getSlideThumbnailUrl(presentationId: string, slideNumber: number): string {
    const baseUrl = getBaseUrl();
    return `${baseUrl}/uploads/presentations/processed/${presentationId}/thumbnails/thumb_slide_${slideNumber}.jpg`;
  }

  /**
   * Get presentation hash for manual verification
   * @param presentationId - Presentation ID
   * @returns Presentation hash information
   */
  async getPresentationHash(presentationId: string): Promise<{
    success: boolean;
    data: {
      presentationId: string;
      title: string;
      sha256Hash: string;
      uploadedAt: string;
    };
  }> {
    return this.request<{
      success: boolean;
      data: {
        presentationId: string;
        title: string;
        sha256Hash: string;
        uploadedAt: string;
      };
    }>(`/presentations/${presentationId}/hash`);
  }

  /**
   * Verify presentation integrity by providing a hash or file
   * @param presentationId - Presentation ID
   * @param hash - Hash string to verify (optional if file is provided)
   * @param file - File to verify (optional if hash is provided)
   * @returns Verification result
   */
  async verifyPresentationIntegrity(
    presentationId: string,
    hash?: string,
    file?: File
  ): Promise<{
    success: boolean;
    data: {
      presentationId: string;
      title: string;
      verified: boolean;
      providedHash: string;
      storedHash: string;
      message: string;
      verifiedAt: string;
    };
  }> {
    const url = `${API_BASE_URL}/presentations/${presentationId}/verify`;
    const token = localStorage.getItem('token');

    if (file) {
      // Upload file for server-side hash calculation
      const formData = new FormData();
      formData.append('presentation', file);

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
        data: {
          presentationId: string;
          title: string;
          verified: boolean;
          providedHash: string;
          storedHash: string;
          message: string;
          verifiedAt: string;
        };
      }>(`/presentations/${presentationId}/verify`, {
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
   * Track presentation view
   * @param presentationId - Presentation ID
   */
  async trackView(presentationId: string): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/presentations/${presentationId}/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }).catch(err => {
        console.warn('Failed to track presentation view:', err);
      });
    } catch (error) {
      console.warn('Failed to track presentation view:', error);
    }
  }

  /**
   * Toggle presentation like
   * @param presentationId - Presentation ID
   * @param action - 'like' or 'unlike'
   * @returns Updated likes count and isLiked status
   */
  async toggleLike(presentationId: string, action: 'like' | 'unlike'): Promise<{ likes: number; isLiked: boolean }> {
    try {
      const response = await this.request<{
        success: boolean;
        data: { presentationId: string; likes: number; isLiked: boolean };
      }>(`/presentations/${presentationId}/like`, {
        method: 'POST',
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
   * Get users who liked a presentation
   * @param presentationId - Presentation ID
   * @returns List of users who liked the presentation
   */
  async getLikedByUsers(presentationId: string): Promise<{
    presentationId: string;
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
          presentationId: string;
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
      }>(`/presentations/${presentationId}/likedby`);
      return response.data;
    } catch (error) {
      console.error('Failed to get liked by users:', error);
      throw error;
    }
  }
}

const presentationService = new PresentationService();
export default presentationService;
