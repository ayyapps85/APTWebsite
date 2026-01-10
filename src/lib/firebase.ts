import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBzApJ5dWbMv1Df-f_o5P-Ci7R1n8u_SFs",
  authDomain: "atlantaparaiteam-1d660.firebaseapp.com",
  projectId: "atlantaparaiteam-1d660",
  storageBucket: "atlantaparaiteam-1d660.firebasestorage.app",
  messagingSenderId: "346334408700",
  appId: "1:346334408700:web:69b710ecda69f4cbc44c79"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Google provider with custom parameters for Sheets access
googleProvider.setCustomParameters({
  'access_type': 'offline',
  'prompt': 'consent'
});

// Add Google Sheets scope for OAuth
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');