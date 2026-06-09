import { 
  AuthResponse, 
  LoginCredentials, 
  RegisterCredentials, 
  AdminRegisterCredentials,
  User 
} from '../types/auth';
import { API_BASE_URL } from '../config/api';

class AuthService {
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = this.getToken();
    
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
      console.error('API request failed:', error);
      throw error;
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    this.setToken(response.data.token);
    return response;
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    this.setToken(response.data.token);
    return response;
  }

  async registerAdmin(credentials: AdminRegisterCredentials): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/register-admin', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    this.setToken(response.data.token);
    return response;
  }

  async getProfile(): Promise<{ data: { user: User } }> {
    return this.request<{ data: { user: User } }>('/auth/profile');
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Server-side logout. Rotates the user's sessionToken so the current JWT
  // can never authenticate again — even if it was copied somewhere. Safe to
  // ignore failures (e.g. offline, token already invalid): we still remove
  // the local token on the client side either way.
  async logout(): Promise<void> {
    try {
      await this.request<{ success: boolean }>('/auth/logout', { method: 'POST' });
    } catch (error) {
      // Don't block client-side logout on a server hiccup.
      console.warn('Server logout failed (continuing with local logout):', error);
    }
  }

  async updateProfile(updates: Partial<User>): Promise<{ data: { user: User } }> {
    return this.request<{ data: { user: User } }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  setToken(token: string): void {
    localStorage.setItem('token', token);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  removeToken(): void {
    localStorage.removeItem('token');
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    return !!token;
  }
}

const authService = new AuthService();
export default authService;
