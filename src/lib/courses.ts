import type { Course } from "@/lib/schema";
import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase";

export type WebSource = {
  title?: string;
  url: string;
  snippet?: string;
  displayLink?: string;
};

export type FirestoreCourseDoc = {
  userId: string;
  title: string;
  prompt: string;
  slug: string;
  description: string;
  isPublic: boolean;
  /** Firebase Storage URL for course thumbnail. Stored at top-level to avoid collisions with chapter images. */
  courseThumbnail?: string;
  /** Web search sources used during generation. */
  sources?: WebSource[];
  courseData: Course; // Store the complete Course object
  createdAt: unknown; // server timestamp
  updatedAt: unknown; // server timestamp
};

export type FirestoreCoursePlaceholderDoc = {
  userId: string;
  prompt: string;
  title: string;
  slug: string;
  description: string;
  isPublic: boolean;
  courseThumbnail?: string;
  sources?: WebSource[];
  courseData: Course; // Empty placeholder
  status: "generating" | "ready";
  createdAt: unknown;
  updatedAt: unknown;
};

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

/**
 * Creates/updates `courses/{courseId}`.
 * This is client-side and relies on Firestore security rules for ownership.
 */
export async function createCourseDoc(params: {
  courseId: string;
  userId: string;
  prompt: string;
  course: Course;
  isPublic?: boolean;
  courseThumbnail?: string;
  sources?: WebSource[];
}) {
  const {
    courseId,
    userId,
    prompt,
    course,
    isPublic = false,
    courseThumbnail,
    sources,
  } = params;
  const title = course.courseTitle ?? "";
  const slug = `${slugify(title)}-${courseId}`;
  const description = course.courseDescription ?? "";

  const ref = doc(firebaseDb, "courses", courseId);
  const data: FirestoreCourseDoc = {
    userId,
    title,
    prompt,
    slug,
    description,
    isPublic,
    ...(courseThumbnail ? { courseThumbnail } : {}),
    ...(sources ? { sources } : {}),
    courseData: course,
    createdAt: serverTimestamp(), // This will overwrite on merge - might be OK
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, data, { merge: true });

  return { courseId, slug };
}

/**
 * Creates a placeholder `courses/{courseId}` document as soon as the ID exists.
 * This lets you navigate to `/course/{courseId}` immediately while streaming.
 */
export async function createCoursePlaceholderDoc(params: {
  courseId: string;
  userId: string;
  prompt: string;
  isPublic?: boolean;
  courseThumbnail?: string;
  sources?: WebSource[];
}) {
  const {
    courseId,
    userId,
    prompt,
    isPublic = false,
    courseThumbnail,
    sources,
  } = params;

  const ref = doc(firebaseDb, "courses", courseId);
  const data: FirestoreCoursePlaceholderDoc = {
    userId,
    prompt,
    title: "",
    slug: courseId,
    description: "",
    isPublic,
    ...(courseThumbnail ? { courseThumbnail } : {}),
    ...(sources ? { sources } : {}),
    courseData: {
      courseTitle: "Generating...",
      courseDescription: "Please wait",
      modules: [],
    },
    status: "generating",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, data, { merge: true });
}

export async function updateCourseThumbnail(params: {
  courseId: string;
  courseThumbnail: string;
}) {
  const ref = doc(firebaseDb, "courses", params.courseId);
  await updateDoc(ref, {
    courseThumbnail: params.courseThumbnail,
    updatedAt: serverTimestamp(),
  });
}

export async function updateCourseSources(params: {
  courseId: string;
  sources: WebSource[];
}) {
  const ref = doc(firebaseDb, "courses", params.courseId);
  await updateDoc(ref, {
    sources: params.sources,
    updatedAt: serverTimestamp(),
  });
}

