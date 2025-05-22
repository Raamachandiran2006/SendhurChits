
import { RecordCollectionForm } from "@/components/employee/RecordCollectionForm";
import { ArrowLeft, PackagePlus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RecordCollectionPage() {
  return (
    <div className="container mx-auto py-8">
       <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <div className="flex items-center gap-3">
            <PackagePlus className="h-8 w-8 text-primary"/>
            <div>
                <h1 className="text-3xl font-bold text-foreground">Record Collection</h1>
                <p className="text-muted-foreground">Log a new payment collected from a user.</p>
            </div>
        </div>
        <Button variant="outline" asChild className="mt-4 sm:mt-0">
            <Link href="/employee/collection">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Collection Management
            </Link>
        </Button>
      </div>
      <RecordCollectionForm />
    </div>
  );
}
