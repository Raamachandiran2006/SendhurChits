
"use client";

import React, { useEffect, useState, useMemo } from "react";
import type { CollectionRecord } from "@/types";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query as firestoreQuery, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, ArchiveRestore, PlusCircle, ArrowLeft, ListChecks, ChevronRight, ChevronDown, Filter, Download, ReceiptText, Search } from "lucide-react"; // Added Search
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format, parseISO, subDays, isAfter, startOfDay, endOfDay } from "date-fns";
import { useSearchParams } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input"; // Added Input
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type CollectionFilterType = "all" | "today" | "last7Days" | "last10Days" | "last30Days";

const formatDateSafe = (dateInput: Date | string | Timestamp | undefined | null, outputFormat: string = "dd MMM yy") => {
  if (!dateInput) return "N/A";
  try {
    let date: Date;
    if (dateInput instanceof Timestamp) {
      date = dateInput.toDate();
    } else if (typeof dateInput === 'string') {
      const parsedDate = new Date(dateInput.replace(/-/g, '/'));
      if (isNaN(parsedDate.getTime())) {
        const isoParsed = parseISO(dateInput);
        if (isNaN(isoParsed.getTime())) return "N/A";
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

const formatDateTimeForSort = (dateStr?: string, timeStr?: string, recordTimestamp?: Timestamp): Date => {
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
  return `₹${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};


export default function AdminCollectionPage() {
  const [rawCollectionHistory, setRawCollectionHistory] = useState<CollectionRecord[]>([]);
  const [filteredCollectionHistory, setFilteredCollectionHistory] = useState<CollectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParamsHook = useSearchParams(); // Renamed to avoid conflict
  const refreshId = searchParamsHook.get('refreshId');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [selectedFilter, setSelectedFilter] = useState<CollectionFilterType>("all");
  const [searchTerm, setSearchTerm] = useState(""); // New state for search term

  const toggleRowExpansion = (recordId: string) => {
    setExpandedRows(prev => ({ ...prev, [recordId]: !prev[recordId] }));
  };

  useEffect(() => {
    const fetchCollectionHistory = async () => {
      setLoading(true);
      try {
        const collectionsRef = collection(db, "collectionRecords"); 
        const q = firestoreQuery(collectionsRef, orderBy("recordedAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedHistory = querySnapshot.docs.map(doc => {
          const data = doc.data() as CollectionRecord;
          return { 
            id: doc.id, 
            ...data,
            filterDate: formatDateTimeForSort(data.paymentDate, data.paymentTime, data.recordedAt)
          } as CollectionRecord & { filterDate: Date };
        });
        setRawCollectionHistory(fetchedHistory as any);
      } catch (error) {
        console.error("Error fetching collection history:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCollectionHistory();
  }, [refreshId]);

  useEffect(() => {
    let tempFiltered = [...rawCollectionHistory]; // Start with a copy of raw data

    // Apply date filter
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
        // Should not happen if selectedFilter is one of the valid types
        startDate = new Date(0); // Effectively no start date filter
      }
      
      tempFiltered = tempFiltered.filter(record => {
        const recordDate = (record as any).filterDate || (record.recordedAt ? record.recordedAt.toDate() : new Date(0));
        if (endDate) {
          return isAfter(recordDate, startDate) && recordDate <= endDate;
        }
        return isAfter(recordDate, startDate);
      });
    }

    // Apply search filter
    if (searchTerm.trim() !== "") {
      const lowercasedSearchTerm = searchTerm.toLowerCase().trim();
      tempFiltered = tempFiltered.filter(record =>
        (record.virtualTransactionId?.toLowerCase().includes(lowercasedSearchTerm)) ||
        (record.receiptNumber?.toLowerCase().includes(lowercasedSearchTerm))
      );
    }

    setFilteredCollectionHistory(tempFiltered);
  }, [selectedFilter, rawCollectionHistory, searchTerm]);


  const totalFilteredAmount = useMemo(() => {
    return filteredCollectionHistory.reduce((sum, record) => sum + (record.amount || 0), 0);
  }, [filteredCollectionHistory]);

  const handleDownloadPdf = () => {
    if (filteredCollectionHistory.length === 0) {
      alert("No data to download.");
      return;
    }
    const doc = new jsPDF();
    const formatCurrencyPdf = (amount: number | null | undefined) => {
      if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
      return `Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    };
    
    const tableColumn = ["S.No", "Group Name", "User", "Date & Time", "Amount (Rs.)", "Type", "Mode", "Location", "Collected By", "Remarks", "Virtual ID", "Receipt No."];
    const tableRows: any[][] = [];

    filteredCollectionHistory.forEach((record, index) => {
      const recordData = [
        index + 1,
        record.groupName,
        `${record.userFullname} (${record.userUsername})`,
        `${formatDateSafe(record.paymentDate)} ${record.paymentTime || ''}`,
        formatCurrencyPdf(record.amount),
        record.paymentType,
        record.paymentMode,
        record.collectionLocation && record.collectionLocation.startsWith('http') ? "Map Link" : record.collectionLocation || "N/A",
        record.recordedByEmployeeName || "N/A",
        record.remarks || "N/A",
        record.virtualTransactionId || "N/A",
        record.receiptNumber || "N/A",
      ];
      tableRows.push(recordData);
    });
    
    const filterLabel: Record<CollectionFilterType, string> = { 
      all: "All Time", 
      today: "Today",
      last7Days: "Last 7 Days", 
      last10Days: "Last 10 Days", 
      last30Days: "Last 30 Days" 
    };

    doc.setFontSize(18);
    doc.text(`Admin Collection History`, 14, 15);
    doc.setFontSize(12);
    doc.text(`Filter: ${filterLabel[selectedFilter]}`, 14, 22);
    if (searchTerm.trim() !== "") {
        doc.text(`Search: "${searchTerm}"`, 14, 29);
        autoTable(doc, { head: [tableColumn], body: tableRows, startY: 36, theme: 'grid', headStyles: { fillColor: [30, 144, 255] }, styles: { fontSize: 6, cellPadding: 1 }, columnStyles: { 0: { cellWidth: 7 }, 4: { halign: 'right' }, 7: { cellWidth: 'auto', overflow: 'linebreak' } }, });
    } else {
        autoTable(doc, { head: [tableColumn], body: tableRows, startY: 35, theme: 'grid', headStyles: { fillColor: [30, 144, 255] }, styles: { fontSize: 7, cellPadding: 1.5 }, columnStyles: { 0: { cellWidth: 8 }, 4: { halign: 'right' }, 7: { cellWidth: 'auto', overflow: 'linebreak' } }, });
    }
    doc.save(`admin_collection_history_${selectedFilter}_search_${searchTerm || 'none'}.pdf`);
  };


  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <ArchiveRestore className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Collection Management (Admin)</h1>
            <p className="text-muted-foreground">Record and view collected payments.</p>
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
                <DropdownMenuItem onSelect={() => setSelectedFilter("today")}>Today</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSelectedFilter("last7Days")}>Last 7 Days</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSelectedFilter("last10Days")}>Last 10 Days</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSelectedFilter("last30Days")}>Last 30 Days</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={filteredCollectionHistory.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </Button>
            <Button variant="outline" asChild size="sm">
                <Link href="/admin">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Admin Overview
                </Link>
            </Button>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90" size="sm">
            <Link href="/admin/collection/record">
                <PlusCircle className="mr-2 h-4 w-4" /> Record Collection
            </Link>
            </Button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by Virtual ID or Receipt No..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full max-w-md shadow-sm"
          />
        </div>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-primary" />
            <CardTitle>Collection History</CardTitle>
          </div>
          <CardDescription>
            Chronological record of all collected payments (latest first). 
            Filtered by: {selectedFilter}.
            {searchTerm && ` Searched for: "${searchTerm}".`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-4 text-lg text-foreground">Loading collection history...</p>
            </div>
          ) : filteredCollectionHistory.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">
                No collection records found 
                {selectedFilter !== 'all' ? ` for the selected period` : ''}
                {searchTerm ? ` matching "${searchTerm}"` : ''}. 
                { !searchTerm && <>{' '}Click "Record Collection" to add one.</>}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S.No</TableHead>
                    <TableHead>Group Name</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Collected By</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead>Receipt No.</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCollectionHistory.map((record, index) => {
                    const isExpanded = expandedRows[record.id];
                    return (
                    <React.Fragment key={record.id}>
                      <TableRow>
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
                        </TableCell>
                        <TableCell>{record.groupName}</TableCell>
                        <TableCell>
                          {record.userFullname}<br/>
                          <span className="text-xs text-muted-foreground">({record.userUsername})</span>
                        </TableCell>
                        <TableCell>
                          {formatDateSafe(record.paymentDate)}<br/>
                          <span className="text-xs text-muted-foreground">{record.paymentTime}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(record.amount)}</TableCell>
                        <TableCell>{record.paymentType}</TableCell>
                        <TableCell>{record.paymentMode}</TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {record.collectionLocation && record.collectionLocation.startsWith('http') ? (
                            <a href={record.collectionLocation} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              View on Map
                            </a>
                          ) : (
                            record.collectionLocation || "N/A"
                          )}
                        </TableCell>
                        <TableCell>{record.recordedByEmployeeName || "N/A"}</TableCell>
                        <TableCell className="max-w-xs truncate">{record.remarks || "N/A"}</TableCell>
                        <TableCell>{record.receiptNumber || "N/A"}</TableCell>
                        <TableCell>
                          <Button asChild variant="ghost" size="icon">
                            <Link href={`/admin/collection/receipt/${record.id}`} title="View Receipt">
                              <ReceiptText className="h-4 w-4 text-primary" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  )})}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="text-right font-semibold">Total Amount:</TableCell>
                    <TableCell className="text-right font-bold font-mono">{formatCurrency(totalFilteredAmount)}</TableCell>
                    <TableCell colSpan={7}></TableCell> {/* Adjusted colSpan */}
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    