
"use client";

import React, { useEffect, useState } from "react"; // Added React import
import type { CollectionRecord, Employee } from "@/types";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query as firestoreQuery, where } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, ArchiveRestore, PlusCircle, ArrowLeft, ListChecks, ChevronRight, ChevronDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "next/navigation";

const formatDateSafe = (dateString: string | undefined | null, outputFormat: string = "dd MMM yyyy") => {
  if (!dateString) return "N/A";
  try {
    const date = parseISO(dateString);
    if (isNaN(date.getTime())) return "N/A";
    return format(date, outputFormat);
  } catch (e) {
    return "N/A";
  }
};

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
  return `₹${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};


export default function EmployeeCollectionPage() {
  const { loggedInEntity } = useAuth();
  const employee = loggedInEntity as Employee | null;
  const [collectionHistory, setCollectionHistory] = useState<CollectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const refreshId = searchParams.get('refreshId');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRowExpansion = (recordId: string) => {
    setExpandedRows(prev => ({ ...prev, [recordId]: !prev[recordId] }));
  };

  useEffect(() => {
    const fetchCollectionHistory = async () => {
      if (!employee) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const collectionsRef = collection(db, "collectionRecords"); 
        const q = firestoreQuery(collectionsRef, orderBy("recordedAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedHistory = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollectionRecord));
        setCollectionHistory(fetchedHistory);
      } catch (error) {
        console.error("Error fetching collection history:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCollectionHistory();
  }, [employee, refreshId]);

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <ArchiveRestore className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Collection Management</h1>
            <p className="text-muted-foreground">Record and view collected payments.</p>
          </div>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0">
            <Button variant="outline" asChild>
                <Link href="/employee/dashboard">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                </Link>
            </Button>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link href="/employee/collection/record">
                <PlusCircle className="mr-2 h-4 w-4" /> Record Collection
            </Link>
            </Button>
        </div>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-primary" />
            <CardTitle>Collection History</CardTitle>
          </div>
          <CardDescription>Chronological record of all collected payments (latest first).</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-4 text-lg text-foreground">Loading collection history...</p>
            </div>
          ) : collectionHistory.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No collection records found. Click "Record Collection" to add one.</p>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collectionHistory.map((record, index) => {
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
                          {formatDateSafe(record.paymentDate, "dd MMM yy")}<br/>
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
