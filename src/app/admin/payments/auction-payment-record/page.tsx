
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Landmark } from "lucide-react";

export default function AuctionPaymentRecordPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
            <Landmark className="h-8 w-8 text-primary"/>
            <div>
                <h1 className="text-3xl font-bold text-foreground">Auction Payment Records</h1>
                <p className="text-muted-foreground">Track all payments related to auctions.</p>
            </div>
        </div>
        <Button variant="outline" asChild>
            <Link href="/admin/payments">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Payments
            </Link>
        </Button>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Auction Payments</CardTitle>
          <CardDescription>
            This page will list all payments made or received as part of chit fund auctions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-10">
            Auction Payment Record feature is currently under development.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
