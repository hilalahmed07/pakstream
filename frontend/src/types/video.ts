export interface Video {
  _id: string;
  title: string;
  description: string;
  uploadedBy: {
    _id: string;
    username: string;
    email: string;
  };
  originalFile: {
    filename: string;
    path: string;
    size: number;
    mimetype: string;
    duration: number;
  };
  processedFiles: {
    hls: {
      masterPlaylist: string;
      segments: string[];
      variants: VideoVariant[];
    };
    thumbnails: string[];
    poster: string;
  };
  status: 'uploading' | 'processing' | 'ready' | 'error' | 'failed';
  processingProgress: number;
  processingError?: string;
  duration: number;
  resolution: string;
  fileSize: number;
  views: number;
  likes: number;
  dislikes: number;
  tags: string[];
  category: 'movie' | 'tv-show' | 'documentary' | 'short-film' | 'other';
  isPublic: boolean;
  isFeatured: boolean;
  isForPremiere?: boolean;
  sha256Hash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VideoVariant {
  resolution: string;
  bitrate: number;
  playlist: string;
  segments: string[];
}

export interface VideoUploadData {
  title: string;
  description: string;
  category: string;
  tags: string;
  isForPremiere?: boolean;
}

export interface VideoResponse {
  success: boolean;
  message: string;
  data: {
    video: Video;
  };
}

export interface VideosResponse {
  success: boolean;
  data: {
    videos: Video[];
    pagination: {
      current: number;
      pages: number;
      total: number;
    };
  };
}

export interface VideoStatus {
  status: string;
  progress: number;
  error?: string;
}
