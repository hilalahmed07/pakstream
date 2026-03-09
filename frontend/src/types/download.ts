export type DownloadAssetType = 'video' | 'document' | 'presentation' | 'patch';

export interface DownloadUser {
  _id: string;
  username: string;
  email: string;
  profile?: {
    firstName?: string;
    lastName?: string;
  };
  organization?: string;
  contactNumber?: string;
  address?: string;
}

export interface DownloadAsset {
  _id: string;
  title: string;
  description?: string;
}

export interface Download {
  _id: string;
  user: DownloadUser;
  assetType: DownloadAssetType;
  asset: DownloadAsset | null;
  assetId: string;
  downloadedAt: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DownloadStats {
  totalDownloads: number;
  downloadsPerAsset: Array<{
    assetType: DownloadAssetType;
    assetId: string;
    assetTitle: string;
    downloadCount: number;
  }>;
  downloadsPerVideo: Array<{
    videoId: string;
    videoTitle: string;
    downloadCount: number;
  }>;
  downloadsPerUser: Array<{
    userId: string;
    username: string;
    email: string;
    downloadCount: number;
  }>;
  downloadsOverTime: Array<{
    date: string;
    count: number;
  }>;
}

export interface DownloadsResponse {
  success: boolean;
  data: {
    downloads: Download[];
    pagination: {
      current: number;
      pages: number;
      total: number;
      limit?: number;
    };
  };
}

export interface DownloadStatsResponse {
  success: boolean;
  data: DownloadStats;
}

