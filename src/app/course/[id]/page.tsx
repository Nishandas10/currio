"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CourseViewer from "@/components/CourseViewer";
import type { Course } from "@/lib/schema";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { courseSchema } from "@/lib/schema";
import { useAuth } from "@/contexts/AuthContext";
import {
  createCourseDoc,
  updateCourseThumbnail,
  updateCourseSources,
  createCoursePlaceholderDoc,
  type WebSource,
  type FirestoreCourseDoc,
} from "@/lib/courses";
import { addCourseToUser } from "@/lib/users";
import { uploadCourseImage } from "@/lib/storage";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase";

type PageProps = {
  params: Promise<{ id: string }>;
};

type CourseWithMetadata = Course & { 
  id?: string;
  courseThumbnail?: string;
  sources?: WebSource[];
};

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-"); // Replace multiple - with single -
}

function placeholderCourse(id: string): Course {
  return {
    courseTitle: "Generating…",
    courseDescription: "Please keep this tab open while your course is being created.",
    modules: [],
    ...(id ? ({ id } as unknown as object) : {}),
  } as Course;
}

export default function CoursePage({ params }: PageProps) {
  const { id: courseIdSlug } = React.use(params);
  const courseId = courseIdSlug.split("-").pop() ?? courseIdSlug;
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const prompt = searchParams.get("prompt");
  const { user, loading: authLoading } = useAuth();

  const [loadedCourse, setLoadedCourse] = useState<CourseWithMetadata | null>(null);
  const [uploadedCourseThumbnail, setUploadedCourseThumbnail] = useState<string | null>(null);
  const [webSources, setWebSources] = useState<WebSource[] | null>(null);
  const hasStartedRef = useRef(false);
  const imageStartedRef = useRef(false);

  // AI Generation Hook
  const { object, submit } = useObject({
    api: "/api/generate",
    schema: courseSchema,
    fetch: async (req, init) => {
      const headers = new Headers(init?.headers);
      if (user) headers.set("x-skip-redis", "1");
      // Pass the courseId so the server uses it (and returns it)
      headers.set("x-course-id", courseId);
      
      const response = await fetch(req, { ...init, headers });
      
      // Extract sources from response headers if available
      // We use x-sources-b64 to handle unicode characters safely in headers
      const sourcesHeader = response.headers.get("x-sources-b64");
      if (sourcesHeader && !webSources) {
        try {
          // Decode Base64 to UTF-8 string
          const binaryStr = atob(sourcesHeader);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const jsonStr = new TextDecoder().decode(bytes);
          const sources = JSON.parse(jsonStr) as WebSource[];
          
          setWebSources(sources);

          // Persist to Firestore immediately (for authenticated users)
          if (user && courseId) {
             // We don't await this to avoid blocking the stream processing
             updateCourseSources({ courseId, sources }).catch(e => 
               console.warn("Failed to persist initial sources:", e)
             );
          }
        } catch (e) {
          console.warn("Failed to parse sources from header:", e);
        }
      }
      
      return response;
    },
    onFinish: async ({ object }) => {
      if (object?.courseTitle) {
        if (user) {
          try {
            const { slug } = await createCourseDoc({
              courseId,
              userId: user.uid,
              prompt: prompt || "",
              course: object as Course,
              isPublic: false,
              ...(webSources ? { sources: webSources } : {}),
            });
            await addCourseToUser({ uid: user.uid, courseId });

            // Update URL to slug silently (without triggering a re-render/navigation)
            window.history.replaceState(null, "", `/course/${slug}`);
          } catch (e) {
            console.error("Failed to save course:", e);
          }
        } else {
          // Guest flow: Just update the URL for aesthetics/SEO
          // The data is already in Redis (handled by the API)
          const slug = `${slugify(object.courseTitle)}-${courseId}`;
          window.history.replaceState(null, "", `/course/${slug}`);
        }
      }
    }
  });

  // Kick off thumbnail generation ASAP (in parallel with streaming), once we have a title and description.
  useEffect(() => {
    if (!user) return;
    if (uploadedCourseThumbnail) return;
    if (imageStartedRef.current) return;
    
    const title = (object as Course | undefined)?.courseTitle;
    const description = (object as Course | undefined)?.courseDescription;
    
    // Wait for both title and description to be available for better image context
    if (!title || title.trim().length < 3) return;
    if (!description || description.trim().length < 10) return;

    imageStartedRef.current = true;

    void (async () => {
      try {
        const imageRes = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: title, description }),
        });

        if (!imageRes.ok) return;
        const imageData = (await imageRes.json()) as {
          success?: boolean;
          image?: string;
        };
        if (!imageData?.success || !imageData.image) return;

        const { url } = await uploadCourseImage({
          userId: user.uid,
          courseId,
          base64Png: imageData.image,
        });

        // Update Firestore best-effort; the UI can still show the URL immediately.
        try {
          await updateCourseThumbnail({ courseId, courseThumbnail: url });
        } catch (e) {
          console.warn("Failed to persist courseThumbnail to Firestore:", e);
        }
        setUploadedCourseThumbnail(url);
      } catch (e) {
        console.warn("Failed to generate/upload course thumbnail:", e);
      }
    })();
  }, [courseId, object, uploadedCourseThumbnail, user]);

  // Effect to trigger generation if prompt is present
  useEffect(() => {
    if (prompt && !hasStartedRef.current) {
      hasStartedRef.current = true;

      if (user) {
        // Create placeholder course doc immediately so thumbnail update can work
        void createCoursePlaceholderDoc({
          courseId,
          userId: user.uid,
          prompt,
          isPublic: false,
        });
      }

      // Remove the prompt from URL immediately to prevent re-generation on URL changes
      router.replace(`/course/${courseIdSlug}`, { scroll: false });

      // Start generation (sources will come from response headers)
      submit({ prompt });
    }
  }, [prompt, user, submit, router, courseIdSlug, courseId]);

  // Load existing course if NOT generating
  useEffect(() => {
    // If we have a prompt, we are about to start generation, so don't load yet.
    if (prompt) return;
    
    // Wait for auth to settle before deciding whether to check Redis or Firestore
    if (authLoading) return;

    let unsubscribe: (() => void) | undefined;

    async function load() {
      try {
        if (user) {
          // Real-time subscription for authenticated users
          const ref = doc(firebaseDb, "courses", courseId);
          unsubscribe = onSnapshot(ref, (snap) => {
            if (snap.exists()) {
              const data = snap.data() as FirestoreCourseDoc;
              const course = {
                ...data.courseData,
                ...(data.courseThumbnail
                  ? { courseThumbnail: data.courseThumbnail }
                  : {}),
                ...(data.sources ? { sources: data.sources } : {}),
              };
              setLoadedCourse(course);
            }
          });
        } else {
          // Guest: Try Redis first
          try {
            const res = await fetch(`/api/courses/${courseId}/redis`);
            if (res.ok) {
              const redisCourse = await res.json();
              const course = {
                ...redisCourse,
                courseThumbnail:
                  redisCourse.courseImage || redisCourse.courseThumbnail,
              };
              setLoadedCourse(course);
              return; // Found in Redis, no need to check Firestore
            }
          } catch (e) {
            console.warn("Failed to load from Redis:", e);
          }

          // Fallback to Firestore (e.g. public shared link) if Redis fails/expired
          // For guests viewing public links, we can also use onSnapshot or just getDoc.
          // Using onSnapshot ensures they see updates too.
          const ref = doc(firebaseDb, "courses", courseId);
          unsubscribe = onSnapshot(ref, (snap) => {
            if (snap.exists()) {
              const data = snap.data() as FirestoreCourseDoc;
              const course = {
                ...data.courseData,
                ...(data.courseThumbnail
                  ? { courseThumbnail: data.courseThumbnail }
                  : {}),
                ...(data.sources ? { sources: data.sources } : {}),
              };
              setLoadedCourse(course);
            }
          });
        }
      } catch (e) {
        console.warn("Failed to load course:", e);
      }
    }

    void load();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [courseId, prompt, object, user, authLoading]);

  // Reload course when courseIdSlug changes (after redirect to slug URL)
  // This ensures we pick up the courseThumbnail that was just uploaded
  // NOTE: With onSnapshot above, this explicit reload effect is largely redundant
  // but we keep it as a fallback or for specific timing issues if onSnapshot takes time to connect.
  useEffect(() => {
    if (!courseIdSlug || prompt || object) return;
    
    // If we are already subscribed via the effect above, this might be redundant,
    // but it doesn't hurt to force a check if the slug changed.
    // However, since the effect above depends on [courseId], it will re-run when slug changes (since courseId is derived from slug).
    // So we can probably remove this effect or keep it minimal.
  }, [courseIdSlug, prompt, object]);

  // Determine which course to display
  // Prefer loadedCourse if it is a valid course (has modules), as it will contain real-time updates (like podcast audio).
  // Otherwise, use the streaming object (during generation).
  // Fallback to placeholder.
  const isLoadedCourseValid = loadedCourse && (loadedCourse.modules?.length ?? 0) > 0;

  let displayCourse: CourseWithMetadata =
    isLoadedCourseValid ? loadedCourse! : (object ? { ...(object as CourseWithMetadata) } : (placeholderCourse(courseId) as CourseWithMetadata));

  // Ensure the course ID is attached to the display object
  // The AI stream object won't have it, but we know it from the URL/params
  if (courseId) {
    displayCourse = { ...displayCourse, id: courseId };
  }

  // If we just uploaded a thumbnail, inject it into the display course.
  // NOTE: courseThumbnail is UI-only metadata and not part of the AI schema.
  if (uploadedCourseThumbnail && !displayCourse.courseThumbnail) {
    displayCourse = { ...displayCourse, courseThumbnail: uploadedCourseThumbnail };
  }

  // Inject web sources if we fetched them during generation
  if (webSources && !displayCourse.sources) {
    displayCourse = { ...displayCourse, sources: webSources };
  }

  // CourseViewer expects a Course shape; we show placeholder while generating.
  return <CourseViewer course={displayCourse} userPrompt={prompt || displayCourse.courseTitle} />;
}