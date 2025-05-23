
"use client";

import { useEffect, useState } from "react";
import type { CollectionRecord, PaymentRecord as AdminPaymentRecordType } from "@/types"; // Using AdminPaymentRecordType alias for clarity
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query as firestoreQuery, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Landmark, Loader2, AlertTriangle, ReceiptText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface UnifiedAuctionTransaction {
  id: string;
  type: "Sent" | "Received";
  dateTime: Date;
  fromParty: string;
  toParty: string;
  amount: number;
  mode: string | null;
  remarks: string | null;
  originalSource: "Payment Record" | "Collection Record"; // To distinguish origin if needed
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

export default function AuctionPaymentRecordPage() {
  const [allAuctionTransactions, setAllAuctionTransactions] = useState<UnifiedAuctionTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAuctionRelatedTransactions = async () => {
      setLoading(true);
      setError(null);
      console.log("AuctionPaymentRecordPage: Starting to fetch transactions...");

      try {
        const collectionsToFetch = [
          { name: "paymentRecords", type: "Sent" as const, source: "Payment Record" as const }, // Payments by company
          { name: "collectionRecords", type: "Received" as const, source: "Collection Record" as const }, // Collections from users
        ];

        const promises = collectionsToFetch.map(c => 
          getDocs(firestoreQuery(collection(db, c.name), orderBy("recordedAt", "desc")))
        );

        const results = await Promise.allSettled(promises);
        console.log("AuctionPaymentRecordPage: Fetch results:", results);

        let combinedTransactions: UnifiedAuctionTransaction[] = [];

        results.forEach((result, index) => {
          const sourceType = collectionsToFetch[index].type;
          const sourceName = collectionsToFetch[index].source;

          if (result.status === "fulfilled") {
            console.log(`AuctionPaymentRecordPage: Fetched from ${collectionsToFetch[index].name}, ${result.value.docs.length} docs`);
            result.value.docs.forEach(doc => {
              const data = doc.data() as CollectionRecord | AdminPaymentRecordType; // Assuming structures are compatible for now
              const id = doc.id;
              let transformed: UnifiedAuctionTransaction | null = null;

              const userIdentifier = data.userFullname && data.userUsername 
                ? `${data.userFullname} (${data.userUsername})` 
                : "Unknown User";

              if (sourceType === "Sent") { // From paymentRecords
                transformed = {
                  id,
                  type: "Sent",
                  dateTime: parseDateTimeForSort(data.paymentDate, data.paymentTime, data.recordedAt),
                  fromParty: "ChitConnect (Company)",
                  toParty: `User: ${userIdentifier}`,
                  amount: data.amount,
                  mode: data.paymentMode,
                  remarks: data.remarks || "Company Payment",
                  originalSource: sourceName,
                };
              } else if (sourceType === "Received") { // From collectionRecords
                transformed = {
                  id,
                  type: "Received",
                  dateTime: parseDateTimeForSort(data.paymentDate, data.paymentTime, data.recordedAt),
                  fromParty: `User: ${userIdentifier}`,
                  toParty: "ChitConnect (Company)",
                  amount: data.amount,
                  mode: data.paymentMode,
                  remarks: data.remarks || "User Collection",
                  originalSource: sourceName,
                };
              }
              if (transformed) combinedTransactions.push(transformed);
            });
          } else {
            console.error(`AuctionPaymentRecordPage: Error fetching from ${collectionsToFetch[index].name}:`, result.reason);
            setError(prev => prev ? `${prev}\nFailed to load ${collectionsToFetch[index].name}.` : `Failed to load ${collectionsToFetch[index].name}.`);
          }
        });
        
        console.log("AuctionPaymentRecordPage: Combined transactions before sort:", combinedTransactions.length);
        combinedTransactions.sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());
        console.log("AuctionPaymentRecordPage: Transactions after sort:", combinedTransactions.length, "First item date:", combinedTransactions[0]?.dateTime);
        setAllAuctionTransactions(combinedTransactions);

      } catch (err) {
        console.error("AuctionPaymentRecordPage: Main fetch error:", err);
        setError("Failed to load auction payment records. Please try again.");
      } finally {
        setLoading(false);
        console.log("AuctionPaymentRecordPage: Fetching completed.");
      }
    };

    fetchAuctionRelatedTransactions();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-8 text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">Loading auction payment records...</p>
      </div>
    );
  }

  if (error && allAuctionTransactions.length === 0) {
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
            <Landmark className="h-8 w-8 text-primary"/>
            <div>
                <h1 className="text-3xl font-bold text-foreground">Auction Payment Records</h1>
                <p className="text-muted-foreground">Combined view of payments sent and received related to auctions/collections.</p>
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
          <div className="flex items-center gap-2">
            <ReceiptText className="h-6 w-6 text-primary" />
            <CardTitle>Transaction Log</CardTitle>
          </div>
          <CardDescription>
            Shows payments made by the company (Sent) and payments received from users (Received). {error && <span className="text-destructive text-xs block mt-1">Note: Some data may have failed to load.</span>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allAuctionTransactions.length === 0 && !error ? (
            <p className="text-muted-foreground text-center py-10">
              No auction-related payment records found.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S.No</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allAuctionTransactions.map((tx, index) => (
                    <TableRow key={tx.id + tx.originalSource}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "font-semibold px-2 py-1 rounded-full text-xs",
                          tx.type === "Sent" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" 
                                             : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        )}>
                          {tx.type}
                        </span>
                      </TableCell>
                      <TableCell>{formatDateSafe(tx.dateTime)}</TableCell>
                      <TableCell className="max-w-xs truncate">{tx.fromParty}</TableCell>
                      <TableCell className="max-w-xs truncate">{tx.toParty}</TableCell>
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

    