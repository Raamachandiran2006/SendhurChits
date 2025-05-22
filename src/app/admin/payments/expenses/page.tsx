
"use client";

import { useEffect, useState } from "react";
import type { ExpenseRecord } from "@/types";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query as firestoreQuery } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Receipt, PlusCircle, ArrowLeft, ListChecks, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { useSearchParams } from "next/navigation";

export default function ExpensesManagementPage() {
  const [expenseHistory, setExpenseHistory] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const refreshId = searchParams.get('refreshId');

  useEffect(() => {
    const fetchExpenseHistory = async () => {
      setLoading(true);
      try {
        const historyRef = collection(db, "expenses");
        // Order by recordedAt in descending order to show latest first
        const q = firestoreQuery(historyRef, orderBy("recordedAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedHistory = querySnapshot.docs.map(doc => {
          const data = doc.data() as ExpenseRecord;
          // Convert Firestore Timestamp to Date for recordedAt if it's not already
          // This might not be strictly necessary if using serverTimestamp for writing,
          // but good for consistency if some records have JS Dates.
          return { 
            id: doc.id, 
            ...data,
            // recordedAt is already a Timestamp from Firestore, so no conversion needed for sorting.
            // For display, we'll format it directly.
          } as ExpenseRecord;
        });
        setExpenseHistory(fetchedHistory);
      } catch (error) {
        console.error("Error fetching expense history:", error);
        // Consider adding a user-facing error message or toast
      } finally {
        setLoading(false);
      }
    };
    fetchExpenseHistory();
  }, [refreshId]); // Re-fetch when refreshId changes

  const formatDateSafe = (dateString: string | undefined | null, dateFormat: string = "dd MMM yyyy"): string => {
    if (!dateString) return "N/A";
    try {
      const date = parseISO(dateString); // Assumes date is stored as YYYY-MM-DD string
      return format(date, dateFormat);
    } catch (e) {
      return "N/A";
    }
  };

  const formatTimestamp = (timestamp: any, dateFormat: string = "dd MMM yyyy, HH:mm"): string => {
    if (!timestamp || typeof timestamp.toDate !== 'function') return "N/A";
    try {
      return format(timestamp.toDate(), dateFormat);
    } catch (e) {
      return "N/A";
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Receipt className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Expenses Management</h1>
            <p className="text-muted-foreground">Track and manage all expenses.</p>
          </div>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0">
            <Button variant="outline" asChild>
                <Link href="/admin/payments">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Payments
                </Link>
            </Button>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link href="/admin/payments/expenses/add">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Expense Record
            </Link>
            </Button>
        </div>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-primary" />
            <CardTitle>Expenses Transaction History</CardTitle>
          </div>
          <CardDescription>Chronological record of all expenses (latest first).</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-4 text-lg text-foreground">Loading expense history...</p>
            </div>
          ) : expenseHistory.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No expense records found. Click "Add Expense Record" to add one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recorded At</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                    <TableHead>Details/Source</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseHistory.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{formatTimestamp(record.recordedAt)}</TableCell>
                      <TableCell className="capitalize">{record.type}</TableCell>
                      <TableCell>
                        {formatDateSafe(record.date)}
                        {record.type === 'spend' && record.time ? ` at ${record.time}` : ''}
                      </TableCell>
                      <TableCell className="text-right font-mono">₹{record.amount.toLocaleString()}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {record.type === 'spend' ? record.reason : record.fromPerson}
                        {record.type === 'received' && record.paymentMode ? ` (Mode: ${record.paymentMode})` : ''}
                      </TableCell>
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
