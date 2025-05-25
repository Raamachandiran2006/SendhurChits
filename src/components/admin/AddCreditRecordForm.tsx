
"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, Send, DollarSign, Banknote } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import type { CreditRecord } from "@/types";

const addCreditRecordFormSchema = z.object({
  fromName: z.string().min(3, "From name must be at least 3 characters."),
  creditNumber: z.string().optional(),
  paymentDate: z.date({ required_error: "Payment date is required." }),
  paymentMode: z.enum(["Cash", "UPI", "Netbanking"], { required_error: "Payment mode is required." }),
  amount: z.coerce.number().positive("Amount must be a positive number."),
  remarks: z.literal("Credit", { errorMap: () => ({ message: "Remark must be 'Credit'."}) }),
});

type AddCreditRecordFormValues = z.infer<typeof addCreditRecordFormSchema>;

const generateVirtualId = () => Math.floor(100000 + Math.random() * 900000).toString();

export function AddCreditRecordForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddCreditRecordFormValues>({
    resolver: zodResolver(addCreditRecordFormSchema),
    defaultValues: {
      fromName: "",
      creditNumber: "",
      paymentDate: new Date(),
      paymentMode: undefined,
      amount: undefined,
      remarks: "Credit",
    },
  });

  async function onSubmit(values: AddCreditRecordFormValues) {
    setIsSubmitting(true);
    try {
      const dataToSave: Omit<CreditRecord, "id" | "recordedAt"> & { recordedAt?: any } = {
        fromName: values.fromName,
        creditNumber: values.creditNumber || undefined,
        paymentDate: format(values.paymentDate, "yyyy-MM-dd"),
        paymentMode: values.paymentMode,
        amount: values.amount,
        remarks: "Credit",
        virtualTransactionId: generateVirtualId(),
      };

      await addDoc(collection(db, "creditRecords"), {
        ...dataToSave,
        recordedAt: serverTimestamp() as Timestamp,
      });

      toast({ title: "Success", description: "Credit record added successfully." });
      router.push(`/admin/payments/credit?refreshId=${Date.now()}`); // Redirect to a future list page
    } catch (error) {
      console.error("Credit record submission error:", error);
      toast({ title: "Error", description: "Could not record credit. " + (error as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="shadow-xl w-full max-w-lg mx-auto my-8">
      {/* CardHeader removed as title is on page */}
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="fromName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Bank Name, Investor Name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="creditNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credit/Loan Agreement Number (Optional)</FormLabel>
                  <FormControl><Input placeholder="e.g., LN12345" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="paymentDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date of Payment/Receipt</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="paymentMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Mode</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select payment mode" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Netbanking">Netbanking</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (₹)</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-muted-foreground" />
                        <Input 
                            type="number" 
                            placeholder="e.g., 50000" 
                            {...field} 
                            value={field.value === undefined ? "" : String(field.value)}
                            onChange={e => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                        />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue="Credit">
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select remark type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" /> Record Credit
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
