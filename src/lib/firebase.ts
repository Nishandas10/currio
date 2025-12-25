import { initializeApp, getApps, getApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function assertFirebaseConfig() {
  const required: Array<keyof typeof firebaseConfig> = [
    "apiKey",
    "authDomain",
    "projectId",
    "appId",
  ];
  const missing = required.filter((k) => !firebaseConfig[k]);
  if (missing.length) {
    throw new Error(
      `Missing Firebase env vars: ${missing
        .map((k) => `NEXT_PUBLIC_FIREBASE_${k.toUpperCase()}`)
        .join(", ")}`
    );
  }
}

export const firebaseApp = (() => {
  assertFirebaseConfig();
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
})();

export const firebaseAuth = (() => {
  const auth = getAuth(firebaseApp);
  // Ensure persistence is set on the client.
  // If this runs during SSR by accident, it will throw; keep module client-only usage.
  if (typeof window !== "undefined") {
    void setPersistence(auth, browserLocalPersistence);
  }
  return auth;
})();
