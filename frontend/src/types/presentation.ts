export interface Presentation {
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
  slides: PresentationSlide[];
  totalSlides: number;
  duration: number;
  views: number;
  likes: number;
  isLiked?: boolean;
  category: 'business' | 'education' | 'marketing' | 'technology' | 'design' | 'other';
  tags: string[];
  isPublic: boolean;
  thumbnail: string;
  sha256Hash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PresentationSlide {
  slideNumber: number;
  imagePath: string;
  thumbnailPath: string;
  type?: 'html' | 'image'; // Added type property for HTML vs image slides
  notes?: string;
}

export interface CreatePresentationData {
  title: string;
  description: string;
  category: string;
  tags: string[];
}

export interface PresentationResponse {
  presentations: Presentation[];
  pagination: {
    current: number;
    pages: number;
    total: number;
  };
}

export interface SinglePresentationResponse {
  presentation: Presentation;
}

export interface SlidesResponse {
  slides: PresentationSlide[];
}
