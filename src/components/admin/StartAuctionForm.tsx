
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIconLucide, Loader2, PlayCircle, DollarSign, CheckCircle, ArrowLeft, ListNumbers } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, doc, updateDoc, serverTimestamp, Timestamp, orderBy, writeBatch, getDoc } from "firebase/firestore";
import type { Group, User, AuctionRecord } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams } from "next/navigation";

const startAuctionFormSchema = z.object({
  selectedGroupId: z.string().min(1, "Please select a Chit Group."),
  auctionNumber: z.coerce.number({invalid_type_error: "Auction number must be selected"}).int().positive("Auction number is required."),
  auctionMonth: z.string().min(3, "Auction month is required (e.g., August 2024)."),
  auctionDate: z.date({ required_error: "Auction date is required." }),
  auctionTime: z.string().min(1, "Auction time is required."),
  auctionMode: z.enum(["Manual", "Online"]).optional(),
  winnerUserId: z.string().min(1, "Please select a winner."),
  winningBidAmount: z.coerce.number().int("Winning bid amount must be a whole number.").positive("Winning bid amount must be a positive number."),
});

type StartAuctionFormValues = z.infer<typeof startAuctionFormSchema>;

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

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
  return `₹${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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
  const [groupMembers, setGroupMembers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [previousWinnerIds, setPreviousWinnerIds] = useState<string[]>([]);
  const [completedAuctionNumbers, setCompletedAuctionNumbers] = useState<number[]>([]);
  const [loadingPreviousWinnersAndCount, setLoadingPreviousWinnersAndCount] = useState(false);
  const [auctionNumberOptions, setAuctionNumberOptions] = useState<number[]>([]);
  const [maxWinningBidAllowed, setMaxWinningBidAllowed] = useState<number | null>(null);


  const form = useForm<StartAuctionFormValues>({
    resolver: zodResolver(startAuctionFormSchema),
    defaultValues: {
      selectedGroupId: preselectedGroupId || "",
      auctionNumber: undefined,
      auctionMonth: "",
      auctionDate: new Date(),
      auctionTime: "",
      auctionMode: "Manual",
      winnerUserId: "",
      winningBidAmount: undefined,
    },
  });

  const { watch, setValue, reset, control, setError: setFormError } = form;
  const watchedGroupId = watch("selectedGroupId");
  const watchedWinnerUserId = watch("winnerUserId");

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
            setValue("selectedGroupId", preselected.id, { shouldValidate: true });
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
  }, [preselectedGroupId, toast, setValue]);

  useEffect(() => {
    if (!watchedGroupId) {
      setSelectedGroup(null);
      setGroupMembers([]);
      setPreviousWinnerIds([]);
      setCompletedAuctionNumbers([]);
      setAuctionNumberOptions([]);
      setMaxWinningBidAllowed(null);
      const currentGroupId = form.getValues("selectedGroupId"); // Keep preselected if it was already set
      reset({
        selectedGroupId: preselectedGroupId === currentGroupId ? currentGroupId : "",
        auctionNumber: undefined,
        auctionMonth: "",
        auctionDate: new Date(),
        auctionTime: "",
        auctionMode: "Manual",
        winnerUserId: "",
        winningBidAmount: undefined,
      });
      return;
    }

    const currentSelectedGroup = groups.find(g => g.id === watchedGroupId);
    setSelectedGroup(currentSelectedGroup || null);

    if (currentSelectedGroup) {
      setValue("auctionMonth", currentSelectedGroup.auctionMonth || "");
      if (currentSelectedGroup.auctionScheduledDate) {
        try {
          const dateParts = currentSelectedGroup.auctionScheduledDate.split('-');
          const localDate = dateParts.length === 3
            ? new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]))
            : parseISO(currentSelectedGroup.auctionScheduledDate);
          if (!isNaN(localDate.getTime())) {
            setValue("auctionDate", localDate);
          } else {
             setValue("auctionDate", new Date());
          }
        } catch (e) {
          console.warn("Could not parse auctionScheduledDate:", currentSelectedGroup.auctionScheduledDate, e);
          setValue("auctionDate", new Date());
        }
      } else {
        setValue("auctionDate", new Date());
      }
      setValue("auctionTime", currentSelectedGroup.auctionScheduledTime || "");
      setValue("auctionMode", currentSelectedGroup.biddingType === "auction" ? "Manual" : (currentSelectedGroup.biddingType === "random" ? "Online" : (currentSelectedGroup.biddingType === "pre-fixed" ? "Online" : "Manual")));

      // Calculate Max Winning Bid Allowed
      if (typeof currentSelectedGroup.totalAmount === 'number') {
        const groupTotalAmount = currentSelectedGroup.totalAmount;
        const groupCommissionPercent = (typeof currentSelectedGroup.commission === 'number' && currentSelectedGroup.commission >= 0) ? currentSelectedGroup.commission : 0;
        const commissionAmount = (groupCommissionPercent / 100) * groupTotalAmount;
        setMaxWinningBidAllowed(groupTotalAmount - commissionAmount);
      } else {
        setMaxWinningBidAllowed(null);
      }


      if (currentSelectedGroup.tenure && currentSelectedGroup.tenure > 0) {
        setAuctionNumberOptions(Array.from({ length: currentSelectedGroup.tenure }, (_, i) => i + 1));
      } else {
        setAuctionNumberOptions([]);
      }


      const fetchGroupRelatedData = async () => {
        setLoadingMembers(true);
        setLoadingPreviousWinnersAndCount(true);
        try {
          if (currentSelectedGroup.members.length > 0) {
            const usersRef = collection(db, "users");
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
          } else {
            setGroupMembers([]);
          }

          const auctionRecordsRef = collection(db, "auctionRecords");
          const qAuction = query(auctionRecordsRef, where("groupId", "==", currentSelectedGroup.id));
          const auctionSnapshot = await getDocs(qAuction);
          const fetchedAuctionHistory = auctionSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as AuctionRecord));
          const winnerIds = fetchedAuctionHistory.map(rec => rec.winnerUserId);
          setPreviousWinnerIds(winnerIds);
          const completedNums = fetchedAuctionHistory
            .map(rec => rec.auctionNumber)
            .filter((num): num is number => typeof num === 'number' && num > 0);
          setCompletedAuctionNumbers(completedNums);

          let defaultAuctionNumber: number | undefined = undefined;
          if (currentSelectedGroup.tenure && currentSelectedGroup.tenure > 0) {
              for (let i = 1; i <= currentSelectedGroup.tenure; i++) {
                  if (!completedNums.includes(i)) {
                      defaultAuctionNumber = i;
                      break;
                  }
              }
              // If all auctions completed or no auctions yet, and tenure exists, default to 1
              if (!defaultAuctionNumber && fetchedAuctionHistory.length === 0 && currentSelectedGroup.tenure > 0) {
                  defaultAuctionNumber = 1;
              }
          }
          setValue("auctionNumber", defaultAuctionNumber, { shouldValidate: true });
        } catch (error) {
          console.error("Error fetching group members or auction history:", error);
          toast({ title: "Error", description: "Could not load members or auction history.", variant: "destructive" });
          setGroupMembers([]);
          setPreviousWinnerIds([]);
          setCompletedAuctionNumbers([]);
          setValue("auctionNumber", undefined);
        } finally {
          setLoadingMembers(false);
          setLoadingPreviousWinnersAndCount(false);
        }
      };
      fetchGroupRelatedData();
    } else {
        setGroupMembers([]);
        setPreviousWinnerIds([]);
        setCompletedAuctionNumbers([]);
        setAuctionNumberOptions([]);
        setMaxWinningBidAllowed(null);
        setValue("auctionNumber", undefined);
    }
    setValue("winnerUserId", "");
  }, [watchedGroupId, groups, setValue, toast, reset, form, preselectedGroupId]);

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

    // Validation for winning bid amount
    const groupTotalAmountVal = typeof selectedGroup.totalAmount === 'number' ? selectedGroup.totalAmount : 0;
    const groupCommissionPercentVal = (typeof selectedGroup.commission === 'number' && selectedGroup.commission >= 0) ? selectedGroup.commission : 0;
    const calculatedCommissionForValidation = (groupCommissionPercentVal / 100) * groupTotalAmountVal;
    const maxBidForValidation = groupTotalAmountVal - calculatedCommissionForValidation;

    if (values.winningBidAmount > maxBidForValidation) {
      const errorMessage = `Winning bid cannot exceed the maximum allowed bid of ${formatCurrency(maxBidForValidation)}.`;
      setFormError("winningBidAmount", { type: "manual", message: errorMessage });
      toast({ title: "Invalid Bid Amount", description: errorMessage, variant: "destructive" });
      return;
    }

    if (previousWinnerIds.includes(winnerUser.id)) {
      toast({
        title: "Selection Blocked",
        description: `${winnerUser.fullname} has already won an auction in this group.`,
        variant: "destructive"
      });
      return;
    }

    if (completedAuctionNumbers.includes(values.auctionNumber)) {
       toast({
        title: "Selection Blocked",
        description: `Auction #${values.auctionNumber} has already been recorded.`,
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
        const commissionPercent = typeof selectedGroup.commission === 'number' ? selectedGroup.commission : 0;
        const totalGroupAmount = typeof selectedGroup.totalAmount === 'number' ? selectedGroup.totalAmount : 0;
        const groupRateInstallment = typeof selectedGroup.rate === 'number' ? selectedGroup.rate : 0;
        const totalGroupPeople = typeof selectedGroup.totalPeople === 'number' && selectedGroup.totalPeople > 0 ? selectedGroup.totalPeople : 1;
        
        let calculatedCommissionAmount: number | null = null;
        if (selectedGroup.commission !== undefined && selectedGroup.commission !== null && totalGroupAmount > 0) {
            calculatedCommissionAmount = (commissionPercent * totalGroupAmount) / 100;
        }

        let calculatedDiscount: number | null = null;
        if (totalGroupAmount > 0 && typeof values.winningBidAmount === 'number') {
            calculatedDiscount = totalGroupAmount - values.winningBidAmount;
        }

        let calculatedNetDiscount: number | null = null;
        if (calculatedDiscount !== null && calculatedCommissionAmount !== null) {
            calculatedNetDiscount = calculatedDiscount - calculatedCommissionAmount;
        }

        let calculatedDividendPerMember: number | null = null;
        if (calculatedNetDiscount !== null && totalGroupPeople > 0) {
            calculatedDividendPerMember = calculatedNetDiscount / totalGroupPeople;
        }

        let calculatedFinalAmountToBePaid: number | null = null; 
        if (groupRateInstallment > 0 && calculatedDividendPerMember !== null) {
            calculatedFinalAmountToBePaid = groupRateInstallment - calculatedDividendPerMember;
        }
        
        let amountPaidToWinnerCalc: number | null = null;
        if (typeof values.winningBidAmount === 'number' && calculatedFinalAmountToBePaid !== null) {
          amountPaidToWinnerCalc = values.winningBidAmount - calculatedFinalAmountToBePaid;
        }


      const auctionRecordData: Omit<AuctionRecord, "id" | "recordedAt"> & { recordedAt?: any } = {
        groupId: selectedGroup.id,
        groupName: selectedGroup.groupName,
        auctionNumber: values.auctionNumber,
        auctionMonth: values.auctionMonth,
        auctionDate: format(values.auctionDate, "yyyy-MM-dd"),
        auctionTime: formatTimeTo12Hour(values.auctionTime),
        auctionMode: values.auctionMode || "Manual",
        winnerUserId: winnerUser.id,
        winnerFullname: winnerUser.fullname,
        winnerUsername: winnerUser.username,
        winningBidAmount: values.winningBidAmount,
        commissionAmount: calculatedCommissionAmount,
        discount: calculatedDiscount,
        netDiscount: calculatedNetDiscount,
        dividendPerMember: calculatedDividendPerMember,
        finalAmountToBePaid: calculatedFinalAmountToBePaid, // Installment by all
        amountPaidToWinner: amountPaidToWinnerCalc, // Amount paid to winner
      };

      await addDoc(collection(db, "auctionRecords"), {
        ...auctionRecordData,
        recordedAt: serverTimestamp() as Timestamp,
      });

      const groupDocRef = doc(db, "groups", selectedGroup.id);
      await updateDoc(groupDocRef, {
        lastAuctionWinner: winnerUser.fullname,
        lastWinningBidAmount: values.winningBidAmount,
        auctionMonth: values.auctionMonth,
        auctionScheduledDate: format(values.auctionDate, "yyyy-MM-dd"),
        auctionScheduledTime: formatTimeTo12Hour(values.auctionTime),
      });

      toast({ title: "Auction Recorded", description: `Auction for ${selectedGroup.groupName} successfully recorded.` });

      // Update dueAmount for ALL members
      if (calculatedFinalAmountToBePaid !== null && calculatedFinalAmountToBePaid > 0) {
        const batch = writeBatch(db);
        
        for (const member of groupMembers) {
          const userDocRef = doc(db, "users", member.id);
          const currentDue = member.dueAmount || 0;
          const newDueAmount = currentDue + calculatedFinalAmountToBePaid;
          batch.update(userDocRef, { dueAmount: newDueAmount });
        }
        await batch.commit();
        toast({ title: "Due Amounts Updated", description: `Due amounts for all group members have been updated.` });
      }

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
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="selectedGroupId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chit Group Name</FormLabel>
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
                <FormLabel>Chit Group ID</FormLabel>
                <Input readOnly value={selectedGroup?.id || ""} placeholder="Auto-filled" />
              </FormItem>
            </div>

            <FormField
              control={form.control}
              name="auctionNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Auction Number</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                    value={field.value?.toString()}
                    disabled={!selectedGroup || !selectedGroup.tenure || loadingPreviousWinnersAndCount}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          loadingPreviousWinnersAndCount ? "Loading auction status..." :
                          (!selectedGroup || !selectedGroup.tenure ? "Select group or group has no tenure" : "Select auction number")}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {!loadingPreviousWinnersAndCount && auctionNumberOptions.map((num) => {
                            const isCompleted = completedAuctionNumbers.includes(num);
                            return (
                            <SelectItem
                                key={num}
                                value={num.toString()}
                                disabled={isCompleted}
                            >
                                Auction #{num} {isCompleted ? '(Completed)' : ''}
                            </SelectItem>
                            );
                        })}
                        {loadingPreviousWinnersAndCount && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />


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
                control={control}
                name="auctionTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Auction Time</FormLabel>
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

            <FormField
              control={form.control}
              name="auctionMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Auction Mode</FormLabel>
                   <Select onValueChange={field.onChange} value={field.value || "Manual"} >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select auction mode" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Manual">Manual</SelectItem>
                      <SelectItem value="Online">Online</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!selectedGroup || loadingMembers || loadingPreviousWinnersAndCount}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          loadingMembers || loadingPreviousWinnersAndCount ? "Loading members..." :
                          (selectedGroup ? "Select winner" : "Select group first")}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {groupMembers.map((member) => {
                        const hasWon = previousWinnerIds.includes(member.id);
                        return (
                          <SelectItem
                            key={member.id}
                            value={member.id}
                            disabled={hasWon}
                          >
                            {member.fullname} (@{member.username}) {hasWon ? '(Already Won)' : ''}
                          </SelectItem>
                        );
                      })}
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
                        <FormControl>
                          <Input
                            type="text" // Changed to text for controlled parsing
                            placeholder="e.g., 70000"
                            value={field.value === undefined ? "" : String(field.value)}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === "") {
                                  field.onChange(undefined);
                                } else {
                                  const num = parseInt(val, 10);
                                  field.onChange(isNaN(num) ? undefined : num);
                                }
                            }}
                          />
                        </FormControl>
                    </div>
                    {maxWinningBidAllowed !== null && (
                      <FormDescription>
                        Maximum allowed bid: {formatCurrency(maxWinningBidAllowed)}
                      </FormDescription>
                    )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isSubmitting || loadingGroups || loadingMembers || loadingPreviousWinnersAndCount}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Record Auction
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

    