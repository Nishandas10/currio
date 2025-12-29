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
import { transferGuestCourseToUser } from "@/lib/guestCourseTransfer";
import { uploadCourseImage } from "@/lib/storage";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
  const [isGuestLimitReached, setIsGuestLimitReached] = useState(false);

  useEffect(() => {
    if (authLoading || user) return;

    const stored = localStorage.getItem("guest_created_courses");
    const guestCourses: string[] = stored ? JSON.parse(stored) : [];

    if (prompt && courseId && !guestCourses.includes(courseId)) {
      guestCourses.push(courseId);
      localStorage.setItem("guest_created_courses", JSON.stringify(guestCourses));
    }

    const index = guestCourses.indexOf(courseId);
    if (index >= 1 && !isGuestLimitReached) {
      // Use setTimeout to avoid synchronous state update during render phase
      setTimeout(() => setIsGuestLimitReached(true), 0);
    }
  }, [user, authLoading, prompt, courseId, isGuestLimitReached]);
  const [uploadedCourseThumbnail, setUploadedCourseThumbnail] = useState<string | null>(null);
  const [webSources, setWebSources] = useState<WebSource[] | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const hasStartedRef = useRef(false);
  const imageStartedRef = useRef(false);
  const transferAttemptedRef = useRef<string | null>(null);

  const guestInProgressKey = `guest_generation_in_progress:${courseId}`;

  // AI Generation Hook
  const { object, submit, isLoading, error } = useObject({
    api: "/api/generate",
    schema: courseSchema,
    onError: (err) => {
      console.error("Generation error:", err);
      setGenerationError("Failed to generate course. Please try again.");
    },
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
        // Generation finished; clear any persisted "in progress" flag.
        try {
          localStorage.removeItem(guestInProgressKey);
        } catch {
          // ignore
        }

        if (user) {
          try {
            const { slug } = await createCourseDoc({
              courseId,
              userId: user.uid,
              prompt: prompt || "",
              course: object as Course,
              isPublic: false,
              ...(webSources ? { sources: webSources } : {}),
              status: "ready",
            });
            await addCourseToUser({ uid: user.uid, courseId });

            // Notify sidebar to refresh recent courses
            window.dispatchEvent(new Event("course_created"));

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

  // Timeout check: If loading but no object after 60s, show error/retry
  useEffect(() => {
    if (isLoading && !object) {
      const timer = setTimeout(() => {
        setGenerationError("Generation is taking longer than expected. Please retry.");
      }, 60000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, object]);

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

      // Persist the prompt so we can resume if the page is reloaded (for both guests and auth users)
      try {
        localStorage.setItem(
          guestInProgressKey,
          JSON.stringify({ prompt, startedAt: Date.now() })
        );
      } catch {
        // ignore
      }

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
  }, [prompt, user, submit, router, courseIdSlug, courseId, guestInProgressKey]);

  // If the user logged in mid-generation, they’ll come back to /course/:id (no prompt).
  // Resume streaming using the saved prompt.
  useEffect(() => {
    if (authLoading) return;
    // if (!user) return; // Allow guests to resume too
    if (prompt) return; // prompt present already triggers generation
    if (hasStartedRef.current) return;

    // Check if we have a saved prompt in localStorage (for guests or auth users who reloaded)
    // OR check if we have a prompt in Redis (via API) if localStorage is empty (cross-device/browser case, though less likely for guest)
    
    const resumeGeneration = async () => {
       try {
        let promptToUse: string | undefined;

        // 1. Try localStorage first
        const stored = localStorage.getItem(guestInProgressKey);
        if (stored) {
          const parsed = JSON.parse(stored) as { prompt?: string };
          if (parsed?.prompt) {
            promptToUse = parsed.prompt;
          }
        }

        // 2. If not in localStorage, try fetching metadata from Redis (if we have an ID)
        if (!promptToUse && courseId) {
          // If authenticated, check Firestore first. If the course exists there,
          // we don't need to resume generation from Redis.
          if (user) {
            try {
              const docRef = doc(firebaseDb, "courses", courseId);
              const snap = await getDoc(docRef);
              if (snap.exists()) {
                return;
              }
            } catch {
              // ignore
            }
          }

          try {
            const res = await fetch(`/api/courses/${courseId}/redis`);
             if (res.ok) {
               const data = await res.json();
               // If the course is already fully generated (has modules), we don't need to resume generation.
               // But if it's partial or we just want to be sure, we can check.
               // Actually, if it's in Redis, it might be the *result* of a generation.
               // We need the *prompt* to restart generation if it was interrupted.
               // The Redis data might contain the prompt if we saved it.
               if (data.prompt && (!data.modules || data.modules.length === 0)) {
                  promptToUse = data.prompt;
               }
             }
           } catch {
             // ignore
           }
        }

        if (!promptToUse) return;

        hasStartedRef.current = true;

        if (user) {
          // Create placeholder doc so dependent updates can work
          void createCoursePlaceholderDoc({
            courseId,
            userId: user.uid,
            prompt: promptToUse,
            isPublic: false,
          });
        }

        submit({ prompt: promptToUse });
      } catch (e) {
        console.warn("Failed to resume generation:", e);
      }
    };

    void resumeGeneration();

  }, [authLoading, user, prompt, courseId, guestInProgressKey, submit]);

  // Load existing course if NOT generating
  useEffect(() => {
    // If we have a prompt, we are about to start generation, so don't load yet.
    if (prompt) return;
    
    // Wait for auth to settle before deciding whether to check Redis or Firestore
    if (authLoading) return;

    // If we are generating (hasStartedRef) AND we are a guest, don't load from Redis (it won't be there yet).
    // Authenticated users should proceed to subscribe to Firestore to get real-time updates.
    if (!user && hasStartedRef.current) return;

    let unsubscribe: (() => void) | undefined;

    async function load() {
      try {
        if (user) {
          // Real-time subscription for authenticated users
          const ref = doc(firebaseDb, "courses", courseId);
          unsubscribe = onSnapshot(ref, async (snap) => {
            if (snap.exists()) {
              const data = snap.data() as FirestoreCourseDoc;
              const course = {
                ...data.courseData,
                isPublic: data.isPublic,
                ...(data.courseThumbnail
                  ? { courseThumbnail: data.courseThumbnail }
                  : {}),
                ...(data.sources ? { sources: data.sources } : {}),
              };
              setLoadedCourse(course);
            } else {
              // If not in Firestore yet (e.g. just transferred from guest), try Redis as fallback
              // This handles the case where transfer might be in progress or failed,
              // or if we are viewing a course that hasn't been fully persisted yet.
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

                  // If we found it in Redis but not Firestore, and we are logged in,
                  // we should transfer it to the user so it persists.
                  if (user && user.uid && transferAttemptedRef.current !== courseId) {
                    transferAttemptedRef.current = courseId;
                    console.log("Found guest course in Redis, transferring to user...", courseId);
                    transferGuestCourseToUser(courseId, user.uid)
                      .then((result) => {
                        if (result) {
                          console.log("Transfer successful, new slug:", result);
                        }
                      })
                      .catch((err) => {
                        console.error("Transfer failed:", err);
                      });
                  }
                }
              } catch (e) {
                console.warn("Failed to load from Redis fallback:", e);
              }
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
                isPublic: data.isPublic,
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
  }, [courseId, prompt, user, authLoading]);

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

  if (generationError || error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white p-4">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Generation Failed</h2>
          <p className="text-gray-600">
            {generationError || (error ? "An error occurred during generation." : "Something went wrong.")}
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Button onClick={() => window.location.reload()} variant="outline">
              Reload Page
            </Button>
            <Link href="/">
              <Button>Go Home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
  return (
    <>
      {isGuestLimitReached && (
        <>
          <div className="fixed inset-0 z-40 bg-linear-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-[0_-8px_30px_rgba(0,0,0,0.12)] rounded-t-4xl p-8 pb-12 animate-in slide-in-from-bottom duration-500">
            <div className="max-w-md mx-auto text-center space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-serif font-medium tracking-tight">Create a free Currio account</h2>
                <p className="text-muted-foreground text-base">
                  Gain access to this course and start creating your own personalized courses today.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Link href={`/signup?redirect=/course/${courseIdSlug}`} className="w-full">
                  <Button size="lg" className="w-full font-semibold text-md rounded-full bg-[#F9F4DA] text-black hover:bg-[#F0EBC0] border-0 shadow-none">
                    Sign Up
                  </Button>
                </Link>
                <Link href={`/login?redirect=/course/${courseIdSlug}`} className="w-full">
                  <Button variant="outline" size="lg" className="w-full font-semibold text-md rounded-full border-input hover:bg-accent hover:text-accent-foreground">
                    Log In
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
      <div className={isGuestLimitReached ? "pointer-events-none select-none" : ""}>
        <CourseViewer course={displayCourse} userPrompt={prompt || displayCourse.courseTitle} />
      </div>
    </>
  );
}