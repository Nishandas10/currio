"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ClientLayout from "@/components/ClientLayout";
import {
  getUserCourses,
  updateCourseVisibility,
  deleteCourse,
  renameCourse,
  FirestoreCourseDoc,
} from "@/lib/courses";
import {
  Search,
  MoreVertical,
  Edit,
  Share2,
  Trash2,
  Globe,
  Lock,
  Loader2,
  FileText,
} from "lucide-react";
import { cn, slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarToggleButton } from "@/components/SidebarToggleButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ShareCourseDialog } from "@/components/ShareCourseDialog";

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<(FirestoreCourseDoc & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Dialog States
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<(FirestoreCourseDoc & { id: string }) | null>(null);
  const [newName, setNewName] = useState("");

  const fetchCourses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getUserCourses(user.uid);
      setCourses(data);
    } catch (error) {
      console.error("Failed to fetch courses:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (user) {
      fetchCourses();
    }
  }, [user, authLoading, router, fetchCourses]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuOpenId && !(event.target as Element).closest(".course-menu-trigger")) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [menuOpenId]);

  const filteredCourses = courses.filter((course) => {
    const matchesSearch = course.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const isValid = course.title && course.description && course.slug;
    return matchesSearch && isValid;
  });

  const handleToggleVisibility = async (course: FirestoreCourseDoc & { id: string }) => {
    const newStatus = !course.isPublic;
    // Optimistic update
    setCourses((prev) =>
      prev.map((c) => (c.id === course.id ? { ...c, isPublic: newStatus } : c))
    );
    try {
      await updateCourseVisibility(course.id, newStatus);
    } catch (error) {
      console.error("Failed to update visibility:", error);
      // Revert
      setCourses((prev) =>
        prev.map((c) => (c.id === course.id ? { ...c, isPublic: !newStatus } : c))
      );
    }
  };

  const handleRenameClick = (course: FirestoreCourseDoc & { id: string }) => {
    setSelectedCourse(course);
    setNewName(course.title);
    setRenameDialogOpen(true);
    setMenuOpenId(null);
  };

  const handleRenameSubmit = async () => {
    if (!selectedCourse || !newName.trim()) return;
    try {
      await renameCourse(selectedCourse.id, newName);
      setCourses((prev) =>
        prev.map((c) => (c.id === selectedCourse.id ? { ...c, title: newName } : c))
      );
      setRenameDialogOpen(false);
    } catch (error) {
      console.error("Failed to rename course:", error);
    }
  };

  const handleDeleteClick = (course: FirestoreCourseDoc & { id: string }) => {
    setSelectedCourse(course);
    setDeleteDialogOpen(true);
    setMenuOpenId(null);
  };

  const handleDeleteSubmit = async () => {
    if (!selectedCourse) return;
    try {
      await deleteCourse(selectedCourse.id);
      setCourses((prev) => prev.filter((c) => c.id !== selectedCourse.id));
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error("Failed to delete course:", error);
    }
  };

  const handleShare = (course: FirestoreCourseDoc & { id: string }) => {
    setSelectedCourse(course);
    setShareDialogOpen(true);
    setMenuOpenId(null);
  };

  const formatDate = (timestamp: unknown) => {
    if (!timestamp || typeof timestamp !== 'object' || !('seconds' in timestamp)) return "N/A";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const date = new Date((timestamp as any).seconds * 1000);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  if (authLoading || loading) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
    <div className="h-full bg-[#F8F6F3] flex flex-col overflow-hidden">
      {/* Fixed Header */}
      <div className="bg-[#F8F6F3] p-3 md:p-8 shrink-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col gap-3 md:gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <SidebarToggleButton />
              <h1 className="text-xl md:text-3xl font-bold text-gray-900">My Library</h1>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/5 bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Table Container */}
      <div className="flex-1 px-3 md:px-8 pb-3 md:pb-8 overflow-hidden">
        <div className="max-w-6xl mx-auto h-full">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-full overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm z-5">
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-medium">
                    <th className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">Name</th>
                    <th className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">Description</th>
                    <th className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">View</th>
                    <th className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">Updated</th>
                    <th className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {filteredCourses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                            <FileText className="text-gray-400" size={24} />
                          </div>
                          <p>No courses found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCourses.map((course) => (
                      <tr key={course.id} className="group hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <Link
                        href={`/course/${course.slug || course.id}`}
                        className="flex items-center gap-2 md:gap-3 font-medium text-sm md:text-base text-gray-900 hover:text-blue-600 transition-colors max-w-xs"
                      >
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded bg-gray-100 flex items-center justify-center shrink-0 text-xs font-bold text-gray-500">
                          {course.title.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{course.title}</span>
                      </Link>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4">
                      <p className="text-xs md:text-sm text-gray-500 truncate max-w-xs">{course.description || "No description"}</p>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleVisibility(course)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border whitespace-nowrap",
                          course.isPublic
                            ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                        )}
                      >
                        {course.isPublic ? (
                          <>
                            <Globe size={12} /> Public
                          </>
                        ) : (
                          <>
                            <Lock size={12} /> Private
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm text-gray-500 whitespace-nowrap">
                      {formatDate(course.updatedAt || course.createdAt)}
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 relative whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === course.id ? null : course.id);
                        }}
                        className="course-menu-trigger p-1.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {menuOpenId === course.id && (
                        <div className="absolute right-8 top-8 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-10 animate-in fade-in zoom-in-95 duration-100">
                          <button
                            onClick={() => handleRenameClick(course)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left"
                          >
                            <Edit size={14} /> Rename
                          </button>
                          <button
                            onClick={() => handleShare(course)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left"
                          >
                            <Share2 size={14} /> Share
                          </button>
                          <div className="h-px bg-gray-100 my-1"></div>
                          <button
                            onClick={() => handleDeleteClick(course)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 text-left"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
            </div>
          </div>
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Course</DialogTitle>
            <DialogDescription>
              Enter a new name for your course.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="name" className="mb-2 block">
              Name
            </Label>
            <Input
              id="name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Course Name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameSubmit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Course</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedCourse?.title}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSubmit}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      {selectedCourse && (
        <ShareCourseDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          courseTitle={selectedCourse.title}
          courseDescription={selectedCourse.description}
          courseThumbnail={selectedCourse.courseThumbnail}
          courseSlug={selectedCourse.slug || `${slugify(selectedCourse.title)}-${selectedCourse.id}`}
          trigger={<span className="hidden" />} // Hidden trigger since we control it via open prop
        />
      )}
    </div>
    </ClientLayout>
  );
}
