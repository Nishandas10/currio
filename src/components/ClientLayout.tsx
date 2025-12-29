"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AppSidebar from "@/components/AppSidebar";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  // Default sidebar to collapsed by default for a compact first view
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  // Only show sidebar for authenticated users
  const shouldShowSidebar = !!user && !loading;

  if (!shouldShowSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-white">
      <AppSidebar 
        isCollapsed={isSidebarCollapsed} 
        toggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
      />
      <main 
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? "ml-16" : "ml-64"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
