import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCR1_K_R5FcPZsm0EN3Z5o9RWtS9Ro8fvo",
  authDomain: "statement-of-account-dd2fc.firebaseapp.com",
  projectId: "statement-of-account-dd2fc",
  storageBucket: "statement-of-account-dd2fc.firebasestorage.app",
  messagingSenderId: "513518376156",
  appId: "1:513518376156:web:7660c73e76b097c2fa9019",
  measurementId: "G-PJ16WY72VM"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);