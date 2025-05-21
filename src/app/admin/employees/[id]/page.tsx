
"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Employee } from "@/types";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { 
  Loader2, 
  ArrowLeft, 
  User as UserIcon, // Using UserIcon for employee representation
  Info, 
  AlertTriangle, 
  Phone, 
  Home, 
  CalendarDays,
  Briefcase,
  FileText,
  Edit3,
  Trash2,
  CreditCard, // For Aadhaar/PAN
  UserCircle2 // For Role
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Separator } from "@/components/ui/separator";

// Helper function to format date safely
const formatDateSafe = (dateString: string | Date | undefined | null, outputFormat: string = "dd MMMM yyyy"): string => {
  if (!dateString) return "N/A";
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    if (isNaN(date.getTime())) return "N/A";
    return format(date, outputFormat);
  } catch (e) {
    return "N/A";
  }
};

export default function AdminEmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const employeeDocId = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // const [isEditing, setIsEditing] = useState(false); // For future edit functionality

  useEffect(() => {
    if (!employeeDocId) {
      setError("Employee ID is missing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const fetchEmployeeDetails = async () => {
      try {
        const employeeDocRef = doc(db, "employees", employeeDocId);
        const employeeDocSnap = await getDoc(employeeDocRef);

        if (!employeeDocSnap.exists()) {
          setError("Employee not found.");
        } else {
          setEmployee({ id: employeeDocSnap.id, ...employeeDocSnap.data() } as Employee);
        }
      } catch (err) {
        console.error("Error fetching employee details:", err);
        setError("Failed to fetch employee details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeeDetails();
  }, [employeeDocId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">Loading employee details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 text-center">
        <Card className="max-w-md mx-auto shadow-lg">
          <CardHeader><CardTitle className="text-destructive flex items-center justify-center"><AlertTriangle className="mr-2 h-6 w-6" /> Error</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => router.push("/admin/employees/view")} className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Employees</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!employee) {
    return <div className="container mx-auto py-8 text-center text-muted-foreground">Employee data not available.</div>;
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={() => router.push("/admin/employees/view")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Employees
        </Button>
        <div className="flex gap-2 mb-6">
            {/* Placeholder for Edit/Delete buttons */}
            <Button variant="outline" disabled> 
                <Edit3 className="mr-2 h-4 w-4" /> Edit Employee
            </Button>
            <Button variant="destructive" disabled>
                <Trash2 className="mr-2 h-4 w-4" /> Delete Employee
            </Button>
        </div>
      </div>

        <Card className="shadow-xl overflow-hidden">
          <CardHeader className="bg-secondary/50 p-6 border-b">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {employee.photoUrl && (
                <Image 
                  src={employee.photoUrl} 
                  alt={`${employee.fullname}'s photo`} 
                  width={100} height={100} 
                  className="rounded-full border-4 border-card object-cover" 
                  data-ai-hint="employee profile"
                />
              )}
              <div className="flex-grow">
                <CardTitle className="text-3xl font-bold text-foreground flex items-center">
                  {employee.fullname}
                </CardTitle>
                <CardDescription>Employee ID: {employee.employeeId}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <section>
              <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><Info className="mr-2 h-5 w-5" />Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div className="flex items-start"><Phone className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Phone:</strong> {employee.phone}</div></div>
                <div className="flex items-start"><CalendarDays className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Date of Birth:</strong> {formatDateSafe(employee.dob)}</div></div>
                <div className="flex items-start col-span-1 md:col-span-2"><Home className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Address:</strong> {employee.address || "N/A"}</div></div>
              </div>
            </section>
            <Separator />
            <section>
              <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><Briefcase className="mr-2 h-5 w-5" />Employment Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div className="flex items-start"><UserCircle2 className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Role:</strong> <Badge variant="secondary">{employee.role}</Badge></div></div>
                <div className="flex items-start"><CalendarDays className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Joining Date:</strong> {formatDateSafe(employee.joiningDate)}</div></div>
              </div>
            </section>
             <Separator />
            <section>
              <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><FileText className="mr-2 h-5 w-5" />Identification Documents</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center"><CreditCard className="mr-2 h-4 w-4 text-muted-foreground" /> <strong className="text-foreground w-32">Aadhaar Number:</strong>{employee.aadhaarNumber || "N/A"}</div>
                <div className="flex items-center"><CreditCard className="mr-2 h-4 w-4 text-muted-foreground" /> <strong className="text-foreground w-32">PAN Card Number:</strong>{employee.panCardNumber || "N/A"}</div>
                 {employee.photoUrl ? (
                    <div className="flex items-start">
                        <UserIcon className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div>
                        <strong className="block text-foreground">Photograph:</strong>
                        <Button variant="link" asChild className="p-0 h-auto text-primary hover:underline">
                            <a href={employee.photoUrl} target="_blank" rel="noopener noreferrer">View Photograph</a>
                        </Button>
                        </div>
                    </div>
                    ) : <p className="text-muted-foreground flex items-center"><UserIcon className="mr-2 h-4 w-4 text-muted-foreground" />Photograph: Not Uploaded</p>
                }
              </div>
            </section>
          </CardContent>
        </Card>
    </div>
  );
}

