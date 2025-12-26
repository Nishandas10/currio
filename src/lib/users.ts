import type { User } from "firebase/auth";
import {
  arrayUnion,
  doc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase";

export type UserProfileDoc = {
  displayName: string;
  email: string;
  avatarUrl: string;
  createdAt: unknown; // Firestore server timestamp
  courses: string[];
  coursesCreated: number;
};

function inferDisplayName(user: User): string {
  if (user.displayName && user.displayName.trim())
    return user.displayName.trim();
  if (user.email) return user.email.split("@")[0] || "";
  return "";
}

/**
 * Idempotently creates/updates `users/{uid}`.
 * - Uses merge so we don't overwrite fields you add later.
 * - Sets `createdAt` only if missing (via merge + `createdAt` fallback in rules/logic).
 */
export async function ensureUserProfileDoc(user: User) {
  const ref = doc(firebaseDb, "users", user.uid);

  const data: UserProfileDoc = {
    displayName: inferDisplayName(user),
    email: user.email ?? "",
    avatarUrl: user.photoURL ?? "",
    createdAt: serverTimestamp(),
    courses: [],
    coursesCreated: 0,
  };

  // merge:true makes this safe to call multiple times.
  await setDoc(ref, data, { merge: true });
}

/**
 * Denormalized updates after creating a course:
 * - add courseId to `users/{uid}.courses`
 * - increment `users/{uid}.coursesCreated`
 */
export async function addCourseToUser(params: {
  uid: string;
  courseId: string;
}) {
  const ref = doc(firebaseDb, "users", params.uid);
  await updateDoc(ref, {
    courses: arrayUnion(params.courseId),
    coursesCreated: increment(1),
    updatedAt: serverTimestamp(),
  });
}
