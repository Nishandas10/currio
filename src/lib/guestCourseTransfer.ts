import {
  createCourseDoc,
  updateCourseThumbnail,
  type WebSource,
} from "@/lib/courses";
import { addCourseToUser } from "@/lib/users";
import { uploadCourseImage } from "@/lib/storage";
import type { Course } from "@/lib/schema";

export async function transferGuestCourseToUser(
  courseId: string,
  userId: string
) {
  console.log(
    `[Transfer] Starting transfer for course ${courseId} to user ${userId}`
  );
  try {
    // 1. Fetch from Redis via our API
    // Retry logic: The course might still be generating or saving to Redis if the user
    // navigated to login/signup immediately. Poll for a few seconds.
    let res: Response | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let redisData: any = null;

    for (let i = 0; i < 10; i++) {
      res = await fetch(`/api/courses/${courseId}/redis`);
      console.log(
        `[Transfer] Redis fetch attempt ${i + 1} status: ${res.status}`
      );

      if (res.ok) {
        redisData = await res.json();
        // Check if data is actually valid (not empty)
        if (redisData && redisData.courseTitle) {
          break;
        }
      }

      // Wait 1s before retry
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!res || !res.ok || !redisData) {
      console.warn("Guest course not found in Redis or expired after retries");
      return null;
    }

    console.log(
      `[Transfer] Redis data retrieved, title: ${redisData.courseTitle}`
    );

    // 2. Extract data
    // We need to separate the Course data from the metadata (id, courseImage, etc.)
    // to ensure we store a clean Course object in Firestore.
    const {
      id,
      courseImage,
      courseThumbnail: cThumb,
      sources,
      ...cleanCourseData
    } = redisData;

    // Silence unused variable warnings
    void id;
    void courseImage;
    void cThumb;
    void sources;

    const course = cleanCourseData as Course;
    const rawCourse = redisData as Course & {
      id: string;
      courseImage?: string;
      courseThumbnail?: string;
      sources?: WebSource[];
    };

    // Use course title as prompt fallback since we might not have the original prompt easily available
    // unless we fetch the meta key separately, but for now this is sufficient.
    const prompt = course.courseTitle || "Generated Course";

    // Handle thumbnail: if it's a base64 string (large), upload to Storage in background
    let courseThumbnail = rawCourse.courseImage || rawCourse.courseThumbnail;

    if (
      courseThumbnail &&
      (courseThumbnail.startsWith("data:") || courseThumbnail.length > 1000)
    ) {
      const imageToUpload = courseThumbnail;
      // Don't save large data to Firestore initially
      courseThumbnail = undefined;

      console.log("[Transfer] Starting background thumbnail upload...");
      // Start upload in background without awaiting
      void uploadCourseImage({
        userId,
        courseId,
        base64Png: imageToUpload,
      })
        .then(async ({ url }) => {
          console.log("[Transfer] Thumbnail uploaded:", url);
          await updateCourseThumbnail({ courseId, courseThumbnail: url });
          console.log("[Transfer] Thumbnail updated in Firestore");
        })
        .catch((uploadErr) => {
          console.warn(
            "[Transfer] Failed to upload thumbnail, skipping image:",
            uploadErr
          );
        });
    } else if (courseThumbnail && !courseThumbnail.startsWith("http")) {
      // If it's a short string but not a URL, it might be a raw base64 fragment or invalid.
      // Treat it as undefined to avoid saving garbage to Firestore.
      console.warn("[Transfer] Invalid thumbnail format detected, skipping.");
      courseThumbnail = undefined;
    }

    // 3. Save to Firestore
    console.log("[Transfer] Saving to Firestore...");
    const { slug } = await createCourseDoc({
      courseId,
      userId,
      prompt,
      course,
      isPublic: false,
      courseThumbnail,
      sources: rawCourse.sources,
    });
    console.log(`[Transfer] Saved to Firestore with slug: ${slug}`);

    // 4. Link to user
    console.log("[Transfer] Linking to user profile...");
    await addCourseToUser({ uid: userId, courseId });
    console.log("[Transfer] Link successful");

    return slug;
  } catch (e) {
    console.error("Failed to transfer guest course:", e);
    return null;
  }
}
