// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

// Your web app's Firebase configuration
// ⚠️ IMPORTANT: Replace this with your actual Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDU4XVdgYTPioXxLtem_takODuiVQBy9j8",
  authDomain: "jyothi-project-1.firebaseapp.com",
  projectId: "jyothi-project-1",
  storageBucket: "jyothi-project-1.firebasestorage.app",
  messagingSenderId: "609800507638",
  appId: "1:609800507638:web:dee1c3d89021df82cf5cd7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
