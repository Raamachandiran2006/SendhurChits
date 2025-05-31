
"use client";

import React, { useEffect, useState } from "react";
import type { ExpenseRecord } from "@/types";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query as firestoreQuery, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Receipt, PlusCircle, ArrowLeft, ListChecks, Loader2, ChevronRight, ChevronDown, Filter, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO, subDays, isAfter } from "date-fns";
import { useSearchParams } from "next/navigation";
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

type ExpenseFilterType = "all" | "last7Days" | "last10Days" | "last30Days";

export default function EmployeeExpensesManagementPage() {
  const [rawExpenseHistory, setRawExpenseHistory] = useState<ExpenseRecord[]>([]);
  const [filteredExpenseHistory, setFilteredExpenseHistory] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const refreshId = searchParams.get('refreshId');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [selectedFilter, setSelectedFilter] = useState<ExpenseFilterType>("all");

  const toggleRowExpansion = (recordId: string) => {
    setExpandedRows(prev => ({ ...prev, [recordId]: !prev[recordId] }));
  };

  useEffect(() => {
    const fetchExpenseHistory = async () => {
      setLoading(true);
      try {
        const historyRef = collection(db, "expenses");
        const q = firestoreQuery(historyRef, orderBy("recordedAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedHistory = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpenseRecord));
        setRawExpenseHistory(fetchedHistory);
        setFilteredExpenseHistory(fetchedHistory);
      } catch (error) {
        console.error("Error fetching expense history:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchExpenseHistory();
  }, [refreshId]);

  useEffect(() => {
    const applyFilter = () => {
      if (selectedFilter === "all") {
        setFilteredExpenseHistory(rawExpenseHistory); return;
      }
      const now = new Date(); let startDate: Date;
      if (selectedFilter === "last7Days") startDate = subDays(now, 7);
      else if (selectedFilter === "last10Days") startDate = subDays(now, 10);
      else if (selectedFilter === "last30Days") startDate = subDays(now, 30);
      else { setFilteredExpenseHistory(rawExpenseHistory); return; }
      startDate.setHours(0, 0, 0, 0); 
      const filtered = rawExpenseHistory.filter(record => {
        if (!record.recordedAt) return false;
        const recordDate = record.recordedAt.toDate();
        return isAfter(recordDate, startDate);
      });
      setFilteredExpenseHistory(filtered);
    };
    applyFilter();
  }, [selectedFilter, rawExpenseHistory]);

  const formatDateSafe = (dateString: string | undefined | null, dateFormat: string = "dd MMM yyyy"): string => (dateString ? format(parseISO(dateString), dateFormat) : "N/A");
  const formatTimestamp = (timestamp: any, dateFormat: string = "dd MMM yyyy, HH:mm"): string => (timestamp && typeof timestamp.toDate === 'function' ? format(timestamp.toDate(), dateFormat) : "N/A");
  const formatCurrencyPdf = (amount: number | null | undefined) => (amount === null || amount === undefined || isNaN(amount)) ? "N/A" : `Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleDownloadPdf = () => {
    if (filteredExpenseHistory.length === 0) { alert("No data to download."); return; }
    const doc = new jsPDF();
    const tableColumn = ["S.No", "Recorded At", "Type", "Date & Time", "Amount", "Details/Source", "Remarks", "Virtual ID"];
    const tableRows: any[][] = filteredExpenseHistory.map((record, index) => [
      index + 1, formatTimestamp(record.recordedAt), record.type, `${formatDateSafe(record.date)} ${record.type === 'spend' && record.time ? `at ${record.time}` : ''}`,
      formatCurrencyPdf(record.amount), record.type === 'spend' ? record.reason : record.fromPerson, record.remarks || "N/A", record.virtualTransactionId || "N/A",
    ]);
    const filterLabel = { all: "All Time", last7Days: "Last 7 Days", last10Days: "Last 10 Days", last30Days: "Last 30 Days" };
    doc.setFontSize(18); doc.text(`Expense Records (Employee View)`, 14, 15);
    doc.setFontSize(12); doc.text(`Filter: ${filterLabel[selectedFilter]}`, 14, 22); doc.text(`Generated on: ${format(new Date(), "dd MMM yyyy, hh:mm a")}`, 14, 29);
    autoTable(doc, {
      head: [tableColumn], body: tableRows, startY: 35, theme: 'grid', headStyles: { fillColor: [30, 144, 255] }, styles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 25 }, 2: { cellWidth: 15 }, 3: { cellWidth: 25 }, 4: { cellWidth: 20, halign: 'right' }, 5: { cellWidth: 'auto' }, 6: { cellWidth: 'auto' }, 7: { cellWidth: 18 } },
    });
    doc.save(`employee_expense_records_${selectedFilter}.pdf`);
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Receipt className="h-8 w-8 text-primary" />
          <div><h1 className="text-3xl font-bold text-foreground">Expenses Management (Employee)</h1><p className="text-muted-foreground">Track and manage expenses.</p></div>
        </div>
        <div className="flex items-center gap-2 mt-4 sm:mt-0">
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Filter className="mr-2 h-4 w-4" /> Filter</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end"><DropdownMenuLabel>Filter by Date</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setSelectedFilter("all")}>All Time</DropdownMenuItem><DropdownMenuItem onSelect={() => setSelectedFilter("last7Days")}>Last 7 Days</DropdownMenuItem><DropdownMenuItem onSelect={() => setSelectedFilter("last10Days")}>Last 10 Days</DropdownMenuItem><DropdownMenuItem onSelect={() => setSelectedFilter("last30Days")}>Last 30 Days</DropdownMenuItem></DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={filteredExpenseHistory.length === 0}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
            <Button variant="outline" asChild size="sm"><Link href="/employee/payments"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90" size="sm"><Link href="/employee/payments/expenses/add"><PlusCircle className="mr-2 h-4 w-4" /> Add Expense</Link></Button>
        </div>
      </div>
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-2"><ListChecks className="h-6 w-6 text-primary" /><CardTitle>Expenses Transaction History</CardTitle></div>
          <CardDescription>Chronological record of all expenses. Filtered by: {selectedFilter}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (<div className="flex justify-center items-center py-10"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-4 text-lg text-foreground">Loading expense history...</p></div>) : 
           filteredExpenseHistory.length === 0 ? (<div className="text-center py-10"><p className="text-muted-foreground">No expense records found {selectedFilter !== 'all' ? `for the selected period` : ''}. Click "Add Expense Record" to add one.</p></div>) : (
            <div className="overflow-x-auto rounded-md border">
              <Table><TableHeader><TableRow><TableHead>S.No</TableHead><TableHead>Recorded At</TableHead><TableHead>Type</TableHead><TableHead>Date & Time</TableHead><TableHead className="text-right">Amount (₹)</TableHead><TableHead>Details/Source</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredExpenseHistory.map((record, index) => {
                    const isExpanded = expandedRows[record.id];
                    return (<React.Fragment key={record.id}>
                        <TableRow>
                          <TableCell><div className="flex items-center"><Button variant="ghost" size="sm" onClick={() => toggleRowExpansion(record.id)} className="mr-1 p-1 h-auto">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button>{index + 1}</div>{isExpanded && (<div className="pl-7 mt-1 text-xs text-muted-foreground">Virtual ID: {record.virtualTransactionId || "N/A"}</div>)}</TableCell>
                          <TableCell>{formatTimestamp(record.recordedAt)}</TableCell><TableCell className="capitalize">{record.type}</TableCell>
                          <TableCell>{formatDateSafe(record.date)}{record.type === 'spend' && record.time ? ` at ${record.time}` : ''}</TableCell>
                          <TableCell className="text-right font-mono">₹{record.amount.toLocaleString()}</TableCell>
                          <TableCell className="max-w-xs truncate">{record.type === 'spend' ? record.reason : record.fromPerson}{record.type === 'received' && record.paymentMode ? ` (Mode: ${record.paymentMode})` : ''}</TableCell>
                          <TableCell className="max-w-xs truncate">{record.remarks || "N/A"}</TableCell>
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
