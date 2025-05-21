
"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, doc, updateDoc, arrayUnion, query, where, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, PlusCircle, Users, CalendarIcon, Tag, LandmarkIcon, SearchCode } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, subYears } from "date-fns";

const groupFormSchema = z.object({
  groupName: z.string().min(3, "Group name must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  totalPeople: z.coerce.number().int().positive("Total people must be a positive number"),
  totalAmount: z.coerce.number().positive("Total amount must be a positive number"),
  memberUsernames: z.array(z.string()).min(1, "At least one member must be selected"),
  tenure: z.coerce.number().int().min(1, "Tenure must be at least 1 month"),
  startDate: z.date({ required_error: "Start date is required." }),
  rate: z.number().int("Monthly Installment must be a whole number.").positive("Monthly Installment must be positive.").optional(),
  commission: z.number().int("Commission must be a whole number.").positive("Commission must be positive.").optional(),
  biddingType: z.enum(["auction", "random", "pre-fixed"], {
    errorMap: () => ({ message: "Please select a valid bidding type." }),
  }).optional(),
  minBid: z.number().int("Min Bid Amount must be a whole number.").positive("Min Bid Amount must be positive.").optional(),
});

export function CreateGroupForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof groupFormSchema>>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      groupName: "",
      description: "",
      totalPeople: 10,
      totalAmount: 100000,
      memberUsernames: [],
      tenure: 10,
      startDate: new Date(),
      rate: undefined,
      commission: undefined,
      biddingType: undefined,
      minBid: undefined,
    },
  });

  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("isAdmin", "!=", true)); 
        const querySnapshot = await getDocs(q);
        const fetchedUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
        toast({ title: "Error", description: "Could not load users.", variant: "destructive" });
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [toast]);

  async function onSubmit(values: z.infer<typeof groupFormSchema>) {
    setIsSubmitting(true);
    try {
      const groupData: any = { 
        groupName: values.groupName,
        description: values.description,
        totalPeople: values.totalPeople,
        totalAmount: values.totalAmount,
        members: values.memberUsernames, 
        tenure: values.tenure,
        startDate: format(values.startDate, "yyyy-MM-dd"),
      };

      if (values.rate !== undefined) {
        groupData.rate = values.rate;
      }
      if (values.commission !== undefined) {
        groupData.commission = values.commission;
      }
      if (values.biddingType) {
        groupData.biddingType = values.biddingType;
      }
      if (values.minBid !== undefined) {
        groupData.minBid = values.minBid;
      }

      const newGroupRef = await addDoc(collection(db, "groups"), groupData);
      const groupId = newGroupRef.id;

      const batch = writeBatch(db);
      values.memberUsernames.forEach(username => {
        const userToUpdate = users.find(u => u.username === username);
        if(userToUpdate) {
          const userDocRef = doc(db, "users", userToUpdate.id);
          batch.update(userDocRef, {
            groups: arrayUnion(groupId)
          });
        }
      });
      await batch.commit();

      toast({ title: "Success", description: "Group created successfully!" });
      router.push("/admin/groups");
    } catch (error) {
      console.error("Error creating group:", error);
      toast({ title: "Error", description: "Could not create group.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const today = new Date();
  const fiveYearsFromNow = subYears(today, -5); 


  const handleNumericInputChange = (event: React.ChangeEvent<HTMLInputElement>, field: any) => {
    const strVal = event.target.value;
    if (strVal.trim() === '') {
      field.onChange(undefined);
    } else if (/^\d+$/.test(strVal.trim())) {
      field.onChange(parseInt(strVal.trim(), 10));
    } else {
      // Keep current value or set to NaN for Zod to catch as invalid if not purely numeric
      // Or, pass the string directly if Zod schema handles non-numeric string validation
      field.onChange(strVal); // Let Zod handle non-numeric strings if schema allows
    }
  };


  return (
    <Card className="shadow-xl w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-3">
            <PlusCircle className="h-8 w-8 text-accent"/>
            <div>
                <CardTitle className="text-2xl font-bold text-foreground">Create New Chit Group</CardTitle>
                <CardDescription>Fill in the details to create a new group.</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="groupName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Name</FormLabel>
                  <FormControl><Input placeholder="e.g., January 2025 Chit" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Chit Details (Description)</FormLabel>
                  <FormControl><Textarea placeholder="Describe the chit group, rules, etc." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="totalPeople" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Number of People</FormLabel>
                    <FormControl><Input type="number" placeholder="10" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="totalAmount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Total Amount (₹)</FormLabel>
                    <FormControl><Input type="number" placeholder="100000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="tenure" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tenure</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl><Input type="number" placeholder="10" {...field} className="w-1/2"/></FormControl>
                      <span className="text-muted-foreground">months</span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild><FormControl>
                          <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button></FormControl></PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" captionLayout="dropdown-buttons" selected={field.value} onSelect={field.onChange} fromDate={subYears(today, 1)} toDate={fiveYearsFromNow} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="rate" render={({ field }) => ( 
                    <FormItem>
                        <FormLabel>Monthly Installment (₹)</FormLabel>
                        <div className="flex items-center gap-2">
                            <LandmarkIcon className="h-4 w-4 text-muted-foreground" />
                            <FormControl>
                              <Input 
                                type="text" 
                                placeholder="e.g., 5000" 
                                {...field} 
                                value={field.value === undefined ? '' : String(field.value)} 
                                onChange={e => handleNumericInputChange(e, field)}
                              />
                            </FormControl>
                        </div>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="commission" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Commission (%)</FormLabel>
                         <div className="flex items-center gap-2">
                            <FormControl>
                              <Input 
                                type="text" 
                                placeholder="e.g., 2" 
                                {...field} 
                                value={field.value === undefined ? '' : String(field.value)} 
                                onChange={e => handleNumericInputChange(e, field)}
                              />
                            </FormControl>
                            <Tag className="h-4 w-4 text-muted-foreground" /> 
                        </div>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="biddingType" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Bidding Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select bidding type" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="auction">Auction Based</SelectItem>
                                <SelectItem value="random">Random Draw</SelectItem>
                                <SelectItem value="pre-fixed">Pre-fixed</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="minBid" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Min Bid Amount (₹)</FormLabel>
                        <div className="flex items-center gap-2">
                          <LandmarkIcon className="h-4 w-4 text-muted-foreground" />
                          <FormControl>
                            <Input 
                              type="text" 
                              placeholder="e.g., 1000" 
                              {...field} 
                              value={field.value === undefined ? '' : String(field.value)} 
                              onChange={e => handleNumericInputChange(e, field)}
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>


            <FormField control={form.control} name="memberUsernames" render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">Select Members</FormLabel>
                    <FormDescription>Choose users to add to this group.</FormDescription>
                  </div>
                  {loadingUsers ? (
                     <div className="flex items-center space-x-2">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="text-muted-foreground">Loading users...</span>
                     </div>
                  ) : users.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No users available to add.</p>
                  ) : (
                    <ScrollArea className="h-64 rounded-md border p-4">
                      <div className="space-y-2">
                      {users.map((user) => (
                        <FormField key={user.id} control={form.control} name="memberUsernames"
                          render={({ field }) => {
                            return (
                              <FormItem key={user.id} className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox checked={field.value?.includes(user.username)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), user.username])
                                        : field.onChange(
                                            (field.value || []).filter(
                                              (value) => value !== user.username
                                            )
                                          );
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">{user.fullname} (@{user.username})</FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                      </div>
                    </ScrollArea>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isSubmitting || loadingUsers}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Group
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
