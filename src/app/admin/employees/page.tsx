
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, Users, PlusCircle, Eye } from "lucide-react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AdminEmployeesPage() {
  const [employeeCount, setEmployeeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmployeeCount = async () => {
      setLoading(true);
      try {
        const employeesSnapshot = await getDocs(collection(db, "employees"));
        setEmployeeCount(employeesSnapshot.size);
      } catch (error) {
        console.error("Error fetching employee count:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployeeCount();
  }, []);

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Briefcase className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Employee Management</h1>
            <p className="text-muted-foreground">Oversee all employee-related activities.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-2xl font-bold">Loading...</div>
            ) : (
              <div className="text-2xl font-bold">{employeeCount}</div>
            )}
            <p className="text-xs text-muted-foreground">Currently active employees</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Employee Actions</CardTitle>
          <CardDescription>Manage your workforce efficiently.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90">
            <Link href="/admin/employees/add">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Employee
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto ml-0 sm:ml-4">
            <Link href="/admin/employees/view">
              <Eye className="mr-2 h-4 w-4" /> View All Employees
            </Link>
          </Button>
          {/* More options can be added here later */}
        </CardContent>
      </Card>

      {/* Placeholder for future content like recent activity or pending tasks */}
      <div className="mt-8">
        {/* Example: <EmployeeActivityFeed /> */}
      </div>
    </div>
  );
}
