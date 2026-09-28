import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGitHub: () => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    const token = localStorage.getItem('AUTH_TOKEN');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const profile = await api.getCurrentUser();
      setUser(profile);
    } catch (e) {
      console.warn('Failed to load user session:', e);
      localStorage.removeItem('AUTH_TOKEN');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Check if returning from GitHub OAuth redirect with token in hash
    const hash = window.location.hash;
    if (hash.includes('auth_token=')) {
      const match = hash.match(/auth_token=([^&]+)/);
      if (match && match[1]) {
        const token = match[1];
        localStorage.setItem('AUTH_TOKEN', token);
        // Clean URL hash without triggering full reload
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }

    refreshUser();
  }, []);

  const loginWithGitHub = async () => {
    try {
      const data = await api.getGitHubAuthUrl();
      if (data.configured && data.url) {
        window.location.href = data.url;
      } else {
        // Offer demo login or instructions if GITHUB_CLIENT_ID is not configured yet
        const useDemo = window.confirm(
          'GitHub OAuth is not configured in .env (GITHUB_CLIENT_ID missing).\n\n' +
          'Would you like to test the dashboard with Instant Demo Login instead?'
        );
        if (useDemo) {
          await loginDemo();
        }
      }
    } catch (e: any) {
      alert(`Error starting GitHub login: ${e.message}`);
    }
  };

  const loginDemo = async () => {
    try {
      setLoading(true);
      const res = await api.demoLogin();
      localStorage.setItem('AUTH_TOKEN', res.access_token);
      setUser(res.user);
    } catch (e: any) {
      alert(`Demo login failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('AUTH_TOKEN');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithGitHub,
        loginDemo,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
