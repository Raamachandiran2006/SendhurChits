
"use client";
import { SignupForm } from "@/components/auth/SignupForm";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function SignupPage() {
  const { loggedInEntity, userType, loading } = useAuth(); // Use loggedInEntity and userType
  const router = useRouter();

  useEffect(() => {
    // Redirect if already logged in
    if (!loading && loggedInEntity) {
      if (userType === 'admin') {
        router.replace("/admin");
      } else if (userType === 'employee') {
        router.replace("/employee/dashboard"); // Employees shouldn't typically sign up here but handle if logged in
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
  return <SignupForm />;
}

    