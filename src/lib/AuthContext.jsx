import React, { createContext, useState, useContext, useEffect } from 'react';
import { apiClient } from '@/api/backendClient';

const AuthContext = createContext(null);

const authFallback = {
  user: null,
  isAuthenticated: false,
  isLoadingAuth: true,
  isLoadingPublicSettings: false,
  authError: null,
  appPublicSettings: null,
  authChecked: false,
  logout: () => {},
  navigateToLogin: () => {},
  checkUserAuth: async () => {},
  checkAppState: async () => {},
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    setAuthError(null);
    await checkUserAuth();
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await apiClient.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      // Clear stale auth cookies to prevent redirect loops
      if (error.status === 401 || error.status === 403) {
        apiClient.auth.logout();
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    apiClient.auth.logout();
    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  // Safe redirect — never loops if already on /login
  const navigateToLogin = () => {
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  return context || authFallback;
};