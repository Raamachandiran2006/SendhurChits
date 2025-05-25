
"use client";
import React, { useEffect, useState } from "react";
import type { SalaryRecord, Employee } from "@/types";
import { db } from "@/lib/firebase";
import { collection, getDocs, query as firestoreQuery, where, orderBy } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, DollarSign, ArrowLeft, ListChecks, ChevronRight, ChevronDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";

export default function EmployeeSalaryPage() {
  const { loggedInEntity, clearSalaryNotificationForEmployee } = useAuth();
  const employee = loggedInEntity as Employee | null; 
  const [salaryHistory, setSalaryHistory] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRowExpansion = (recordId: string) => {
    setExpandedRows(prev => ({ ...prev, [recordId]: !prev[recordId] }));
  };

  useEffect(() => {
    const fetchSalaryHistory = async () => {
      if (!employee) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const historyRef = collection(db, "salaryRecords");
        const q = firestoreQuery(
          historyRef,
          where("employeeDocId", "==", employee.id),
          orderBy("paymentDate", "desc"),
          orderBy("recordedAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const fetchedHistory = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalaryRecord));
        setSalaryHistory(fetchedHistory);

        if (employee.hasUnreadSalaryNotification) {
          await clearSalaryNotificationForEmployee();
        }

      } catch (error) {
        console.error("Error fetching salary history:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSalaryHistory();
  }, [employee, clearSalaryNotificationForEmployee]);

  const formatDateSafe = (dateString: string | undefined | null): string => {
    if (!dateString) return "N/A";
    try {
      const date = parseISO(dateString); 
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
            <h1 className="text-3xl font-bold text-foreground">My Salary History</h1>
            <p className="text-muted-foreground">View your past salary payments.</p>
          </div>
        </div>
        <Button variant="outline" asChild className="mt-4 sm:mt-0">
            <Link href="/employee/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
            </Link>
        </Button>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-primary" />
            <CardTitle>Payment Records</CardTitle>
          </div>
          <CardDescription>Chronological record of your salary payments.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-4 text-lg text-foreground">Loading salary history...</p>
            </div>
          ) : salaryHistory.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No salary records found for you.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S.No</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryHistory.map((record, index) => {
                    const isExpanded = expandedRows[record.id];
                    return (
                    <TableRow key={record.id}>{/* Key moved here, React.Fragment removed */}
                        <TableCell>
                          <div className="flex items-center">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleRowExpansion(record.id)}
                                className="mr-1 p-1 h-auto"
                            >
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                            {index + 1}
                          </div>
                          {isExpanded && (
                            <div className="pl-7 mt-1 text-xs text-muted-foreground">
                                Virtual ID: {record.virtualTransactionId || "N/A"}
                            </div>
                          )}
                        </TableCell><TableCell className="text-right font-mono">₹{record.amount.toLocaleString()}</TableCell><TableCell>{formatDateSafe(record.paymentDate)}</TableCell><TableCell className="max-w-xs truncate">{record.remarks || "N/A"}</TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
