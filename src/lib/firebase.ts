import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBrgdDgSBxB0Vp5usNH-NwfuO5g6Kwz7jc",
  authDomain: "chit-210c0.firebaseapp.com",
  projectId: "chit-210c0",
  storageBucket: "chit-210c0.firebasestorage.app",
  messagingSenderId: "50956020884",
  appId: "1:50956020884:web:411ee93601754649b99881",
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
