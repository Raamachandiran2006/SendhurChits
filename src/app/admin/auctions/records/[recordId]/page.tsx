
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { AuctionRecord } from "@/types";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, CalendarDays, Clock, User, Tag, Landmark, Percent, FileText, Info, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Separator } from "@/components/ui/separator";

const formatDateSafe = (dateString: string | undefined | null, outputFormat: string = "dd MMMM yyyy") => {
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
  if (amount === null || amount === undefined) return "N/A";
  return `₹${amount.toLocaleString()}`;
};

export default function AuctionRecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const recordId = params.recordId as string;

  const [auctionRecord, setAuctionRecord] = useState<AuctionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAuctionRecord = useCallback(async () => {
    if (!recordId) {
      setError("Auction Record ID is missing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const recordDocRef = doc(db, "auctionRecords", recordId);
      const recordDocSnap = await getDoc(recordDocRef);

      if (!recordDocSnap.exists()) {
        setError("Auction Record not found.");
      } else {
        setAuctionRecord({ id: recordDocSnap.id, ...recordDocSnap.data() } as AuctionRecord);
      }
    } catch (err) {
      console.error("Error fetching auction record:", err);
      setError("Failed to fetch auction record details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    fetchAuctionRecord();
  }, [fetchAuctionRecord]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">Loading auction record details...</p>
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
            <Button onClick={() => router.back()} className="mt-6">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!auctionRecord) {
    return <div className="container mx-auto py-8 text-center text-muted-foreground">Auction record data not available.</div>;
  }

  const DetailItem = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) => (
    <div className="flex items-start py-2">
      <Icon className="mr-3 h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
      <div>
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{value || "N/A"}</p>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Button
        variant="outline"
        onClick={() => router.back()}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">
                Auction Record Details
              </CardTitle>
              <CardDescription>
                Viewing details for Auction Record ID: {auctionRecord.id}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <section>
            <h3 className="text-lg font-semibold text-primary mb-2 flex items-center"><Info className="mr-2 h-5 w-5" />Group & Auction Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <DetailItem icon={Landmark} label="Chit Group Name" value={auctionRecord.groupName} />
              <DetailItem icon={Info} label="Chit Group ID" value={auctionRecord.groupId} />
              <DetailItem icon={CalendarDays} label="Auction Month" value={auctionRecord.auctionMonth} />
              <DetailItem icon={CalendarDays} label="Auction Date" value={formatDateSafe(auctionRecord.auctionDate)} />
              <DetailItem icon={Clock} label="Auction Time" value={auctionRecord.auctionTime || "N/A"} />
              <DetailItem icon={Tag} label="Auction Number" value={auctionRecord.auctionNumber ? `#${auctionRecord.auctionNumber}` : "N/A"} />
              <DetailItem icon={Info} label="Auction Mode" value={auctionRecord.auctionMode || "N/A"} />
            </div>
          </section>

          <Separator />

          <section>
            <h3 className="text-lg font-semibold text-primary mb-2 flex items-center"><User className="mr-2 h-5 w-5" />Winner Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <DetailItem icon={User} label="Winner Full Name" value={auctionRecord.winnerFullname} />
              <DetailItem icon={Info} label="Winner User ID" value={auctionRecord.winnerUsername} />
              <DetailItem icon={Landmark} label="Winning Bid Amount" value={formatCurrency(auctionRecord.winningBidAmount)} />
            </div>
          </section>
          
          <Separator />

          <section>
            <h3 className="text-lg font-semibold text-primary mb-2 flex items-center"><Percent className="mr-2 h-5 w-5" />Financials</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <DetailItem icon={Percent} label="Discount" value={formatCurrency(auctionRecord.discount)} />
              <DetailItem icon={Landmark} label="Commission Amount" value={formatCurrency(auctionRecord.commissionAmount)} />
              <DetailItem icon={Landmark} label="Final Amount to be Paid" value={formatCurrency(auctionRecord.finalAmountToBePaid)} />
            </div>
          </section>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            Record created on: {auctionRecord.recordedAt ? format(auctionRecord.recordedAt.toDate(), "PPpp") : "N/A"}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
