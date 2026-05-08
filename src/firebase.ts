import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// CẤU HÌNH TRONG FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyB4nWM-RSRRqQWyK3OjZ25BM-uQ3AHC3qc",
  authDomain: "digital-office-72b63.firebaseapp.com",
  projectId: "digital-office-72b63",
  storageBucket: "digital-office-72b63.firebasestorage.app",
  messagingSenderId: "278098607984",
  appId: "1:278098607984:web:740d3435efabb9fc2d59b5",
  measurementId: "G-VYBB10PDMW"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();