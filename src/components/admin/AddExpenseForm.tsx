
"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, FilePlus, ArrowLeft, Send, TrendingUp, TrendingDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import type { ExpenseRecord } from "@/types";

const addExpenseFormSchema = z.object({
  date: z.date().optional(), // Optional for 'received', required for 'spend'
  time: z.string().optional(), // Optional for 'received', required for 'spend'
  amount: z.coerce.number({ required_error: "Amount is required." }).positive("Amount must be a positive number."),
  reason: z.string().optional(), // For 'spend'
  fromPerson: z.string().optional(), // For 'received'
  paymentMode: z.enum(["Cash", "UPI", "Netbanking"]).optional(), // For 'received'
  remarks: z.string().optional(),
});

type AddExpenseFormValues = z.infer<typeof addExpenseFormSchema>;

// Converts "HH:mm" (24h) to "hh:mm AM/PM" (12h)
const formatTimeTo12Hour = (timeStr?: string): string => {
  if (!timeStr) return "";
  // Check if it's already in HH:mm format
  if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr)) {
    const [hoursStr, minutesStr] = timeStr.split(':');
    let hours = parseInt(hoursStr, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    return `${String(hours).padStart(2, '0')}:${minutesStr} ${ampm}`;
  }
  return timeStr; // Return as is if not in expected format
};

// Converts "hh:mm AM/PM" (and other variants) to "HH:mm" (24h) for time input
const formatTimeTo24HourInput = (timeStr?: string): string => {
    if (!timeStr) return "";
    // Check if already in 24-hour format
    if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr)) return timeStr;

    const lowerTime = timeStr.toLowerCase();
    const match = lowerTime.match(/(\d{1,2}):(\d{2})\s*(am|pm)/);
    if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const period = match[3];
        if (hours === 12 && period === 'am') hours = 0; // Midnight case
        else if (period === 'pm' && hours !== 12) hours += 12;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    return ""; // Return empty if format is not recognized
};


