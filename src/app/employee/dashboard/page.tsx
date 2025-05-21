
"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, Users, Layers, Eye } from "lucide-react";
import Link from "next/link";
import type { Employee } from "@/types";

export default function EmployeeDashboardPage() {
  const { loggedInEntity } = useAuth();
  const employee = loggedInEntity as Employee | null;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Employee Dashboard</h1>
        {employee && (
          <p className="text-muted-foreground">Welcome, {employee.fullname}! (ID: {employee.employeeId})</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              <CardTitle>Users</CardTitle>
            </div>
            <CardDescription>View registered users in the system.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/employee/users">
                <Eye className="mr-2 h-4 w-4" /> View Users
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" />
              <CardTitle>Groups</CardTitle>
            </div>
            <CardDescription>Browse active chit groups.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/employee/groups">
                <Eye className="mr-2 h-4 w-4" /> View Groups
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-primary" />
              <CardTitle>Colleagues</CardTitle>
            </div>
            <CardDescription>View details of other employees.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/employee/employees">
                <Eye className="mr-2 h-4 w-4" /> View Colleagues
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      
      {/* "Your Profile" card removed from here */}

    </div>
  );
}
