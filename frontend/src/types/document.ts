export interface Document {
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
  };
  status: 'processing' | 'ready' | 'error';
  processingProgress: number;
  pageCount: number;
  views: number;
  likes: number;
  isLiked?: boolean;
  category: 'academic' | 'business' | 'legal' | 'technical' | 'other';
  tags: string[];
  isPublic: boolean;
  thumbnail: string | null;
  sha256Hash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentUploadData {
  title: string;
  description: string;
  category: string;
  tags: string;
}

export interface DocumentsResponse {
  documents: Document[];
  pagination: {
    current: number;
    pages: number;
    total: number;
  };
}

export interface DocumentResponse {
  document: Document;
}

