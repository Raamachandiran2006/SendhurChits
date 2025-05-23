
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { CollectionRecord, User, PaymentRecord as AdminPaymentRecord } from "@/types"; // Renamed to avoid conflict
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, ArrowLeft, History, ReceiptText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface UserTransaction {
  id: string;
  dateTime: Date;
  fromParty: string;
  toParty: string;
  amount: number;
  type: "Sent" | "Received"; // Sent by user, Received by user
  mode: string | null;
  remarks: string | null;
  sourceCollection: "CollectionRecords" | "PaymentRecords"; // More specific source
}

const formatDateSafe = (dateInput: Date | string | Timestamp | undefined | null, outputFormat: string = "dd MMM yyyy, hh:mm a") => {
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
    const d = new Date(dateStr.replace(/-/g, '/')); 
    if (isNaN(d.getTime())) { 
        const isoD = parseISO(dateStr);
        if(isNaN(isoD.getTime())) return new Date(0); 
        baseDate = isoD;
    } else {
        baseDate = d;
    }
  } else {
    baseDate = new Date(); 
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
    const time24hMatch = timeStr.match(/^(\d{2}):(\d{2})$/);
    if (time24hMatch) {
        const hours = parseInt(time24hMatch[1], 10);
        const minutes = parseInt(time24hMatch[2], 10);
        baseDate.setHours(hours, minutes, 0, 0);
        return baseDate;
    }
  }
  baseDate.setHours(0,0,0,0); 
  return baseDate;
};


const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
  return `₹${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function UserPaymentHistoryPage() {
  const { loggedInEntity } = useAuth();
  const user = loggedInEntity as User | null;
  const [transactions, setTransactions] = useState<UserTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      setError("User not found. Please log in again.");
      return;
    }

    const fetchTransactions = async () => {
      setLoading(true);
      setError(null);
      try {
        let combinedTransactions: UserTransaction[] = [];

        // Fetch from collectionRecords (payments MADE BY user)
        const collectionsRef = collection(db, "collectionRecords");
        const collectionsQuery = query(collectionsRef, where("userId", "==", user.id), orderBy("recordedAt", "desc"));
        const collectionsSnapshot = await getDocs(collectionsQuery);
        collectionsSnapshot.forEach(doc => {
          const data = doc.data() as CollectionRecord;
          combinedTransactions.push({
            id: doc.id,
            dateTime: parseDateTimeForSort(data.paymentDate, data.paymentTime, data.recordedAt),
            type: "Sent",
            fromParty: `You (${user.fullname})`,
            toParty: "ChitConnect (Company)",
            amount: data.amount,
            mode: data.paymentMode,
            remarks: data.remarks || `Payment for Group: ${data.groupName}`,
            sourceCollection: "CollectionRecords"
          });
        });

        // Fetch from paymentRecords (payments RECEIVED BY user from admin/company)
        // Assuming AdminPaymentRecord is the type for data in 'paymentRecords' collection
        const paymentsRef = collection(db, "paymentRecords");
        const paymentsQuery = query(paymentsRef, where("userId", "==", user.id), orderBy("recordedAt", "desc"));
        const paymentsSnapshot = await getDocs(paymentsQuery);
        paymentsSnapshot.forEach(doc => {
          const data = doc.data() as AdminPaymentRecord; 
          combinedTransactions.push({
            id: doc.id,
            dateTime: parseDateTimeForSort(data.paymentDate, data.paymentTime, data.recordedAt),
            type: "Received",
            fromParty: "ChitConnect (Company)",
            toParty: `You (${user.fullname})`,
            amount: data.amount,
            mode: data.paymentMode,
            remarks: data.remarks || `Payment from Company for ${data.groupName || 'General Payment'}`,
            sourceCollection: "PaymentRecords"
          });
        });
        
        combinedTransactions.sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());
        setTransactions(combinedTransactions);

      } catch (err) {
        console.error("Error fetching payment history:", err);
        setError("Failed to load payment history. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [user?.id, user?.fullname]);

  if (loading) {
    return (
      <div className="container mx-auto py-8 text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">Loading payment history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 text-center">
         <Card className="max-w-md mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center justify-center">
              <History className="mr-2 h-6 w-6" /> Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
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
          <ReceiptText className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Payment History</h1>
            <p className="text-muted-foreground">A record of your transactions.</p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>Your recent financial activities, sorted by most recent first.</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">
              No payment history found.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S.No</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx, index) => (
                    <TableRow key={tx.id + tx.sourceCollection}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{formatDateSafe(tx.dateTime)}</TableCell>
                      <TableCell className="max-w-xs truncate">{tx.fromParty}</TableCell>
                      <TableCell className="max-w-xs truncate">{tx.toParty}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "font-semibold px-2 py-1 rounded-full text-xs",
                          tx.type === "Sent" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" 
                                             : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        )}>
                          {tx.type}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(tx.amount)}</TableCell>
                      <TableCell>{tx.mode || "N/A"}</TableCell>
                      <TableCell className="max-w-xs truncate">{tx.remarks || "N/A"}</TableCell>
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
