import { UsersResponse, UserResponse, CreateUserData, UpdateUserData, UserSearchParams } from '../types/user';
import { API_BASE_URL } from '../config/api';

class UserService {
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
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
      console.error('UserService API request failed:', error);
      throw error;
    }
  }

  async getUsers(params: UserSearchParams = {}): Promise<UsersResponse> {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.role) queryParams.append('role', params.role);
    if (params.isActive !== undefined) queryParams.append('isActive', params.isActive);
    
    const queryString = queryParams.toString();
    const endpoint = `/users${queryString ? `?${queryString}` : ''}`;
    
    return this.request<UsersResponse>(endpoint);
  }

  async getUserById(userId: string): Promise<UserResponse> {
    return this.request<UserResponse>(`/users/${userId}`);
  }

  async createUser(userData: CreateUserData): Promise<UserResponse> {
    return this.request<UserResponse>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId: string, userData: UpdateUserData): Promise<UserResponse> {
    return this.request<UserResponse>(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async resetUserPassword(userId: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/users/${userId}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword }),
    });
  }

  async toggleUserStatus(userId: string): Promise<UserResponse> {
    return this.request<UserResponse>(`/users/${userId}/toggle-status`, {
      method: 'PUT',
    });
  }

  async deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/users/${userId}`, {
      method: 'DELETE',
    });
  }
}

const userService = new UserService();
export default userService;

