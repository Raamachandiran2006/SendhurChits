
"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, UserSearch, DollarSign, FilePenLine, Send } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, serverTimestamp, Timestamp, query, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import type { Employee } from "@/types";

const addSalaryRecordFormSchema = z.object({
  employeeDocId: z.string().min(1, "Please select an employee."),
  amount: z.coerce.number().positive("Salary amount must be a positive number."),
  paymentDate: z.date({ required_error: "Payment date is required." }),
  remarks: z.string().optional(),
});

type AddSalaryRecordFormValues = z.infer<typeof addSalaryRecordFormSchema>;

export function AddSalaryRecordForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  const form = useForm<AddSalaryRecordFormValues>({
    resolver: zodResolver(addSalaryRecordFormSchema),
    defaultValues: {
      employeeDocId: "",
      amount: undefined, // Use undefined for numeric inputs that are not pre-filled
      paymentDate: new Date(),
      remarks: "",
    },
  });

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoadingEmployees(true);
      try {
        const employeesRef = collection(db, "employees");
        const q = query(employeesRef, orderBy("fullname"));
        const querySnapshot = await getDocs(q);
        const fetchedEmployees = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
        setEmployees(fetchedEmployees);
      } catch (error) {
        console.error("Error fetching employees:", error);
        toast({ title: "Error", description: "Could not load employees for selection.", variant: "destructive" });
      } finally {
        setLoadingEmployees(false);
      }
    };
    fetchEmployees();
  }, [toast]);

  async function onSubmit(values: AddSalaryRecordFormValues) {
    setIsSubmitting(true);
    try {
      const selectedEmployee = employees.find(emp => emp.id === values.employeeDocId);
      if (!selectedEmployee) {
        toast({ title: "Error", description: "Selected employee not found.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      await addDoc(collection(db, "salaryRecords"), {
        employeeDocId: values.employeeDocId,
        employeeReadableId: selectedEmployee.employeeId,
        employeeName: selectedEmployee.fullname,
        amount: values.amount,
        paymentDate: format(values.paymentDate, "yyyy-MM-dd"),
        remarks: values.remarks || "",
        recordedAt: serverTimestamp(),
      });

      toast({ title: "Salary Record Added", description: `Salary for ${selectedEmployee.fullname} recorded successfully.` });
      router.push(`/admin/employees/salary?refreshId=${Date.now()}`);
    } catch (error) {
      console.error("Salary record submission error:", error);
      toast({ title: "Error", description: "Could not add salary record. " + (error as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="shadow-xl w-full max-w-lg mx-auto my-8">
      <CardHeader>
        <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-primary"/>
            <div>
                <CardTitle className="text-2xl font-bold text-foreground">Add Salary Record</CardTitle>
                <CardDescription>Log a new salary payment for an employee.</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="employeeDocId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={loadingEmployees}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingEmployees ? "Loading employees..." : "Select an employee"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {!loadingEmployees && employees.length === 0 && (
                        <SelectItem value="no-employee" disabled>No employees found</SelectItem>
                      )}
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.fullname} (ID: {employee.employeeId})
                        </SelectItem>
                      ))}
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
                  <FormLabel>Salary Amount (₹)</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-muted-foreground" />
                        <Input 
                        type="number" 
                        placeholder="e.g., 30000" 
                        {...field} 
                        value={field.value === undefined ? "" : field.value}
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
              name="paymentDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Payment Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                        >
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
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any notes about this payment..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting || loadingEmployees}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" /> Record Salary Payment
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
