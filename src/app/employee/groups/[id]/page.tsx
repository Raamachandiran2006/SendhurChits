
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Group, User, AuctionRecord, PaymentRecord } from "@/types";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
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
  DollarSign
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Separator } from "@/components/ui/separator";

const formatDateSafe = (dateString: string | Date | undefined | null, outputFormat: string = "dd MMM yyyy") => {
  if (!dateString) return "N/A";
  try {
    const date = typeof dateString === 'string' && dateString.includes('T') 
      ? parseISO(dateString) 
      : (typeof dateString === 'string' ? new Date(dateString.replace(/-/g, '/')) : dateString); 

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

const getBiddingTypeLabel = (type: string | undefined) => {
  if (!type) return "N/A";
  switch (type) {
    case "auction": return "Auction Based";
    case "random": return "Random Draw";
    case "pre-fixed": return "Pre-fixed";
    default: return type; 
  }
};

export default function EmployeeViewGroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [membersDetails, setMembersDetails] = useState<User[]>([]);
  const [auctionHistory, setAuctionHistory] = useState<AuctionRecord[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingAuctionHistory, setLoadingAuctionHistory] = useState(true);
  const [loadingPaymentHistory, setLoadingPaymentHistory] = useState(true);

  const fetchGroupData = useCallback(async () => {
    if (!groupId) {
      setError("Group ID is missing.");
      setLoading(false); setLoadingAuctionHistory(false); setLoadingPaymentHistory(false);
      return;
    }
    setLoading(true); setLoadingAuctionHistory(true); setLoadingPaymentHistory(true); setError(null);
    try {
      const groupDocRef = doc(db, "groups", groupId);
      const groupDocSnap = await getDoc(groupDocRef);

      if (!groupDocSnap.exists()) {
        setError("Group not found.");
        setLoading(false); setLoadingAuctionHistory(false); setLoadingPaymentHistory(false);
        return;
      }
      const groupData = { id: groupDocSnap.id, ...groupDocSnap.data() } as Group;
      setGroup(groupData);

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

      const auctionRecordsRef = collection(db, "auctionRecords");
      const qAuction = query(auctionRecordsRef, where("groupId", "==", groupId), orderBy("auctionDate", "desc"));
      const auctionSnapshot = await getDocs(qAuction);
      const fetchedAuctionHistory = auctionSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as AuctionRecord));
      setAuctionHistory(fetchedAuctionHistory);
      setLoadingAuctionHistory(false);
      
      const paymentRecordsRef = collection(db, "paymentRecords");
      const qPayment = query(paymentRecordsRef, where("groupId", "==", groupId), orderBy("recordedAt", "desc"));
      const paymentSnapshot = await getDocs(qPayment);
      const fetchedPaymentHistory = paymentSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as PaymentRecord));
      setPaymentHistory(fetchedPaymentHistory);
      setLoadingPaymentHistory(false);

    } catch (err) {
      console.error("Error fetching group details:", err);
      setError("Failed to fetch group details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchGroupData();
  }, [fetchGroupData]);

  const AuctionDetailItemReadOnly = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value?: string }) => (
    <div className="flex items-center p-3 bg-secondary/50 rounded-md">
      <Icon className="mr-3 h-5 w-5 text-muted-foreground flex-shrink-0" />
      <div className="flex-grow">
        <p className="font-semibold text-foreground">{label}</p>
        <p className="text-muted-foreground text-sm">{value || "N/A"}</p>
      </div>
    </div>
  );

  if (loading) {
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

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center mb-6">
        <Button variant="outline" onClick={() => router.push("/employee/groups")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Groups
        </Button>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
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
            <span>Total Amount: ₹{group.totalAmount.toLocaleString()}</span>
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
              <span>Monthly Installment: ₹{group.rate.toLocaleString()}</span>
            </div>
          )}
          {group.commission !== undefined && (
            <div className="flex items-center">
              <Tag className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Commission: {group.commission}%</span>
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
              <span>Min Bid Amount: ₹{group.minBid.toLocaleString()}</span>
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
                  <TableRow><TableHead>Full Name</TableHead><TableHead>Username</TableHead><TableHead>Phone Number</TableHead><TableHead className="text-right">Due Amount (₹)</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {membersDetails.map((member) => (
                    <TableRow key={member.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">{member.fullname}</TableCell><TableCell>{member.username}</TableCell><TableCell><div className="flex items-center"><Phone className="mr-2 h-3 w-3 text-muted-foreground" /> {member.phone || "N/A"}</div></TableCell><TableCell className="text-right">{formatCurrency(member.dueAmount)}</TableCell>
                    </TableRow>
                  ))}
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
                <div className="flex-grow">
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
          {/* Removed Start Auction button for employee view */}
        </CardHeader>
        <CardContent>
           {loadingAuctionHistory ? (
             <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading auction history...</p>
             </div>
           ) : auctionHistory.length === 0 ? (
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
        </CardHeader>
        <CardContent>
          {loadingPaymentHistory ? (
             <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading payment history...</p>
             </div>
          ) : paymentHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No payment history found for this group.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Date & Time</TableHead>
                            <TableHead className="text-right">Amount (₹)</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Mode</TableHead>
                            <TableHead>Auction #</TableHead>
                            <TableHead>Remarks</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paymentHistory.map((payment) => (
                            <TableRow key={payment.id}>
                                <TableCell>
                                    {payment.userFullname}<br/>
                                    <span className="text-xs text-muted-foreground">({payment.userUsername})</span>
                                </TableCell>
                                <TableCell>
                                    {formatDateSafe(payment.paymentDate, "dd MMM yy")}<br/>
                                    <span className="text-xs text-muted-foreground">{payment.paymentTime}</span>
                                </TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(payment.amount)}</TableCell>
                                <TableCell>{payment.paymentType}</TableCell>
                                <TableCell>{payment.paymentMode}</TableCell>
                                <TableCell className="text-center">{payment.auctionNumber || "N/A"}</TableCell>
                                <TableCell className="max-w-xs truncate">{payment.remarks || "N/A"}</TableCell>
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
