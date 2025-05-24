
"use client";

import React, { useEffect, useState } from "react"; 
import type { CollectionRecord, PaymentRecord as AdminPaymentRecordType } from "@/types"; 
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query as firestoreQuery, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Landmark, Loader2, AlertTriangle, ReceiptText, ChevronRight, ChevronDown, Filter, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO, subDays, isAfter } from "date-fns";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface UnifiedAuctionTransaction {
  id: string;
  type: "Sent" | "Received";
  dateTime: Date;
  fromParty: string;
  toParty: string;
  amount: number;
  mode: string | null;
  remarks: string | null;
  originalSource: "Payment Record" | "Collection Record"; 
  virtualTransactionId?: string;
}

type PaymentFilterType = "all" | "last7Days" | "last10Days" | "last30Days";

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
  const [rawAllAuctionTransactions, setRawAllAuctionTransactions] = useState<UnifiedAuctionTransaction[]>([]);
  const [filteredAuctionTransactions, setFilteredAuctionTransactions] = useState<UnifiedAuctionTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [selectedFilter, setSelectedFilter] = useState<PaymentFilterType>("all");

  const toggleRowExpansion = (transactionKey: string) => {
    setExpandedRows(prev => ({ ...prev, [transactionKey]: !prev[transactionKey] }));
  };

  useEffect(() => {
    const fetchAuctionRelatedTransactions = async () => {
      setLoading(true);
      setError(null);
      try {
        const collectionsToFetch = [
          { name: "paymentRecords", type: "Sent" as const, source: "Payment Record" as const }, 
          { name: "collectionRecords", type: "Received" as const, source: "Collection Record" as const }, 
        ];

        const promises = collectionsToFetch.map(c => 
          getDocs(firestoreQuery(collection(db, c.name), orderBy("recordedAt", "desc")))
        );

        const results = await Promise.allSettled(promises);
        let combinedTransactions: UnifiedAuctionTransaction[] = [];

        results.forEach((result, index) => {
          const sourceType = collectionsToFetch[index].type;
          const sourceName = collectionsToFetch[index].source;

          if (result.status === "fulfilled") {
            result.value.docs.forEach(doc => {
              const data = doc.data() as CollectionRecord | AdminPaymentRecordType; 
              const id = doc.id;
              let transformed: UnifiedAuctionTransaction | null = null;

              const userIdentifier = data.userFullname && data.userUsername 
                ? `${data.userFullname} (${data.userUsername})` 
                : "Unknown User";

              if (sourceType === "Sent") { 
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
                  virtualTransactionId: data.virtualTransactionId,
                };
              } else if (sourceType === "Received") { 
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
                  virtualTransactionId: data.virtualTransactionId,
                };
              }
              if (transformed) combinedTransactions.push(transformed);
            });
          } else {
            console.error(`Error fetching from ${collectionsToFetch[index].name}:`, result.reason);
            setError(prev => prev ? `${prev}\nFailed to load ${collectionsToFetch[index].name}.` : `Failed to load ${collectionsToFetch[index].name}.`);
          }
        });
        
        combinedTransactions.sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());
        setRawAllAuctionTransactions(combinedTransactions);
        setFilteredAuctionTransactions(combinedTransactions); // Initially show all

      } catch (err) {
        console.error("Main fetch error:", err);
        setError("Failed to load auction payment records. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchAuctionRelatedTransactions();
  }, []);

  useEffect(() => {
    const applyFilter = () => {
      if (selectedFilter === "all") {
        setFilteredAuctionTransactions(rawAllAuctionTransactions);
        return;
      }
      const now = new Date();
      let startDate: Date;
      if (selectedFilter === "last7Days") {
        startDate = subDays(now, 7);
      } else if (selectedFilter === "last10Days") {
        startDate = subDays(now, 10);
      } else if (selectedFilter === "last30Days") {
        startDate = subDays(now, 30);
      } else {
        setFilteredAuctionTransactions(rawAllAuctionTransactions);
        return;
      }
      startDate.setHours(0, 0, 0, 0); 
      const filtered = rawAllAuctionTransactions.filter(tx => isAfter(tx.dateTime, startDate));
      setFilteredAuctionTransactions(filtered);
    };
    applyFilter();
  }, [selectedFilter, rawAllAuctionTransactions]);

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    
    const formatCurrencyPdf = (amount: number | null | undefined) => {
      if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
      return `Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const tableColumn = ["S.No", "Type", "Date & Time", "From", "To", "Amount", "Mode", "Remarks", "Virtual ID"];
    const tableRows: any[][] = [];

    filteredAuctionTransactions.forEach((tx, index) => {
      const txData = [
        index + 1,
        tx.type,
        formatDateSafe(tx.dateTime),
        tx.fromParty,
        tx.toParty,
        formatCurrencyPdf(tx.amount),
        tx.mode || "N/A",
        tx.remarks || "N/A",
        tx.virtualTransactionId || "N/A",
      ];
      tableRows.push(txData);
    });

    const filterLabel = {
      all: "All Time",
      last7Days: "Last 7 Days",
      last10Days: "Last 10 Days",
      last30Days: "Last 30 Days",
    };

    doc.setFontSize(18);
    doc.text(`Auction Payment Records`, 14, 15);
    doc.setFontSize(12);
    doc.text(`Filter: ${filterLabel[selectedFilter]}`, 14, 22);
    doc.text(`Generated on: ${format(new Date(), "dd MMM yyyy, hh:mm a")}`, 14, 29);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [30, 144, 255] }, 
      styles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: { 
        0: { cellWidth: 8 },  
        1: { cellWidth: 15 }, 
        2: { cellWidth: 25 }, 
        3: { cellWidth: 'auto' }, 
        4: { cellWidth: 'auto' }, 
        5: { cellWidth: 20, halign: 'right' }, 
        6: { cellWidth: 15 }, 
        7: { cellWidth: 'auto' }, 
        8: { cellWidth: 18 }  
      },
    });
    doc.save(`auction_payment_records_${selectedFilter}.pdf`);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">Loading auction payment records...</p>
      </div>
    );
  }

  if (error && filteredAuctionTransactions.length === 0) {
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
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <div className="flex items-center gap-3">
            <Landmark className="h-8 w-8 text-primary"/>
            <div>
                <h1 className="text-3xl font-bold text-foreground">Auction Payment Records</h1>
                <p className="text-muted-foreground">Combined view of payments sent and received related to auctions/collections.</p>
            </div>
        </div>
        <div className="flex items-center gap-2 mt-4 sm:mt-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" /> Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Filter by Date</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSelectedFilter("all")}>All Time</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSelectedFilter("last7Days")}>Last 7 Days</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSelectedFilter("last10Days")}>Last 10 Days</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSelectedFilter("last30Days")}>Last 30 Days</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={filteredAuctionTransactions.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
          <Button variant="outline" asChild size="sm">
            <Link href="/admin/payments">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
            </Link>
          </Button>
        </div>
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
          {filteredAuctionTransactions.length === 0 && !error ? (
            <p className="text-muted-foreground text-center py-10">
              No auction-related payment records found {selectedFilter !== 'all' ? `for the selected period` : ''}.
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
                  {filteredAuctionTransactions.map((tx, index) => {
                    const transactionKey = tx.id + tx.originalSource;
                    const isExpanded = expandedRows[transactionKey];
                    return (
                    <React.Fragment key={transactionKey}>
                      <TableRow>
                        <TableCell>
                          <div className="flex items-center">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleRowExpansion(transactionKey)}
                                className="mr-1 p-1 h-auto"
                            >
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                            {index + 1}
                          </div>
                          {isExpanded && (
                            <div className="pl-7 mt-1 text-xs text-muted-foreground">
                                Virtual ID: {tx.virtualTransactionId || "N/A"}
                            </div>
                          )}
                        </TableCell>
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
                    </React.Fragment>
                  )})}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

