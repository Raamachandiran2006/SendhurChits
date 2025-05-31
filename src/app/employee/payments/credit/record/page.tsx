
import { AddCreditRecordForm } from "@/components/admin/AddCreditRecordForm"; // Using the admin form as it's generic
import { ArrowLeft, Banknote } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function EmployeeAddCreditRecordPage() {
  return (
    <div className="container mx-auto py-8">
       <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <div className="flex items-center gap-3">
            <Banknote className="h-8 w-8 text-primary"/>
            <div>
                <h1 className="text-3xl font-bold text-foreground">Record Credit Transaction (Employee)</h1>
                <p className="text-muted-foreground">Log a new credit received.</p>
            </div>
        </div>
        <Button variant="outline" asChild className="mt-4 sm:mt-0">
            <Link href="/employee/payments/credit">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Credit Management
            </Link>
        </Button>
      </div>
      <AddCreditRecordForm />
    </div>
  );
}