export async function updateLessonAssetUrls(params: {
  courseId: string;
  moduleIndex: number;
  sectionIndex: number;
  imageUrl?: string;
  audioUrl?: string;
  duration?: number;
}) {
  const ref = doc(firebaseDb, "courses", params.courseId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const data = snap.data() as FirestoreCourseDoc;
  const courseData = data.courseData;

  if (!courseData || !courseData.modules) return;

  // Deep clone to avoid mutating state directly (though here we just read from Firestore)
  const modules = [...courseData.modules];
  const mod = { ...modules[params.moduleIndex] };

  if (!mod || !mod.sections) return;

  const sections = [...mod.sections];
  // Cast to any to allow adding runtime fields not in the Zod schema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const section = { ...sections[params.sectionIndex] } as any;

  if (!section) return;

  // Apply updates
  if (typeof params.imageUrl === "string") section.imageUrl = params.imageUrl;
  if (typeof params.audioUrl === "string") section.audioUrl = params.audioUrl;
  if (typeof params.duration === "number") section.duration = params.duration;

  // Reconstruct the tree
  sections[params.sectionIndex] = section;
  mod.sections = sections;
  modules[params.moduleIndex] = mod;

  // Update Firestore with the modified modules array
  await updateDoc(ref, {
    "courseData.modules": modules,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Fetches a course document from Firestore and converts it back to the Course schema.
 */
export async function getCourseDoc(
  courseId: string
): Promise<
  (Course & { courseThumbnail?: string; sources?: WebSource[] }) | null
> {
  const ref = doc(firebaseDb, "courses", courseId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const data = snap.data() as FirestoreCourseDoc;

  // Return courseData plus thumbnail and sources (stored at top-level metadata)
  return {
    ...data.courseData,
    ...(data.courseThumbnail ? { courseThumbnail: data.courseThumbnail } : {}),
    ...(data.sources ? { sources: data.sources } : {}),
  };
}

export async function updateCourseVisibility(
  courseId: string,
  isPublic: boolean
) {
  const ref = doc(firebaseDb, "courses", courseId);
  await updateDoc(ref, { isPublic });
}

export async function renameCourse(courseId: string, newTitle: string) {
  const ref = doc(firebaseDb, "courses", courseId);
  await updateDoc(ref, {
    title: newTitle,
    "courseData.courseTitle": newTitle,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCourse(courseId: string) {
  const ref = doc(firebaseDb, "courses", courseId);
  await deleteDoc(ref);
}

export async function getUserCourses(userId: string) {
  try {
    // Try with orderBy first (requires index)
    const q = query(
      collection(firebaseDb, "courses"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as (FirestoreCourseDoc & { id: string })[];
  } catch (e) {
    console.warn(
      "Index missing or query failed, falling back to client-side sort",
      e
    );
    // Fallback: fetch ALL courses for user to ensure we get the newest ones, then sort in memory.
    const q = query(
      collection(firebaseDb, "courses"),
      where("userId", "==", userId)
    );
    const snapshot = await getDocs(q);
    const courses = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as (FirestoreCourseDoc & { id: string })[];

    // Sort by createdAt desc
    return courses.sort((a, b) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getSeconds = (t: any) => {
        if (!t) return 0;
        if (typeof t.seconds === "number") return t.seconds;
        return 0;
      };
      const tA = getSeconds(a.createdAt);
      const tB = getSeconds(b.createdAt);
      return tB - tA;
    });
  }
}

export async function getUserRecentCourses(userId: string, limitCount = 10) {
  try {
    // Try with orderBy first (requires index)
    const q = query(
      collection(firebaseDb, "courses"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as (FirestoreCourseDoc & { id: string })[];
  } catch (e) {
    console.warn(
      "Index missing or query failed, falling back to client-side sort",
      e
    );
    // Fallback: fetch ALL courses for user to ensure we get the newest ones, then sort in memory.
    const q = query(
      collection(firebaseDb, "courses"),
      where("userId", "==", userId)
    );
    const snapshot = await getDocs(q);
    const courses = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as (FirestoreCourseDoc & { id: string })[];

    // Sort by createdAt desc
    return courses
      .sort((a, b) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getSeconds = (t: any) => {
          if (!t) return 0;
          if (typeof t.seconds === "number") return t.seconds;
          return 0;
        };
        const tA = getSeconds(a.createdAt);
        const tB = getSeconds(b.createdAt);
        return tB - tA;
      })
      .slice(0, limitCount);
  }
}
