'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { GoogleSignInService } from '@/lib/google-signin';
import { isUserAuthorized } from '@/lib/auth';

interface User {
  email: string;
  name: string;
  picture: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  isAuthorized: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      await GoogleSignInService.initialize();
      const currentUser = GoogleSignInService.getCurrentUser();
      setUser(currentUser);
      setLoading(false);
    };
    
    initializeAuth();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await GoogleSignInService.signIn();
    } catch (error: any) {
      console.error('Sign in error:', error);
      alert(`Sign-in failed: ${error.message}`);
    }
  };

  const logout = async () => {
    try {
      GoogleSignInService.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const isAuthorized = isUserAuthorized(user?.email || null);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signInWithGoogle,
      logout,
      isAuthorized
    }}>
      {children}
    </AuthContext.Provider>
  );
};