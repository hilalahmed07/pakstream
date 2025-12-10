import { API_BASE_URL } from '../config/api';
import { DownloadsResponse, DownloadStatsResponse } from '../types/download';

class DownloadService {
  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  /**
   * Download video file
   * @param videoId - Video ID to download
   */
  async downloadVideo(videoId: string): Promise<void> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Authentication required to download videos');
    }

    try {
      // Create download URL
      const url = `${API_BASE_URL.replace('/api', '')}/api/videos/${videoId}/download`;
      
      // Fetch the video file
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to download video');
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `video_${videoId}.mp4`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Convert response to blob
      const blob = await response.blob();
      
      // Create download link and trigger download
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download error:', error);
      throw error;
    }
  }

  /**
   * Get download statistics (admin only)
   */
  async getDownloadStats(): Promise<DownloadStatsResponse> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/downloads/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get download statistics');
    }

    return response.json();
  }

  /**
   * Get all downloads with pagination and filtering (admin only)
   */
  async getAllDownloads(params: {
    page?: number;
    limit?: number;
    userId?: string;
    videoId?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<DownloadsResponse> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.userId) queryParams.append('userId', params.userId);
    if (params.videoId) queryParams.append('videoId', params.videoId);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    const queryString = queryParams.toString();
    const url = `${API_BASE_URL}/downloads${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get downloads');
    }

    return response.json();
  }

  /**
   * Get downloads by user (admin only)
   */
  async getUserDownloads(userId: string, page: number = 1, limit: number = 25): Promise<DownloadsResponse> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/downloads/user/${userId}?page=${page}&limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get user downloads');
    }

    return response.json();
  }

  /**
   * Get downloads by video (admin only)
   */
  async getVideoDownloads(videoId: string, page: number = 1, limit: number = 25): Promise<DownloadsResponse> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/downloads/video/${videoId}?page=${page}&limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get video downloads');
    }

    return response.json();
  }
}

const downloadService = new DownloadService();
export default downloadService;

