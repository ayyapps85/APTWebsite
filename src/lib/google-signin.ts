declare global {
  interface Window {
    google: any;
  }
}

export class GoogleSignInService {
  private static CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
  private static SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
  private static user: any = null;
  private static tokenClient: any = null;
  private static accessToken: string | null = null;

  static async initialize() {
    return new Promise<void>((resolve) => {
      if (window.google?.accounts) {
        this.setupSignIn();
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        this.setupSignIn();
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  private static setupSignIn() {
    // Setup ID token for user info
    window.google.accounts.id.initialize({
      client_id: this.CLIENT_ID,
      callback: this.handleCredentialResponse.bind(this),
    });
    
    // Setup OAuth token client for Sheets access
    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: this.CLIENT_ID,
      scope: this.SCOPES,
      callback: (response: any) => {
        if (response.access_token) {
          this.accessToken = response.access_token;
          localStorage.setItem('google_access_token', response.access_token);
        }
      },
    });
  }

  private static handleCredentialResponse(response: any) {
    // Decode JWT token
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    this.user = {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
    
    // Store user in localStorage
    localStorage.setItem('google_user', JSON.stringify(this.user));
    
    // Also request Sheets access
    if (this.tokenClient) {
      this.tokenClient.requestAccessToken();
    }
    
    // Trigger page reload to update auth state
    window.location.reload();
  }

  static async signIn() {
    if (!window.google?.accounts) {
      await this.initialize();
    }
    
    // Use renderButton instead of prompt for better Safari compatibility
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'google-signin-button';
    document.body.appendChild(buttonContainer);
    
    window.google.accounts.id.renderButton(
      buttonContainer,
      {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left'
      }
    );
    
    // Trigger click programmatically
    setTimeout(() => {
      const button = buttonContainer.querySelector('div[role="button"]') as HTMLElement;
      if (button) {
        button.click();
      }
    }, 100);
  }

  static signOut() {
    this.user = null;
    this.accessToken = null;
    localStorage.removeItem('google_user');
    localStorage.removeItem('google_access_token');
    window.google?.accounts.id.disableAutoSelect();
    window.location.reload();
  }

  static getCurrentUser() {
    if (this.user) return this.user;
    
    const stored = localStorage.getItem('google_user');
    if (stored) {
      this.user = JSON.parse(stored);
      return this.user;
    }
    
    return null;
  }

  static getAccessToken(): string | null {
    if (this.accessToken) return this.accessToken;
    
    // Try multiple storage keys
    const stored = localStorage.getItem('google_access_token') || localStorage.getItem('google_sheets_token');
    if (stored) {
      this.accessToken = stored;
      return stored;
    }
    
    return null;
  }
}