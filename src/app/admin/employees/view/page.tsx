
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";

export default function ViewEmployeesPage() {
  return (
    <div className="container mx-auto py-8">
      <Button variant="outline" asChild className="mb-6">
        <Link href="/admin/employees">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Employee Management
        </Link>
      </Button>
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Construction className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">View All Employees</CardTitle>
              <CardDescription>This section is currently under construction.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-center py-10">
          <p className="text-muted-foreground">
            The detailed employee listing and management features are coming soon!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
