
"use client";
import { LoginForm } from "@/components/auth/LoginForm";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const { loggedInEntity, userType, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && loggedInEntity) {
      if (userType === 'admin') {
        router.replace("/admin");
      } else if (userType === 'employee') {
        router.replace("/employee/dashboard");
      } else if (userType === 'user') {
        router.replace("/dashboard");
      }
    }
  }, [loggedInEntity, userType, loading, router]);

  if (loading || (!loading && loggedInEntity)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  return <LoginForm />;
}

    