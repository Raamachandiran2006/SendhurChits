
"use client";

import { AppHeader } from "@/components/layout/AppHeader";
import { EmployeeSidebar } from "@/components/employee/EmployeeSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loggedInEntity, userType, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!loggedInEntity) {
        router.replace("/login");
      } else if (userType !== 'employee') {
        if (userType === 'admin') {
          router.replace("/admin");
        } else if (userType === 'user') {
          router.replace("/dashboard");
        } else {
          router.replace("/login");
        }
      }
    }
  }, [loggedInEntity, userType, loading, router]);

  if (loading || !loggedInEntity || userType !== 'employee') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <div className="flex flex-1">
          <EmployeeSidebar />
          <SidebarInset>
            <div className="md:hidden p-2 border-b">
              <SidebarTrigger />
            </div>
            <main className="flex-1 p-4 md:p-8 bg-secondary/30">
              {children}
            </main>
          </SidebarInset>
        </div>
        <footer className="py-4 text-center text-sm text-muted-foreground border-t md:ml-[var(--sidebar-width-icon)] peer-data-[state=expanded]:md:ml-[var(--sidebar-width)] transition-[margin-left] duration-300 ease-in-out">
           © {new Date().getFullYear()} Sendhur Chits Employee Portal.
        </footer>
      </div>
    </SidebarProvider>
  );
}
