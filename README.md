# APT Instrument Status

A Next.js application for tracking musical instrument checkout status, now using Firebase for authentication and data storage, deployed on GitHub Pages.

## Features

- Google Sign-In authentication via Firebase
- Real-time instrument status tracking
- Member management system
- Responsive design with Tailwind CSS
- Static site deployment on GitHub Pages

## Setup Instructions

### 1. Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing one
3. Enable Authentication and select Google as sign-in provider
4. Enable Firestore Database
5. Get your Firebase config from Project Settings
6. Update `src/lib/firebase.ts` with your Firebase configuration:

```typescript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### 2. Firestore Database Setup

Create a collection called `instruments` with documents containing:
```json
{
  "name": "Instrument Name",
  "type": "Instrument Type",
  "image": "/images/filename.jpeg",
  "status": "available", // or "checked_out"
  "checkedOutBy": null, // or member name
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 3. GitHub Pages Deployment

1. Push your code to a GitHub repository
2. Go to repository Settings > Pages
3. Select "GitHub Actions" as source
4. The workflow will automatically deploy on push to main branch
5. Your site will be available at `https://yourusername.github.io/APTWebsite/`

### 4. Local Development

```bash
npm install
npm run dev
```

## Project Structure

- `src/lib/firebase.ts` - Firebase configuration
- `src/lib/firebase-service.ts` - Firestore operations
- `src/contexts/AuthContext.tsx` - Authentication context
- `src/components/InstrumentStatus.tsx` - Main component
- `src/data/` - Local data files (fallback)

The application now uses Firebase for all backend services and deploys as a static site on GitHub Pages.