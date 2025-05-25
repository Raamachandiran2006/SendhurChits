
"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import type { User, Group, CollectionRecord, PaymentRecord as AdminPaymentRecordType, AuctionRecord } from "@/types";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, documentId, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import {
  Loader2,
  ArrowLeft,
  User as UserIconLucide,
  Info,
  AlertTriangle,
  Phone,
  CalendarDays,
  Home as HomeIcon,
  Users as GroupIcon,
  FileText,
  Shield,
  DollarSign,
  ReceiptText,
  Filter,
  Download,
  ChevronRight,
  ChevronDown,
  Sheet,
  Contact,
  ArchiveRestore // Added ArchiveRestore
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, subDays, isAfter, addDays } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { useToast } from "@/hooks/use-toast";


// Helper functions
const formatDateSafe = (dateInput: string | Date | Timestamp | undefined | null, outputFormat: string = "dd MMMM yyyy"): string => {
  if (!dateInput) return "N/A";
  try {
    let date: Date;
    if (dateInput instanceof Timestamp) date = dateInput.toDate();
    else if (typeof dateInput === 'string') date = dateInput.includes('T') ? parseISO(dateInput) : new Date(dateInput.replace(/-/g, '/'));
    else if (dateInput instanceof Date) date = dateInput;
    else return "N/A";
    if (isNaN(date.getTime())) return "N/A";
    return format(date, outputFormat);
  } catch (e) { return "N/A"; }
};

