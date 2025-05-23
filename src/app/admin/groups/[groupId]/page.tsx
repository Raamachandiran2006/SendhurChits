
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Group, User, AuctionRecord, CollectionRecord, PaymentRecord as AdminPaymentRecordType } from "@/types"; // Assuming PaymentRecord is for admin payments
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, deleteDoc, writeBatch, arrayRemove, updateDoc, orderBy, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { 
  Loader2, 
  ArrowLeft, 
  Users as UsersIconLucide, 
  User as UserIcon, 
  Info, 
  AlertTriangle, 
  Phone, 
  Mail, 
  CalendarDays, 
  Landmark, 
  Clock, 
  Tag, 
  LandmarkIcon as GroupLandmarkIcon, 
  SearchCode,
  Trash2,
  Megaphone, 
  CalendarClock,
  Edit3,
  Save,
  XCircle,
  PlayCircle,
  History,
  DollarSign,
  ReceiptText
} from "lucide-react";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// Helper function to format date safely
const formatDateSafe = (dateInput: string | Date | Timestamp | undefined | null, outputFormat: string = "dd MMM yyyy") => {
  if (!dateInput) return "N/A";
  try {
    let date: Date;
    if (dateInput instanceof Timestamp) {
      date = dateInput.toDate();
    } else if (typeof dateInput === 'string') {
      const parsedDate = new Date(dateInput.replace(/-/g, '/'));
      if (isNaN(parsedDate.getTime())) {
        const isoParsed = parseISO(dateInput);
        if(isNaN(isoParsed.getTime())) return "N/A";
        date = isoParsed;
      } else {
        date = parsedDate;
      }
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      return "N/A";
    }
    
    if (isNaN(date.getTime())) return "N/A";
    return format(date, outputFormat);
  } catch (e) {
    console.error("Error formatting date:", dateInput, e);
    return "N/A";
  }
};

