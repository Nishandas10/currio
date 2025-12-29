import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Plus, 
  Search, 
  ChevronLeft,
  LogOut,
  User,
  BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserRecentCourses, FirestoreCourseDoc } from "@/lib/courses";

interface AppSidebarProps {
  isCollapsed: boolean;
  toggle: () => void;
}

export default function AppSidebar({ isCollapsed, toggle }: AppSidebarProps) {
  const { user, signOutUser } = useAuth();
  const router = useRouter();
  const [recentCourses, setRecentCourses] = useState<(FirestoreCourseDoc & { id: string })[]>([]);

  const fetchCourses = useCallback(() => {
    if (user) {
      getUserRecentCourses(user.uid).then(setRecentCourses).catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    fetchCourses();

    const handleCourseCreated = () => fetchCourses();
    window.addEventListener("course_created", handleCourseCreated);

    return () => {
      window.removeEventListener("course_created", handleCourseCreated);
    };
  }, [fetchCourses]);  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-[#F8F6F3] border-r border-gray-200 transition-all duration-300 flex flex-col",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 pt-2 h-16 border-b border-gray-100">
        <div 
          className={cn(
            "flex items-center justify-center transition-transform", 
            isCollapsed ? "w-full cursor-pointer hover:scale-105" : "ml-3"
          )}
          onClick={isCollapsed ? toggle : undefined}
        >
           <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white font-serif font-bold text-lg">
             C
           </div>
        </div>
        {!isCollapsed && (
          <button
            onClick={toggle}
            className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
        )}
      </div>

      {/* Main Menu */}
      <div className="flex-1 py-6 px-3 space-y-6 overflow-y-auto custom-scrollbar">
        <div className="space-y-2">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-black/5 transition-all group",
              isCollapsed ? "justify-center" : ""
            )}
            title="New Course"
          >
              <div
                className={cn(
                  "w-8 h-8 bg-black rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform",
                  !isCollapsed ? "-ml-1" : ""
                )}
              >
                 <Plus size={17} className="text-white" />
              </div>
            {!isCollapsed && <span className="font-medium">New Course</span>}
          </Link>

          <button
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-black/5 transition-all group",
              isCollapsed ? "justify-center" : ""
            )}
            title="Search"
          >
            <Search size={20} className="text-gray-500 group-hover:text-black" />
            {!isCollapsed && <span className="font-medium">Search</span>}
          </button>
        </div>

        {/* Recent Courses */}
        {!isCollapsed && recentCourses.length > 0 && (
          <div className="pt-2">
            <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Recent
            </h3>
            <div className="space-y-1">
              {recentCourses.map((course) => (
                <Link
                  key={course.id}
                  href={`/course/${course.slug || course.id}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-black/5 hover:text-black transition-all text-sm"
                >
                  <span className="truncate">{course.title || "Untitled Course"}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
        {isCollapsed && recentCourses.length > 0 && (
           <div className="pt-2 flex flex-col items-center gap-2">
              <div className="w-4 h-px bg-gray-300 my-1"></div>
              {recentCourses.slice(0, 5).map((course) => (
                <Link
                  key={course.id}
                  href={`/course/${course.slug || course.id}`}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 text-gray-500 hover:text-black transition-all"
                  title={course.title}
                >
                  <BookOpen size={16} />
                </Link>
              ))}
           </div>
        )}
      </div>

      {/* User Profile (Bottom) */}
      <div className="p-4 border-t border-gray-200">
        <div className={cn("flex items-center gap-3", isCollapsed ? "justify-center" : "")}>
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0 overflow-hidden relative">
            {user?.photoURL ? (
              <Image 
                src={user.photoURL} 
                alt={user.displayName || "User"} 
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <User size={16} className="text-gray-500" />
            )}
          </div>
          
          {!isCollapsed && (
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.displayName || "User"}
              </p>
              <button 
                onClick={async () => {
                  await signOutUser();
                  router.push("/");
                }}
                className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 mt-0.5"
              >
                <LogOut size={12} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
