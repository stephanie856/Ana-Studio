// Firebase initialization
import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: "AIzaSyAYFKJ6taN44A8EFR4NFn-DOuM-hpmKYJo",
  authDomain: "ana-studio-600b7.firebaseapp.com",
  projectId: "ana-studio-600b7",
  storageBucket: "ana-studio-600b7.firebasestorage.app",
  messagingSenderId: "1009041324832",
  appId: "1:1009041324832:web:85a7614edf2abe5e8cf545",
  measurementId: "G-L06YJ12X5Z"
};

export const app = initializeApp(firebaseConfig);

// Initialize Analytics only in supported browser contexts
export let analytics: any = null;
if (typeof window !== 'undefined') {
  import('firebase/analytics').then(async ({ getAnalytics, isSupported }) => {
    try {
      if (await isSupported()) {
        analytics = getAnalytics(app);
      }
    } catch (e) {
      console.warn('Analytics not supported:', e);
    }
  });
}
