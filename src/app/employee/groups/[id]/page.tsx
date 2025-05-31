
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Group, User, AuctionRecord, CollectionRecord, PaymentRecord as AdminPaymentRecordType } from "@/types";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import {
  Loader2,
  ArrowLeft,
  Users as UsersIconLucide,
  User as UserIcon,
  Info,
  AlertTriangle,
  Phone,
  CalendarDays,
  Landmark,
  Clock,
  Tag,
  LandmarkIcon as GroupLandmarkIcon,
  SearchCode,
  Megaphone,
  CalendarClock,
  History,
  ReceiptText,
  DollarSign,
  ChevronRight,
  ChevronDown,
  Filter,
  Download,
  PercentIcon
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, subDays, isAfter, addDays } from "date-fns";
import { Separator } from "@/components/ui/separator";
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

// Helper function to format date safely
const formatDateSafe = (dateInput: string | Date | Timestamp | undefined | null, outputFormat: string = "dd MMM yyyy") => {
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
  return `₹${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};


const getBiddingTypeLabel = (type: string | undefined) => {
  if (!type) return "N/A";
  switch (type) {
    case "auction": return "Auction Based";
    case "random": return "Random Draw";
    case "pre-fixed": return "Pre-fixed";
    default: return type;
  }
};

interface CombinedPaymentHistoryTransaction {
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


export default function EmployeeViewGroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [membersDetails, setMembersDetails] = useState<User[]>([]);
  const [auctionHistory, setAuctionHistory] = useState<AuctionRecord[]>([]);
  const [rawPaymentHistory, setRawPaymentHistory] = useState<CombinedPaymentHistoryTransaction[]>([]);
  const [filteredPaymentHistory, setFilteredPaymentHistory] = useState<CombinedPaymentHistoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingAuctionHistory, setLoadingAuctionHistory] = useState(true);
  const [loadingPaymentHistory, setLoadingPaymentHistory] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [expandedPaymentRows, setExpandedPaymentRows] = useState<Record<string, boolean>>({});
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<PaymentFilterType>("all");


  const fetchGroupData = useCallback(async () => {
    if (!groupId) {
      setError("Group ID is missing.");
      setLoading(false); setLoadingAuctionHistory(false); setLoadingPaymentHistory(false); setLoadingMembers(false);
      return;
    }
    setLoading(true); setLoadingAuctionHistory(true); setLoadingPaymentHistory(true); setLoadingMembers(true); setError(null);
    try {
      const groupDocRef = doc(db, "groups", groupId);
      const groupDocSnap = await getDoc(groupDocRef);

      if (!groupDocSnap.exists()) {
        setError("Group not found.");
        setLoading(false); setLoadingAuctionHistory(false); setLoadingPaymentHistory(false); setLoadingMembers(false);
        return;
      }
      const groupData = { id: groupDocSnap.id, ...groupDocSnap.data() } as Group;
      setGroup(groupData);
      setLoading(false);

      if (groupData.members && groupData.members.length > 0) {
        const memberUsernames = groupData.members;
        const fetchedMembers: User[] = [];
        const batchSize = 30;
        for (let i = 0; i < memberUsernames.length; i += batchSize) {
          const batchUsernames = memberUsernames.slice(i, i + batchSize);
          if (batchUsernames.length > 0) {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("username", "in", batchUsernames));
            const querySnapshot = await getDocs(q);
            querySnapshot.docs.forEach(docSnap => {
              fetchedMembers.push({ id: docSnap.id, ...docSnap.data() } as User);
            });
          }
        }
        setMembersDetails(fetchedMembers);
      } else {
        setMembersDetails([]);
      }
      setLoadingMembers(false);

      const auctionRecordsRef = collection(db, "auctionRecords");
      const qAuction = query(auctionRecordsRef, where("groupId", "==", groupId), orderBy("auctionDate", "asc"));
      const auctionSnapshot = await getDocs(qAuction);
      const fetchedAuctionHistory = auctionSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as AuctionRecord));
      setAuctionHistory(fetchedAuctionHistory);
      setLoadingAuctionHistory(false);

      const collectionRecordsRef = collection(db, "collectionRecords");
      const qCollection = query(collectionRecordsRef, where("groupId", "==", groupId));
      const collectionSnapshot = await getDocs(qCollection);
      const fetchedCollections = collectionSnapshot.docs.map(docSnap => {
        const data = docSnap.data() as CollectionRecord;
        return {
          id: docSnap.id,
          type: "Received" as const,
          dateTime: parseDateTimeForSort(data.paymentDate, data.paymentTime, data.recordedAt),
          fromParty: `User: ${data.userFullname} (${data.userUsername})`,
          toParty: "Sendhur Chits (Company)",
          amount: data.amount,
          mode: data.paymentMode,
          remarks: data.remarks || "User Collection",
          originalSource: "Collection Record" as const,
          virtualTransactionId: data.virtualTransactionId,
        } as CombinedPaymentHistoryTransaction;
      });

      const paymentRecordsRef = collection(db, "paymentRecords");
      const qPayment = query(paymentRecordsRef, where("groupId", "==", groupId));
      const paymentSnapshot = await getDocs(qPayment);
      const fetchedPayments = paymentSnapshot.docs.map(docSnap => {
        const data = docSnap.data() as AdminPaymentRecordType;
        return {
          id: docSnap.id,
          type: "Sent" as const,
          dateTime: parseDateTimeForSort(data.paymentDate, data.paymentTime, data.recordedAt),
          fromParty: "Sendhur Chits (Company)",
          toParty: `User: ${data.userFullname} (${data.userUsername})`,
          amount: data.amount,
          mode: data.paymentMode,
          remarks: data.remarks || "Company Payment",
          originalSource: "Payment Record" as const,
          virtualTransactionId: data.virtualTransactionId,
        } as CombinedPaymentHistoryTransaction;
      });

      const combined = [...fetchedCollections, ...fetchedPayments].sort((a,b) => b.dateTime.getTime() - a.dateTime.getTime());
      setRawPaymentHistory(combined);
      setFilteredPaymentHistory(combined);
      setLoadingPaymentHistory(false);

    } catch (err) {
      console.error("Error fetching group details:", err);
      setError("Failed to fetch group details. Please try again.");
      setLoading(false); setLoadingAuctionHistory(false); setLoadingPaymentHistory(false); setLoadingMembers(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchGroupData();
  }, [fetchGroupData]);

  useEffect(() => {
    const applyFilter = () => {
      if (selectedPaymentFilter === "all") {
        setFilteredPaymentHistory(rawPaymentHistory);
        return;
      }
      const now = new Date();
      let startDate: Date;
      if (selectedPaymentFilter === "last7Days") {
        startDate = subDays(now, 7);
      } else if (selectedPaymentFilter === "last10Days") {
        startDate = subDays(now, 10);
      } else if (selectedPaymentFilter === "last30Days") {
        startDate = subDays(now, 30);
      } else {
        setFilteredPaymentHistory(rawPaymentHistory);
        return;
      }
      startDate.setHours(0, 0, 0, 0);
      const filtered = rawPaymentHistory.filter(tx => isAfter(tx.dateTime, startDate));
      setFilteredPaymentHistory(filtered);
    };
    applyFilter();
  }, [selectedPaymentFilter, rawPaymentHistory]);

  const handleDownloadPdf = () => {
    if (!group) return;
    const doc = new jsPDF();

    const formatCurrencyPdf = (amount: number | null | undefined) => {
      if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
      return `Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    };

    const tableColumn = ["S.No", "Type", "Date & Time", "From", "To", "Amount", "Mode", "Remarks", "Virtual ID"];
    const tableRows: any[][] = [];

    filteredPaymentHistory.forEach((payment, index) => {
      const paymentData = [
        index + 1,
        payment.type,
        formatDateSafe(payment.dateTime, "dd MMM yy, hh:mm a"),
        payment.fromParty,
        payment.toParty,
        formatCurrencyPdf(payment.amount),
        payment.mode || "N/A",
        payment.remarks || "N/A",
        payment.virtualTransactionId || "N/A",
      ];
      tableRows.push(paymentData);
    });

    const filterLabel: Record<PaymentFilterType, string> = {
      all: "All Time",
      last7Days: "Last 7 Days",
      last10Days: "Last 10 Days",
      last30Days: "Last 30 Days",
    };

    doc.setFontSize(18);
    doc.text(`Payment History - ${group.groupName}`, 14, 15);
    doc.setFontSize(12);
    doc.text(`Filter: ${filterLabel[selectedPaymentFilter]}`, 14, 22);
    doc.text(`Generated on: ${format(new Date(), "dd MMM yyyy, hh:mm a")}`, 14, 29);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [30, 144, 255] },
      styles: { fontSize: 8, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 15 },
        2: { cellWidth: 23 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 'auto' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 15 },
        7: { cellWidth: 'auto' },
        8: { cellWidth: 18 }
      },
    });
    doc.save(`payment_history_${group.groupName.replace(/\s+/g, '_')}_${selectedPaymentFilter}.pdf`);
  };

  const togglePaymentRowExpansion = (transactionKey: string) => {
    setExpandedPaymentRows(prev => ({ ...prev, [transactionKey]: !prev[transactionKey] }));
  };

  if (loading || loadingMembers || loadingAuctionHistory || loadingPaymentHistory) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">Loading group details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 text-center">
        <Card className="max-w-md mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center justify-center">
              <AlertTriangle className="mr-2 h-6 w-6" /> Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => router.push("/employee/groups")} className="mt-6">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Groups
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!group) {
    return <div className="container mx-auto py-8 text-center text-muted-foreground">Group data not available.</div>;
  }

  const AuctionDetailItemReadOnly = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value?: string }) => (
    <div className="flex items-center p-3 bg-secondary/50 rounded-md">
      <Icon className="mr-3 h-5 w-5 text-muted-foreground flex-shrink-0" />
      <div className="flex-grow">
        <p className="font-semibold text-foreground">{label}</p>
        <p className="text-muted-foreground text-sm">{value || "N/A"}</p>
      </div>
    </div>
  );
  
  const pastWinnerUserIds = auctionHistory.map(ah => ah.winnerUserId);

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center mb-6">
        <Button variant="outline" onClick={() => router.push("/employee/groups")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Groups
        </Button>
      </div>

      <Card className="shadow-xl overflow-hidden">
        <div className="relative w-full h-48 md:h-64">
          <Image
            src={`https://placehold.co/1200x300.png?text=${encodeURIComponent(group.groupName)}`}
            alt={`${group.groupName} banner`}
            layout="fill"
            objectFit="cover"
            data-ai-hint="team collaboration"
            priority
          />
        </div>
        <CardHeader className="pt-4">
          <div className="flex items-center gap-3">
            <UsersIconLucide className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">{group.groupName}</CardTitle>
              <CardDescription>{group.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center">
            <UsersIconLucide className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Capacity: {group.totalPeople} members</span>
          </div>
          <div className="flex items-center">
            <Badge variant="secondary">Members: {group.members.length} / {group.totalPeople}</Badge>
          </div>
          <div className="flex items-center">
            <Landmark className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Total Amount: {formatCurrency(group.totalAmount)}</span>
          </div>
          <div className="flex items-center">
            <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Tenure: {group.tenure ? `${group.tenure} months` : "N/A"}</span>
          </div>
          <div className="flex items-center">
            <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Start Date: {formatDateSafe(group.startDate)}</span>
          </div>
            <div className="flex items-center">
            <Info className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Group ID: {group.id}</span>
          </div>
          {group.rate !== undefined && (
            <div className="flex items-center">
              <GroupLandmarkIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Monthly Installment: {formatCurrency(group.rate)}</span>
            </div>
          )}
          {group.commission !== undefined && (
            <div className="flex items-center">
              <Tag className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Commission: {group.commission}%</span>
            </div>
          )}
           {group.penaltyPercentage !== undefined && (
            <div className="flex items-center">
              <PercentIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Penalty: {group.penaltyPercentage}%</span>
            </div>
          )}
          {group.biddingType && (
            <div className="flex items-center">
              <SearchCode className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Bidding Type: {getBiddingTypeLabel(group.biddingType)}</span>
            </div>
          )}
          {group.minBid !== undefined && (
            <div className="flex items-center">
              <GroupLandmarkIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Min Bid Amount: {formatCurrency(group.minBid)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <UserIcon className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">Group Members</CardTitle>
              <CardDescription>Details of users in this group.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {membersDetails.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No members have been added to this group yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead className="text-right">Due Amount (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membersDetails.map((member) => {
                    const hasWon = pastWinnerUserIds.includes(member.id);
                    return (
                      <TableRow key={member.id} className={cn("transition-colors", hasWon ? "bg-green-100 dark:bg-green-900/50 hover:bg-green-200/80 dark:hover:bg-green-800/70" : "hover:bg-muted/50")}>
                        <TableCell className="font-medium">{member.fullname}</TableCell>
                        <TableCell>{member.username}</TableCell>
                        <TableCell><div className="flex items-center"><Phone className="mr-2 h-3 w-3 text-muted-foreground" /> {member.phone || "N/A"}</div></TableCell>
                        <TableCell className="text-right">{formatCurrency(member.dueAmount)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Megaphone className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl font-bold text-foreground">Group Auction Details</CardTitle>
          </div>
        </CardHeader>
        <CardDescription className="px-6 pb-2">Information about auction events for this group.</CardDescription>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <AuctionDetailItemReadOnly icon={CalendarClock} label="Auction Month" value={group.auctionMonth} />
            <div className="flex items-center p-3 bg-secondary/50 rounded-md">
                <CalendarDays className="mr-3 h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                    <p className="font-semibold text-foreground">Scheduled Date</p>
                    <p className="text-muted-foreground text-sm">{formatDateSafe(group.auctionScheduledDate, "PPP") || "N/A"}</p>
                </div>
            </div>
            <AuctionDetailItemReadOnly icon={Clock} label="Scheduled Time" value={group.auctionScheduledTime} />
            <AuctionDetailItemReadOnly icon={Info} label="Last Auction Winner" value={group.lastAuctionWinner} />
        </CardContent>
      </Card>

      <Separator />

      <Card className="shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <History className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl font-bold text-foreground">Auction History</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
           {auctionHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No auction history found for this group.
            </p>
           ) : (
            <div className="space-y-4">
              {auctionHistory.map((auction, index) => (
                <Link key={auction.id} href={`/employee/auctions/records/${auction.id}`} className="block">
                  <Card className="bg-secondary/50 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3 pt-4">
                      <CardTitle className="text-md font-semibold text-primary">
                         Auction #{auction.auctionNumber ? auction.auctionNumber : (index + 1)}
                      </CardTitle>
                      <CardDescription>Group: {auction.groupName}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2 pb-4">
                        <div><strong className="text-foreground">Period:</strong> {auction.auctionMonth} - {formatDateSafe(auction.auctionDate, "PP")}</div>
                        {auction.auctionTime && <div><strong className="text-foreground">Time:</strong> {auction.auctionTime}</div>}
                        <div><strong className="text-foreground">Winner:</strong> {auction.winnerFullname} ({auction.winnerUsername})</div>
                        <div><strong className="text-foreground">Winning Bid:</strong> {formatCurrency(auction.winningBidAmount)}</div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
           )}
        </CardContent>
      </Card>

      <Separator />

      <Card className="shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <ReceiptText className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl font-bold text-foreground">Payment History</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" /> Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filter by Date</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setSelectedPaymentFilter("all")}>All Time</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSelectedPaymentFilter("last7Days")}>Last 7 Days</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSelectedPaymentFilter("last10Days")}>Last 10 Days</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSelectedPaymentFilter("last30Days")}>Last 30 Days</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={filteredPaymentHistory.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPaymentHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No payment history found for this group {selectedPaymentFilter !== 'all' ? `in the selected period` : ''}.
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
                        {filteredPaymentHistory.map((payment, index) => {
                          const transactionKey = payment.id + payment.originalSource;
                          const isExpanded = expandedPaymentRows[transactionKey];
                          return (
                            <React.Fragment key={transactionKey}>
                              <TableRow>
                                <TableCell>
                                  <div className="flex items-center">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => togglePaymentRowExpansion(transactionKey)}
                                      className="mr-1 p-1 h-auto"
                                    >
                                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    </Button>
                                    {index + 1}
                                  </div>
                                  {isExpanded && (
                                    <div className="pl-7 mt-1 text-xs text-muted-foreground">
                                      Virtual ID: {payment.virtualTransactionId || "N/A"}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className={cn(
                                    "font-semibold px-2 py-1 rounded-full text-xs",
                                    payment.type === "Sent" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                                          : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                  )}>
                                    {payment.type}
                                  </span>
                                </TableCell>
                                <TableCell>{formatDateSafe(payment.dateTime, "dd MMM yy, hh:mm a")}</TableCell>
                                <TableCell className="max-w-xs truncate">{payment.fromParty}</TableCell>
                                <TableCell className="max-w-xs truncate">{payment.toParty}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(payment.amount)}</TableCell>
                                <TableCell>{payment.mode || "N/A"}</TableCell>
                                <TableCell className="max-w-xs truncate">{payment.remarks || "N/A"}</TableCell>
                              </TableRow>
                            </React.Fragment>
                          )
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
