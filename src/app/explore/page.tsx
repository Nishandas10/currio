"use client";

import React, { useEffect, useState } from "react";
import { getPublicCourses, FirestoreCourseDoc } from "@/lib/courses";
import { Input } from "@/components/ui/input";
import { Search, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import ClientLayout from "@/components/ClientLayout";
import { getUserProfile } from "@/lib/users";

type CourseWithUser = FirestoreCourseDoc & {
  id: string;
  creatorName?: string;
};

export default function ExplorePage() {
  const [courses, setCourses] = useState<CourseWithUser[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<CourseWithUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const publicCourses = await getPublicCourses(50);
        
        // Fetch creator names
        const coursesWithCreators = await Promise.all(
          publicCourses.map(async (course) => {
            try {
              const userProfile = await getUserProfile(course.userId);
              return {
                ...course,
                creatorName: userProfile?.displayName || "Unknown User",
              };
            } catch {
              return { ...course, creatorName: "Unknown User" };
            }
          })
        );

        setCourses(coursesWithCreators);
        setFilteredCourses(coursesWithCreators);
      } catch (error) {
        console.error("Error fetching public courses:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  useEffect(() => {
    const lowerQuery = searchQuery.toLowerCase();
    const filtered = courses.filter(
      (course) =>
        course.title.toLowerCase().includes(lowerQuery) ||
        course.description.toLowerCase().includes(lowerQuery) ||
        course.creatorName?.toLowerCase().includes(lowerQuery)
    );
    setFilteredCourses(filtered);
  }, [searchQuery, courses]);

  return (
    <ClientLayout>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <Link
            href="/"
            className="text-2xl font-bold tracking-tight text-gray-900 hover:opacity-80 transition-opacity shrink-0"
          >
            Currio
          </Link>

          <div className="space-y-4 flex-1 md:max-w-md md:text-right">
            <h1 className="text-3xl font-bold text-gray-900">Explore Courses</h1>
            <p className="text-gray-500">
              Discover courses created by the community.
            </p>
            <div className="relative max-w-md md:ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search courses..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-64 bg-gray-100 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredCourses.map((course) => (
              <Link
                key={course.id}
                href={`/course/${course.id}`}
                className="group block bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
              >
                <div className="relative h-40 w-full bg-gray-100">
                  {course.courseThumbnail ? (
                    <Image
                      src={course.courseThumbnail}
                      alt={course.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      <span className="text-4xl">📚</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 line-clamp-1 mb-1 group-hover:text-blue-600 transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3 h-10">
                    {course.description}
                  </p>
                  <div className="flex items-center text-xs text-gray-400 pt-3 border-t border-gray-100">
                    <User className="w-3 h-3 mr-1" />
                    <span className="truncate max-w-37.5">
                      {course.creatorName}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No courses found.</p>
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