const formatDateTimeSafe = (dateInput: string | Date | Timestamp | undefined | null, outputFormat: string = "dd MMM yy, hh:mm a"): string => {
    return formatDateSafe(dateInput, outputFormat);
};

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
  return `₹${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    } else { baseDate = d; }
  } else { baseDate = new Date(); }
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


interface EmployeeUserTransaction {
  id: string;
  type: "Sent by User" | "Received by User";
  dateTime: Date;
  fromParty: string;
  toParty: string;
  amount: number;
  mode: string | null;
  remarksOrSource: string | null;
  originalSource: "CollectionRecord" | "PaymentRecord"; 
  virtualTransactionId?: string;
}

type TransactionFilterType = "all" | "last7Days" | "last10Days" | "last30Days";

interface DueSheetItem {
  dueNo: number; 
  groupId: string;
  groupName: string;
  auctionId: string;
  dueDate: string; 
  amount: number; 
  penalty: number;
  paidAmount: number; 
  balance: number; 
  status: 'Paid' | 'Not Paid' | 'Partially Paid';
  paidDateTime?: string; 
}

export default function EmployeeViewUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const userId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rawUserTransactions, setRawUserTransactions] = useState<EmployeeUserTransaction[]>([]);
  const [filteredUserTransactions, setFilteredUserTransactions] = useState<EmployeeUserTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [selectedTransactionFilter, setSelectedTransactionFilter] = useState<TransactionFilterType>("all");
  const [expandedTransactionRows, setExpandedTransactionRows] = useState<Record<string, boolean>>({});
  
  const [dueSheetItems, setDueSheetItems] = useState<DueSheetItem[]>([]);
  const [loadingDueSheet, setLoadingDueSheet] = useState(true);

  const fetchUserDetailsAndRelatedData = useCallback(async () => {
    if (!userId) {
      setError("User ID is missing or invalid.");
      setLoadingUser(false); setLoadingTransactions(false); setLoadingDueSheet(false);
      return;
    }
    setLoadingUser(true); setLoadingTransactions(true); setLoadingDueSheet(true);
    setError(null); setTransactionError(null);

    try {
      // Fetch User Details
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) {
        setError("User not found."); setUser(null); 
        setLoadingUser(false); setLoadingTransactions(false); setLoadingDueSheet(false); return;
      }
      const userData = { id: userDocSnap.id, ...userDocSnap.data() } as User;
      setUser(userData);

      // Fetch User Groups
      const fetchedGroups: Group[] = [];
      if (userData.groups && userData.groups.length > 0) {
        const groupsRef = collection(db, "groups");
        const groupIds = userData.groups.slice(0, 30); 
        if (groupIds.length > 0) {
          const groupQuery = query(groupsRef, where(documentId(), "in", groupIds));
          const groupSnapshots = await getDocs(groupQuery);
          groupSnapshots.docs.forEach(groupDoc => fetchedGroups.push({ id: groupDoc.id, ...groupDoc.data() } as Group));
        }
      }
      setUserGroups(fetchedGroups);
      setLoadingUser(false); 

      // Fetch Payment Transactions
      let combinedTransactions: EmployeeUserTransaction[] = [];
      const collectionsRef = collection(db, "collectionRecords");
      const collectionsQuery = query(collectionsRef, where("userId", "==", userId), orderBy("recordedAt", "desc"));
      const collectionsSnapshot = await getDocs(collectionsQuery);
      collectionsSnapshot.forEach(docSnap => {
        const data = docSnap.data() as CollectionRecord;
        combinedTransactions.push({
          id: docSnap.id, type: "Sent by User", dateTime: parseDateTimeForSort(data.paymentDate, data.paymentTime, data.recordedAt),
          fromParty: `User: ${userData.fullname} (${userData.username})`, toParty: "ChitConnect (Company)", amount: data.amount,
          mode: data.paymentMode, remarksOrSource: data.remarks || `Payment for Group: ${data.groupName}`,
          originalSource: "CollectionRecord", virtualTransactionId: data.virtualTransactionId,
        });
      });
      const paymentsRef = collection(db, "paymentRecords"); 
      const paymentsQuery = query(paymentsRef, where("userId", "==", userId), orderBy("recordedAt", "desc"));
      const paymentsSnapshot = await getDocs(paymentsQuery);
      paymentsSnapshot.forEach(docSnap => {
        const data = docSnap.data() as AdminPaymentRecordType; 
        combinedTransactions.push({
          id: docSnap.id, type: "Received by User", dateTime: parseDateTimeForSort(data.paymentDate, data.paymentTime, data.recordedAt),
          fromParty: "ChitConnect (Company)", toParty: `User: ${userData.fullname} (${userData.username})`, amount: data.amount,
          mode: data.paymentMode, remarksOrSource: data.remarks || `Payment for Group: ${data.groupName || 'N/A'}`,
          originalSource: "PaymentRecord", virtualTransactionId: data.virtualTransactionId,
        });
      });
      combinedTransactions.sort((a,b) => b.dateTime.getTime() - a.dateTime.getTime());
      setRawUserTransactions(combinedTransactions);
      setFilteredUserTransactions(combinedTransactions); 
      setLoadingTransactions(false);

      // Fetch and Process Due Sheet Items
      const processedDueSheetItems: DueSheetItem[] = [];
      if (fetchedGroups.length > 0) { 
        for (const group of fetchedGroups) {
          if (!group || !group.id) continue;
          const groupAuctionRecordsQuery = query(collection(db, "auctionRecords"), where("groupId", "==", group.id), orderBy("auctionNumber", "asc"));
          const groupAuctionRecordsSnapshot = await getDocs(groupAuctionRecordsQuery);
          for (const auctionDoc of groupAuctionRecordsSnapshot.docs) {
            const auctionRecord = { id: auctionDoc.id, ...auctionDoc.data() } as AuctionRecord;
            if (auctionRecord.auctionNumber === undefined || auctionRecord.finalAmountToBePaid === null || auctionRecord.finalAmountToBePaid === undefined) continue;
            const amountDueForInstallment = auctionRecord.finalAmountToBePaid;
            const penaltyChargedForInstallment = 0; // Placeholder
            let totalCollectedForThisDue = 0;
            let latestPaidDate: Date | null = null;
            const collectionForAuctionQuery = query(collection(db, "collectionRecords"), where("userId", "==", userId), where("groupId", "==", group.id), where("auctionNumber", "==", auctionRecord.auctionNumber));
            const collectionsForAuctionSnapshot = await getDocs(collectionForAuctionQuery);
            collectionsForAuctionSnapshot.docs.forEach(colDoc => {
              const colData = colDoc.data() as CollectionRecord;
              totalCollectedForThisDue += colData.amount;
              const paymentDateTime = parseDateTimeForSort(colData.paymentDate, colData.paymentTime, colData.recordedAt);
              if (paymentDateTime && (!latestPaidDate || paymentDateTime > latestPaidDate)) latestPaidDate = paymentDateTime;
            });
            let paidTowardsPenalty = Math.min(totalCollectedForThisDue, penaltyChargedForInstallment);
            let remainingCollectedAfterPenalty = totalCollectedForThisDue - paidTowardsPenalty;
            let paidTowardsPrincipal = Math.min(remainingCollectedAfterPenalty, amountDueForInstallment);
            const balanceOnPrincipal = amountDueForInstallment - paidTowardsPrincipal;
            let status: DueSheetItem['status'] = 'Not Paid';
            if (balanceOnPrincipal <= 0 && amountDueForInstallment > 0) status = 'Paid';
            else if (paidTowardsPrincipal > 0 && balanceOnPrincipal > 0) status = 'Partially Paid';
            processedDueSheetItems.push({
              dueNo: auctionRecord.auctionNumber, groupId: group.id, groupName: group.groupName, auctionId: auctionRecord.id,
              dueDate: formatDateSafe(addDays(parseISO(auctionRecord.auctionDate), 5), "dd MMM yyyy"), amount: amountDueForInstallment,
              penalty: penaltyChargedForInstallment, paidAmount: paidTowardsPrincipal, balance: balanceOnPrincipal, status: status,
              paidDateTime: status === 'Paid' && latestPaidDate ? formatDateTimeSafe(latestPaidDate) : undefined,
            });
          }
        }
      }
      processedDueSheetItems.sort((a,b) => {
        const dateA = parseISO(a.dueDate.replace(/(\d{2}) (\w{3}) (\d{4})/, '$2 $1 $3'));
        const dateB = parseISO(b.dueDate.replace(/(\d{2}) (\w{3}) (\d{4})/, '$2 $1 $3'));
        if (dateA.getTime() !== dateB.getTime()) return dateA.getTime() - dateB.getTime();
        return a.dueNo - b.dueNo;
      }); 
      setDueSheetItems(processedDueSheetItems);
      setLoadingDueSheet(false);

    } catch (err) {
      console.error("Error fetching user details/related data:", err);
      setError("Error loading user details.");
      setLoadingUser(false); setLoadingTransactions(false); setLoadingDueSheet(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUserDetailsAndRelatedData();
  }, [fetchUserDetailsAndRelatedData]);

  useEffect(() => {
    const applyFilter = () => {
      if (selectedTransactionFilter === "all") { setFilteredUserTransactions(rawUserTransactions); return; }
      const now = new Date(); let startDate: Date;
      if (selectedTransactionFilter === "last7Days") startDate = subDays(now, 7);
      else if (selectedTransactionFilter === "last10Days") startDate = subDays(now, 10);
      else if (selectedTransactionFilter === "last30Days") startDate = subDays(now, 30);
      else { setFilteredUserTransactions(rawUserTransactions); return; }
      startDate.setHours(0, 0, 0, 0); 
      const filtered = rawUserTransactions.filter(tx => isAfter(tx.dateTime, startDate));
      setFilteredUserTransactions(filtered);
    };
    applyFilter();
  }, [selectedTransactionFilter, rawUserTransactions]);

  const toggleTransactionRowExpansion = (transactionKey: string) => {
    setExpandedTransactionRows(prev => ({ ...prev, [transactionKey]: !prev[transactionKey] }));
  };

  const handleDownloadPdfTransactions = () => {
    if (!user || filteredUserTransactions.length === 0) {
      toast({ title: "Not Available", description: "No transaction data to download.", variant: "default"}); return;
    }
    const doc = new jsPDF();
    const formatCurrencyPdf = (amount: number | null | undefined) => (amount === null || amount === undefined || isNaN(amount)) ? "N/A" : `Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const tableColumn = ["S.No", "Date & Time", "From", "To", "Type", "Amount", "Mode", "Remarks/Source", "Virtual ID"];
    const tableRows: any[][] = filteredUserTransactions.map((tx, index) => [
      index + 1, formatDateTimeSafe(tx.dateTime, "dd MMM yy, hh:mm a"), tx.fromParty, tx.toParty, tx.type,
      formatCurrencyPdf(tx.amount), tx.mode || "N/A", tx.remarksOrSource || "N/A", tx.virtualTransactionId || "N/A",
    ]);
    const filterLabel: Record<TransactionFilterType, string> = { all: "All Time", last7Days: "Last 7 Days", last10Days: "Last 10 Days", last30Days: "Last 30 Days" };
    doc.setFontSize(18); doc.text(`Payment History - ${user.fullname}`, 14, 15);
    doc.setFontSize(12); doc.text(`Filter: ${filterLabel[selectedTransactionFilter]}`, 14, 22);
    doc.text(`Generated on: ${format(new Date(), "dd MMM yyyy, hh:mm a")}`, 14, 29);
    autoTable(doc, {
      head: [tableColumn], body: tableRows, startY: 35, theme: 'grid', headStyles: { fillColor: [30, 144, 255] },
      styles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 25 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 'auto' }, 4: { cellWidth: 20 }, 5: { cellWidth: 20, halign: 'right' }, 6: { cellWidth: 15 }, 7: { cellWidth: 'auto' }, 8: { cellWidth: 18 } },
    });
    doc.save(`payment_history_${user.username}_${selectedTransactionFilter}.pdf`);
  };

  if (loadingUser) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">Loading user details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 text-center">
        <Card className="max-w-md mx-auto shadow-lg">
          <CardHeader><CardTitle className="text-destructive flex items-center justify-center"><AlertTriangle className="mr-2 h-6 w-6" /> Error</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">{error}</p><Button onClick={() => router.push("/employee/users")} className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Users</Button></CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return <div className="container mx-auto py-8 text-center text-muted-foreground">User data not available.</div>;
  }

  const isAdminUser = user.isAdmin || user.username === 'admin'; 

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={() => router.push("/employee/users")} className="mb-6"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Users</Button>
        <div className="flex gap-2 mb-6">
          <Button 
            asChild 
            variant="destructive" 
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Link href={`/employee/collection/record?userId=${user.id}&fullname=${encodeURIComponent(user.fullname)}&username=${encodeURIComponent(user.username)}`}>
              <ArchiveRestore className="mr-2 h-4 w-4" /> Record Collection
            </Link>
          </Button>
        </div>
      </div>

      <Card className="shadow-xl overflow-hidden">
        <CardHeader className="bg-secondary/50 p-6 border-b">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {(user.photoUrl) && (<Image src={user.photoUrl} alt={`${user.fullname}'s photo`} width={100} height={100} className="rounded-full border-4 border-card object-cover" data-ai-hint="user profile"/>)}
            <div className="flex-grow">
              <CardTitle className="text-3xl font-bold text-foreground flex items-center">
                {user.fullname} {isAdminUser && <Badge variant="destructive" className="ml-3"><Shield className="mr-1 h-4 w-4"/>Admin</Badge>}
              </CardTitle>
              <CardDescription>@{user.username} (User ID: {user.id})</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <section>
            <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><Info className="mr-2 h-5 w-5" />Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div className="flex items-start"><Phone className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Phone:</strong> {user.phone}</div></div>
              <div className="flex items-start"><CalendarDays className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Date of Birth:</strong> {formatDateSafe(user.dob)}</div></div>
              <div className="flex items-start col-span-1 md:col-span-2"><HomeIcon className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Address:</strong> {user.address || "N/A"}</div></div>
            </div>
          </section>
          <Separator />
           <section>
            <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><Contact className="mr-2 h-5 w-5 text-primary"/>Referral Source Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div className="flex items-start"><UserIconLucide className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Name:</strong> {user.referralSourceName || "N/A"}</div></div>
              <div className="flex items-start"><Phone className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Phone:</strong> {user.referralSourcePhone || "N/A"}</div></div>
              <div className="flex items-start col-span-1 md:col-span-2"><HomeIcon className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Address:</strong> {user.referralSourceAddress || "N/A"}</div></div>
            </div>
          </section>
          <Separator />
           <section>
            <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><DollarSign className="mr-2 h-5 w-5" />Financial Information</h3>
            <div className="space-y-3 text-sm">
               <div className="flex items-center"><strong className="text-foreground w-28">Total Due Amount:</strong>{user.dueAmount !== undefined && user.dueAmount !== null ? formatCurrency(user.dueAmount) : "N/A"}</div>
               <div className="flex items-center"><strong className="text-foreground w-28">Due Type:</strong>{user.dueType || "N/A"}</div>
            </div>
          </section>
          <Separator />
          <section>
            <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><FileText className="mr-2 h-5 w-5" />Uploaded Documents</h3>
            <div className="space-y-3 text-sm">
              {user.aadhaarCardUrl ? (<div className="flex items-center"><strong className="text-foreground w-32">Aadhaar Card:</strong><Button variant="link" asChild className="p-0 h-auto"><a href={user.aadhaarCardUrl} target="_blank" rel="noopener noreferrer">View Document</a></Button></div>) : <p className="text-muted-foreground">Aadhaar Card: Not Uploaded</p>}
              {user.panCardUrl ? (<div className="flex items-center"><strong className="text-foreground w-32">PAN Card:</strong><Button variant="link" asChild className="p-0 h-auto"><a href={user.panCardUrl} target="_blank" rel="noopener noreferrer">View Document</a></Button></div>) : <p className="text-muted-foreground">PAN Card: Not Uploaded</p>}
              {user.photoUrl ? (<div className="flex items-center"><strong className="text-foreground w-32">Photograph:</strong><Button variant="link" asChild className="p-0 h-auto"><a href={user.photoUrl} target="_blank" rel="noopener noreferrer">View Photo</a></Button></div>) : <p className="text-muted-foreground">Photograph: Not Uploaded</p>}
            </div>
          </section>
          <Separator />
          <section>
            <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><GroupIcon className="mr-2 h-5 w-5" />Joined Groups ({userGroups.length})</h3>
            {userGroups.length > 0 ? (
              <div className="space-y-4">
                {userGroups.map(group => (
                  <Card key={group.id} className="bg-secondary/30 shadow-sm">
                    <CardHeader className="pb-2 pt-3">
                      <CardTitle className="text-md font-semibold">
                        <Link href={`/employee/groups/${group.id}`} className="text-primary hover:underline">
                          {group.groupName}
                        </Link>
                      </CardTitle>
                      <CardDescription>Group ID: {group.id}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : ( <p className="text-sm text-muted-foreground">This user has not joined any groups yet.</p>)}
          </section>
          <Separator />
            <section>
              <Card className="shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Sheet className="mr-2 h-6 w-6 text-primary" />
                    <CardTitle className="text-xl font-bold text-foreground">Due Sheet</CardTitle>
                  </div>
                  <CardDescription>Detailed breakdown of dues for this user.</CardDescription>
                </CardHeader>
                <CardContent>
                {loadingDueSheet ? (
                     <div className="flex items-center justify-center py-4">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        <span>Loading due sheet...</span>
                    </div>
                ) : dueSheetItems.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No due items found for this user.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Due No</TableHead><TableHead>Group</TableHead><TableHead>Due Date</TableHead>
                          <TableHead className="text-right">Amount (₹)</TableHead><TableHead className="text-right">Penalty (₹)</TableHead>
                          <TableHead className="text-right">Paid (₹)</TableHead><TableHead className="text-right">Balance (₹)</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dueSheetItems.map((item, index) => (
                          <TableRow key={`${item.auctionId}-${item.dueNo}-${index}`}>
                            <TableCell>{item.dueNo}</TableCell><TableCell>{item.groupName}</TableCell><TableCell>{item.dueDate}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell><TableCell className="text-right">{formatCurrency(item.penalty)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.paidAmount)}</TableCell><TableCell className="text-right">{formatCurrency(item.balance)}</TableCell>
                            <TableCell>
                              <Badge variant={item.status === 'Paid' ? 'default' : (item.status === 'Partially Paid' ? 'secondary' : 'destructive')}
                                     className={cn(item.status === 'Paid' ? 'bg-green-600 hover:bg-green-700' : item.status === 'Partially Paid' ? 'bg-yellow-500 hover:bg-yellow-600' : '')}>
                                {item.status}
                                {item.status === 'Paid' && item.paidDateTime && (<span className="ml-1 text-xs opacity-80">({item.paidDateTime})</span>)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                </CardContent>
              </Card>
            </section>
            <Separator />
            <section>
              <Card className="shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div className="flex items-center gap-3">
                        <ReceiptText className="mr-2 h-6 w-6 text-primary" />
                        <CardTitle className="text-xl font-bold text-foreground">Payment History</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Filter className="mr-2 h-4 w-4" /> Filter by Date</Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Filter by Date</DropdownMenuLabel><DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setSelectedTransactionFilter("all")}>All Time</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setSelectedTransactionFilter("last7Days")}>Last 7 Days</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setSelectedTransactionFilter("last10Days")}>Last 10 Days</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setSelectedTransactionFilter("last30Days")}>Last 30 Days</DropdownMenuItem>
                        </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="outline" size="sm" onClick={handleDownloadPdfTransactions} disabled={filteredUserTransactions.length === 0}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loadingTransactions && (<div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Loading payment history...</p></div>)}
                    {!loadingTransactions && transactionError && (<div className="text-center py-10 text-destructive"><AlertTriangle className="mx-auto h-10 w-10 mb-2" /><p>{transactionError}</p></div>)}
                    {!loadingTransactions && !transactionError && filteredUserTransactions.length === 0 && (<p className="text-muted-foreground text-center py-10">{`No payment history found for this user ${selectedTransactionFilter !== 'all' ? `in the selected period` : ''}`}.</p>)}
                    {!loadingTransactions && !transactionError && filteredUserTransactions.length > 0 && (
                    <div className="overflow-x-auto rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>S.No</TableHead><TableHead>Date & Time</TableHead><TableHead>From</TableHead>
                                    <TableHead>To</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount (₹)</TableHead>
                                    <TableHead>Mode</TableHead><TableHead>Remarks/Source</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                            {filteredUserTransactions.map((tx, index) => {
                                const transactionKey = tx.id + tx.originalSource; const isExpanded = expandedTransactionRows[transactionKey];
                                return (
                                <React.Fragment key={transactionKey}>
                                    <TableRow>
                                    <TableCell>
                                        <div className="flex items-center">
                                        <Button variant="ghost" size="sm" onClick={() => toggleTransactionRowExpansion(transactionKey)} className="mr-1 p-1 h-auto">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button>
                                        {index + 1}
                                        </div>
                                        {isExpanded && (<div className="pl-7 mt-1 text-xs text-muted-foreground">Virtual ID: {tx.virtualTransactionId || "N/A"}</div>)}
                                    </TableCell>
                                    <TableCell>{formatDateTimeSafe(tx.dateTime, "dd MMM yy, hh:mm a")}</TableCell>
                                    <TableCell className="max-w-[150px]">{tx.fromParty}</TableCell><TableCell className="max-w-[150px]">{tx.toParty}</TableCell>
                                    <TableCell><span className={cn("font-semibold px-2 py-1 rounded-full text-xs", tx.type === "Sent by User" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300")}>{tx.type}</span></TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(tx.amount)}</TableCell><TableCell>{tx.mode || "N/A"}</TableCell>
                                    <TableCell className="max-w-[200px]">{tx.remarksOrSource || "N/A"}</TableCell>
                                    </TableRow>
                                </React.Fragment>
                                );
                            })}
                            </TableBody>
                        </Table>
                    </div>
                    )}
                </CardContent>
              </Card>
            </section>
        </CardContent>
      </Card>
    </div>
  );
}