const parseDateTimeForSort = (dateStr?: string, timeStr?: string, recordTimestamp?: Timestamp): Date => {
  if (recordTimestamp) return recordTimestamp.toDate();
  
  let baseDate: Date;
  if (dateStr) {
    const d = new Date(dateStr.replace(/-/g, '/')); 
    if (isNaN(d.getTime())) { 
        const isoD = parseISO(dateStr);
        if(isNaN(isoD.getTime())) return new Date(0); 
        baseDate = isoD;
    } else {
        baseDate = d;
    }
  } else {
    baseDate = new Date(); 
  }

  if (isNaN(baseDate.getTime())) return new Date(0); 

  if (timeStr) {
    const timePartsMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (timePartsMatch) {
      let hours = parseInt(timePartsMatch[1], 10);
      const minutes = parseInt(timePartsMatch[2], 10);
      const period = timePartsMatch[3]?.toUpperCase();

      if (period === "PM" && hours < 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;

      baseDate.setHours(hours, minutes, 0, 0);
      return baseDate;
    }
    const time24hMatch = timeStr.match(/^(\d{2}):(\d{2})$/);
    if (time24hMatch) {
        const hours = parseInt(time24hMatch[1], 10);
        const minutes = parseInt(time24hMatch[2], 10);
        baseDate.setHours(hours, minutes, 0, 0);
        return baseDate;
    }
  }
  baseDate.setHours(0,0,0,0); 
  return baseDate;
};


const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
  return `₹${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};


const getBiddingTypeLabel = (type: string | undefined) => {
  if (!type) return "N/A";
  switch (type) {
    case "auction": return "Auction Based";
    case "random": return "Random Draw";
    case "pre-fixed": return "Pre-fixed";
    default: return type; 
  }
};

const auctionDetailsFormSchema = z.object({
  auctionMonth: z.string().optional().or(z.literal('')),
  auctionScheduledDate: z.string().optional().or(z.literal('')),
  auctionScheduledTime: z.string().optional().or(z.literal('')),
  lastAuctionWinner: z.string().optional().or(z.literal('')),
});

type AuctionDetailsFormValues = z.infer<typeof auctionDetailsFormSchema>;

const convert24hTo12hFormat = (time24?: string): string => {
  if (!time24 || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(time24)) {
    return time24 || ""; 
  }
  const [hoursStr, minutesStr] = time24.split(':');
  let hours = parseInt(hoursStr, 10);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; 
  const hours12Str = String(hours).padStart(2, '0');
  return `${hours12Str}:${minutesStr} ${ampm}`;
};

const convert12hTo24hFormat = (time12?: string): string => {
  if (!time12 || time12.trim() === "") return "";

  if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(time12)) {
    return time12;
  }

  const lowerTime12 = time12.toLowerCase();
  const match = lowerTime12.match(/(\d{1,2}):(\d{2})\s*(am|pm)/);

  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3];

    if (hours === 12) { 
      hours = (period === 'am') ? 0 : 12;
    } else if (period === 'pm') {
      hours += 12;
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  return ""; 
};

interface CombinedPaymentHistoryTransaction {
  id: string;
  type: "Sent" | "Received"; // "Sent" by company, "Received" by company
  dateTime: Date;
  fromParty: string;
  toParty: string;
  amount: number;
  mode: string | null;
  remarks: string | null;
  originalSource: "Collection Record" | "Payment Record";
}


export default function AdminGroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const groupId = params.groupId as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [membersDetails, setMembersDetails] = useState<User[]>([]);
  const [auctionHistory, setAuctionHistory] = useState<AuctionRecord[]>([]);
  const [combinedPaymentHistory, setCombinedPaymentHistory] = useState<CombinedPaymentHistoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isEditingAuctionDetails, setIsEditingAuctionDetails] = useState(false);
  const [isSavingAuctionDetails, setIsSavingAuctionDetails] = useState(false);
  const [loadingAuctionHistory, setLoadingAuctionHistory] = useState(true);
  const [loadingPaymentHistory, setLoadingPaymentHistory] = useState(true);


  const auctionForm = useForm<AuctionDetailsFormValues>({
    resolver: zodResolver(auctionDetailsFormSchema),
    defaultValues: {
      auctionMonth: "",
      auctionScheduledDate: "",
      auctionScheduledTime: "",
      lastAuctionWinner: "",
    },
  });

  const fetchGroupData = useCallback(async () => {
    if (!groupId) {
      setError("Group ID is missing.");
      setLoading(false); setLoadingAuctionHistory(false); setLoadingPaymentHistory(false);
      return;
    }
    setLoading(true); setLoadingAuctionHistory(true); setLoadingPaymentHistory(true); setError(null);
    try {
      const groupDocRef = doc(db, "groups", groupId);
      const groupDocSnap = await getDoc(groupDocRef);

      if (!groupDocSnap.exists()) {
        setError("Group not found.");
        setLoading(false); setLoadingAuctionHistory(false); setLoadingPaymentHistory(false);
        return;
      }
      const groupData = { id: groupDocSnap.id, ...groupDocSnap.data() } as Group;
      setGroup(groupData);
      auctionForm.reset({
        auctionMonth: groupData.auctionMonth || "",
        auctionScheduledDate: groupData.auctionScheduledDate || "",
        auctionScheduledTime: groupData.auctionScheduledTime || "", 
        lastAuctionWinner: groupData.lastAuctionWinner || "",
      });

      if (groupData.members && groupData.members.length > 0) {
        const memberUsernames = groupData.members;
        const fetchedMembers: User[] = [];
        const batchSize = 30; 
        for (let i = 0; i < memberUsernames.length; i += batchSize) {
          const batchUsernames = memberUsernames.slice(i, i + batchSize);
          if (batchUsernames.length > 0) {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("username", "in", batchUsernames));
            const querySnapshot = await getDocs(q);
            querySnapshot.docs.forEach(docSnap => {
              fetchedMembers.push({ id: docSnap.id, ...docSnap.data() } as User);
            });
          }
        }
        setMembersDetails(fetchedMembers);
      } else {
        setMembersDetails([]);
      }

      const auctionRecordsRef = collection(db, "auctionRecords");
      const qAuction = query(auctionRecordsRef, where("groupId", "==", groupId), orderBy("auctionDate", "desc")); 
      const auctionSnapshot = await getDocs(qAuction);
      const fetchedAuctionHistory = auctionSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as AuctionRecord));
      setAuctionHistory(fetchedAuctionHistory);
      setLoadingAuctionHistory(false);
      
      // Fetch Collection Records (Received by Company for this group)
      const collectionRecordsRef = collection(db, "collectionRecords");
      const qCollection = query(collectionRecordsRef, where("groupId", "==", groupId), orderBy("recordedAt", "desc"));
      const collectionSnapshot = await getDocs(qCollection);
      const fetchedCollections = collectionSnapshot.docs.map(docSnap => {
        const data = docSnap.data() as CollectionRecord;
        return {
          id: docSnap.id,
          type: "Received" as const,
          dateTime: parseDateTimeForSort(data.paymentDate, data.paymentTime, data.recordedAt),
          fromParty: `User: ${data.userFullname} (${data.userUsername})`,
          toParty: "ChitConnect (Company)",
          amount: data.amount,
          mode: data.paymentMode,
          remarks: data.remarks || "User Collection",
          originalSource: "Collection Record" as const,
        } as CombinedPaymentHistoryTransaction;
      });

      // Fetch Payment Records (Sent by Company for this group)
      const paymentRecordsRef = collection(db, "paymentRecords");
      const qPayment = query(paymentRecordsRef, where("groupId", "==", groupId), orderBy("recordedAt", "desc"));
      const paymentSnapshot = await getDocs(qPayment);
      const fetchedPayments = paymentSnapshot.docs.map(docSnap => {
        const data = docSnap.data() as AdminPaymentRecordType; // Assuming CollectionRecord structure for now
        return {
          id: docSnap.id,
          type: "Sent" as const,
          dateTime: parseDateTimeForSort(data.paymentDate, data.paymentTime, data.recordedAt),
          fromParty: "ChitConnect (Company)",
          toParty: `User: ${data.userFullname} (${data.userUsername})`,
          amount: data.amount,
          mode: data.paymentMode,
          remarks: data.remarks || "Company Payment",
          originalSource: "Payment Record" as const,
        } as CombinedPaymentHistoryTransaction;
      });

      const combined = [...fetchedCollections, ...fetchedPayments].sort((a,b) => b.dateTime.getTime() - a.dateTime.getTime());
      setCombinedPaymentHistory(combined);
      setLoadingPaymentHistory(false);

    } catch (err) {
      console.error("Error fetching group details:", err);
      setError("Failed to fetch group details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [groupId, auctionForm]);

  useEffect(() => {
    fetchGroupData();
  }, [fetchGroupData]);

  const handleDeleteGroup = async () => {
    if (!group || deleteConfirmationText !== "delete") return;

    setIsDeleting(true);
    try {
      const groupDocRef = doc(db, "groups", groupId);
      
      const batchDB = writeBatch(db);
      const usersToUpdateQuery = query(collection(db, "users"), where("groups", "array-contains", groupId));
      const usersToUpdateSnapshot = await getDocs(usersToUpdateQuery);
      
      usersToUpdateSnapshot.forEach(userDoc => {
        batchDB.update(userDoc.ref, {
          groups: arrayRemove(groupId)
        });
      });
      
      await batchDB.commit();
      
      await deleteDoc(groupDocRef);

      toast({
        title: "Group Deleted",
        description: `Group "${group.groupName}" and its member associations have been successfully deleted.`,
      });
      router.push("/admin/groups");
    } catch (err) {
      console.error("Error deleting group:", err);
      toast({
        title: "Error Deleting Group",
        description: "Failed to delete the group. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmationText("");
    }
  };

  const onSaveAuctionDetails = async (values: AuctionDetailsFormValues) => {
    if (!group) return;
    setIsSavingAuctionDetails(true);
    try {
      const groupDocRef = doc(db, "groups", groupId);
      await updateDoc(groupDocRef, {
        auctionMonth: values.auctionMonth || "",
        auctionScheduledDate: values.auctionScheduledDate || "",
        auctionScheduledTime: values.auctionScheduledTime || "", 
        lastAuctionWinner: values.lastAuctionWinner || "",
      });
      
      setGroup(prevGroup => prevGroup ? { 
        ...prevGroup, 
        auctionMonth: values.auctionMonth || "",
        auctionScheduledDate: values.auctionScheduledDate || "",
        auctionScheduledTime: values.auctionScheduledTime || "",
        lastAuctionWinner: values.lastAuctionWinner || ""
      } : null); 
      toast({ title: "Auction Details Updated", description: "Successfully saved auction details." });
      setIsEditingAuctionDetails(false);
    } catch (error) {
      console.error("Error updating auction details:", error);
      toast({ title: "Error", description: "Could not update auction details. " + (error as Error).message, variant: "destructive" });
    } finally {
      setIsSavingAuctionDetails(false);
    }
  };

  const handleCancelEditAuctionDetails = () => {
    if (group) {
      auctionForm.reset({
        auctionMonth: group.auctionMonth || "",
        auctionScheduledDate: group.auctionScheduledDate || "",
        auctionScheduledTime: group.auctionScheduledTime || "",
        lastAuctionWinner: group.lastAuctionWinner || "",
      });
    }
    setIsEditingAuctionDetails(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">Loading group details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 text-center">
        <Card className="max-w-md mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center justify-center">
              <AlertTriangle className="mr-2 h-6 w-6" /> Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => router.push("/admin/groups")} className="mt-6">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Groups
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!group) {
    return <div className="container mx-auto py-8 text-center text-muted-foreground">Group data not available.</div>;
  }

  const AuctionDetailItem = ({ icon: Icon, label, value, isEditing, fieldName, register }: { icon: React.ElementType, label: string, value?: string, isEditing?: boolean, fieldName?: keyof AuctionDetailsFormValues, register?: any }) => (
    <div className="flex items-center p-3 bg-secondary/50 rounded-md">
      <Icon className="mr-3 h-5 w-5 text-muted-foreground flex-shrink-0" />
      <div className="flex-grow">
        <p className="font-semibold text-foreground">{label}</p>
        {isEditing && fieldName ? (
             <Input {...register(fieldName)} defaultValue={value || ""} className="text-sm h-8 mt-1 w-full" />
        ) : (
          <p className="text-muted-foreground text-sm">{value || "N/A"}</p>
        )}
      </div>
    </div>
  );


  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center mb-6">
        <Button variant="outline" onClick={() => router.push("/admin/groups")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Groups
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Delete Group
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the group
                <strong className="text-foreground"> {group.groupName} </strong> 
                and remove it from all associated users. Type "delete" to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input 
              type="text"
              placeholder='Type "delete" to confirm'
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              className="my-2"
            />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteConfirmationText("")}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteGroup}
                disabled={deleteConfirmationText !== "delete" || isDeleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <UsersIconLucide className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">{group.groupName}</CardTitle>
              <CardDescription>{group.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center">
            <UsersIconLucide className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Capacity: {group.totalPeople} members</span>
          </div>
          <div className="flex items-center">
            <Badge variant="secondary">Members: {group.members.length} / {group.totalPeople}</Badge>
          </div>
          <div className="flex items-center">
            <Landmark className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Total Amount: ₹{group.totalAmount.toLocaleString()}</span>
          </div>
          <div className="flex items-center">
            <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Tenure: {group.tenure ? `${group.tenure} months` : "N/A"}</span>
          </div>
          <div className="flex items-center">
            <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Start Date: {formatDateSafe(group.startDate)}</span>
          </div>
            <div className="flex items-center">
            <Info className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Group ID: {group.id}</span>
          </div>
          {group.rate !== undefined && (
            <div className="flex items-center">
              <GroupLandmarkIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Monthly Installment: ₹{group.rate.toLocaleString()}</span>
            </div>
          )}
          {group.commission !== undefined && (
            <div className="flex items-center">
              <Tag className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Commission: {group.commission}%</span>
            </div>
          )}
          {group.biddingType && (
            <div className="flex items-center">
              <SearchCode className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Bidding Type: {getBiddingTypeLabel(group.biddingType)}</span>
            </div>
          )}
          {group.minBid !== undefined && (
            <div className="flex items-center">
              <GroupLandmarkIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Min Bid Amount: ₹{group.minBid.toLocaleString()}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <UserIcon className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">Group Members</CardTitle>
              <CardDescription>Details of users in this group.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {membersDetails.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No members have been added to this group yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Full Name</TableHead><TableHead>Username</TableHead><TableHead>Phone Number</TableHead><TableHead className="text-right">Due Amount (₹)</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {membersDetails.map((member) => (
                    <TableRow key={member.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">{member.fullname}</TableCell><TableCell>{member.username}</TableCell><TableCell><div className="flex items-center"><Phone className="mr-2 h-3 w-3 text-muted-foreground" /> {member.phone || "N/A"}</div></TableCell><TableCell className="text-right">{formatCurrency(member.dueAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Separator />

      <Card className="shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <Megaphone className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl font-bold text-foreground">Group Auction Details</CardTitle>
          </div>
          {!isEditingAuctionDetails ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditingAuctionDetails(true)}>
              <Edit3 className="mr-2 h-4 w-4" /> Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancelEditAuctionDetails} disabled={isSavingAuctionDetails}>
                <XCircle className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button size="sm" onClick={auctionForm.handleSubmit(onSaveAuctionDetails)} disabled={isSavingAuctionDetails}>
                {isSavingAuctionDetails ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save
              </Button>
            </div>
          )}
        </CardHeader>
        <CardDescription className="px-6 pb-2">Information about auction events for this group.</CardDescription>
        <CardContent>
          {isEditingAuctionDetails ? (
            <Form {...auctionForm}>
              <form onSubmit={auctionForm.handleSubmit(onSaveAuctionDetails)} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <AuctionDetailItem icon={CalendarClock} label="Auction Month" value={group.auctionMonth} isEditing fieldName="auctionMonth" register={auctionForm.register} />
                
                <FormField control={auctionForm.control} name="auctionScheduledDate" render={({ field }) => (
                  <FormItem className="flex flex-col p-3 bg-secondary/50 rounded-md">
                    <div className="flex items-center">
                      <CalendarDays className="mr-3 h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <FormLabel className="font-semibold text-foreground">Scheduled Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn("w-full pl-3 text-left font-normal h-8 mt-1 text-sm", !field.value && "text-muted-foreground")}
                              >
                                {field.value ? formatDateSafe(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value.replace(/-/g, '/')) : undefined}
                              onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <FormMessage className="text-xs pl-[calc(0.75rem+1.25rem)]" />
                  </FormItem>
                )} />

                <FormField
                  control={auctionForm.control}
                  name="auctionScheduledTime" 
                  render={({ field }) => (
                    <FormItem className="flex flex-col p-3 bg-secondary/50 rounded-md">
                      <div className="flex items-center">
                        <Clock className="mr-3 h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <FormLabel className="font-semibold text-foreground">Scheduled Time</FormLabel>
                          <Input
                            type="time"
                            value={convert12hTo24hFormat(field.value)} 
                            onChange={(e) => {
                              field.onChange(convert24hTo12hFormat(e.target.value) || ""); 
                            }}
                            className="text-sm h-8 mt-1 w-full"
                          />
                        </div>
                      </div>
                      <FormMessage className="text-xs pl-[calc(0.75rem+1.25rem)]" />
                    </FormItem>
                  )}
                />

                <AuctionDetailItem icon={Info} label="Last Auction Winner" value={group.lastAuctionWinner} isEditing fieldName="lastAuctionWinner" register={auctionForm.register} />
              </form>
            </Form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <AuctionDetailItem icon={CalendarClock} label="Auction Month" value={group.auctionMonth} />
                 <div className="flex items-center p-3 bg-secondary/50 rounded-md">
                    <CalendarDays className="mr-3 h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-foreground">Scheduled Date</p>
                        <p className="text-muted-foreground text-sm">{formatDateSafe(group.auctionScheduledDate, "PPP") || "N/A"}</p>
                    </div>
                </div>
                <AuctionDetailItem icon={Clock} label="Scheduled Time" value={group.auctionScheduledTime} />
                <AuctionDetailItem icon={Info} label="Last Auction Winner" value={group.lastAuctionWinner} />
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card className="shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <History className="h-6 w-6 text-primary" /> 
            <CardTitle className="text-xl font-bold text-foreground">Auction History</CardTitle>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/auctions/start?groupId=${groupId}`}>
              <PlayCircle className="mr-2 h-4 w-4" /> Start Auction
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
           {loadingAuctionHistory ? (
             <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading auction history...</p>
             </div>
           ) : auctionHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No auction history found for this group.
            </p>
           ) : (
            <div className="space-y-4">
              {auctionHistory.map((auction, index) => (
                <Link key={auction.id} href={`/admin/auctions/records/${auction.id}`} className="block">
                  <Card className="bg-secondary/50 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3 pt-4">
                      <CardTitle className="text-md font-semibold text-primary">
                         Auction #{auction.auctionNumber ? auction.auctionNumber : (index + 1)}
                      </CardTitle>
                      <CardDescription>Group: {auction.groupName}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2 pb-4">
                        <div><strong className="text-foreground">Period:</strong> {auction.auctionMonth} - {formatDateSafe(auction.auctionDate, "PP")}</div>
                        {auction.auctionTime && <div><strong className="text-foreground">Time:</strong> {auction.auctionTime}</div>}
                        <div><strong className="text-foreground">Winner:</strong> {auction.winnerFullname} ({auction.winnerUsername})</div>
                        <div><strong className="text-foreground">Winning Bid:</strong> {formatCurrency(auction.winningBidAmount)}</div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
           )}
        </CardContent>
      </Card>

      <Separator />

      <Card className="shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <ReceiptText className="h-6 w-6 text-primary" /> 
            <CardTitle className="text-xl font-bold text-foreground">Payment History</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loadingPaymentHistory ? (
             <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading payment history...</p>
             </div>
          ) : combinedPaymentHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No payment history found for this group.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>S.No</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Date & Time</TableHead>
                            <TableHead>From</TableHead>
                            <TableHead>To</TableHead>
                            <TableHead className="text-right">Amount (₹)</TableHead>
                            <TableHead>Mode</TableHead>
                            <TableHead>Remarks</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {combinedPaymentHistory.map((payment, index) => (
                            <TableRow key={payment.id + payment.originalSource}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>
                                  <span className={cn(
                                    "font-semibold px-2 py-1 rounded-full text-xs",
                                    payment.type === "Sent" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" 
                                                          : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                  )}>
                                    {payment.type}
                                  </span>
                                </TableCell>
                                <TableCell>{formatDateSafe(payment.dateTime, "dd MMM yy, hh:mm a")}</TableCell>
                                <TableCell className="max-w-xs truncate">{payment.fromParty}</TableCell>
                                <TableCell className="max-w-xs truncate">{payment.toParty}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(payment.amount)}</TableCell>
                                <TableCell>{payment.mode || "N/A"}</TableCell>
                                <TableCell className="max-w-xs truncate">{payment.remarks || "N/A"}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
           )}
        </CardContent>
      </Card>

    </div>
  );
}


    