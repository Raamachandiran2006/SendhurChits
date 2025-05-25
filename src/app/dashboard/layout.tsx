
"use client";

import { AppHeader } from "@/components/layout/AppHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
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
      } else if (userType !== 'user') {
        
        if (userType === 'admin') {
          router.replace("/admin");
        } else if (userType === 'employee') {
          router.replace("/employee/dashboard");
        } else { 
          router.replace("/login");
        }
      }
    }
  }, [loggedInEntity, userType, loading, router]);

  if (loading || !loggedInEntity || userType !== 'user') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 p-4 md:p-8 bg-secondary/50">
        {children}
      </main>
      <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        © {new Date().getFullYear()} Sendhur Chits. All rights reserved.
      </footer>
    </div>
  );
}
