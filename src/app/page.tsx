"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import Link from "next/link";
import { ArrowUp } from "lucide-react"
import Image from "next/image"
import { subscribeToPublicCourses, FirestoreCourseDoc } from "@/lib/courses";

function generateId(length = 10) {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  
  // UI States
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)
  const addMenuRef = useRef<HTMLDivElement | null>(null)
  
  // --- NEW LOGIC STATE ---
  const [input, setInput] = useState("") 
  const [recentPublicCourses, setRecentPublicCourses] = useState<(FirestoreCourseDoc & { id: string })[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToPublicCourses((courses) => {
      setRecentPublicCourses(courses);
    }, 3);
    return () => unsubscribe();
  }, []); 

  const header = useMemo(
    () => (
      <div className="w-full flex items-center justify-between px-4 md:px-8 h-15 pt-2">
        <Link href="/" className="text-xl md:text-2xl font-bold tracking-tight text-gray-900">
          Currio
        </Link>
        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-3">
            {user ? (
              // For authenticated users, the sidebar handles logout.
              // We can hide the logout button here or keep it as a secondary option.
              // The user requested "Currio stays outside the sidebar", which implies the header is visible.
              // But if the sidebar has logout, maybe we don't need it here.
              // However, to be safe and consistent with "outside sidebar", I'll leave the header but maybe hide the logout button if it's redundant?
              // Actually, let's just hide the logout button for auth users in the header since it's in the sidebar.
              null
            ) : (
              <>
                <Link
                  href="/signup"
                  className="rounded-full bg-[#FBE7A1] hover:bg-[#F7D978] text-[#1A1A1A] px-5 py-2 text-sm font-medium transition-colors"
                >
                  Sign Up
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-black/10 bg-white px-5 py-2 text-sm font-medium text-[#1A1A1A] hover:bg-black/5 transition-colors"
                >
                  Log In
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    ),
    [user]
  );

  // --- HANDLER ---
  const handleGenerate = () => {
    if (!input.trim()) return

    // Unified flow: Redirect immediately to course page to start generation there.
    // We generate a client-side ID to reserve the slot.
    const newId = generateId();
    const params = new URLSearchParams();
    params.set("prompt", input);
    router.push(`/course/${newId}?${params.toString()}`);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGenerate()
    }
  }

  // Close the add menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setIsAddMenuOpen(false)
      }
    }

    if (isAddMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isAddMenuOpen])

  useEffect(() => {
    // Stay on `/` after authentication (no dashboard redirect).
    // We keep the home page available to both authenticated and unauthenticated users.
  }, [user, loading, router])

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  // If user is authenticated, we still show the home page; UI will adapt (Logout vs Sign in/up)

  return (
    <div className="min-h-screen bg-[#fcfaf8] flex flex-col">
      {/* Top bar: Brand + Auth - Fixed at top */}
      {header}

      <main className="flex-1 px-6 pb-16">

      {/* Hero */}
      <section className="max-w-4xl mx-auto text-center mt-12">
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
            <span className="text-6xl leading-none" role="img" aria-label="sloth">🦥</span>
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-normal text-[#3A3A3A] mb-1">
          What do you want to learn today?
        </h1>
        {/* Search */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="flex items-center gap-3 rounded-full bg-white ring-1 ring-[#cccccc] px-6 py-4 relative focus-within:ring-2 focus-within:ring-black/20 transition-shadow">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Teach me about..."
              className="flex-1 bg-transparent outline-none text-sm text-gray-600 placeholder:text-gray-400"
            />
            <div ref={addMenuRef} className="relative">
              {/* <button
                aria-label="Add topic"
                onClick={() => setIsAddMenuOpen((open) => !open)}
                className="text-3xl text-gray-400 hover:text-gray-600 transition-colors leading-none"
              >
                +
              </button> */}
              {isAddMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white text-sm text-gray-800 border border-gray-100 shadow-sm py-2 z-20">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs">🔗</span>
                    <span>Add website link</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs">▶️</span>
                    <span>YouTube video</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs">🎙️</span>
                    <span>Record audio</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs">📄</span>
                    <span>Upload docs</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs">📷</span>
                    <span>Camera</span>
                  </button>
                </div>
              )}
            </div>
            <button
              aria-label="Search"
              onClick={handleGenerate}
              disabled={!input.trim()}
              className="size-10 rounded-full bg-black text-white grid place-items-center text-base hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </section>

      {/* Trending / Suggestions */}
      <section className="max-w-2xl mx-auto mt-12 space-y-6">
        {recentPublicCourses.map((course) => {
          const parts = course.title.split(":");
          const mainTitle = parts[0].trim();
          const subTitle = parts.length > 1 ? parts.slice(1).join(":").trim() : mainTitle;

          return (
            <div key={course.id}>
              <div className="flex items-center gap-2 text-gray-500 mb-3 text-sm">
                <span>↗</span>
                <span>{mainTitle}</span>
              </div>
              <Link
                href={`/course/${course.slug || course.id}`}
                className="w-full flex items-center justify-between gap-3 rounded-2xl bg-white ring-1 ring-black/5 px-3 py-3 hover:ring-black/10 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-gray-100 grid place-items-center overflow-hidden relative">
                    {course.courseThumbnail ? (
                      <Image
                        src={course.courseThumbnail}
                        alt={course.title}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-lg">📚</span>
                    )}
                  </div>
                  <div className="text-sm font-normal text-[#3A3A3A] line-clamp-1">
                    {subTitle}
                  </div>
                </div>
                <div className="text-xl text-gray-300 group-hover:text-gray-400 transition-colors">
                  ›
                </div>
              </Link>
            </div>
          );
        })}

        {recentPublicCourses.length > 0 && (
          <div className="flex justify-center pt-4">
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#FBE7A1] hover:bg-[#F7D978] border border-gray-300 text-[#1A1A1A] transition-all shadow-sm text-sm font-medium"
            >
              Explore courses created by the community
            </Link>
          </div>
        )}
      </section>
    </main>
    </div>
  )
}