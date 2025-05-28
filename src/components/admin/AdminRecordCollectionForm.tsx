
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIconLucide, Loader2, DollarSign, Save, LocateFixed } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { db, storage } from "@/lib/firebase";
import { ref as storageRefFB, uploadBytes, getDownloadURL } from "firebase/storage"; 
import { collection, addDoc, getDocs, query, where, serverTimestamp, Timestamp, runTransaction, doc, orderBy, getDoc } from "firebase/firestore";
import type { Group, User, Admin, CollectionRecord, AuctionRecord } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import jsPDF from 'jspdf';

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

const formatCurrencyLocal = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
  return `Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDateLocal = (dateString: string | undefined | null, outputFormat: string = "dd MMM yyyy") => {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString.replace(/-/g, '/'));
    if (isNaN(date.getTime())) {
        const isoDate = new Date(dateString);
        if (isNaN(isoDate.getTime())) return "N/A";
        return format(isoDate, outputFormat);
    }
    return format(date, outputFormat);
  } catch (e) {
    console.error("Error formatting date in formatDateLocal:", e, "input:", dateString);
    return "N/A";
  }
};

const NO_AUCTION_SELECTED_VALUE = "no-auction-specific-collection";

const recordCollectionFormSchema = z.object({
  selectedGroupId: z.string().min(1, "Please select a Group."),
  selectedAuctionId: z.string().min(1, "Auction number is required."),
  selectedUserId: z.string().min(1, "Please select a User."),
  paymentDate: z.date({ required_error: "Payment date is required." }),
  paymentTime: z.string().min(1, "Payment time is required."),
  paymentType: z.enum(["Full Payment", "Partial Payment"], { required_error: "Payment type is required." }),
  paymentMode: z.enum(["Cash", "UPI", "Netbanking"], { required_error: "Payment mode is required." }),
  amount: z.coerce.number().int("Amount must be a whole number.").positive("Amount must be a positive number."),
  collectionLocationOption: z.enum(["User Location"], { required_error: "Collection location must be User Location."}),
  remarks: z.string().optional(),
});

type RecordCollectionFormValues = z.infer<typeof recordCollectionFormSchema>;

const generate7DigitRandomNumber = () => {
  return Math.floor(1000000 + Math.random() * 9000000).toString();
};

async function generateUniqueReceiptNumber(maxRetries = 5): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const receiptNumber = generate7DigitRandomNumber();
    const q = query(collection(db, "collectionRecords"), where("receiptNumber", "==", receiptNumber));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return receiptNumber;
    }
    console.warn(`[Admin Collection Form] Receipt number ${receiptNumber} already exists, retrying...`);
  }
  throw new Error("Failed to generate a unique receipt number after several retries.");
}

async function generateReceiptPdfBlob(recordData: Partial<CollectionRecord>): Promise<Blob | null> {
  console.log("[PDF Generation] Admin: Generating blob with data:", recordData);
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [72, 'auto'] 
    });
    let y = 10;
    const lineHeight = 5; 
    const margin = 3; 
    const pageWidth = doc.internal.pageSize.width;
    if (!pageWidth || pageWidth <= 0) {
        console.error("[PDF Generation] Invalid page width:", pageWidth);
        return null; 
    }
    const centerX = pageWidth / 2;

    doc.setFont('Helvetica-Bold'); 
    doc.setFontSize(12); 
    doc.text(String(recordData.companyName || "Sendhur Chits"), Number(centerX), Number(y), { align: 'center' }); y += lineHeight * 1.5;
    
    doc.setFont('Helvetica');  
    doc.setFontSize(10); 
    doc.text(`Receipt No: ${recordData.receiptNumber || 'N/A'}`, Number(centerX), Number(y), { align: 'center' }); y += lineHeight;
    doc.text(`Date: ${formatDateLocal(recordData.paymentDate, "dd-MMM-yyyy")} ${recordData.paymentTime || ''}`, Number(centerX), Number(y), { align: 'center' }); y += lineHeight;
    
    doc.setLineDashPattern([1, 1], 0); 
    doc.line(Number(margin), Number(y), Number(pageWidth - margin), Number(y)); y += lineHeight * 0.5; 
    doc.setLineDashPattern([], 0); 
    
    y += lineHeight * 0.5;
    
    const wrapText = (text: string, x: number, yPos: number, maxWidth: number, lHeight: number): number => {
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, Number(x), Number(yPos));
        return yPos + (lines.length * lHeight);
    };

    const printLine = (label: string, value: string | number | null | undefined, yPos: number, isBoldValue: boolean = false): number => {
        doc.setFont('Helvetica-Bold'); 
        doc.setFontSize(10);
        doc.text(label, Number(margin), Number(yPos));
        const labelWidth = doc.getTextWidth(label);
        
        doc.setFont(isBoldValue ? 'Helvetica-Bold' : 'Helvetica'); 
        doc.setFontSize(10);
        return wrapText(String(value || 'N/A'), Number(margin + labelWidth + 2), Number(yPos), Number(66 - labelWidth - 2), Number(lineHeight));
    };
    
    y = printLine("Group:", recordData.groupName || 'N/A', y);
    y = printLine("Name:", recordData.userFullname || 'N/A', y);
    y = printLine("Chit Scheme Value:", recordData.groupTotalAmount ? formatCurrencyLocal(recordData.groupTotalAmount) : 'N/A', y);
    y = printLine("Chit Date:", recordData.auctionDateForReceipt ? formatDateLocal(recordData.auctionDateForReceipt, "dd-MMM-yyyy") : formatDateLocal(recordData.paymentDate, "dd-MMM-yyyy"), y);

    if (recordData.dueNumber) {
        y = printLine("Due No.:", recordData.dueNumber, y);
    }
    if (recordData.chitAmount !== null && recordData.chitAmount !== undefined) {
        y = printLine("Due Amount (This Inst.):", formatCurrencyLocal(recordData.chitAmount), y);
    }
     if (recordData.totalPaidForThisDue !== null && recordData.totalPaidForThisDue !== undefined) {
        y = printLine("Paid Amount (This Inst.):", formatCurrencyLocal(recordData.totalPaidForThisDue), y);
    }
    y = printLine("Bill Amount (This Txn.):", formatCurrencyLocal(recordData.amount), y, true); 
    
    if (recordData.balanceForThisInstallment !== null && recordData.balanceForThisInstallment !== undefined) {
        y = printLine("Balance (This Inst.):", formatCurrencyLocal(recordData.balanceForThisInstallment), y);
    }
    if (recordData.userTotalDueBeforeThisPayment !== null && recordData.userTotalDueBeforeThisPayment !== undefined) {
        y = printLine("User Total Balance (Overall):", formatCurrencyLocal(recordData.userTotalDueBeforeThisPayment), y);
    }
    y = printLine("Mode:", recordData.paymentMode || 'N/A', y);
    
    doc.setLineDashPattern([1, 1], 0);
    doc.line(Number(margin), Number(y), Number(pageWidth - margin), Number(y)); y += lineHeight * 0.5;
    doc.setLineDashPattern([], 0);
    
    y += lineHeight;
    doc.setFont('Helvetica'); 
    doc.setFontSize(10);
    doc.text("Thank You!", Number(centerX), Number(y), { align: 'center' });
    
    return doc.output('blob');
  } catch (pdfError) {
    console.error("[PDF Generation] Admin: Error generating PDF blob:", pdfError);
    return null;
  }
}

async function generateAndUploadReceiptPdf(
  recordData: Partial<CollectionRecord>,
  groupId: string,
  receiptNumber: string
): Promise<string | null> {
  console.log("[PDF Upload] Admin: Starting PDF generation for receipt:", receiptNumber, "Group ID:", groupId);
  if (!receiptNumber || !groupId) {
    console.error("[PDF Upload] Admin: Critical: Missing groupId or receiptNumber for PDF upload path. Aborting PDF generation.");
    return null;
  }
  try {
    const pdfBlob = await generateReceiptPdfBlob(recordData);
    if (!pdfBlob) {
      console.error("[PDF Upload] Admin: PDF Blob generation failed for receipt:", receiptNumber);
      return null;
    }
    console.log("[PDF Upload] Admin: PDF Blob generated, size:", pdfBlob.size);
    const pdfFileName = `receipt_${receiptNumber}_admin_${Date.now()}.pdf`;
    const pdfStoragePath = `collection_receipts/${groupId}/${pdfFileName}`;
    console.log("[PDF Upload] Admin: Attempting to upload to storage path:", pdfStoragePath);
    const pdfRef = storageRefFB(storage, pdfStoragePath);
    await uploadBytes(pdfRef, pdfBlob);
    console.log("[PDF Upload] Admin: PDF uploaded to storage.");
    const downloadURL = await getDownloadURL(pdfRef);
    console.log("[PDF Upload] Admin: PDF Download URL:", downloadURL);
    return downloadURL;
  } catch (error: any) {
    console.error("[PDF Upload] Admin: Error in generateAndUploadReceiptPdf:", error);
    if (error.code) console.error("[PDF Upload] Admin: Firebase Storage Error Code:", error.code);
    if (error.message) console.error("[PDF Upload] Admin: Firebase Storage Error Message:", error.message);
    return null;
  }
}

export function AdminRecordCollectionForm() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loggedInEntity } = useAuth(); 
  const admin = loggedInEntity as Admin | null;

  const preselectedUserIdFromQuery = searchParams.get("userId");
  const preselectedUserFullnameFromQuery = searchParams.get("fullname");
  const preselectedUserUsernameFromQuery = searchParams.get("username");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  
  const [selectedGroupObject, setSelectedGroupObject] = useState<Group | null>(null);
  const [groupAuctions, setGroupAuctions] = useState<AuctionRecord[]>([]);
  const [loadingAuctions, setLoadingAuctions] = useState(false);
  const [groupMembers, setGroupMembers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [currentLocationDisplay, setCurrentLocationDisplay] = useState<string | null>(null);
  const [currentLocationValue, setCurrentLocationValue] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  const form = useForm<RecordCollectionFormValues>({
    resolver: zodResolver(recordCollectionFormSchema),
    defaultValues: {
      selectedGroupId: "",
      selectedAuctionId: "",
      selectedUserId: "",
      paymentDate: new Date(),
      paymentTime: formatTimeTo12Hour(format(new Date(), "HH:mm")),
      paymentType: undefined,
      paymentMode: undefined,
      amount: undefined,
      collectionLocationOption: "User Location", 
      remarks: "Auction Collection",
    },
  });

  const { watch, setValue, reset } = form;
  const watchedGroupId = watch("selectedGroupId");
  const watchedCollectionLocationOption = watch("collectionLocationOption");

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
      setGroupMembers([]);
      setGroupAuctions([]);
      setValue("selectedUserId", "");
      setValue("selectedAuctionId", ""); 
      return;
    }

    const group = groups.find(g => g.id === watchedGroupId);
    setSelectedGroupObject(group || null);

    if (group) {
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
    }
  }, [watchedGroupId, groups, setValue, toast]);

   useEffect(() => {
    if (preselectedUserIdFromQuery && groupMembers.length > 0 && watchedGroupId) {
      const userExistsInGroup = groupMembers.some(member => member.id === preselectedUserIdFromQuery);
      if (userExistsInGroup) {
        setValue("selectedUserId", preselectedUserIdFromQuery, { shouldValidate: true });
      } else if (preselectedUserFullnameFromQuery && watchedGroupId) {
        toast({
          variant: "default",
          title: "User Not in Selected Group",
          description: `${preselectedUserFullnameFromQuery} (@${preselectedUserUsernameFromQuery || 'N/A'}) is not a member of the currently selected group. Please select a group they belong to, or a different user.`,
          duration: 7000,
        });
        setValue("selectedUserId", "");
      }
    } else if (!preselectedUserIdFromQuery && (!watchedGroupId || groupMembers.length === 0)) {
        setValue("selectedUserId", "");
    }
  }, [preselectedUserIdFromQuery, preselectedUserFullnameFromQuery, preselectedUserUsernameFromQuery, groupMembers, setValue, watchedGroupId, toast]);


  const handleFetchLocation = useCallback(() => {
    if (navigator.geolocation) {
      setIsFetchingLocation(true);
      setLocationError(null);
      setCurrentLocationDisplay(null);
      setCurrentLocationValue(null);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const gMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
          setCurrentLocationDisplay(`Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`);
          setCurrentLocationValue(gMapsUrl);
          setIsFetchingLocation(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          setLocationError(`Error: ${error.message}`);
          setIsFetchingLocation(false);
        }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser.");
    }
  },[]); 

  useEffect(() => {
    if (watchedCollectionLocationOption === "User Location") { 
      handleFetchLocation();
    } else {
      setCurrentLocationDisplay(null);
      setCurrentLocationValue(null);
      setLocationError(null);
    }
  }, [watchedCollectionLocationOption, handleFetchLocation]);


  async function onSubmit(values: RecordCollectionFormValues) {
    if (!admin) {
      toast({ title: "Error", description: "Admin details not found. Please re-login.", variant: "destructive" });
      return;
    }
    if (values.collectionLocationOption === "User Location" && !currentLocationValue) {
        toast({ title: "Location Required", description: "Please fetch user's location.", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);
    console.log("[Admin Collection Form] onSubmit - values:", values);
    const selectedGroup = groups.find(g => g.id === values.selectedGroupId);
    const selectedUser = groupMembers.find(m => m.id === values.selectedUserId);

    if (!selectedGroup || !selectedUser) {
      toast({ title: "Error", description: "Group or User details not found.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    
    const selectedAuction = groupAuctions.find(a => a.id === values.selectedAuctionId);
    if (!selectedAuction) { 
      toast({ title: "Error", description: "Selected auction not found or is invalid.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    
    let newReceiptNumber = "";
    let receiptPdfDownloadUrl: string | null = null;
    let newCollectionRecordId = "";
    let userDueBeforePayment: number | null = null;
    let totalPaidForThisSpecificDue: number | null = null;
    let balanceForThisSpecificInstallment: number | null = null;


    try {
        console.log("Attempting to generate unique receipt number...");
        newReceiptNumber = await generateUniqueReceiptNumber();
        if (!newReceiptNumber) throw new Error("Failed to generate unique receipt number.");
        console.log("Generated Receipt Number:", newReceiptNumber);

        console.log("Selected Auction for Chit/Due Amount:", selectedAuction);

        let chitAmountForDue: number | null = null;
        let dueNumberForRecord: number | null = null;
        
        if (selectedAuction && selectedAuction.finalAmountToBePaid !== null && selectedAuction.finalAmountToBePaid !== undefined) {
            chitAmountForDue = selectedAuction.finalAmountToBePaid;
            dueNumberForRecord = selectedAuction.auctionNumber || null;
        } else if (selectedGroup && selectedGroup.rate !== null && selectedGroup.rate !== undefined) {
            chitAmountForDue = selectedGroup.rate; 
        }
        console.log("Calculated chitAmountForDue:", chitAmountForDue, "dueNumberForRecord:", dueNumberForRecord);

        let balanceAmountAfterPayment: number | null = null;
        if (chitAmountForDue !== null && typeof values.amount === 'number') {
            balanceAmountAfterPayment = chitAmountForDue - values.amount;
        }
        console.log("Calculated balanceAmountAfterPayment:", balanceAmountAfterPayment);

        const collectionLocationToStore = currentLocationValue; 
        const virtualId = generate7DigitRandomNumber();

        const userDocRefForDueRead = doc(db, "users", selectedUser.id);
        const userDocSnapshot = await getDoc(userDocRefForDueRead);
        if (userDocSnapshot.exists()) {
          userDueBeforePayment = userDocSnapshot.data()?.dueAmount || 0;
        } else {
          console.error("User document not found for due amount read, user ID:", selectedUser.id);
          throw new Error("User document not found when trying to read current due amount.");
        }
        console.log("Fetched userTotalDueBeforeThisPayment:", userDueBeforePayment);
        
        if (selectedUser.id && selectedGroup.id && dueNumberForRecord !== null) {
            const collectionsForDueQuery = query(
            collection(db, "collectionRecords"),
            where("userId", "==", selectedUser.id),
            where("groupId", "==", selectedGroup.id),
            where("auctionNumber", "==", dueNumberForRecord)
            );
            const collectionsForDueSnapshot = await getDocs(collectionsForDueQuery);
            let sumPaidForDueAlready = 0;
            collectionsForDueSnapshot.forEach(snap => {
            sumPaidForDueAlready += (snap.data() as CollectionRecord).amount || 0;
            });
            totalPaidForThisSpecificDue = sumPaidForDueAlready + values.amount; 
            if(chitAmountForDue !== null) {
              balanceForThisSpecificInstallment = chitAmountForDue - totalPaidForThisSpecificDue;
            }
        } else if (chitAmountForDue !== null) {
            totalPaidForThisSpecificDue = values.amount;
            balanceForThisSpecificInstallment = chitAmountForDue - values.amount;
        }

        const tempRecordDataForPdf: Partial<CollectionRecord> = {
            companyName: "Sendhur Chits",
            receiptNumber: newReceiptNumber,
            paymentDate: format(values.paymentDate, "yyyy-MM-dd"),
            paymentTime: values.paymentTime,
            groupId: selectedGroup.id,
            groupName: selectedGroup.groupName,
            groupTotalAmount: selectedGroup.totalAmount,
            auctionDateForReceipt: selectedAuction ? selectedAuction.auctionDate : null,
            userId: selectedUser.id,
            userFullname: selectedUser.fullname,
            userUsername: selectedUser.username,
            dueNumber: dueNumberForRecord,
            chitAmount: chitAmountForDue,
            amount: values.amount,
            userTotalDueBeforeThisPayment: userDueBeforePayment,
            balanceAmount: balanceAmountAfterPayment, 
            totalPaidForThisDue: totalPaidForThisSpecificDue, 
            balanceForThisInstallment: balanceForThisSpecificInstallment, 
            paymentMode: values.paymentMode,
            remarks: values.remarks || "Auction Collection",
            virtualTransactionId: virtualId,
        };
        console.log("[Admin Collection Form] Data prepared for PDF generation (tempRecordDataForPdf):", tempRecordDataForPdf);
        
        receiptPdfDownloadUrl = await generateAndUploadReceiptPdf(
            tempRecordDataForPdf,
            selectedGroup.id,
            newReceiptNumber
        );
        console.log("[Admin Collection Form] Receipt PDF Download URL from helper:", receiptPdfDownloadUrl);

        const finalCollectionRecordData: Omit<CollectionRecord, "id" | "recordedAt"> & { recordedAt?: any } = {
            receiptNumber: newReceiptNumber,
            companyName: "Sendhur Chits",
            groupId: selectedGroup.id,
            groupName: selectedGroup.groupName,
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
            chitAmount: chitAmountForDue,
            dueNumber: dueNumberForRecord,
            userTotalDueBeforeThisPayment: userDueBeforePayment,
            balanceAmount: balanceAmountAfterPayment,
            totalPaidForThisDue: totalPaidForThisSpecificDue,
            balanceForThisInstallment: balanceForThisSpecificInstallment,
            remarks: values.remarks || "Auction Collection",
            collectionLocation: collectionLocationToStore,
            recordedByEmployeeId: admin.id, 
            recordedByEmployeeName: `Admin: ${admin.fullname}`, 
            virtualTransactionId: virtualId,
            receiptPdfUrl: receiptPdfDownloadUrl,
        };
        console.log("[Admin Collection Form] Final data being saved to Firestore (finalCollectionRecordData):", finalCollectionRecordData);

        await runTransaction(db, async (transaction) => {
            const userDocRef = doc(db, "users", selectedUser.id);
            const currentDueAmount = userDueBeforePayment !== null ? userDueBeforePayment : (userDocSnapshot.data()?.dueAmount || 0);
            const newDueAmount = currentDueAmount - values.amount;
            transaction.update(userDocRef, { dueAmount: newDueAmount });
            console.log(`[Admin Collection Form] Updated user ${selectedUser.username} due amount from ${currentDueAmount} to ${newDueAmount}`);

            const collectionRecordRef = doc(collection(db, "collectionRecords")); 
            newCollectionRecordId = collectionRecordRef.id; 
            transaction.set(collectionRecordRef, {
                ...finalCollectionRecordData,
                recordedAt: serverTimestamp() as Timestamp,
            });
            console.log("[Admin Collection Form] Collection record set in transaction, newCollectionRecordId:", newCollectionRecordId);
        });
        
        if (!newCollectionRecordId) {
            console.error("[Admin Collection Form] Failed to obtain new collection record ID for redirection.");
            throw new Error("Failed to obtain new collection record ID for redirection.");
        }

        toast({ title: "Collection Recorded", description: `Payment from ${selectedUser.fullname} recorded. ${receiptPdfDownloadUrl ? 'Receipt PDF generated.' : 'Receipt PDF generation failed.'}` });
        
        router.push(`/admin/collection/receipt/${newCollectionRecordId}`);
    } catch (error) {
      console.error("[Admin Collection Form] Error recording collection in onSubmit:", error);
      toast({ title: "Error", description: "Could not record collection. " + (error as Error).message, variant: "destructive" });
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
                  <FormLabel>Auction Number</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value} 
                    disabled={!watchedGroupId || loadingAuctions}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={!watchedGroupId ? "Select group first" : (loadingAuctions ? "Loading auctions..." : "Select an auction")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {groupAuctions.map((auction) => (
                        <SelectItem key={auction.id} value={auction.id}>
                          Auction #{auction.auctionNumber} - {auction.auctionMonth} (Due: {formatCurrencyLocal(auction.finalAmountToBePaid)})
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
                        <SelectValue 
                          placeholder={
                            preselectedUserFullnameFromQuery && preselectedUserUsernameFromQuery ? 
                            `${preselectedUserFullnameFromQuery} (@${preselectedUserUsernameFromQuery})` :
                            (!watchedGroupId ? "Select group first" : (loadingMembers ? "Loading members..." : "Select a user"))
                          } 
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {groupMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.fullname} (@{member.username}) - Due: {formatCurrencyLocal(member.dueAmount)}
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
                    <FormLabel>Collection Date</FormLabel>
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
                    <FormLabel>Collection Time</FormLabel>
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
                  <FormLabel>Amount Collected (₹)</FormLabel>
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
              name="collectionLocationOption"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Collection Location</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue="User Location">
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select collection location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="User Location">User Location</SelectItem>
                    </SelectContent>
                  </Select>
                  {watchedCollectionLocationOption === "User Location" && (
                    <div className="mt-2 space-y-2">
                      <Button type="button" variant="outline" onClick={handleFetchLocation} disabled={isFetchingLocation}>
                        {isFetchingLocation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <LocateFixed className="mr-2 h-4 w-4" /> Fetch User Location
                      </Button>
                      {currentLocationDisplay && <p className="text-sm text-muted-foreground">Fetched: {currentLocationDisplay}</p>}
                      {locationError && <Alert variant="destructive"><AlertTitle>Location Error</AlertTitle><AlertDescription>{locationError}</AlertDescription></Alert>}
                    </div>
                  )}
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
                  <Select onValueChange={field.onChange} value={field.value || "Auction Collection"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select remark type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Auction Collection">Auction Collection</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting || isFetchingLocation}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Record Collection
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
