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
  getCourseDoc,
  updateCourseThumbnail,
  updateCourseSources,
  createCoursePlaceholderDoc,
  type WebSource,
} from "@/lib/courses";
import { addCourseToUser } from "@/lib/users";
import { uploadCourseImage } from "@/lib/storage";

type PageProps = {
  params: Promise<{ id: string }>;
};

type CourseWithMetadata = Course & { 
  id?: string;
  courseThumbnail?: string;
  sources?: WebSource[];
};

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
  const { user } = useAuth();

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
      if (user && object?.courseTitle) {
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

           // Update URL to slug (without query params)
           router.replace(`/course/${slug}`, { scroll: false });
        } catch (e) {
           console.error("Failed to save course:", e);
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
    if (prompt && user && !hasStartedRef.current) {
      hasStartedRef.current = true;
      
      // Create placeholder course doc immediately so thumbnail update can work
      void createCoursePlaceholderDoc({
        courseId,
        userId: user.uid,
        prompt,
        isPublic: false,
      });
      
      // Remove the prompt from URL immediately to prevent re-generation on URL changes
      router.replace(`/course/${courseIdSlug}`, { scroll: false });
      
      // Start generation (sources will come from response headers)
      submit({ prompt });
    }
  }, [prompt, user, submit, router, courseIdSlug, courseId]);

  // Load existing course if NOT generating
  useEffect(() => {
    // If we have a prompt or are streaming, don't load from Firestore yet.
    if (prompt || object) return;

    async function load() {
      try {
        const course = await getCourseDoc(courseId);
        if (course) {
          setLoadedCourse(course);
        }
      } catch (e) {
        console.warn("Failed to load course from Firestore:", e);
      }
    }

    void load();
  }, [courseId, prompt, object]);

  // Reload course when courseIdSlug changes (after redirect to slug URL)
  // This ensures we pick up the courseThumbnail that was just uploaded
  useEffect(() => {
    if (!courseIdSlug || prompt || object) return;
    
    async function reloadAfterRedirect() {
      try {
        console.log("[Reload Effect] Attempting to load courseId:", courseId, "user:", user?.uid);
        const course = await getCourseDoc(courseId);
        console.log("[Reload Effect] Loaded course:", course?.courseTitle);
        if (course) setLoadedCourse(course);
      } catch (e) {
        console.error("[Reload Effect] Failed to reload course after redirect:", e);
        // Log more details
        if (e instanceof Error) {
          console.error("[Reload Effect] Error details:", e.message, e.name);
        }
      }
    }
    
    // Small delay to ensure Firestore write has propagated
    const timer = setTimeout(reloadAfterRedirect, 500);
    return () => clearTimeout(timer);
  }, [courseIdSlug, courseId, prompt, object, user]);

  // Determine which course to display
  let displayCourse: CourseWithMetadata =
    object ? { ...(object as CourseWithMetadata) } : loadedCourse || (placeholderCourse(courseId) as CourseWithMetadata);

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