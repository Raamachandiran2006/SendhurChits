
"use client";

import React, { useEffect, useState, useMemo } from "react";
import type { CreditRecord } from "@/types";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query as firestoreQuery, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, PlusCircle, ListChecks, ArrowLeft, Banknote, Filter, Download, ChevronRight, ChevronDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type CreditFilterType = "all" | "today" | "last7Days" | "last10Days" | "last30Days";

const formatDateSafe = (dateInput: Date | string | Timestamp | undefined | null, outputFormat: string = "dd MMM yy") => {
  if (!dateInput) return "N/A";
  try {
    let date: Date;
    if (dateInput instanceof Timestamp) date = dateInput.toDate();
    else if (typeof dateInput === 'string') {
      const parsedDate = new Date(dateInput.replace(/-/g, '/'));
      if (isNaN(parsedDate.getTime())) {
        const isoParsed = parseISO(dateInput);
        if (isNaN(isoParsed.getTime())) return "N/A";
        date = isoParsed;
      } else date = parsedDate;
    } else if (dateInput instanceof Date) date = dateInput;
    else return "N/A";
    if (isNaN(date.getTime())) return "N/A";
    return format(date, outputFormat);
  } catch (e) { console.error("Error formatting date:", dateInput, e); return "N/A"; }
};

