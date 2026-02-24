export interface Patch {
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
    size: number;
    mimetype: string;
  };
  fileType: 'exe' | 'msi' | 'msu' | 'cab' | 'def';
  patchType: 'security' | 'feature' | 'bugfix' | 'driver' | 'update' | 'other';
  version?: string;
  targetOs: string[];
  architecture: 'x86' | 'x64' | 'arm64' | 'all';
  status: 'processing' | 'ready' | 'error';
  processingProgress: number;
  downloads: number;
  views: number;
  likes: number;
  likedBy: string[];
  isLiked?: boolean;
  category: 'security' | 'system' | 'application' | 'driver' | 'other';
  tags: string[];
  isPublic: boolean;
  sha256Hash?: string;
  virusScanStatus: 'pending' | 'safe' | 'warning' | 'threat';
  virusScanResult?: {
    scanner: string;
    scanTime: string;
    threats: string[];
    details: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PatchUploadData {
  title: string;
  description: string;
  category: string;
  tags: string;
  patchType: string;
  version?: string;
  targetOs: string[];
  architecture: string;
}

export interface PatchesResponse {
  patches: Patch[];
  pagination: {
    current: number;
    pages: number;
    total: number;
  };
}

export interface PatchResponse {
  patch: Patch;
}

export interface PatchVerificationData {
  patchId: string;
  title: string;
  verified: boolean;
  providedHash: string;
  storedHash: string;
  message: string;
  verifiedAt: string;
}

export interface PatchHashData {
  patchId: string;
  title: string;
  sha256Hash: string;
  uploadedAt: string;
}
