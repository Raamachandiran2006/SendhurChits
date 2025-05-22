
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, BookOpenCheck } from "lucide-react";

export default function MasterRecordPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
            <BookOpenCheck className="h-8 w-8 text-primary"/>
            <div>
                <h1 className="text-3xl font-bold text-foreground">Master Financial Record</h1>
                <p className="text-muted-foreground">A comprehensive overview of all transactions.</p>
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
          <CardTitle>Master Record</CardTitle>
          <CardDescription>
            This page will display an aggregated view of all financial transactions including auction payments, salary payments, and general expenses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-10">
            Master Record feature is currently under development.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
