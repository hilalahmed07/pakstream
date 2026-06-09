export interface User {
  _id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  isActive: boolean;
  mustChangePassword?: boolean;
  profile: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
    bio?: string;
  };
  preferences: {
    theme: string;
    language: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
  organization?: string;
  dateOfEnrollment?: string;
  contactNumber?: string;
  address?: string;
}

export interface AdminRegisterCredentials {
  username: string;
  email: string;
  password: string;
  adminKey: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  register: (credentials: RegisterCredentials) => Promise<AuthResponse>;
  registerAdmin: (credentials: AdminRegisterCredentials) => Promise<AuthResponse>;
  logout: () => void;
  updateProfile: (profileData: Partial<User>) => Promise<void>;
  clearMustChangePassword: () => void;
}
