import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: String(import.meta.env.VITE_FIREBASE_API_KEY ?? "").trim(),
  authDomain: String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "").trim(),
  projectId: String(import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "").trim(),
  storageBucket: String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "").trim(),
  messagingSenderId: String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "").trim(),
  appId: String(import.meta.env.VITE_FIREBASE_APP_ID ?? "").trim(),
  measurementId: String(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "").trim(),
};

const requiredConfig: Array<[string, string]> = [
  ["VITE_FIREBASE_API_KEY", firebaseConfig.apiKey],
  ["VITE_FIREBASE_AUTH_DOMAIN", firebaseConfig.authDomain],
  ["VITE_FIREBASE_PROJECT_ID", firebaseConfig.projectId],
  ["VITE_FIREBASE_APP_ID", firebaseConfig.appId],
];

export const firebaseMissingConfig = requiredConfig
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const firebaseConfigured = firebaseMissingConfig.length === 0;

const existingDefaultApp = getApps().find((app) => app.name === "[DEFAULT]");

export const firebaseApp = firebaseConfigured
  ? existingDefaultApp ?? initializeApp(firebaseConfig)
  : null;

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
