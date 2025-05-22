
"use client";

import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Construction } from "lucide-react";

export default function AuctionRecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const recordId = params.recordId as string;

  return (
    <div className="container mx-auto py-8">
      <Button
        variant="outline"
        onClick={() => router.back()} // Go back to the previous page (likely the group detail page)
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Construction className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">
                Auction Record Details
              </CardTitle>
              <CardDescription>
                Viewing details for Auction Record ID: {recordId}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="py-10 text-center">
            <Construction className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">
              This page is under construction.
            </p>
            <p className="text-sm text-muted-foreground">
              Full details for this auction record will be displayed here soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
