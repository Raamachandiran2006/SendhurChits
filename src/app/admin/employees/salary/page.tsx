
"use client";

import { useEffect, useState } from "react";
import type { SalaryRecord } from "@/types";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query as firestoreQuery } from "firebase/firestore"; // aliased query
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, DollarSign, PlusCircle, ArrowLeft, ListChecks } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { useSearchParams } from "next/navigation"; // Import useSearchParams

export default function SalaryManagementPage() {
  const [salaryHistory, setSalaryHistory] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams(); // Get search params

  const refreshId = searchParams.get('refreshId'); // Get the refreshId

  useEffect(() => {
    const fetchSalaryHistory = async () => {
      setLoading(true);
      try {
        const historyRef = collection(db, "salaryRecords");
        const q = firestoreQuery(historyRef, orderBy("paymentDate", "desc"), orderBy("recordedAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedHistory = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalaryRecord));
        setSalaryHistory(fetchedHistory);
      } catch (error) {
        console.error("Error fetching salary history:", error);
        // Consider adding a toast notification for the user here
      } finally {
        setLoading(false);
      }
    };
    fetchSalaryHistory();
  }, [refreshId]); // Add refreshId to the dependency array

  const formatDateSafe = (dateString: string | undefined | null): string => {
    if (!dateString) return "N/A";
    try {
      const date = parseISO(dateString); // Dates are stored as YYYY-MM-DD
      return format(date, "dd MMM yyyy");
    } catch (e) {
      return "N/A";
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <DollarSign className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Salary Management</h1>
            <p className="text-muted-foreground">Add and view employee salary records.</p>
          </div>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0">
            <Button variant="outline" asChild>
                <Link href="/admin/employees">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Employee Mgmt
                </Link>
            </Button>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link href="/admin/employees/salary/add">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Salary Record
            </Link>
            </Button>
        </div>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-primary" />
            <CardTitle>Salary Payment History</CardTitle>
          </div>
          <CardDescription>Chronological record of all salary payments made.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-4 text-lg text-foreground">Loading salary history...</p>
            </div>
          ) : salaryHistory.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No salary records found. Click "Add Salary Record" to add one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryHistory.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.employeeName}</TableCell>
                      <TableCell>{record.employeeReadableId}</TableCell>
                      <TableCell className="text-right font-mono">₹{record.amount.toLocaleString()}</TableCell>
                      <TableCell>{formatDateSafe(record.paymentDate)}</TableCell>
                      <TableCell className="max-w-xs truncate">{record.remarks || "N/A"}</TableCell>
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
