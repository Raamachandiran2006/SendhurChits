
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpenCheck, Landmark, Receipt, Globe, ArrowLeft, CreditCard, Banknote } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Employee } from "@/types";

export default function EmployeePaymentsPage() {
  const { loggedInEntity } = useAuth();
  const router = useRouter();
  const employee = loggedInEntity as Employee | null;

  useEffect(() => {
    // Redirect if not a manager
    if (employee && employee.role !== "Manager") {
      router.replace("/employee/dashboard");
    }
  }, [employee, router]);

  if (employee?.role !== "Manager") {
    // Optionally show a loading or unauthorized message before redirect
    return <div className="container mx-auto py-8 text-center">Access Denied. Redirecting...</div>;
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center">
        <div className="flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Payments Management</h1>
            <p className="text-muted-foreground">Oversee financial transactions and records.</p>
          </div>
        </div>
         <Button variant="outline" asChild className="mt-4 sm:mt-0">
            <Link href="/employee/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
            </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              <Link href="/employee/payments/master-record">
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
              <Link href="/employee/payments/auction-payment-record">
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
              <Link href="/employee/payments/expenses">
                Manage Expenses
              </Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Banknote className="h-6 w-6 text-accent" />
              <CardTitle>Credit</CardTitle>
            </div>
            <CardDescription>Record and manage credit transactions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/employee/payments/credit">
                Manage Credit
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-6 w-6 text-accent" />
              <CardTitle>Record Payments to Users</CardTitle>
            </div>
            <CardDescription>Log payments made by the company to users (e.g., auction payouts).</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/employee/payments/payment-portal">
                Record Payment
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
