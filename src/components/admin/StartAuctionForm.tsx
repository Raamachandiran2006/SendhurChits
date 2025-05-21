
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIconLucide, Loader2, Users as UsersIcon, PlayCircle, DollarSign, CheckCircle, Edit } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import type { Group, User, AuctionRecord } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams } from "next/navigation";

const startAuctionFormSchema = z.object({
  selectedGroupId: z.string().min(1, "Please select a Chit Group."),
  auctionMonth: z.string().min(3, "Auction month is required (e.g., August 2024)."),
  auctionDate: z.date({ required_error: "Auction date is required." }),
  auctionTime: z.string().min(1, "Auction time is required."),
  auctionMode: z.string().optional(),
  winnerUserId: z.string().min(1, "Please select a winner."), // Stores Firestore User Doc ID
  winningBidAmount: z.coerce.number().positive("Winning bid amount must be a positive number."),
});

type StartAuctionFormValues = z.infer<typeof startAuctionFormSchema>;

// Helper to convert 12h or 24h time string to 12h format for display/storage
const formatTimeTo12Hour = (timeStr?: string): string => {
  if (!timeStr) return "";
  if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr)) { // If already 24h "HH:mm"
    const [hoursStr, minutesStr] = timeStr.split(':');
    let hours = parseInt(hoursStr, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    return `${String(hours).padStart(2, '0')}:${minutesStr} ${ampm}`;
  }
  // If it's already in some 12h format, return as is, assuming it's valid.
  // More robust parsing can be added if various 12h inputs are expected.
  return timeStr; 
};

// Helper to convert time string (12h or 24h) to "HH:mm" for <input type="time">
const formatTimeTo24HourInput = (timeStr?: string): string => {
    if (!timeStr) return "";
    if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr)) return timeStr; // Already HH:mm

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
    return ""; // Return empty if not parsable to avoid input errors
};


