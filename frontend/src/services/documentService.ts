import { Document, DocumentUploadData, DocumentsResponse, DocumentResponse } from '../types/document';
import { API_BASE_URL, getBaseUrl } from '../config/api';

class DocumentService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem('token');

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('DocumentService API request failed:', error);
      throw error;
    }
  }

  async getDocuments(params: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
  } = {}): Promise<DocumentsResponse> {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.category) queryParams.append('category', params.category);
    if (params.search) queryParams.append('search', params.search);

    const queryString = queryParams.toString();
    const endpoint = `/documents${queryString ? `?${queryString}` : ''}`;
    
    return this.request<DocumentsResponse>(endpoint);
  }

  async getDocumentById(id: string): Promise<DocumentResponse> {
    return this.request<DocumentResponse>(`/documents/${id}`);
  }

  async uploadDocument(
    file: File, 
    uploadData: DocumentUploadData,
    onProgress?: (progress: number) => void
  ): Promise<{ message: string; document: any }> {
    return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('title', uploadData.title);
    formData.append('description', uploadData.description);
    formData.append('category', uploadData.category);
    formData.append('tags', uploadData.tags);

      const xhr = new XMLHttpRequest();
      const url = `${API_BASE_URL}/documents/upload`;
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

  async getAdminDocuments(): Promise<{ documents: Document[] }> {
    return this.request<{ documents: Document[] }>('/documents/admin/all');
  }

  async updateDocument(id: string, data: Partial<DocumentUploadData>): Promise<DocumentResponse> {
    return this.request<DocumentResponse>(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDocument(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/documents/${id}`, {
      method: 'DELETE',
    });
  }

  getDocumentFileUrl(id: string): string {
    const baseUrl = getBaseUrl();
    return `${baseUrl}/api/documents/${id}/file`;
  }

  getDocumentDownloadUrl(id: string): string {
    const baseUrl = getBaseUrl();
    return `${baseUrl}/api/documents/${id}/file?download=true`;
  }

  getThumbnailUrl(id: string): string {
    const baseUrl = getBaseUrl();
    return `${baseUrl}/api/documents/${id}/thumbnail`;
  }

  /**
   * Get document hash for manual verification
   * @param documentId - Document ID
   * @returns Document hash information
   */
  async getDocumentHash(documentId: string): Promise<{
    success: boolean;
    data: {
      documentId: string;
      title: string;
      sha256Hash: string;
      uploadedAt: string;
    };
  }> {
    return this.request<{
      success: boolean;
      data: {
        documentId: string;
        title: string;
        sha256Hash: string;
        uploadedAt: string;
      };
    }>(`/documents/${documentId}/hash`);
  }

  /**
   * Verify document integrity by providing a hash or file
   * @param documentId - Document ID
   * @param hash - Hash string to verify (optional if file is provided)
   * @param file - File to verify (optional if hash is provided)
   * @returns Verification result
   */
  async verifyDocumentIntegrity(
    documentId: string,
    hash?: string,
    file?: File
  ): Promise<{
    success: boolean;
    data: {
      documentId: string;
      title: string;
      verified: boolean;
      providedHash: string;
      storedHash: string;
      message: string;
      verifiedAt: string;
    };
  }> {
    const url = `${API_BASE_URL}/documents/${documentId}/verify`;
    const token = localStorage.getItem('token');

    if (file) {
      // Upload file for server-side hash calculation
      const formData = new FormData();
      formData.append('document', file);

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
          documentId: string;
          title: string;
          verified: boolean;
          providedHash: string;
          storedHash: string;
          message: string;
          verifiedAt: string;
        };
      }>(`/documents/${documentId}/verify`, {
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
   * Track document view
   * @param documentId - Document ID
   */
  async trackView(documentId: string): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/documents/${documentId}/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }).catch(err => {
        console.warn('Failed to track document view:', err);
      });
    } catch (error) {
      console.warn('Failed to track document view:', error);
    }
  }

  /**
   * Toggle document like
   * @param documentId - Document ID
   * @param action - 'like' or 'unlike'
   * @returns Updated likes count and isLiked status
   */
  async toggleLike(documentId: string, action: 'like' | 'unlike'): Promise<{ likes: number; isLiked: boolean }> {
    try {
      const response = await this.request<{
        success: boolean;
        data: { documentId: string; likes: number; isLiked: boolean };
      }>(`/documents/${documentId}/like`, {
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
}

const documentService = new DocumentService();
export default documentService;

