
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Globe } from "lucide-react";

export default function PaymentPortalPage() {
  return (
    <div className="container mx-auto py-8">
       <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
            <Globe className="h-8 w-8 text-primary"/>
            <div>
                <h1 className="text-3xl font-bold text-foreground">Payment Portal</h1>
                <p className="text-muted-foreground">Access external payment services.</p>
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
          <CardTitle>Payment Portal Integration</CardTitle>
          <CardDescription>
            This section would integrate or link to external payment gateways or services.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-10">
            Payment Portal feature is currently under development.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
