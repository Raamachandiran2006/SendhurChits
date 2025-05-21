
"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase } from "lucide-react";

export default function EmployeeDashboardPage() {
  const { loggedInEntity } = useAuth();

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Employee Dashboard</h1>
        {loggedInEntity && (
          <p className="text-muted-foreground">Welcome, {loggedInEntity.fullname}!</p>
        )}
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Briefcase className="h-8 w-8 text-primary" />
            <CardTitle className="text-xl">Your Space</CardTitle>
          </div>
          <CardDescription>This is your employee dashboard. More features will be added soon.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Currently, there are no specific actions for you here, but stay tuned for updates!</p>
          {/* Placeholder for future employee-specific content */}
        </CardContent>
      </Card>
    </div>
  );
}

    