
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const { loggedInEntity, userType, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (loggedInEntity) {
        if (userType === 'admin') {
          router.replace("/admin");
        } else if (userType === 'employee') {
          router.replace("/employee/dashboard");
        } else if (userType === 'user') {
          router.replace("/dashboard");
        } else { // Should not happen if loggedInEntity is true
          router.replace("/login");
        }
      } else {
        router.replace("/login");
      }
    }
  }, [loggedInEntity, userType, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-16 w-16 animate-spin text-primary" />
      <p className="ml-4 text-lg text-foreground">Loading ChitConnect...</p>
    </div>
  );
}

    