const formatCurrency = (amount: number | null | undefined) => (amount === null || amount === undefined || isNaN(amount)) ? "N/A" : `₹${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function EmployeeCreditManagementPage() {
  const [rawCreditHistory, setRawCreditHistory] = useState<CreditRecord[]>([]);
  const [filteredCreditHistory, setFilteredCreditHistory] = useState<CreditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const refreshId = searchParams.get('refreshId');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [selectedFilter, setSelectedFilter] = useState<CreditFilterType>("all");

  const toggleRowExpansion = (recordId: string) => setExpandedRows(prev => ({ ...prev, [recordId]: !prev[recordId] }));

  useEffect(() => {
    const fetchCreditHistory = async () => {
      setLoading(true);
      try {
        const creditsRef = collection(db, "creditRecords");
        const q = firestoreQuery(creditsRef, orderBy("recordedAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedHistory = querySnapshot.docs.map(doc => {
          const data = doc.data() as CreditRecord;
          return { id: doc.id, ...data, filterDate: data.recordedAt ? data.recordedAt.toDate() : (data.paymentDate ? parseISO(data.paymentDate) : new Date(0)) } as CreditRecord & { filterDate: Date };
        });
        setRawCreditHistory(fetchedHistory);
        setFilteredCreditHistory(fetchedHistory);
      } catch (error) { console.error("Error fetching credit history:", error); } 
      finally { setLoading(false); }
    };
    fetchCreditHistory();
  }, [refreshId]);

  useEffect(() => {
    const applyFilter = () => {
      if (selectedFilter === "all") { setFilteredCreditHistory(rawCreditHistory); return; }
      const now = new Date(); let startDate: Date; let endDate: Date | null = null;
      if (selectedFilter === "today") { startDate = startOfDay(now); endDate = endOfDay(now); } 
      else if (selectedFilter === "last7Days") { startDate = startOfDay(subDays(now, 6)); endDate = endOfDay(now); } 
      else if (selectedFilter === "last10Days") { startDate = startOfDay(subDays(now, 9)); endDate = endOfDay(now); } 
      else if (selectedFilter === "last30Days") { startDate = startOfDay(subDays(now, 29)); endDate = endOfDay(now); } 
      else { setFilteredCreditHistory(rawCreditHistory); return; }
      const filtered = rawCreditHistory.filter(record => {
        const recordDate = record.filterDate;
        if (endDate) return isAfter(recordDate, startDate) && recordDate <= endDate;
        return isAfter(recordDate, startDate);
      });
      setFilteredCreditHistory(filtered);
    };
    applyFilter();
  }, [selectedFilter, rawCreditHistory]);

  const handleDownloadPdf = () => {
    if (filteredCreditHistory.length === 0) { alert("No data to download."); return; }
    const doc = new jsPDF();
    const formatCurrencyPdf = (amount: number | null | undefined) => (amount === null || amount === undefined || isNaN(amount)) ? "N/A" : `Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    const tableColumn = ["S.No", "From Name", "Credit No.", "Date", "Amount (Rs.)", "Mode", "Remarks", "Virtual ID"];
    const tableRows: any[][] = filteredCreditHistory.map((record, index) => [
      index + 1, record.fromName, record.creditNumber || "N/A", formatDateSafe(record.paymentDate),
      formatCurrencyPdf(record.amount), record.paymentMode, record.remarks, record.virtualTransactionId || "N/A",
    ]);
    const filterLabel: Record<CreditFilterType, string> = { all: "All Time", today: "Today", last7Days: "Last 7 Days", last10Days: "Last 10 Days", last30Days: "Last 30 Days" };
    doc.setFontSize(18); doc.text(`Credit Transaction History (Employee View)`, 14, 15);
    doc.setFontSize(12); doc.text(`Filter: ${filterLabel[selectedFilter]}`, 14, 22); doc.text(`Generated on: ${format(new Date(), "dd MMM yyyy, hh:mm a")}`, 14, 29);
    autoTable(doc, {
      head: [tableColumn], body: tableRows, startY: 35, theme: 'grid', headStyles: { fillColor: [30, 144, 255] }, styles: { fontSize: 8, cellPadding: 1.5 },
      columnStyles: { 0: { cellWidth: 8 }, 4: { halign: 'right' } },
    });
    doc.save(`employee_credit_history_${selectedFilter}.pdf`);
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Banknote className="h-8 w-8 text-primary" />
          <div><h1 className="text-3xl font-bold text-foreground">Credit Management (Employee)</h1><p className="text-muted-foreground">Track and manage credit transactions.</p></div>
        </div>
        <div className="flex items-center gap-2 mt-4 sm:mt-0">
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Filter className="mr-2 h-4 w-4" /> Filter</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end"><DropdownMenuLabel>Filter by Date</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setSelectedFilter("all")}>All Time</DropdownMenuItem><DropdownMenuItem onSelect={() => setSelectedFilter("today")}>Today</DropdownMenuItem><DropdownMenuItem onSelect={() => setSelectedFilter("last7Days")}>Last 7 Days</DropdownMenuItem><DropdownMenuItem onSelect={() => setSelectedFilter("last10Days")}>Last 10 Days</DropdownMenuItem><DropdownMenuItem onSelect={() => setSelectedFilter("last30Days")}>Last 30 Days</DropdownMenuItem></DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={filteredCreditHistory.length === 0}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
          <Button variant="outline" asChild size="sm"><Link href="/employee/payments"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
          <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90" size="sm"><Link href="/employee/payments/credit/record"><PlusCircle className="mr-2 h-4 w-4" /> Add Credit</Link></Button>
        </div>
      </div>
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-2"><ListChecks className="h-6 w-6 text-primary" /><CardTitle>Credit Transaction History</CardTitle></div>
          <CardDescription>Chronological record of credit transactions. Filtered by: {selectedFilter}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (<div className="flex justify-center items-center py-10"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-4 text-lg text-foreground">Loading...</p></div>) : 
           filteredCreditHistory.length === 0 ? (<div className="text-center py-10"><p className="text-muted-foreground">No credit records found {selectedFilter !== 'all' ? `for selected period` : ''}.</p></div>) : (
            <div className="overflow-x-auto rounded-md border">
              <Table><TableHeader><TableRow><TableHead>S.No</TableHead><TableHead>From Name</TableHead><TableHead>Credit No.</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount (₹)</TableHead><TableHead>Mode</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredCreditHistory.map((record, index) => {
                    const isExpanded = expandedRows[record.id];
                    return (<React.Fragment key={record.id}>
                        <TableRow>
                          <TableCell><div className="flex items-center"><Button variant="ghost" size="sm" onClick={() => toggleRowExpansion(record.id)} className="mr-1 p-1 h-auto">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button>{index + 1}</div>{isExpanded && (<div className="pl-7 mt-1 text-xs text-muted-foreground">Virtual ID: {record.virtualTransactionId || "N/A"}</div>)}</TableCell>
                          <TableCell>{record.fromName}</TableCell><TableCell>{record.creditNumber || "N/A"}</TableCell><TableCell>{formatDateSafe(record.paymentDate)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(record.amount)}</TableCell><TableCell>{record.paymentMode}</TableCell><TableCell>{record.remarks}</TableCell>
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
