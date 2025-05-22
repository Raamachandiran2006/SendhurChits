
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpenCheck, Landmark, Receipt, Globe, ArrowLeft, CreditCard } from "lucide-react";
import Link from "next/link";

export default function AdminPaymentsPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center">
        <div className="flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Payments Management</h1>
            <p className="text-muted-foreground">Oversee all financial transactions and records.</p>
          </div>
        </div>
         <Button variant="outline" asChild className="mt-4 sm:mt-0">
            <Link href="/admin">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Admin Overview
            </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpenCheck className="h-6 w-6 text-accent" />
              <CardTitle>Master Record</CardTitle>
            </div>
            <CardDescription>View a comprehensive log of all financial activities.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/admin/payments/master-record">
                View Master Record
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Landmark className="h-6 w-6 text-accent" />
              <CardTitle>Auction Payment Records</CardTitle>
            </div>
            <CardDescription>Track payments related to chit fund auctions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/admin/payments/auction-payment-record">
                View Auction Payments
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="h-6 w-6 text-accent" />
              <CardTitle>Expenses</CardTitle>
            </div>
            <CardDescription>Manage and record operational or other expenses.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/admin/payments/expenses">
                Manage Expenses
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-6 w-6 text-accent" />
              <CardTitle>Payment Portal</CardTitle>
            </div>
            <CardDescription>Access external payment gateways or services.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/admin/payments/payment-portal">
                Go to Payment Portal
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
