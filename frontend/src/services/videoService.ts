import { Video, VideoUploadData, VideoResponse, VideosResponse, VideoStatus } from '../types/video';
import { API_BASE_URL, getBaseUrl } from '../config/api';

class VideoService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
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
      console.error('API request failed:', error);
      throw error;
    }
  }

  async uploadVideo(
    videoFile: File,
    uploadData: VideoUploadData,
    onProgress?: (progress: number) => void
  ): Promise<VideoResponse> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('title', uploadData.title);
      formData.append('description', uploadData.description);
      formData.append('category', uploadData.category);
      formData.append('tags', uploadData.tags);
      if (uploadData.isForPremiere !== undefined) {
        formData.append('isForPremiere', uploadData.isForPremiere.toString());
      }

      const xhr = new XMLHttpRequest();
      const url = `${API_BASE_URL}/videos/upload`;
      const token = localStorage.getItem('token');

      let lastProgress = 0;
      let progressInterval: NodeJS.Timeout | null = null;

      // Track upload progress
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percentComplete = (e.loaded / e.total) * 100;
          const progress = Math.min(100, Math.max(0, percentComplete));
          lastProgress = progress;
          // Scale to 0-90% for upload phase
          onProgress(progress * 0.9);
        }
      };

      // Fallback for Chrome - force progress updates if no events for a while
      if (onProgress) {
        progressInterval = setInterval(() => {
          if (xhr.readyState < 4 && lastProgress < 90) {
            // If we haven't received progress in a while, increment slightly
            // This helps Chrome show progress even if events are delayed
            const estimatedProgress = Math.min(90, lastProgress + 0.5);
            onProgress(estimatedProgress * 0.9);
          }
        }, 500);
      }

      // Handle completion
      xhr.onload = () => {
        if (progressInterval) {
          clearInterval(progressInterval);
        }

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
        if (progressInterval) {
          clearInterval(progressInterval);
        }
        reject(new Error('Network error during upload'));
      };

      // Handle abort
      xhr.onabort = () => {
        if (progressInterval) {
          clearInterval(progressInterval);
        }
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

  async getVideos(params: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<VideosResponse> {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.category) queryParams.append('category', params.category);
    if (params.search) queryParams.append('search', params.search);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    const queryString = queryParams.toString();
    const endpoint = queryString ? `/videos?${queryString}` : '/videos';

    return this.request<VideosResponse>(endpoint);
  }

  async getFeaturedVideos(limit: number = 1): Promise<VideosResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append('limit', limit.toString());

    return this.request<VideosResponse>(`/videos/featured/list?${queryParams.toString()}`);
  }

  async getVideo(id: string): Promise<VideoResponse> {
    return this.request<VideoResponse>(`/videos/${id}`);
  }

  async updateVideo(id: string, updates: Partial<Video>): Promise<VideoResponse> {
    return this.request<VideoResponse>(`/videos/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
  }

  async deleteVideo(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/videos/${id}`, {
      method: 'DELETE',
    });
  }

  async getVideoStatus(id: string): Promise<{ success: boolean; data: VideoStatus }> {
    return this.request<{ success: boolean; data: VideoStatus }>(`/videos/${id}/status`);
  }

  async getAdminVideos(params: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    status?: string;
  } = {}): Promise<VideosResponse> {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.category) queryParams.append('category', params.category);
    if (params.search) queryParams.append('search', params.search);
    if (params.status) queryParams.append('status', params.status);

    const queryString = queryParams.toString();
    const endpoint = `/videos/admin/all${queryString ? `?${queryString}` : ''}`;

    return this.request<VideosResponse>(endpoint);
  }

  getVideoUrl(video: Video, quality: string = '360p'): string {
    if (video.status !== 'ready' || !video.processedFiles?.hls) {
      return '';
    }

    const variant = video.processedFiles.hls.variants.find(v => v.resolution === quality);
    if (!variant) {
      return '';
    }

    const baseUrl = getBaseUrl();
    return `${baseUrl}/uploads/videos/processed/${video._id}/hls/${variant.playlist}`;
  }

  getMasterPlaylistUrl(video: Video): string {
    if (video.status !== 'ready' || !video.processedFiles?.hls?.masterPlaylist) {
      return '';
    }

    const baseUrl = getBaseUrl();
    return `${baseUrl}/uploads/videos/processed/${video._id}/hls/${video.processedFiles.hls.masterPlaylist}`;
  }

  getThumbnailUrl(video: Video, index: number = 0): string {
    if (!video.processedFiles?.thumbnails || !video.processedFiles.thumbnails[index]) {
      return '';
    }

    const baseUrl = getBaseUrl();
    return `${baseUrl}/uploads/videos/processed/${video._id}/hls/${video.processedFiles.thumbnails[index]}`;
  }

  getPosterUrl(video: Video): string {
    if (!video.processedFiles?.poster) {
      return this.getThumbnailUrl(video, 0);
    }

    const baseUrl = getBaseUrl();
    return `${baseUrl}/uploads/videos/processed/${video._id}/hls/${video.processedFiles.poster}`;
  }

  getOriginalVideoUrl(video: Video): string {
    if (!video.originalFile?.path) {
      return '';
    }

    return `${API_BASE_URL}/videos/${video._id}/original`;
  }

  /**
   * Track video view (only once per session)
   * @param videoId - Video ID
   */
  async trackVideoView(videoId: string): Promise<void> {
    try {
      // Make POST request to track view (no auth needed, public endpoint)
      await fetch(`${API_BASE_URL}/videos/${videoId}/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }).catch(err => {
        // Silently handle errors - don't interrupt video playback
        console.warn('Failed to track video view:', err);
      });
    } catch (error) {
      // Silently handle errors - don't interrupt video playback
      console.warn('Failed to track video view:', error);
    }
  }

  /**
   * Toggle video like
   * @param videoId - Video ID
   * @param action - 'like' or 'unlike'
   * @returns Updated likes count and isLiked status
   */
  async toggleLike(videoId: string, action: 'like' | 'unlike'): Promise<{ likes: number; isLiked: boolean }> {
    const response = await this.request<{
      success: boolean;
      data: { videoId: string; likes: number; isLiked: boolean };
    }>(`/videos/${videoId}/like`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });

    return {
      likes: response.data.likes,
      isLiked: response.data.isLiked
    };
  }

  /**
   * Get users who liked a video
   * @param videoId - Video ID
   * @returns List of users who liked the video
   */
  async getLikedByUsers(videoId: string): Promise<{
    videoId: string;
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
          videoId: string;
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
      }>(`/videos/${videoId}/likedby`);
      return response.data;
    } catch (error) {
      console.error('Failed to get liked by users:', error);
      throw error;
    }
  }

  /**
   * Get video hash for manual verification
   * @param videoId - Video ID
   * @returns Video hash information
   */
  async getVideoHash(videoId: string): Promise<{
    success: boolean;
    data: {
      videoId: string;
      title: string;
      sha256Hash: string;
      uploadedAt: string;
    };
  }> {
    return this.request<{
      success: boolean;
      data: {
        videoId: string;
        title: string;
        sha256Hash: string;
        uploadedAt: string;
      };
    }>(`/videos/${videoId}/hash`);
  }

  /**
   * Verify video integrity by uploading a file or providing a hash
   * @param videoId - Video ID
   * @param file - Optional video file to verify
   * @param hash - Optional hash string to verify
   * @returns Verification result
   */
  async verifyVideoIntegrity(
    videoId: string,
    file?: File,
    hash?: string
  ): Promise<{
    success: boolean;
    data: {
      videoId: string;
      title: string;
      verified: boolean;
      providedHash: string;
      storedHash: string;
      message: string;
      verifiedAt: string;
    };
  }> {
    if (file) {
      // Upload file for verification
      const formData = new FormData();
      formData.append('video', file);

      return this.request<{
        success: boolean;
        data: {
          videoId: string;
          title: string;
          verified: boolean;
          providedHash: string;
          storedHash: string;
          message: string;
          verifiedAt: string;
        };
      }>(`/videos/${videoId}/verify`, {
        method: 'POST',
        body: formData,
      });
    } else if (hash) {
      // Send hash string for verification
      return this.request<{
        success: boolean;
        data: {
          videoId: string;
          title: string;
          verified: boolean;
          providedHash: string;
          storedHash: string;
          message: string;
          verifiedAt: string;
        };
      }>(`/videos/${videoId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hash }),
      });
    } else {
      throw new Error('Either file or hash must be provided');
    }
  }
}

const videoService = new VideoService();
export default videoService;
