
"use client";

import { useEffect, useState } from "react";
import type { CollectionRecord, ExpenseRecord, SalaryRecord, PaymentRecord as AdminPaymentRecord } from "@/types"; // Assuming PaymentRecord is for admin-recorded payments
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query as firestoreQuery, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, BookOpenCheck, Loader2, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils"; // Ensure cn is imported

interface MasterTransaction {
  id: string;
  transactionDisplayId: string;
  direction: "Sent" | "Received";
  dateTime: Date;
  fromParty: string;
  toParty: string;
  amount: number;
  mode: string | null;
  remarksOrSource: string;
  originalSource: string; // e.g., "Collection", "Salary", "Expense"
}

const formatDateSafe = (dateInput: string | Date | Timestamp | undefined | null, outputFormat: string = "dd MMM yyyy, hh:mm a") => {
  if (!dateInput) return "N/A";
  try {
    let date: Date;
    if (dateInput instanceof Timestamp) {
      date = dateInput.toDate();
    } else if (typeof dateInput === 'string') {
      const parsedDate = new Date(dateInput.replace(/-/g, '/'));
      if (isNaN(parsedDate.getTime())) {
        const isoParsed = parseISO(dateInput);
        if(isNaN(isoParsed.getTime())) return "N/A";
        date = isoParsed;
      } else {
        date = parsedDate;
      }
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      return "N/A";
    }
    
    if (isNaN(date.getTime())) return "N/A";
    return format(date, outputFormat);
  } catch (e) {
    console.error("Error formatting date:", dateInput, e);
    return "N/A";
  }
};

