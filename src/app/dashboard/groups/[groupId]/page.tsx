
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Group, AuctionRecord } from "@/types";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { 
  Loader2, 
  ArrowLeft, 
  Users as UsersIconLucide, 
  Info, 
  AlertTriangle, 
  CalendarDays, 
  Landmark, 
  Clock, 
  Tag, 
  SearchCode,
  Megaphone,
  CalendarClock,
  History 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Separator } from "@/components/ui/separator";

const formatDateSafe = (dateInput: string | Date | undefined | null, outputFormat: string = "dd MMM yyyy") => {
  if (!dateInput) return "N/A";
  try {
    let date: Date;
    if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      date = dateInput.includes('T') ? parseISO(dateInput) : new Date(dateInput.replace(/-/g, '/'));
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

export default function UserGroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [auctionHistory, setAuctionHistory] = useState<AuctionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAuctionHistory, setLoadingAuctionHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroupDetailsAndHistory = useCallback(async () => {
    if (!groupId) {
      setError("Group ID is missing.");
      setLoading(false);
      setLoadingAuctionHistory(false);
      return;
    }
    setLoading(true);
    setLoadingAuctionHistory(true);
    setError(null);
    try {
      const groupDocRef = doc(db, "groups", groupId);
      const groupDocSnap = await getDoc(groupDocRef);

      if (!groupDocSnap.exists()) {
        setError("Group not found.");
        setGroup(null);
      } else {
        const groupData = { id: groupDocSnap.id, ...groupDocSnap.data() } as Group;
        setGroup(groupData);

        const auctionRecordsRef = collection(db, "auctionRecords");
        const qAuction = query(
          auctionRecordsRef, 
          where("groupId", "==", groupId), 
          orderBy("auctionDate", "desc")
        );
        const auctionSnapshot = await getDocs(qAuction);
        const fetchedAuctionHistory = auctionSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as AuctionRecord));
        setAuctionHistory(fetchedAuctionHistory);
      }
    } catch (err) {
      console.error("Error fetching group details or history:", err);
      setError("Failed to fetch group details or auction history. Please try again.");
    } finally {
      setLoading(false);
      setLoadingAuctionHistory(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchGroupDetailsAndHistory();
  }, [fetchGroupDetailsAndHistory]);

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
            <Button onClick={() => router.push("/dashboard")} className="mt-6">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
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

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center mb-6">
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
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
              <Landmark className="mr-2 h-4 w-4 text-muted-foreground" />
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
              <Landmark className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Min Bid Amount: ₹{group.minBid.toLocaleString()}</span>
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
          {/* Removed Last Auction Winner display for regular users */}
        </CardContent>
      </Card>

      <Separator />

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <History className="h-6 w-6 text-primary" /> 
            <CardTitle className="text-xl font-bold text-foreground">Auction History</CardTitle>
          </div>
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
                <Card key={auction.id} className="bg-secondary/50 shadow-sm">
                  <CardHeader className="pb-3 pt-4">
                    <CardTitle className="text-md font-semibold text-primary">
                       Auction #{auction.auctionNumber ? auction.auctionNumber : (index + 1)}
                    </CardTitle>
                    <CardDescription>Period: {auction.auctionMonth} - {formatDateSafe(auction.auctionDate, "PP")}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2 pb-4">
                      {auction.auctionTime && <div><strong className="text-foreground">Time:</strong> {auction.auctionTime}</div>}
                      {/* Removed Winner display for regular users */}
                      <div><strong className="text-foreground">Winning Bid:</strong> {formatCurrency(auction.winningBidAmount)}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
           )}
        </CardContent>
      </Card>

    </div>
  );
}
