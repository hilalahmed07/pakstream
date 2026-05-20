import React, { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';
import authService from '../services/authService';
import { User, LoginCredentials, RegisterCredentials, AdminRegisterCredentials, AuthContextType } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const idleTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (authService.isAuthenticated()) {
          const token = authService.getToken();
          setToken(token);
          
          const response = await authService.getProfile();
          setUser(response.data.user);
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        authService.removeToken();
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authService.login(credentials);
      setUser(response.data.user);
      setToken(response.data.token);
      
      return response;
    } catch (error: any) {
      setError(error.message || 'Login failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authService.register(credentials);
      setUser(response.data.user);
      setToken(response.data.token);
      
      return response;
    } catch (error: any) {
      setError(error.message || 'Registration failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const registerAdmin = async (credentials: AdminRegisterCredentials) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authService.registerAdmin(credentials);
      setUser(response.data.user);
      setToken(response.data.token);
      
      return response;
    } catch (error: any) {
      setError(error.message || 'Admin registration failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Fire-and-forget the server logout so the user's sessionToken gets
    // rotated server-side (invalidating the JWT). The local state is torn
    // down immediately — we don't wait on the network round-trip.
    void authService.logout();
    authService.removeToken();
    setUser(null);
    setToken(null);
    setError(null);
  };

  useEffect(() => {
    const clearIdleTimeout = () => {
      if (idleTimeoutRef.current !== null) {
        window.clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
    };

    // Only enforce inactivity timeout for authenticated sessions.
    if (!user || !token) {
      clearIdleTimeout();
      return () => {
        clearIdleTimeout();
      };
    }

    const handleSessionTimeout = () => {
      logout();
      window.dispatchEvent(new Event('session-expired'));
    };

    const resetIdleTimer = () => {
      clearIdleTimeout();
      idleTimeoutRef.current = window.setTimeout(handleSessionTimeout, SESSION_TIMEOUT_MS);
    };

    const activityEvents: (keyof WindowEventMap)[] = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetIdleTimer, { passive: true });
    });

    resetIdleTimer();

    return () => {
      clearIdleTimeout();
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetIdleTimer);
      });
    };
  }, [user, token]);

  const updateProfile = async (profileData: Partial<User>) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authService.updateProfile(profileData);
      setUser(response.data.user);
    } catch (error: any) {
      setError(error.message || 'Profile update failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    loading,
    error,
    login,
    register,
    registerAdmin,
    logout,
    updateProfile
  };

  return React.createElement(AuthContext.Provider, { value }, children);
};