export function AddExpenseForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenseType, setExpenseType] = useState<'spend' | 'received'>('spend');

  const form = useForm<AddExpenseFormValues>({
    resolver: zodResolver(addExpenseFormSchema),
    defaultValues: {
      date: new Date(), // Default to today for spend
      time: format(new Date(), "HH:mm"), // Default to current time for spend
      amount: undefined,
      reason: "",
      fromPerson: "",
      paymentMode: undefined,
      remarks: expenseType === 'spend' ? "Expenses" : "", // Default remark based on type
    },
  });

  const handleTypeChange = (type: 'spend' | 'received') => {
    setExpenseType(type);
    form.reset({ // Reset form to defaults appropriate for the type
      date: type === 'spend' ? new Date() : undefined,
      time: type === 'spend' ? format(new Date(), "HH:mm") : undefined,
      amount: undefined,
      reason: "",
      fromPerson: "",
      paymentMode: undefined,
      remarks: type === 'spend' ? "Expenses" : "",
    });
  };

  async function onSubmit(values: AddExpenseFormValues) {
    setIsSubmitting(true);
    let dataToSave: Omit<ExpenseRecord, "id" | "recordedAt"> & { recordedAt?: any } = {
        type: expenseType,
        amount: values.amount,
        remarks: values.remarks || null,
        date: '', // Will be set below
        time: null,
        reason: null,
        fromPerson: null,
        paymentMode: null,
    };

    if (expenseType === 'spend') {
      if (!values.date) {
        toast({ title: "Validation Error", description: "Date is required for spending.", variant: "destructive" });
        setIsSubmitting(false); return;
      }
      if (!values.time || values.time.trim() === "") {
        toast({ title: "Validation Error", description: "Time is required for spending.", variant: "destructive" });
        setIsSubmitting(false); return;
      }
       if (!values.reason || values.reason.trim().length < 3) {
        toast({ title: "Validation Error", description: "Reason must be at least 3 characters for spending.", variant: "destructive" });
        setIsSubmitting(false); return;
      }
      dataToSave = {
        ...dataToSave,
        date: format(values.date, "yyyy-MM-dd"),
        time: formatTimeTo12Hour(values.time), // Save in 12hr format
        reason: values.reason,
        remarks: values.remarks || "Expenses", // Ensure remarks defaults to "Expenses" if not explicitly changed
      };
    } else { // 'received'
       if (!values.fromPerson || values.fromPerson.trim().length < 3) {
        toast({ title: "Validation Error", description: "'From' field must be at least 3 characters for received income.", variant: "destructive" });
        setIsSubmitting(false); return;
      }
      if (!values.paymentMode) {
        toast({ title: "Validation Error", description: "Payment mode is required for received income.", variant: "destructive" });
        setIsSubmitting(false); return;
      }
      dataToSave = {
        ...dataToSave,
        date: format(values.date || new Date(), "yyyy-MM-dd"), // Use selected date or default to today for received
        fromPerson: values.fromPerson,
        paymentMode: values.paymentMode,
        remarks: values.remarks || null,
        // time is typically not recorded for 'received' unless specified
      };
    }

    try {
      await addDoc(collection(db, "expenses"), {
        ...dataToSave,
        recordedAt: serverTimestamp() as Timestamp,
      });
      toast({ title: "Success", description: `Expense (${expenseType}) recorded successfully.` });
      router.push(`/admin/payments/expenses?refreshId=${Date.now()}`);
    } catch (error) {
      console.error("Expense submission error:", error);
      toast({ title: "Error", description: "Could not record expense. " + (error as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="shadow-xl w-full max-w-lg mx-auto my-8">
      <CardHeader>
        <div className="flex items-center gap-3 mb-4">
            <FilePlus className="h-8 w-8 text-primary"/>
            <div>
                <CardTitle className="text-2xl font-bold text-foreground">Add Expense Record</CardTitle>
                <CardDescription>Log a new financial transaction.</CardDescription>
            </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => handleTypeChange('spend')}
            variant={expenseType === 'spend' ? 'default' : 'outline'}
            className="flex-1"
          >
            <TrendingDown className="mr-2 h-4 w-4"/> Spend
          </Button>
          <Button
            onClick={() => handleTypeChange('received')}
            variant={expenseType === 'received' ? 'default' : 'outline'}
            className="flex-1"
          >
            <TrendingUp className="mr-2 h-4 w-4"/> Received
          </Button>
        </div>
      </CardHeader>
      <CardContent>
         <Button variant="outline" onClick={() => router.back()} className="mb-6 w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Expenses
        </Button>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
             <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem className="flex flex-col">
                <FormLabel>{expenseType === 'spend' ? 'Date of Spending' : 'Date of Receipt (Optional)'}</FormLabel>
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
            {expenseType === 'spend' && (
              <>
                <FormField control={form.control} name="time" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Time of Spending</FormLabel>
                    <FormControl>
                        <Input 
                            type="time" 
                            {...field} 
                            value={formatTimeTo24HourInput(field.value)}
                            onChange={(e) => field.onChange(e.target.value)} // Store as HH:mm
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField control={form.control} name="reason" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Reason for Spending</FormLabel>
                    <FormControl><Input placeholder="e.g., Office Supplies" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
              </>
            )}

            {expenseType === 'received' && (
              <>
                <FormField control={form.control} name="fromPerson" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Received From</FormLabel>
                    <FormControl><Input placeholder="e.g., Client X, Interest" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField control={form.control} name="paymentMode" render={({ field }) => (
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
              </>
            )}

            <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                <FormLabel>Amount (₹)</FormLabel>
                <FormControl>
                    <Input 
                        type="number" 
                        placeholder="e.g., 5000" 
                        {...field} 
                        value={field.value === undefined ? "" : String(field.value)}
                        onChange={e => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                    />
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
                  {expenseType === 'spend' ? (
                    <Select onValueChange={field.onChange} value={field.value || "Expenses"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select remark" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Expenses">Expenses</SelectItem>
                        {/* Add other predefined remarks for 'spend' if needed in the future */}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormControl>
                      <Textarea placeholder="Any additional notes for received income..." {...field} />
                    </FormControl>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" /> Record Transaction
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

    