declare global {
  interface Window {
    google: any;
  }
}

export class GoogleOAuthService {
  private static CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
  private static SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
  private static tokenClient: any = null;
  private static accessToken: string | null = null;
  private static isAuthenticating: boolean = false;

  static async initialize() {
    // Check if we're returning from OAuth redirect
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      if (accessToken) {
        this.accessToken = accessToken;
        localStorage.setItem('google_access_token', accessToken);
        // Clean up the URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
    
    // Try to restore token from localStorage
    if (typeof window !== 'undefined') {
      this.accessToken = this.accessToken || localStorage.getItem('google_access_token');
    }
    
    return new Promise<void>((resolve) => {
      if (window.google?.accounts) {
        this.setupTokenClient();
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        this.setupTokenClient();
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  private static setupTokenClient() {
    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: this.CLIENT_ID,
      scope: this.SCOPES,
      callback: (response: any) => {
        if (response.access_token) {
          this.accessToken = response.access_token;
          // Store token in localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('google_access_token', response.access_token);
          }
        }
      },
    });
  }

  static async getAccessToken(): Promise<string | null> {
    // First check if we have a valid token in memory or localStorage
    if (this.accessToken) {
      return this.accessToken;
    }
    
    // Try to restore from localStorage
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('google_access_token');
      if (storedToken) {
        this.accessToken = storedToken;
        return storedToken;
      }
    }

    // Prevent multiple simultaneous authentication attempts
    if (this.isAuthenticating) {
      return null;
    }

    // Ensure we're initialized first
    if (!this.tokenClient) {
      await this.initialize();
    }

    // No token found, need to request one
    return new Promise((resolve) => {
      if (!this.tokenClient) {
        alert('Google OAuth not properly initialized');
        resolve(null);
        return;
      }

      this.isAuthenticating = true;
      const originalCallback = this.tokenClient.callback;
      this.tokenClient.callback = (response: any) => {
        this.isAuthenticating = false;
        if (response.access_token) {
          this.accessToken = response.access_token;
          // Store in localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('google_access_token', response.access_token);
          }
          resolve(response.access_token);
        } else {
          resolve(null);
        }
        this.tokenClient.callback = originalCallback;
      };

      const isMobileSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent);
      
      if (isMobileSafari) {
        // For mobile Safari, use redirect flow
        const basePath = process.env.NODE_ENV === 'production' ? '/APTWebsite' : '';
        const redirectUri = window.location.origin + basePath + '/';
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${this.CLIENT_ID}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `response_type=token&` +
          `scope=${encodeURIComponent(this.SCOPES)}&` +
          `prompt=consent`;
        
        window.location.href = authUrl;
        return;
      }
      
      this.tokenClient.requestAccessToken();
    });
  }

  static revokeToken() {
    if (this.accessToken) {
      window.google.accounts.oauth2.revoke(this.accessToken);
      this.accessToken = null;
      // Clear token from localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('google_access_token');
      }
    }
  }
}