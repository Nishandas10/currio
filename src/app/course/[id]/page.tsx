import { Metadata } from "next";
import ClientPage from "./ClientPage";
import { doc, getDoc } from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase";
import { Course } from "@/lib/schema";

type PageProps = {
  params: Promise<{ id: string }>;

};

// Helper to fetch course data for metadata
async function getCourse(id: string) {
  try {
    const docRef = doc(firebaseDb, "courses", id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (error) {
    console.error("Error fetching course for metadata:", error);
  }
  return null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id: courseIdSlug } = await params;
  const courseId = courseIdSlug.split("-").pop() ?? courseIdSlug;
  
  const data = await getCourse(courseId);
  
  if (!data) {
    return {
      title: "Currio - AI Course Generator",
      description: "Generate personalized courses with AI",
    };
  }

  const course = data.courseData as Course;
  const title = course.courseTitle || "Currio Course";
  const description = course.courseDescription || "Learn with Currio";
  const thumbnail = data.courseThumbnail || "https://currio.co/opengraph-image.png"; // Fallback image

  return {
    title: `${title} | Currio`,
    description: description,
    openGraph: {
      title: title,
      description: description,
      images: [
        {
          url: thumbnail,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: title,
      description: description,
      images: [thumbnail],
    },
  };
}

export default function Page(props: PageProps) {
  return <ClientPage {...props} />;
}