
"use client";

import { useEffect, useState } from "react";
import type { Employee } from "@/types";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Briefcase, ArrowLeft } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function EmployeeViewColleaguesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      try {
        const employeesRef = collection(db, "employees");
        const q = query(employeesRef, orderBy("fullname"));
        const querySnapshot = await getDocs(q);
        const fetchedEmployees = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
        setEmployees(fetchedEmployees);
      } catch (error) {
        console.error("Error fetching employees:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  const formatDateSafe = (dateString: string | undefined | null, outputFormat: string = "dd MMM yyyy"): string => {
    if (!dateString) return "N/A";
    try {
      const date = dateString.includes('T') ? parseISO(dateString) : new Date(dateString);
      if (isNaN(date.getTime())) return "N/A";
      return format(date, outputFormat);
    } catch (e) {
      return "N/A";
    }
  };

  const handleEmployeeRowClick = (employeeId: string) => {
    router.push(`/employee/employees/${employeeId}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">Loading colleagues...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Briefcase className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">View Colleagues</h1>
            <p className="text-muted-foreground">Browse records of other employees.</p>
          </div>
        </div>
        <Button variant="outline" asChild className="mt-4 sm:mt-0">
          <Link href="/employee/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>
      </div>

      <Card className="shadow-xl">
        <CardContent className="pt-6">
          {employees.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No employees found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joining Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow
                      key={employee.id}
                      onClick={() => handleEmployeeRowClick(employee.id)}
                      className="cursor-pointer hover:bg-muted/70 transition-colors"
                    >{/* Compacted JSX below */}
                      <TableCell className="font-mono">{employee.employeeId}</TableCell><TableCell className="font-medium">{employee.fullname}</TableCell><TableCell>{employee.phone}</TableCell><TableCell>{employee.role}</TableCell><TableCell>{formatDateSafe(employee.joiningDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
