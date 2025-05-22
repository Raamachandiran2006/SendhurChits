
"use client";

import React, { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIconLucide, Loader2, DollarSign, Save, Users as UsersIcon, Layers as LayersIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, serverTimestamp, Timestamp, orderBy, doc } from "firebase/firestore";
import type { Group, User, AuctionRecord, CollectionRecord } from "@/types"; // Keep CollectionRecord for structure similarity for now
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

// Helper for time formatting
const formatTimeTo12Hour = (timeStr?: string): string => {
  if (!timeStr) return "";
  if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr)) {
    const [hoursStr, minutesStr] = timeStr.split(':');
    let hours = parseInt(hoursStr, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${String(hours).padStart(2, '0')}:${minutesStr} ${ampm}`;
  }
  return timeStr;
};

const formatTimeTo24HourInput = (timeStr?: string): string => {
    if (!timeStr) return "";
    if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr)) return timeStr;
    const lowerTime = timeStr.toLowerCase();
    const match = lowerTime.match(/(\d{1,2}):(\d{2})\s*(am|pm)/);
    if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const period = match[3];
        if (hours === 12 && period === 'am') hours = 0;
        else if (period === 'pm' && hours !== 12) hours += 12;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    return "";
};

const recordPaymentFormSchema = z.object({
  selectedGroupId: z.string().min(1, "Please select a Group."),
  selectedAuctionId: z.string().optional(),
  selectedUserId: z.string().min(1, "Please select a User."),
  paymentDate: z.date({ required_error: "Payment date is required." }),
  paymentTime: z.string().min(1, "Payment time is required."),
  paymentType: z.enum(["Full Payment", "Partial Payment"], { required_error: "Payment type is required." }),
  paymentMode: z.enum(["Cash", "UPI", "Netbanking"], { required_error: "Payment mode is required." }),
  amount: z.coerce.number().int("Amount must be a whole number.").positive("Amount must be a positive number."),
  remarks: z.string().optional(),
});

type RecordPaymentFormValues = z.infer<typeof recordPaymentFormSchema>;

const NO_AUCTION_SELECTED_VALUE = "no-auction-selected";

export function RecordPaymentForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  
  const [selectedGroupObject, setSelectedGroupObject] = useState<Group | null>(null);
  const [groupAuctions, setGroupAuctions] = useState<AuctionRecord[]>([]);
  const [loadingAuctions, setLoadingAuctions] = useState(false);
  const [groupMembers, setGroupMembers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const form = useForm<RecordPaymentFormValues>({
    resolver: zodResolver(recordPaymentFormSchema),
    defaultValues: {
      selectedGroupId: "",
      selectedAuctionId: undefined,
      selectedUserId: "",
      paymentDate: new Date(),
      paymentTime: formatTimeTo12Hour(format(new Date(), "HH:mm")),
      paymentType: undefined,
      paymentMode: undefined,
      amount: undefined,
      remarks: "",
    },
  });

  const { watch, setValue } = form;
  const watchedGroupId = watch("selectedGroupId");

  useEffect(() => {
    const fetchGroups = async () => {
      setLoadingGroups(true);
      try {
        const groupsSnapshot = await getDocs(collection(db, "groups"));
        const fetchedGroups = groupsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Group));
        setGroups(fetchedGroups);
      } catch (error) {
        console.error("Error fetching groups:", error);
        toast({ title: "Error", description: "Could not load groups.", variant: "destructive" });
      } finally {
        setLoadingGroups(false);
      }
    };
    fetchGroups();
  }, [toast]);

  useEffect(() => {
    if (!watchedGroupId) {
      setSelectedGroupObject(null);
      setGroupAuctions([]);
      setGroupMembers([]);
      setValue("selectedAuctionId", undefined); 
      setValue("selectedUserId", "");
      return;
    }

    const group = groups.find(g => g.id === watchedGroupId);
    setSelectedGroupObject(group || null);

    if (group) {
      const fetchAuctions = async () => {
        setLoadingAuctions(true);
        try {
          const auctionQuery = query(collection(db, "auctionRecords"), where("groupId", "==", group.id), orderBy("auctionNumber", "desc"));
          const auctionSnapshot = await getDocs(auctionQuery);
          setGroupAuctions(auctionSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as AuctionRecord)));
        } catch (error) {
          console.error("Error fetching auctions for group:", error);
          toast({ title: "Error", description: "Could not load auctions for the selected group.", variant: "destructive" });
          setGroupAuctions([]);
        } finally {
          setLoadingAuctions(false);
        }
      };
      fetchAuctions();

      const fetchMembers = async () => {
        setLoadingMembers(true);
        try {
          if (group.members && group.members.length > 0) {
            const usersRef = collection(db, "users");
            const fetchedMembers: User[] = [];
            for (let i = 0; i < group.members.length; i += 30) {
                const batchUsernames = group.members.slice(i, i + 30);
                if (batchUsernames.length > 0) {
                    const memberQuery = query(usersRef, where("username", "in", batchUsernames));
                    const memberSnapshot = await getDocs(memberQuery);
                    memberSnapshot.docs.forEach(doc => fetchedMembers.push({ id: doc.id, ...doc.data() } as User));
                }
            }
            setGroupMembers(fetchedMembers);
          } else {
            setGroupMembers([]);
          }
        } catch (error) {
          console.error("Error fetching members for group:", error);
          toast({ title: "Error", description: "Could not load members for the selected group.", variant: "destructive" });
          setGroupMembers([]);
        } finally {
          setLoadingMembers(false);
        }
      };
      fetchMembers();
    }
  }, [watchedGroupId, groups, setValue, toast]);

  async function onSubmit(values: RecordPaymentFormValues) {
    setIsSubmitting(true);
    if (!selectedGroupObject) {
      toast({ title: "Error", description: "Group details not found.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    const selectedUser = groupMembers.find(m => m.id === values.selectedUserId);
    if (!selectedUser) {
      toast({ title: "Error", description: "User details not found.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    
    const selectedAuction = values.selectedAuctionId && values.selectedAuctionId !== NO_AUCTION_SELECTED_VALUE 
      ? groupAuctions.find(a => a.id === values.selectedAuctionId) 
      : null;

    try {
      // Using CollectionRecord type here for structure, but saving to 'paymentRecords'
      const paymentData: Omit<CollectionRecord, "id" | "recordedAt" | "collectionLocation" | "recordedByEmployeeId" | "recordedByEmployeeName"> & { recordedAt?: any } = { 
        groupId: selectedGroupObject.id,
        groupName: selectedGroupObject.groupName,
        auctionId: selectedAuction ? selectedAuction.id : null,
        auctionNumber: selectedAuction ? selectedAuction.auctionNumber : null,
        userId: selectedUser.id,
        userUsername: selectedUser.username,
        userFullname: selectedUser.fullname,
        paymentDate: format(values.paymentDate, "yyyy-MM-dd"),
        paymentTime: values.paymentTime, 
        paymentType: values.paymentType,
        paymentMode: values.paymentMode,
        amount: values.amount,
        remarks: values.remarks || null,
      };

      await addDoc(collection(db, "paymentRecords"), { // Changed to "paymentRecords"
        ...paymentData,
        recordedAt: serverTimestamp() as Timestamp,
        // Admin-specific recording details (if needed) can be added here
        recordedBy: "Admin", // Example
      });

      toast({ title: "Payment Recorded", description: "Payment details saved successfully to payment records." }); // Updated toast
      form.reset({
        selectedGroupId: values.selectedGroupId,
        selectedAuctionId: undefined,
        selectedUserId: "",
        paymentDate: new Date(),
        paymentTime: formatTimeTo12Hour(format(new Date(), "HH:mm")),
        paymentType: undefined,
        paymentMode: undefined,
        amount: undefined,
        remarks: "",
      }); 
    } catch (error) {
      console.error("Error recording payment:", error);
      toast({ title: "Error", description: "Could not record payment. " + (error as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="shadow-xl w-full max-w-2xl mx-auto">
      <CardHeader>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="selectedGroupId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Name</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={loadingGroups}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingGroups ? "Loading groups..." : "Select a group"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.groupName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Group ID</FormLabel>
                <Input readOnly value={selectedGroupObject?.id || ""} placeholder="Auto-filled" />
              </FormItem>
            </div>

            <FormField
              control={form.control}
              name="selectedAuctionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Auction No (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || NO_AUCTION_SELECTED_VALUE} disabled={!watchedGroupId || loadingAuctions}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={!watchedGroupId ? "Select group first" : (loadingAuctions ? "Loading auctions..." : "Select auction (if applicable)")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_AUCTION_SELECTED_VALUE}>None</SelectItem> 
                      {groupAuctions.map((auction) => (
                        <SelectItem key={auction.id} value={auction.id}>
                          Auction #{auction.auctionNumber} - {auction.auctionMonth}
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
              name="selectedUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!watchedGroupId || loadingMembers}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={!watchedGroupId ? "Select group first" : (loadingMembers ? "Loading members..." : "Select a user")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {groupMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.fullname} (@{member.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Payment Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIconLucide className="ml-auto h-4 w-4 opacity-50" />
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
                name="paymentTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        value={formatTimeTo24HourInput(field.value)}
                        onChange={(e) => field.onChange(e.target.value ? formatTimeTo12Hour(e.target.value) : "")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                control={form.control}
                name="paymentType"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Payment Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select payment type" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="Full Payment">Full Payment</SelectItem>
                        <SelectItem value="Partial Payment">Partial Payment</SelectItem>
                        </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} value={field.value}>
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
            </div>

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
                        type="text" 
                        placeholder="e.g., 10000"
                        value={field.value === undefined ? "" : String(field.value)}
                        onChange={e => {
                            const val = e.target.value;
                            if (val === "") {
                                field.onChange(undefined);
                            } else {
                                const num = parseInt(val, 10);
                                field.onChange(isNaN(num) ? undefined : num);
                            }
                        }}
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
                  <FormLabel>Remarks (Optional)</FormLabel>
                  <FormControl><Textarea placeholder="Any notes about this payment..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Record Payment
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

    