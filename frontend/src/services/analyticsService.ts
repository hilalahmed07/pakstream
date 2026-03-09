import { API_BASE_URL } from '../config/api';

export interface AnalyticsPlatform {
  totalUsers: number;
  totalVideos: number;
  totalDocuments: number;
  totalPresentations: number;
  totalPatches: number;
  totalContent: number;
  totalViews: number;
}

export interface AnalyticsActiveUsers {
  dau: number;
  mau: number;
}

export interface TopContentItem {
  _id: string;
  title: string;
  views: number;
  likes: number;
  uploadedBy?: { _id: string; username: string };
  createdAt: string;
}

export interface TopUserItem {
  _id: string;
  username: string;
  email: string;
  uploadCount: number;
  totalViews: number;
  totalLikes: number;
}

export interface AnalyticsSummary {
  platform: AnalyticsPlatform;
  activeUsers: AnalyticsActiveUsers;
  topVideos: TopContentItem[];
  topDocuments: TopContentItem[];
  topPresentations: TopContentItem[];
  topPatches: TopContentItem[];
  topUsers: TopUserItem[];
}

class AnalyticsService {
  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  private async request<T>(endpoint: string): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = this.getToken();

    const response = await fetch(url, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch analytics');
    }

    return data;
  }

  async getSummary(): Promise<{ success: boolean; data: AnalyticsSummary }> {
    return this.request<{ success: boolean; data: AnalyticsSummary }>('/analytics/summary');
  }
}

const analyticsService = new AnalyticsService();
export default analyticsService;
