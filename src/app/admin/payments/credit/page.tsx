
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, ListChecks, ArrowLeft, Banknote } from "lucide-react";
import Link from "next/link";
import React from "react";

// This page will list credit records in the future.
// For now, it provides a link to add a new credit record.

export default function CreditManagementPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Banknote className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Credit Management</h1>
            <p className="text-muted-foreground">Track and manage credit transactions.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 sm:mt-0">
            <Button variant="outline" asChild size="sm">
                <Link href="/admin/payments">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Payments
                </Link>
            </Button>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90" size="sm">
            <Link href="/admin/payments/credit/record">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Credit Record
            </Link>
            </Button>
        </div>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-primary" />
            <CardTitle>Credit Transaction History</CardTitle>
          </div>
          <CardDescription>A chronological record of all credit transactions. (Feature coming soon)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10">
            <p className="text-muted-foreground">Credit history display is under development. Click "Add Credit Record" to add a new transaction.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
