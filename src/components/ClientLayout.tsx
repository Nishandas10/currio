"use client";

import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import AppSidebar from "@/components/AppSidebar";

function ClientLayoutInner({ children }: { children: React.ReactNode }) {
  const { isSidebarCollapsed, toggleSidebar } = useSidebar();

  return (
    <>
      <AppSidebar 
        isCollapsed={isSidebarCollapsed} 
        toggle={toggleSidebar} 
      />
      
      <main 
        className={`flex-1 transition-all duration-300 ease-in-out h-screen overflow-auto ${
          isSidebarCollapsed ? "ml-0 md:ml-16" : "ml-0 md:ml-64"
        }`}
      >
        {children}
      </main>
    </>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // Only show sidebar for authenticated users
  const shouldShowSidebar = !!user && !loading;

  return (
    <SidebarProvider>
      {shouldShowSidebar ? (
        <div className="flex h-screen bg-white overflow-hidden">
          <ClientLayoutInner>{children}</ClientLayoutInner>
        </div>
      ) : (
        <div className="h-screen bg-white overflow-auto">
          {children}
        </div>
      )}
    </SidebarProvider>
  );
}