export function StartAuctionForm() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedGroupId = searchParams.get("groupId");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<User[]>([]); // Full User objects
  const [loadingMembers, setLoadingMembers] = useState(false);

  const form = useForm<StartAuctionFormValues>({
    resolver: zodResolver(startAuctionFormSchema),
    defaultValues: {
      selectedGroupId: preselectedGroupId || "",
      auctionMonth: "",
      auctionDate: new Date(),
      auctionTime: "",
      auctionMode: "Manual",
      winnerUserId: "",
      winningBidAmount: undefined,
    },
  });

  const { watch, setValue } = form;
  const watchedGroupId = watch("selectedGroupId");
  const watchedWinnerUserId = watch("winnerUserId");

  // Fetch all groups for the dropdown
  useEffect(() => {
    const fetchGroupsData = async () => {
      setLoadingGroups(true);
      try {
        const groupsSnapshot = await getDocs(collection(db, "groups"));
        const fetchedGroups = groupsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Group));
        setGroups(fetchedGroups);
        if (preselectedGroupId && fetchedGroups.length > 0) {
          const preselected = fetchedGroups.find(g => g.id === preselectedGroupId);
          if (preselected) {
            setSelectedGroup(preselected);
          }
        }
      } catch (error) {
        console.error("Error fetching groups:", error);
        toast({ title: "Error", description: "Could not load groups.", variant: "destructive" });
      } finally {
        setLoadingGroups(false);
      }
    };
    fetchGroupsData();
  }, [preselectedGroupId, toast]);

  // When selectedGroupId changes, fetch its members
  useEffect(() => {
    if (!watchedGroupId) {
      setSelectedGroup(null);
      setGroupMembers([]);
      setValue("winnerUserId", ""); // Reset winner if group changes
      return;
    }

    const currentSelectedGroup = groups.find(g => g.id === watchedGroupId);
    setSelectedGroup(currentSelectedGroup || null);

    if (currentSelectedGroup && currentSelectedGroup.members.length > 0) {
      setLoadingMembers(true);
      const fetchMembers = async () => {
        try {
          const usersRef = collection(db, "users");
          // Firestore 'in' query limit is 30. Handle larger groups if necessary.
          const memberUsernamesBatches: string[][] = [];
          for (let i = 0; i < currentSelectedGroup.members.length; i += 30) {
            memberUsernamesBatches.push(currentSelectedGroup.members.slice(i, i + 30));
          }
          
          const fetchedMembers: User[] = [];
          for (const batch of memberUsernamesBatches) {
            if (batch.length > 0) {
              const q = query(usersRef, where("username", "in", batch));
              const memberSnapshots = await getDocs(q);
              memberSnapshots.docs.forEach(docSnap => fetchedMembers.push({ id: docSnap.id, ...docSnap.data() } as User));
            }
          }
          setGroupMembers(fetchedMembers);
        } catch (error) {
          console.error("Error fetching group members:", error);
          toast({ title: "Error", description: "Could not load members for the selected group.", variant: "destructive" });
          setGroupMembers([]);
        } finally {
          setLoadingMembers(false);
        }
      };
      fetchMembers();
    } else {
      setGroupMembers([]);
    }
    setValue("winnerUserId", ""); // Reset winner when group changes
  }, [watchedGroupId, groups, setValue, toast]);
  
  const getSelectedWinner = useCallback(() => {
    return groupMembers.find(member => member.id === watchedWinnerUserId) || null;
  }, [groupMembers, watchedWinnerUserId]);


  async function onSubmit(values: StartAuctionFormValues) {
    if (!selectedGroup) {
      toast({ title: "Error", description: "No group selected.", variant: "destructive" });
      return;
    }
    const winnerUser = getSelectedWinner();
    if (!winnerUser) {
        toast({ title: "Error", description: "Selected winner details not found.", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);
    try {
      const auctionRecordData: Omit<AuctionRecord, "id" | "recordedAt"> = {
        groupId: selectedGroup.id,
        groupName: selectedGroup.groupName,
        auctionMonth: values.auctionMonth,
        auctionDate: format(values.auctionDate, "yyyy-MM-dd"),
        auctionTime: formatTimeTo12Hour(values.auctionTime),
        auctionMode: values.auctionMode || "Manual",
        winnerUserId: winnerUser.id,
        winnerFullname: winnerUser.fullname,
        winnerUsername: winnerUser.username,
        winningBidAmount: values.winningBidAmount,
      };

      await addDoc(collection(db, "auctionRecords"), {
        ...auctionRecordData,
        recordedAt: serverTimestamp() as Timestamp,
      });

      // Update the group document
      const groupDocRef = doc(db, "groups", selectedGroup.id);
      await updateDoc(groupDocRef, {
        lastAuctionWinner: winnerUser.fullname,
        lastWinningBidAmount: values.winningBidAmount,
        // Optionally update scheduled auction details if these fields are for the *next* auction
        // auctionMonth: values.auctionMonth, 
        // auctionScheduledDate: format(values.auctionDate, "yyyy-MM-dd"),
        // auctionScheduledTime: formatTimeTo12Hour(values.auctionTime),
      });

      toast({ title: "Auction Recorded", description: `Auction for ${selectedGroup.groupName} successfully recorded.` });
      router.push(`/admin/groups/${selectedGroup.id}`);
    } catch (error) {
      console.error("Error recording auction:", error);
      toast({ title: "Error", description: "Could not record auction. " + (error as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const selectedWinnerDetails = getSelectedWinner();

  return (
    <Card className="shadow-xl w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-3">
            <PlayCircle className="h-8 w-8 text-primary"/>
            <div>
                <CardTitle className="text-2xl font-bold text-foreground">Start/Record Auction</CardTitle>
                <CardDescription>Fill in the details for the auction event.</CardDescription>
            </div>
        </div>
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
                    <FormLabel>Chit Group Name</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={loadingGroups}>
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
                <FormLabel>Chit Group ID</FormLabel>
                <Input readOnly value={selectedGroup?.id || ""} placeholder="Auto-filled" />
              </FormItem>
            </div>

            <FormField
              control={form.control}
              name="auctionMonth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Auction Month</FormLabel>
                  <FormControl><Input placeholder="e.g., August 2024" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="auctionDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Auction Date</FormLabel>
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
                name="auctionTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Auction Time</FormLabel>
                    <FormControl>
                      <Input 
                        type="time" 
                        {...field} 
                        value={formatTimeTo24HourInput(field.value)}
                        onChange={(e) => field.onChange(e.target.value ? formatTimeTo12Hour(e.target.value) : "")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="auctionMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Auction Mode (Optional)</FormLabel>
                  <FormControl><Input placeholder="e.g., Manual, Online" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="winnerUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Winner</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!selectedGroup || loadingMembers}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingMembers ? "Loading members..." : (selectedGroup ? "Select winner" : "Select group first")} />
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
                <FormItem>
                    <FormLabel>Winner User ID</FormLabel>
                    <Input readOnly value={selectedWinnerDetails?.username || ""} placeholder="Auto-filled" />
                </FormItem>
                <FormItem>
                    <FormLabel>Winner Full Name</FormLabel>
                    <Input readOnly value={selectedWinnerDetails?.fullname || ""} placeholder="Auto-filled" />
                </FormItem>
            </div>

            <FormField
              control={form.control}
              name="winningBidAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Winning Bid Amount (₹)</FormLabel>
                    <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-muted-foreground" />
                        <FormControl><Input type="number" placeholder="e.g., 12000" {...field} /></FormControl>
                    </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting || loadingGroups || loadingMembers}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Record Auction
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
