import type { Course } from "@/lib/schema";
import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  getDoc,
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
  const patch: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  const prefix = `courseData.modules.${params.moduleIndex}.sections.${params.sectionIndex}`;

  if (typeof params.imageUrl === "string")
    patch[`${prefix}.imageUrl`] = params.imageUrl;
  if (typeof params.audioUrl === "string")
    patch[`${prefix}.audioUrl`] = params.audioUrl;
  if (typeof params.duration === "number")
    patch[`${prefix}.duration`] = params.duration;

  if (Object.keys(patch).length <= 1) return;

  const ref = doc(firebaseDb, "courses", params.courseId);
  await updateDoc(ref, patch);
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