const parseDateTimeForSort = (dateStr?: string, timeStr?: string, recordTimestamp?: Timestamp): Date => {
  if (recordTimestamp) return recordTimestamp.toDate();
  
  let baseDate: Date;
  if (dateStr) {
    const d = new Date(dateStr.replace(/-/g, '/')); // Handle YYYY-MM-DD
    if (isNaN(d.getTime())) { // try ISO if direct fails
        const isoD = parseISO(dateStr);
        if(isNaN(isoD.getTime())) return new Date(0); // Invalid date, sort to epoch
        baseDate = isoD;
    } else {
        baseDate = d;
    }
  } else {
    baseDate = new Date(); // Default to now if no date string
  }

  if (isNaN(baseDate.getTime())) return new Date(0); 

  if (timeStr) {
    const timePartsMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (timePartsMatch) {
      let hours = parseInt(timePartsMatch[1], 10);
      const minutes = parseInt(timePartsMatch[2], 10);
      const period = timePartsMatch[3]?.toUpperCase();

      if (period === "PM" && hours < 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;

      baseDate.setHours(hours, minutes, 0, 0);
      return baseDate;
    }
    // Handle HH:mm (24-hour format)
    const time24hMatch = timeStr.match(/^(\d{2}):(\d{2})$/);
    if (time24hMatch) {
        const hours = parseInt(time24hMatch[1], 10);
        const minutes = parseInt(time24hMatch[2], 10);
        baseDate.setHours(hours, minutes, 0, 0);
        return baseDate;
    }
  }
  baseDate.setHours(0,0,0,0); // Default to start of the day if no time
  return baseDate;
};


const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
  return `₹${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function MasterRecordPage() {
  const [allTransactions, setAllTransactions] = useState<MasterTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      setError(null);
      console.log("Master Record: Starting to fetch transactions...");

      try {
        const collectionsToFetch = [
          { name: "collectionRecords", type: "Collection" as const, dateField: "recordedAt" },
          { name: "paymentRecords", type: "Payment" as const, dateField: "recordedAt" }, // Changed type for clarity
          { name: "salaryRecords", type: "Salary" as const, dateField: "recordedAt" },
          { name: "expenses", type: "Expense" as const, dateField: "recordedAt" },
        ];

        const promises = collectionsToFetch.map(c => 
          getDocs(firestoreQuery(collection(db, c.name), orderBy(c.dateField, "desc")))
        );

        const results = await Promise.allSettled(promises);
        console.log("Master Record: Fetch results from Promise.allSettled:", results);

        let combinedTransactions: MasterTransaction[] = [];

        results.forEach((result, index) => {
          const sourceType = collectionsToFetch[index].type;
          if (result.status === "fulfilled") {
            console.log(`Master Record: Successfully fetched from ${collectionsToFetch[index].name}, ${result.value.docs.length} docs`);
            result.value.docs.forEach(doc => {
              const data = doc.data();
              const id = doc.id;
              let transformed: MasterTransaction | null = null;

              if (sourceType === "Collection" && data) {
                const record = data as CollectionRecord;
                transformed = {
                  id,
                  transactionDisplayId: `COLL-${id.substring(0, 6)}`,
                  direction: "Received",
                  dateTime: parseDateTimeForSort(record.paymentDate, record.paymentTime, record.recordedAt),
                  fromParty: `User: ${record.userFullname} (${record.userUsername})`,
                  toParty: "ChitConnect (Company)",
                  amount: record.amount,
                  mode: record.paymentMode,
                  remarksOrSource: record.remarks || `Collection from ${record.userFullname}`,
                  originalSource: "Collection",
                };
              } else if (sourceType === "Payment" && data) {
                const record = data as AdminPaymentRecord; 
                transformed = {
                  id,
                  transactionDisplayId: `PAY-${id.substring(0,6)}`,
                  direction: "Sent", // Admin recorded payments are typically 'Sent' by company
                  dateTime: parseDateTimeForSort(record.paymentDate, record.paymentTime, record.recordedAt),
                  fromParty: "ChitConnect (Company)",
                  toParty: `User: ${record.userFullname} (${record.userUsername})`,
                  amount: record.amount,
                  mode: record.paymentMode,
                  remarksOrSource: record.remarks || `Payment to ${record.userFullname}`,
                  originalSource: "Payment",
                };
              } else if (sourceType === "Salary" && data) {
                const record = data as SalaryRecord;
                transformed = {
                  id,
                  transactionDisplayId: `SAL-${id.substring(0,6)}`,
                  direction: "Sent",
                  dateTime: parseDateTimeForSort(record.paymentDate, undefined, record.recordedAt),
                  fromParty: "ChitConnect (Company)",
                  toParty: `Employee: ${record.employeeName} (${record.employeeReadableId})`,
                  amount: record.amount,
                  mode: "Bank Transfer", 
                  remarksOrSource: record.remarks || `Salary for ${record.employeeName}`,
                  originalSource: "Salary",
                };
              } else if (sourceType === "Expense" && data) {
                const record = data as ExpenseRecord;
                transformed = {
                  id,
                  transactionDisplayId: `EXP-${id.substring(0,6)}`,
                  direction: record.type === "spend" ? "Sent" : "Received",
                  dateTime: parseDateTimeForSort(record.date, record.time, record.recordedAt),
                  fromParty: record.type === "spend" ? "ChitConnect (Company)" : (record.fromPerson || "Unknown Source"),
                  toParty: record.type === "spend" ? (record.reason || "Expense") : "ChitConnect (Company)",
                  amount: record.amount,
                  mode: record.paymentMode || (record.type === "spend" ? "Company Account" : "N/A"),
                  remarksOrSource: record.remarks || (record.type === "spend" ? record.reason : `Income from ${record.fromPerson}` ) || "Expense Record",
                  originalSource: "Expense",
                };
              }
              if (transformed) combinedTransactions.push(transformed);
            });
          } else {
            console.error(`Master Record: Error fetching from ${collectionsToFetch[index].name}:`, result.reason);
            setError(prev => prev ? `${prev}\nFailed to load ${collectionsToFetch[index].name}.` : `Failed to load ${collectionsToFetch[index].name}.`);
          }
        });
        
        console.log("Master Record: Combined transactions before sort:", combinedTransactions.length, "items");
        combinedTransactions.sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());
        console.log("Master Record: Transactions after sort:", combinedTransactions.length, "items. First item date:", combinedTransactions[0]?.dateTime);
        setAllTransactions(combinedTransactions);

      } catch (err) {
        console.error("Master Record: Main fetch error:", err);
        setError("Failed to load master transaction records. Please try again.");
      } finally {
        setLoading(false);
        console.log("Master Record: Fetching completed, loading set to false.");
      }
    };

    fetchTransactions();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-8 text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">Loading master record...</p>
      </div>
    );
  }

  if (error && allTransactions.length === 0) { // Show error only if no transactions loaded
    return (
      <div className="container mx-auto py-8 text-center">
        <Card className="max-w-md mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center justify-center">
              <AlertTriangle className="mr-2 h-6 w-6" /> Error Loading Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-line">{error}</p>
            <Button onClick={() => window.location.reload()} className="mt-6">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <BookOpenCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Master Financial Record</h1>
            <p className="text-muted-foreground">A comprehensive overview of all transactions.</p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/payments">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Payments
          </Link>
        </Button>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>Sorted by most recent first. {error && <span className="text-destructive text-xs block mt-1">Note: Some data may have failed to load.</span>}</CardDescription>
        </CardHeader>
        <CardContent>
          {allTransactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">
              No transactions found across all records.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S.No</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Remarks/Source</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allTransactions.map((tx, index) => (
                    <TableRow key={tx.id + tx.originalSource}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <span className={cn("font-semibold", tx.direction === "Sent" ? "text-destructive" : "text-green-600")}>
                          {tx.direction}
                        </span>
                      </TableCell>
                      <TableCell>{formatDateSafe(tx.dateTime)}</TableCell>
                      <TableCell className="max-w-xs truncate">{tx.fromParty}</TableCell>
                      <TableCell className="max-w-xs truncate">{tx.toParty}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(tx.amount)}</TableCell>
                      <TableCell>{tx.mode || "N/A"}</TableCell>
                      <TableCell className="max-w-xs truncate">{tx.remarksOrSource}</TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                          {tx.originalSource}
                        </span>
                        </TableCell>
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
