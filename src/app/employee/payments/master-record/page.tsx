
"use client";

import React, { useEffect, useState, useMemo } from "react"; 
import type { CollectionRecord, ExpenseRecord, SalaryRecord, PaymentRecord as AdminPaymentRecord, CreditRecord } from "@/types";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query as firestoreQuery, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, BookOpenCheck, Loader2, AlertTriangle, ChevronRight, ChevronDown, Filter, Download, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO, subDays, isAfter, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  originalSource: string; 
  virtualTransactionId?: string; 
}

type PaymentFilterType = "all" | "today" | "last7Days" | "last10Days" | "last30Days";

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
        if(isNaN(isoD.getTime())) { 
            console.warn(`Could not parse date: ${dateStr}, using current date as fallback for sort.`);
            return new Date(); 
        }
        baseDate = isoD;
    } else {
        baseDate = d;
    }
  } else {
    baseDate = new Date(); 
  }

  if (isNaN(baseDate.getTime())) { 
      console.warn(`Base date is invalid after initial parsing for: ${dateStr}, using current date.`);
      return new Date();
  }

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

export default function EmployeeMasterRecordPage() {
  const [rawAllTransactions, setRawAllTransactions] = useState<MasterTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<MasterTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [selectedFilter, setSelectedFilter] = useState<PaymentFilterType>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const toggleRowExpansion = (transactionKey: string) => {
    setExpandedRows(prev => ({ ...prev, [transactionKey]: !prev[transactionKey] }));
  };

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      setError(null);
      try {
        const collectionsToFetch = [
          { name: "collectionRecords", type: "Collection" as const, dateField: "recordedAt" },
          { name: "paymentRecords", type: "Payment" as const, dateField: "recordedAt" }, 
          { name: "salaryRecords", type: "Salary" as const, dateField: "recordedAt" },
          { name: "expenses", type: "Expense" as const, dateField: "recordedAt" },
          { name: "creditRecords", type: "Credit" as const, dateField: "recordedAt"},
        ];

        const promises = collectionsToFetch.map(c => 
          getDocs(firestoreQuery(collection(db, c.name), orderBy(c.dateField, "desc")))
        );

        const results = await Promise.allSettled(promises);
        let combinedTransactions: MasterTransaction[] = [];
        
        results.forEach((result, index) => {
          const sourceType = collectionsToFetch[index].type;
          if (result.status === "fulfilled") {
            result.value.docs.forEach(doc => {
              const data = doc.data();
              const id = doc.id;
              let transformed: MasterTransaction | null = null;

              if (sourceType === "Collection" && data) {
                const record = data as CollectionRecord;
                transformed = {
                  id,
                  transactionDisplayId: `COLL-${record.virtualTransactionId || id.substring(0, 6)}`,
                  direction: "Received",
                  dateTime: parseDateTimeForSort(record.paymentDate, record.paymentTime, record.recordedAt),
                  fromParty: `User: ${record.userFullname} (${record.userUsername})`,
                  toParty: "Sendhur Chits (Company)",
                  amount: record.amount,
                  mode: record.paymentMode,
                  remarksOrSource: record.remarks || `Collection for Group: ${record.groupName}`,
                  originalSource: "Collection",
                  virtualTransactionId: record.virtualTransactionId,
                };
              } else if (sourceType === "Payment" && data) {
                const record = data as AdminPaymentRecord; 
                transformed = {
                  id,
                  transactionDisplayId: `PAY-${record.virtualTransactionId || id.substring(0,6)}`,
                  direction: "Sent", 
                  dateTime: parseDateTimeForSort(record.paymentDate, record.paymentTime, record.recordedAt),
                  fromParty: "Sendhur Chits (Company)",
                  toParty: `User: ${record.userFullname} (${record.userUsername})`,
                  amount: record.amount,
                  mode: record.paymentMode,
                  remarksOrSource: record.remarks || `Payment for Group: ${record.groupName || 'N/A'}`,
                  originalSource: "Payment",
                  virtualTransactionId: record.virtualTransactionId,
                };
              } else if (sourceType === "Salary" && data) {
                const record = data as SalaryRecord;
                transformed = {
                  id,
                  transactionDisplayId: `SAL-${record.virtualTransactionId || id.substring(0,6)}`,
                  direction: "Sent",
                  dateTime: parseDateTimeForSort(record.paymentDate, undefined, record.recordedAt),
                  fromParty: "Sendhur Chits (Company)",
                  toParty: `Employee: ${record.employeeName} (${record.employeeReadableId})`,
                  amount: record.amount,
                  mode: "Bank Transfer", 
                  remarksOrSource: record.remarks || `Salary for ${record.employeeName}`,
                  originalSource: "Salary",
                  virtualTransactionId: record.virtualTransactionId,
                };
              } else if (sourceType === "Expense" && data) {
                const record = data as ExpenseRecord;
                transformed = {
                  id,
                  transactionDisplayId: `EXP-${record.virtualTransactionId || id.substring(0,6)}`,
                  direction: record.type === "spend" ? "Sent" : "Received",
                  dateTime: parseDateTimeForSort(record.date, record.time, record.recordedAt),
                  fromParty: record.type === "spend" ? "Sendhur Chits (Company)" : (record.fromPerson || "Unknown Source"),
                  toParty: record.type === "spend" ? (record.reason || "Expense") : "Sendhur Chits (Company)",
                  amount: record.amount,
                  mode: record.paymentMode || (record.type === "spend" ? "Company Account" : "N/A"),
                  remarksOrSource: record.remarks || (record.type === "spend" ? record.reason : `Income from ${record.fromPerson}` ) || "Expense Record",
                  originalSource: "Expense",
                  virtualTransactionId: record.virtualTransactionId,
                };
              } else if (sourceType === "Credit" && data) {
                const record = data as CreditRecord;
                transformed = {
                  id,
                  transactionDisplayId: `CRED-${record.virtualTransactionId || id.substring(0,6)}`,
                  direction: "Received",
                  dateTime: parseDateTimeForSort(record.paymentDate, undefined, record.recordedAt),
                  fromParty: record.fromName,
                  toParty: "Sendhur Chits (Company)",
                  amount: record.amount,
                  mode: record.paymentMode,
                  remarksOrSource: record.remarks || `Credit from ${record.fromName}`,
                  originalSource: "Credit",
                  virtualTransactionId: record.virtualTransactionId,
                };
              }
              if (transformed) combinedTransactions.push(transformed);
            });
          } else {
            console.error(`Master Record: Error fetching from ${collectionsToFetch[index].name}:`, result.reason);
            setError(prev => {
                const newError = `Failed to load ${collectionsToFetch[index].name}.`;
                return prev ? `${prev}\n${newError}` : newError;
            });
          }
        });
        
        combinedTransactions.sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());
        setRawAllTransactions(combinedTransactions);
      } catch (err) {
        console.error("Master Record: Main fetch error:", err);
        setError("Failed to load master transaction records. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  useEffect(() => {
    let tempFiltered = [...rawAllTransactions];
    if (selectedFilter !== "all") {
      const now = new Date();
      let startDate: Date;
      let endDate: Date | null = null;
      if (selectedFilter === "today") {
        startDate = startOfDay(now);
        endDate = endOfDay(now);
      } else if (selectedFilter === "last7Days") {
        startDate = startOfDay(subDays(now, 6));
        endDate = endOfDay(now);
      } else if (selectedFilter === "last10Days") {
        startDate = startOfDay(subDays(now, 9));
        endDate = endOfDay(now);
      } else if (selectedFilter === "last30Days") {
        startDate = startOfDay(subDays(now, 29));
        endDate = endOfDay(now);
      } else {
        startDate = new Date(0);
      }
      tempFiltered = tempFiltered.filter(tx => {
        const recordDate = tx.dateTime;
        if (endDate) {
          return isAfter(recordDate, startDate) && recordDate <= endDate;
        }
        return isAfter(recordDate, startDate);
      });
    }
    if (searchTerm.trim() !== "") {
      const lowercasedSearchTerm = searchTerm.toLowerCase().trim();
      tempFiltered = tempFiltered.filter(tx =>
        tx.virtualTransactionId?.toLowerCase().includes(lowercasedSearchTerm)
      );
    }
    setFilteredTransactions(tempFiltered);
  }, [selectedFilter, rawAllTransactions, searchTerm]);

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    const formatCurrencyPdf = (amount: number | null | undefined) => (amount === null || amount === undefined || isNaN(amount)) ? "N/A" : `Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const tableColumn = ["S.No", "Direction", "Date & Time", "From", "To", "Amount", "Mode", "Remarks/Source", "Type", "Virtual ID"];
    const tableRows: any[][] = filteredTransactions.map((tx, index) => [
      index + 1, tx.direction, formatDateSafe(tx.dateTime), tx.fromParty, tx.toParty,
      formatCurrencyPdf(tx.amount), tx.mode || "N/A", tx.remarksOrSource, tx.originalSource, tx.virtualTransactionId || "N/A",
    ]);
    const filterLabel: Record<PaymentFilterType, string> = { all: "All Time", today: "Today", last7Days: "Last 7 Days", last10Days: "Last 10 Days", last30Days: "Last 30 Days" };
    doc.setFontSize(18); doc.text(`Master Financial Record (Employee View)`, 14, 15);
    doc.setFontSize(12); doc.text(`Filter: ${filterLabel[selectedFilter]}`, 14, 22);
    if (searchTerm.trim() !== "") {
        doc.text(`Search: "${searchTerm}"`, 14, 29);
        autoTable(doc, { head: [tableColumn], body: tableRows, startY: 36, theme: 'grid', headStyles: { fillColor: [30, 144, 255] }, styles: { fontSize: 6, cellPadding: 1 }, columnStyles: { 0: { cellWidth: 7 }, 5: { cellWidth: 20, halign: 'right'}, 6: { cellWidth: 15 }, 8: { cellWidth: 15 }, 9: { cellWidth: 18 } }, });
    } else {
        autoTable(doc, { head: [tableColumn], body: tableRows, startY: 35, theme: 'grid', headStyles: { fillColor: [30, 144, 255] }, styles: { fontSize: 7, cellPadding: 1.5 }, columnStyles: { 0: { cellWidth: 8 }, 5: { cellWidth: 20, halign: 'right'}, 6: { cellWidth: 15 }, 8: { cellWidth: 15 }, 9: { cellWidth: 18 } }, });
    }
    doc.save(`master_financial_record_employee_${selectedFilter}_search_${searchTerm || 'none'}.pdf`);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">Loading master record...</p>
      </div>
    );
  }

  if (error && filteredTransactions.length === 0) { 
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
            <Button onClick={() => window.location.reload()} className="mt-6">Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <BookOpenCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Master Financial Record (Employee)</h1>
            <p className="text-muted-foreground">A comprehensive overview of all transactions.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 sm:mt-0">
          <Button variant="outline" asChild size="sm">
            <Link href="/employee/payments"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
          </Button>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input type="text" placeholder="Search by Virtual ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-full shadow-sm" />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="w-full sm:w-auto"><Filter className="mr-2 h-4 w-4" /> Filter</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filter by Date</DropdownMenuLabel><DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setSelectedFilter("all")}>All Time</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSelectedFilter("today")}>Today</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSelectedFilter("last7Days")}>Last 7 Days</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSelectedFilter("last10Days")}>Last 10 Days</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSelectedFilter("last30Days")}>Last 30 Days</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={filteredTransactions.length === 0} className="w-full sm:w-auto"><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
        </div>
      </div>
      <Card className="shadow-lg">
        <CardHeader><CardTitle>All Transactions</CardTitle>
          <CardDescription>Sorted by most recent first. Filtered by: {selectedFilter}. {searchTerm && ` Searched for: "${searchTerm}".`} {error && <span className="text-destructive text-xs block mt-1">Note: Some data may have failed to load.</span>}</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 && !error ? (<p className="text-muted-foreground text-center py-10">No transactions found {selectedFilter !== 'all' ? `for the selected period` : ''}{searchTerm ? ` matching "${searchTerm}"` : ''}.</p>) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>S.No</TableHead><TableHead>Direction</TableHead><TableHead>Date & Time</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead className="text-right">Amount (₹)</TableHead><TableHead>Mode</TableHead><TableHead>Remarks/Source</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx, index) => {
                    const transactionKey = tx.id + tx.originalSource; 
                    const isExpanded = expandedRows[transactionKey];
                    return (<React.Fragment key={transactionKey}>
                        <TableRow>
                          <TableCell><div className="flex items-center"><Button variant="ghost" size="sm" onClick={() => toggleRowExpansion(transactionKey)} className="mr-1 p-1 h-auto">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button>{index + 1}</div>{isExpanded && (<div className="pl-7 mt-1 text-xs text-muted-foreground">Virtual ID: {tx.virtualTransactionId || "N/A"}</div>)}</TableCell>
                          <TableCell><span className={cn("font-semibold px-2 py-1 rounded-full text-xs", tx.direction === "Sent" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300")}>{tx.direction}</span></TableCell>
                          <TableCell>{formatDateSafe(tx.dateTime)}</TableCell><TableCell>{tx.fromParty}</TableCell><TableCell>{tx.toParty}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(tx.amount)}</TableCell><TableCell>{tx.mode || "N/A"}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{tx.remarksOrSource}</TableCell>
                          <TableCell><span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">{tx.originalSource}</span></TableCell>
                        </TableRow>
                      </React.Fragment>);
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
