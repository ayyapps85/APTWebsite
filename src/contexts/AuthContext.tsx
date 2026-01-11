'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { isUserAuthorized } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  isAuthorized: boolean;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      console.log('Attempting Google sign-in...');
      const result = await signInWithPopup(auth, googleProvider);
      console.log('Sign-in successful:', result.user.email);
    } catch (error: any) {
      console.error('Sign in error:', error);
      alert(`Sign-in failed: ${error.message}`);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      // Clear Google Sheets token when logging out
      const { GoogleOAuthService } = await import('@/lib/google-oauth');
      GoogleOAuthService.revokeToken();
      // Redirect to home page after logout with proper base path
      const basePath = process.env.NODE_ENV === 'production' ? '/APTWebsite' : '';
      window.location.href = basePath + '/';
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const getAccessToken = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      // Get the Firebase ID token first
      const idToken = await user.getIdToken();
      
      // For Google Sheets API, we need the OAuth access token
      // This requires the user to have signed in with the proper scopes
      const credential = await user.getIdTokenResult();
      
      // Check if we have the access token in the credential
      if (credential.claims.firebase && credential.claims.firebase.sign_in_provider === 'google.com') {
        // Return the ID token for now - Firebase handles the OAuth flow
        return idToken;
      }
      
      return idToken;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  };

  const isAuthorized = isUserAuthorized(user?.email || null);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signInWithGoogle,
      logout,
      isAuthorized,
      getAccessToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};