"use client";

import { useSidebar } from "@/contexts/SidebarContext";
import { useAuth } from "@/contexts/AuthContext";

export function SidebarToggleButton() {
  const { user } = useAuth();
  const { toggleSidebar } = useSidebar();

  // Only show for authenticated users
  if (!user) return null;

  return (
    <button
      onClick={toggleSidebar}
      className="md:hidden w-10 h-10 bg-black rounded-full flex items-center justify-center text-white font-serif font-bold text-lg hover:scale-105 transition-transform shrink-0"
      aria-label="Toggle sidebar"
    >
      C
    </button>
  );
}
