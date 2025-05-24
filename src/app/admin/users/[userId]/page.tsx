
"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { User, Group, CollectionRecord, PaymentRecord as AdminPaymentRecordType, AuctionRecord } from "@/types";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, documentId, getDocs, updateDoc, runTransaction, orderBy, Timestamp, limit } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import {
  Loader2,
  ArrowLeft,
  User as UserIconLucide,
  Info,
  AlertTriangle,
  Phone,
  Mail,
  CalendarDays,
  Home as HomeIcon,
  Users as GroupIcon,
  Briefcase,
  FileText,
  Shield,
  DollarSign,
  Edit3,
  Save,
  XCircle,
  Camera,
  RefreshCw,
  Image as ImageIconLucide,
  ReceiptText,
  Filter,
  Download,
  ChevronRight,
  ChevronDown,
  Landmark,
  ClockIcon,
  Sheet,
  Contact,
  ArchiveRestore
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, subYears, parseISO, subDays, isAfter, addDays } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Alert, AlertTitle, AlertDescription as AlertDescriptionUI } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


// Helper function to format date safely
const formatDateSafe = (dateInput: string | Date | Timestamp | undefined | null, outputFormat: string = "dd MMMM yyyy"): string => {
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

const formatDateTimeSafe = (dateInput: string | Date | Timestamp | undefined | null, outputFormat: string = "dd MMM yy, hh:mm a"): string => {
    return formatDateSafe(dateInput, outputFormat);
};

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
  return `₹${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"];

const optionalFileSchema = z.custom<File>((val) => val instanceof File, "File is required")
  .refine((file) => file.size <= MAX_FILE_SIZE_BYTES, `Max file size is ${MAX_FILE_SIZE_MB}MB.`)
  .refine((file) => ACCEPTED_DOCUMENT_TYPES.includes(file.type), "Only .pdf, .jpg, .jpeg, .png files.")
  .optional()
  .nullable();

const optionalImageFileSchema = z.custom<File>((val) => val instanceof File, "Image file is required")
  .refine((file) => file.size <= MAX_FILE_SIZE_BYTES, `Max file size is ${MAX_FILE_SIZE_MB}MB.`)
  .refine((file) => ACCEPTED_IMAGE_TYPES.includes(file.type), "Only .jpg, .jpeg, .png files.")
  .optional()
  .nullable();

const editUserFormSchema = z.object({
  fullname: z.string().min(3, "Full name must be at least 3 characters"),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
  dob: z.date({ required_error: "Date of birth is required." }),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal('')),
  address: z.string().min(10, "Address must be at least 10 characters"),
  referralSourceName: z.string().optional().or(z.literal('')),
  referralSourcePhone: z.string().regex(/^\d{10}$/, "Referral phone must be 10 digits").optional().or(z.literal('')),
  referralSourceAddress: z.string().optional().or(z.literal('')),
  aadhaarCard: optionalFileSchema,
  panCard: optionalFileSchema,
  recentPhotographFile: optionalImageFileSchema,
  recentPhotographWebcamDataUrl: z.string().optional().nullable(),
  isAdmin: z.boolean().default(false).optional(),
  dueAmount: z.coerce.number().optional().nullable(),
  dueType: z.enum(["Day", "Week", "Month"], {
    errorMap: () => ({ message: "Please select a valid due type." }),
  }).optional().nullable(),
});

type EditUserFormValues = z.infer<typeof editUserFormSchema>;

interface AdminUserTransaction {
  id: string;
  type: "Sent by User" | "Received by User";
  dateTime: Date;
  fromParty: string;
  toParty: string;
  amount: number;
  mode: string | null;
  remarksOrSource: string | null;
  originalSource: "CollectionRecord" | "PaymentRecord"; 
  virtualTransactionId?: string;
}

type TransactionFilterType = "all" | "last7Days" | "last10Days" | "last30Days";

interface DueSheetItem {
  dueNo: number; 
  groupId: string;
  groupName: string;
  auctionId: string;
  dueDate: string; 
  amount: number; // Principal amount due for the installment
  penalty: number; // Penalty charged for this installment
  paidAmount: number; // Amount paid towards the principal after clearing penalty
  balance: number; // Remaining balance on the principal (amount - paidAmount)
  status: 'Paid' | 'Not Paid' | 'Partially Paid';
  paidDateTime?: string; 
}


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

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const userId = params.userId as string;

  const [user, setUser] = useState<User | null>(null);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [rawUserTransactions, setRawUserTransactions] = useState<AdminUserTransaction[]>([]);
  const [filteredUserTransactions, setFilteredUserTransactions] = useState<AdminUserTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [selectedTransactionFilter, setSelectedTransactionFilter] = useState<TransactionFilterType>("all");
  const [expandedTransactionRows, setExpandedTransactionRows] = useState<Record<string, boolean>>({});
  
  const [dueSheetItems, setDueSheetItems] = useState<DueSheetItem[]>([]);
  const [loadingDueSheet, setLoadingDueSheet] = useState(true);
  const dueSheetRef = useRef<HTMLDivElement>(null);


  const [showCamera, setShowCamera] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: {},
  });

  const fetchUserDetailsAndTransactions = useCallback(async () => {
    if (!userId) {
      setError("User ID is missing or invalid.");
      setLoading(false);
      setLoadingTransactions(false);
      setLoadingDueSheet(false);
      return;
    }
    setLoading(true); setLoadingTransactions(true); setLoadingDueSheet(true);
    setError(null); setTransactionError(null);
    try {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        setError("User not found.");
        setUser(null);
        setLoading(false); setLoadingTransactions(false); setLoadingDueSheet(false);
        return;
      }
      const userData = { id: userDocSnap.id, ...userDocSnap.data() } as User;
      setUser(userData);
      form.reset({
        fullname: userData.fullname,
        phone: userData.phone,
        dob: userData.dob ? parseISO(userData.dob) : new Date(),
        password: '',
        address: userData.address,
        referralSourceName: userData.referralSourceName || "",
        referralSourcePhone: userData.referralSourcePhone || "",
        referralSourceAddress: userData.referralSourceAddress || "",
        isAdmin: userData.isAdmin || false,
        aadhaarCard: null,
        panCard: null,
        recentPhotographFile: null,
        recentPhotographWebcamDataUrl: null,
        dueAmount: userData.dueAmount ?? null,
        dueType: userData.dueType ?? undefined,
      });
      setCapturedImage(userData.photoUrl || null);

      // Fetch User Groups
      const fetchedGroups: Group[] = [];
      if (userData.groups && userData.groups.length > 0) {
        const groupsRef = collection(db, "groups");
        const groupIds = userData.groups.slice(0, 30); 
        if (groupIds.length > 0) {
          const groupQuery = query(groupsRef, where(documentId(), "in", groupIds));
          const groupSnapshots = await getDocs(groupQuery);
          for (const groupDoc of groupSnapshots.docs) {
            fetchedGroups.push({ id: groupDoc.id, ...groupDoc.data() } as Group);
          }
        }
      }
      setUserGroups(fetchedGroups);

      // Fetch Payment Transactions for the user
      let combinedTransactions: AdminUserTransaction[] = [];
      const collectionsRef = collection(db, "collectionRecords");
      const collectionsQuery = query(collectionsRef, where("userId", "==", userId), orderBy("recordedAt", "desc"));
      const collectionsSnapshot = await getDocs(collectionsQuery);
      collectionsSnapshot.forEach(docSnap => {
        const data = docSnap.data() as CollectionRecord;
        combinedTransactions.push({
          id: docSnap.id,
          type: "Sent by User",
          dateTime: parseDateTimeForSort(data.paymentDate, data.paymentTime, data.recordedAt),
          fromParty: `User: ${userData.fullname} (${userData.username})`,
          toParty: "ChitConnect (Company)",
          amount: data.amount,
          mode: data.paymentMode,
          remarksOrSource: data.remarks || `Payment for Group: ${data.groupName}`,
          originalSource: "CollectionRecord",
          virtualTransactionId: data.virtualTransactionId,
        });
      });

      const paymentsRef = collection(db, "paymentRecords"); 
      const paymentsQuery = query(paymentsRef, where("userId", "==", userId), orderBy("recordedAt", "desc"));
      const paymentsSnapshot = await getDocs(paymentsQuery);
      paymentsSnapshot.forEach(docSnap => {
        const data = docSnap.data() as AdminPaymentRecordType; 
        combinedTransactions.push({
          id: docSnap.id,
          type: "Received by User",
          dateTime: parseDateTimeForSort(data.paymentDate, data.paymentTime, data.recordedAt),
          fromParty: "ChitConnect (Company)",
          toParty: `User: ${userData.fullname} (${userData.username})`,
          amount: data.amount,
          mode: data.paymentMode,
          remarksOrSource: data.remarks || `Payment for Group: ${data.groupName || 'N/A'}`,
          originalSource: "PaymentRecord",
          virtualTransactionId: data.virtualTransactionId,
        });
      });
      combinedTransactions.sort((a,b) => b.dateTime.getTime() - a.dateTime.getTime());
      setRawUserTransactions(combinedTransactions);
      setFilteredUserTransactions(combinedTransactions); 
      setLoadingTransactions(false);

      // Fetch and Process Due Sheet Items
      const processedDueSheetItems: DueSheetItem[] = [];
      if (fetchedGroups.length > 0) { 
        for (const group of fetchedGroups) {
          if (!group || !group.id) continue;
          const groupAuctionRecordsQuery = query(
            collection(db, "auctionRecords"),
            where("groupId", "==", group.id),
            orderBy("auctionNumber", "asc")
          );
          const groupAuctionRecordsSnapshot = await getDocs(groupAuctionRecordsQuery);

          for (const auctionDoc of groupAuctionRecordsSnapshot.docs) {
            const auctionRecord = { id: auctionDoc.id, ...auctionDoc.data() } as AuctionRecord;
            if (auctionRecord.auctionNumber === undefined || auctionRecord.finalAmountToBePaid === null || auctionRecord.finalAmountToBePaid === undefined) {
              continue;
            }
            
            const amountDueForInstallment = auctionRecord.finalAmountToBePaid;
            const penaltyChargedForInstallment = 0; // Placeholder: implement actual penalty fetching if needed

            let totalCollectedForThisDue = 0;
            let latestPaidDate: Date | null = null;

            const collectionForAuctionQuery = query(
              collection(db, "collectionRecords"),
              where("userId", "==", userId),
              where("groupId", "==", group.id),
              where("auctionNumber", "==", auctionRecord.auctionNumber)
            );
            const collectionsForAuctionSnapshot = await getDocs(collectionForAuctionQuery);
            
            const sortedCollections = collectionsForAuctionSnapshot.docs
              .map(doc => ({ ...doc.data(), id: doc.id } as CollectionRecord))
              .sort((a, b) => (a.recordedAt?.toDate()?.getTime() || 0) - (b.recordedAt?.toDate()?.getTime() || 0)); // Oldest first

            sortedCollections.forEach(colData => {
              totalCollectedForThisDue += colData.amount;
               const paymentDateTime = parseDateTimeForSort(colData.paymentDate, colData.paymentTime, colData.recordedAt);
               if (paymentDateTime) latestPaidDate = paymentDateTime; // Keep updating to get the latest payment date for this due
            });
            
            let paidTowardsPenalty = 0;
            let paidTowardsPrincipal = 0;
            let remainingCollectedAfterPenalty = totalCollectedForThisDue;

            if (penaltyChargedForInstallment > 0) {
              paidTowardsPenalty = Math.min(totalCollectedForThisDue, penaltyChargedForInstallment);
              remainingCollectedAfterPenalty = totalCollectedForThisDue - paidTowardsPenalty;
            }

            paidTowardsPrincipal = Math.min(remainingCollectedAfterPenalty, amountDueForInstallment);
            const balanceOnPrincipal = amountDueForInstallment - paidTowardsPrincipal;
            
            let status: DueSheetItem['status'] = 'Not Paid';
            if (balanceOnPrincipal <= 0 && amountDueForInstallment > 0) { 
              status = 'Paid';
            } else if (paidTowardsPrincipal > 0 && balanceOnPrincipal > 0) {
              status = 'Partially Paid';
            }
            
            processedDueSheetItems.push({
              dueNo: auctionRecord.auctionNumber,
              groupId: group.id,
              groupName: group.groupName,
              auctionId: auctionRecord.id,
              dueDate: formatDateSafe(addDays(parseISO(auctionRecord.auctionDate), 5), "dd MMM yyyy"),
              amount: amountDueForInstallment,
              penalty: penaltyChargedForInstallment,
              paidAmount: paidTowardsPrincipal, 
              balance: balanceOnPrincipal,
              status: status,
              paidDateTime: status === 'Paid' && latestPaidDate ? formatDateTimeSafe(latestPaidDate) : undefined,
            });
          }
        }
      }
      processedDueSheetItems.sort((a,b) => {
        const dateA = parseISO(a.dueDate.replace(/(\d{2}) (\w{3}) (\d{4})/, '$2 $1 $3')); // Reformat for parseISO if needed
        const dateB = parseISO(b.dueDate.replace(/(\d{2}) (\w{3}) (\d{4})/, '$2 $1 $3'));
        if (dateA.getTime() !== dateB.getTime()) {
            return dateA.getTime() - dateB.getTime();
        }
        return a.dueNo - b.dueNo;
      }); 
      setDueSheetItems(processedDueSheetItems);
      setLoadingDueSheet(false);


    } catch (err) {
      console.error("Error fetching user details/transactions/due sheet:", err);
      setError("Error loading user details. Please try again later.");
      setUser(null);
      setTransactionError("Failed to fetch payment history.");
      setLoadingDueSheet(false);
    } finally {
      setLoading(false);
    }
  }, [userId, form]);

  useEffect(() => {
    fetchUserDetailsAndTransactions();
  }, [fetchUserDetailsAndTransactions]);

  useEffect(() => {
    if (window.location.hash === "#due-sheet" && dueSheetRef.current && !loadingDueSheet) {
      dueSheetRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loadingDueSheet]); 

  useEffect(() => {
    const applyFilter = () => {
      if (selectedTransactionFilter === "all") {
        setFilteredUserTransactions(rawUserTransactions);
        return;
      }
      const now = new Date();
      let startDate: Date;
      if (selectedTransactionFilter === "last7Days") {
        startDate = subDays(now, 7);
      } else if (selectedTransactionFilter === "last10Days") {
        startDate = subDays(now, 10);
      } else if (selectedTransactionFilter === "last30Days") {
        startDate = subDays(now, 30);
      } else {
        setFilteredUserTransactions(rawUserTransactions); 
        return;
      }
      startDate.setHours(0, 0, 0, 0); 
      const filtered = rawUserTransactions.filter(tx => isAfter(tx.dateTime, startDate));
      setFilteredUserTransactions(filtered);
    };
    applyFilter();
  }, [selectedTransactionFilter, rawUserTransactions]);

  const requestCameraPermission = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasCameraPermission(false); 
      toast({ variant: 'destructive', title: 'Camera Not Supported', description: 'Your browser does not support camera access.' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasCameraPermission(true);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (error) {
      console.error("Error accessing camera:", error); 
      setHasCameraPermission(false);
      toast({ variant: 'destructive', title: 'Camera Access Denied', description: 'Please enable camera permissions in your browser settings.' });
    }
  }, [toast]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (showCamera && hasCameraPermission === null) {
      requestCameraPermission();
    }
    
    if (videoRef.current && videoRef.current.srcObject) {
        stream = videoRef.current.srcObject as MediaStream;
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (showCamera && videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null; 
      }
    };
  }, [showCamera, requestCameraPermission, hasCameraPermission]);

  const handleCapturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current; const canvas = canvasRef.current;
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        form.setValue("recentPhotographWebcamDataUrl", dataUrl, { shouldValidate: true });
        form.setValue("recentPhotographFile", null); 
        setShowCamera(false); 
        if (videoRef.current?.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null; 
            setHasCameraPermission(null); 
        }
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(user?.photoUrl || null); 
    form.setValue("recentPhotographWebcamDataUrl", null);
    setShowCamera(true); 
    setHasCameraPermission(null); 
  };

  const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) throw new Error('Invalid data URL');
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]); let n = bstr.length; const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  };

  const uploadFile = async (file: File, path: string): Promise<string> => {
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  };

  async function onSubmit(values: EditUserFormValues) {
    if (!user) return;
    setIsSubmitting(true);
    try {
      if (values.phone !== user.phone) {
        const phoneQuery = query(collection(db, "users"), where("phone", "==", values.phone));
        const phoneSnapshot = await getDocs(phoneQuery);
        if (!phoneSnapshot.empty) {
          const existingUser = phoneSnapshot.docs[0];
          if (existingUser.id !== userId) { 
            toast({ title: "Error", description: "Phone number already registered.", variant: "destructive" });
            setIsSubmitting(false);
            return;
          }
        }
      }
      const updatedUserData: Partial<User> & {password?: string} = {
        fullname: values.fullname,
        phone: values.phone,
        dob: format(values.dob, "yyyy-MM-dd"),
        address: values.address,
        referralSourceName: values.referralSourceName || "",
        referralSourcePhone: values.referralSourcePhone || "",
        referralSourceAddress: values.referralSourceAddress || "",
        isAdmin: values.isAdmin,
        dueAmount: values.dueAmount ?? undefined, 
        dueType: values.dueType ?? undefined, 
      };
      if (values.password && values.password.length >= 6) {
        updatedUserData.password = values.password; 
      }

      let oldPhotoUrl = user.photoUrl;

      if (values.recentPhotographFile) {
        if (oldPhotoUrl) { try { await deleteObject(storageRef(storage, oldPhotoUrl));} catch(e) {console.warn("Old photo delete failed", e);}}
        updatedUserData.photoUrl = await uploadFile(values.recentPhotographFile, `userFiles/${user.phone}/photo/${values.recentPhotographFile.name}`);
      } else if (values.recentPhotographWebcamDataUrl && values.recentPhotographWebcamDataUrl !== user.photoUrl) {
        if (oldPhotoUrl) { try { await deleteObject(storageRef(storage, oldPhotoUrl));} catch(e) {console.warn("Old photo delete failed", e);}}
        const photoFile = dataURLtoFile(values.recentPhotographWebcamDataUrl, `webcam_photo_${Date.now()}.jpg`);
        updatedUserData.photoUrl = await uploadFile(photoFile, `userFiles/${user.phone}/photo/${photoFile.name}`);
      }

      if (values.aadhaarCard) {
        if(user.aadhaarCardUrl) {try { await deleteObject(storageRef(storage, user.aadhaarCardUrl));} catch(e) {console.warn("Old aadhaar delete failed", e);}}
        updatedUserData.aadhaarCardUrl = await uploadFile(values.aadhaarCard, `userFiles/${user.phone}/aadhaar/${values.aadhaarCard.name}`);
      }
      if (values.panCard) {
         if(user.panCardUrl) {try { await deleteObject(storageRef(storage, user.panCardUrl));} catch(e) {console.warn("Old PAN delete failed", e);}}
        updatedUserData.panCardUrl = await uploadFile(values.panCard, `userFiles/${user.phone}/pan/${values.panCard.name}`);
      }

      const userDocRef = doc(db, "users", userId);
      await updateDoc(userDocRef, updatedUserData);
      toast({ title: "User Updated", description: `${values.fullname}'s details updated successfully.` });
      setIsEditing(false);
      fetchUserDetailsAndTransactions(); 
    } catch (error) {
      console.error("User update error:", error);
      toast({ title: "Error", description: `Could not update user. ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const toggleTransactionRowExpansion = (transactionKey: string) => {
    setExpandedTransactionRows(prev => ({ ...prev, [transactionKey]: !prev[transactionKey] }));
  };

  const handleDownloadPdfTransactions = () => {
    if (!user || filteredUserTransactions.length === 0) {
      toast({ title: "Not Available", description: "No transaction data to download.", variant: "default"});
      return;
    }
    const doc = new jsPDF();
    const formatCurrencyPdf = (amount: number | null | undefined) => {
      if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
      return `Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const tableColumn = ["S.No", "Date & Time", "From", "To", "Type", "Amount", "Mode", "Remarks/Source", "Virtual ID"];
    const tableRows: any[][] = [];

    filteredUserTransactions.forEach((tx, index) => {
      const txData = [
        index + 1,
        formatDateTimeSafe(tx.dateTime, "dd MMM yy, hh:mm a"),
        tx.fromParty,
        tx.toParty,
        tx.type,
        formatCurrencyPdf(tx.amount),
        tx.mode || "N/A",
        tx.remarksOrSource || "N/A",
        tx.virtualTransactionId || "N/A",
      ];
      tableRows.push(txData);
    });

    const filterLabel: Record<TransactionFilterType, string> = {
        all: "All Time",
        last7Days: "Last 7 Days",
        last10Days: "Last 10 Days",
        last30Days: "Last 30 Days"
    };

    doc.setFontSize(18);
    doc.text(`Payment History - ${user.fullname}`, 14, 15);
    doc.setFontSize(12);
    doc.text(`Filter: ${filterLabel[selectedTransactionFilter]}`, 14, 22);
    doc.text(`Generated on: ${format(new Date(), "dd MMM yyyy, hh:mm a")}`, 14, 29);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [30, 144, 255] },
      styles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 8 }, 1: { cellWidth: 25 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 'auto' },
        4: { cellWidth: 20 }, 5: { cellWidth: 20, halign: 'right' }, 6: { cellWidth: 15 },
        7: { cellWidth: 'auto' }, 8: { cellWidth: 18 }
      },
    });
    doc.save(`payment_history_${user.username}_${selectedTransactionFilter}.pdf`);
  };


  const today = new Date();
  const hundredYearsAgo = subYears(today, 100);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">Loading user details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 text-center">
        <Card className="max-w-md mx-auto shadow-lg">
          <CardHeader><CardTitle className="text-destructive flex items-center justify-center"><AlertTriangle className="mr-2 h-6 w-6" /> Error</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => router.push("/admin/users")} className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Back to All Users</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
        <div className="container mx-auto py-8 text-center">
            <Card className="max-w-md mx-auto shadow-lg">
            <CardHeader><CardTitle className="text-amber-600 flex items-center justify-center"><AlertTriangle className="mr-2 h-6 w-6" /> Data Issue</CardTitle></CardHeader>
            <CardContent>
                <p className="text-muted-foreground">User data not available.</p>
                <Button onClick={() => router.push("/admin/users")} className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Back to All Users</Button>
            </CardContent>
            </Card>
        </div>
    );
  }

  const isAdminUser = user?.isAdmin || user?.username === 'admin';


  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={() => isEditing ? setIsEditing(false) : router.push("/admin/users")} className="mb-6"><ArrowLeft className="mr-2 h-4 w-4" /> {isEditing ? "Cancel Edit" : "Back to All Users"}</Button>
        <div className="flex gap-2 mb-6">
          <Button 
            asChild 
            variant="destructive" 
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Link href={`/admin/collection/record?userId=${user.id}&fullname=${encodeURIComponent(user.fullname)}&username=${encodeURIComponent(user.username)}`}>
              <ArchiveRestore className="mr-2 h-4 w-4" /> Record Collection
            </Link>
          </Button>
          {!isEditing && (
            <Button onClick={() => setIsEditing(true)}><Edit3 className="mr-2 h-4 w-4" /> Edit User</Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <Card className="shadow-xl w-full max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-foreground">Edit User: {user.fullname}</CardTitle>
            <CardDescription>Modify the user's details below.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField control={form.control} name="fullname" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="dob" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date of Birth</FormLabel>
                      <Popover><PopoverTrigger asChild><FormControl>
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal",!field.value && "text-muted-foreground")}>
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                            </Button></FormControl></PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" captionLayout="dropdown-buttons" selected={field.value} onSelect={field.onChange} fromDate={hundredYearsAgo} toDate={today} disabled={(date) => date > new Date() || date < hundredYearsAgo} defaultMonth={field.value ? field.value : subYears(new Date(), 18)} initialFocus />
                        </PopoverContent>
                      </Popover><FormMessage />
                    </FormItem>)} />
                </div>
                <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>New Password (optional)</FormLabel><FormControl><Input type="password" placeholder="Leave blank to keep current password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>User's Address</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                
                <Separator />
                <div className="space-y-2">
                    <h3 className="text-lg font-medium text-foreground flex items-center"><Contact className="mr-2 h-5 w-5 text-primary"/>Referral Source Details (Optional)</h3>
                    <FormField control={form.control} name="referralSourceName" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Referral Source Name</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField control={form.control} name="referralSourcePhone" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Referral Source Phone</FormLabel>
                        <FormControl><Input type="tel" {...field} value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField control={form.control} name="referralSourceAddress" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Referral Source Address</FormLabel>
                        <FormControl><Textarea {...field} value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                <Separator />

                <div className="grid md:grid-cols-2 gap-6">
                     <FormField control={form.control} name="dueType" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Due Type (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select due type" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="Day">Day</SelectItem>
                                    <SelectItem value="Week">Week</SelectItem>
                                    <SelectItem value="Month">Month</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                    />
                     <FormField control={form.control} name="dueAmount" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Due Amount (₹)</FormLabel>
                        <FormControl>
                            <Input
                            type="number"
                            placeholder="e.g., 5000"
                            {...field}
                            value={field.value ?? ""}
                            onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                            />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-lg">Update Documents (Optional)</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <FormField control={form.control} name="aadhaarCard" render={({ field: { onChange, onBlur, name, ref }}) => (
                      <FormItem><FormLabel>Aadhaar Card (Upload new to replace)</FormLabel>
                        {user.aadhaarCardUrl && <p className="text-xs text-muted-foreground">Current: <a href={user.aadhaarCardUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View Document</a></p>}
                        <FormControl><Input type="file" 
                            onChange={(e) => { 
                                const file = e.target.files?.[0]; 
                                onChange(file ?? null); 
                            }} 
                            onBlur={onBlur} name={name} ref={ref}
                            accept=".pdf,image/jpeg,image/png" /></FormControl><FormMessage />
                      </FormItem>)} />
                    <FormField control={form.control} name="panCard" render={({ field: { onChange, onBlur, name, ref }}) => (
                      <FormItem><FormLabel>PAN Card (Upload new to replace)</FormLabel>
                         {user.panCardUrl && <p className="text-xs text-muted-foreground">Current: <a href={user.panCardUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View Document</a></p>}
                        <FormControl><Input type="file" 
                            onChange={(e) => { 
                                const file = e.target.files?.[0]; 
                                onChange(file ?? null); 
                            }} 
                            onBlur={onBlur} name={name} ref={ref}
                            accept=".pdf,image/jpeg,image/png" /></FormControl><FormMessage />
                      </FormItem>)} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-lg">Update Photograph (Optional)</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                     { (capturedImage || user.photoUrl) && !showCamera && (
                        <div className="mb-2">
                          <FormLabel>Current/Captured Photograph:</FormLabel>
                          <Image src={capturedImage || user.photoUrl!} alt="User photo" width={150} height={150} className="rounded-md border mt-1" data-ai-hint="user profile"/>
                        </div>
                      )}
                    {!showCamera && (
                      <>
                        <FormField control={form.control} name="recentPhotographFile" render={({ field: { onChange, onBlur, name, ref }}) => (<FormItem><FormLabel>Upload New Photo</FormLabel>
                            <FormControl><Input type="file"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                onChange(file || null);
                                if(file) {
                                  form.setValue("recentPhotographWebcamDataUrl", null);
                                  setCapturedImage(URL.createObjectURL(file));
                                } else {
                                  setCapturedImage(user.photoUrl || null);
                                }
                              }}
                              onBlur={onBlur} name={name} ref={ref}
                              accept="image/jpeg,image/png" /></FormControl><FormMessage />
                          </FormItem>)} />
                        <div className="text-center my-2 text-sm text-muted-foreground">OR</div>
                        <Button type="button" variant="outline" className="w-full" onClick={() => {setShowCamera(true); setCapturedImage(null); form.setValue("recentPhotographFile", null); requestCameraPermission(); }}><Camera className="mr-2 h-4 w-4" /> Capture with Webcam</Button>
                      </>
                    )}
                    {showCamera && hasCameraPermission === false && <Alert variant="destructive"><AlertTitle>Camera Access Denied</AlertTitle><AlertDescriptionUI>Please enable camera permissions.</AlertDescriptionUI></Alert>}

                    <video ref={videoRef} className={cn("w-full aspect-video rounded-md border bg-muted", { 'hidden': !showCamera || hasCameraPermission !== true })} autoPlay playsInline muted />

                    {showCamera && hasCameraPermission === true && (
                      <div className="space-y-2">
                        <Button type="button" className="w-full" onClick={handleCapturePhoto}><ImageIconLucide className="mr-2 h-4 w-4" /> Capture Photo</Button>
                        <Button type="button" variant="ghost" className="w-full" onClick={() => {
                            setShowCamera(false);
                            setCapturedImage(user.photoUrl || null);
                            if (videoRef.current && videoRef.current.srcObject) {
                                (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
                                videoRef.current.srcObject = null;
                                setHasCameraPermission(null);
                            }
                            }}>Cancel Webcam</Button>
                      </div>
                    )}
                     {capturedImage && !showCamera && (
                       <Button type="button" variant="outline" onClick={handleRetake} className="w-full"><RefreshCw className="mr-2 h-4 w-4" /> Retake Photo</Button>
                     )}
                    <canvas ref={canvasRef} className="hidden"></canvas>
                  </CardContent>
                </Card>

                <FormField control={form.control} name="isAdmin" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <div className="space-y-1 leading-none"><FormLabel>Administrator?</FormLabel><FormDescription>Grants full access to admin panel.</FormDescription></div>
                    </FormItem>)} />
                <div className="flex gap-4">
                  <Button type="button" variant="outline" onClick={() => {setIsEditing(false); fetchUserDetailsAndTransactions();}} disabled={isSubmitting}><XCircle className="mr-2 h-4 w-4" />Cancel</Button>
                  <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 flex-grow" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<Save className="mr-2 h-4 w-4" /> Save Changes</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : (
        <>
        <Card className="shadow-xl overflow-hidden">
          <CardHeader className="bg-secondary/50 p-6 border-b">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {(user?.photoUrl) && (<Image src={user.photoUrl} alt={`${user.fullname}'s photo`} width={100} height={100} className="rounded-full border-4 border-card object-cover" data-ai-hint="user profile"/>)}
              <div className="flex-grow">
                <CardTitle className="text-3xl font-bold text-foreground flex items-center">
                  {user.fullname} {isAdminUser && <Badge variant="destructive" className="ml-3"><Shield className="mr-1 h-4 w-4"/>Admin</Badge>}
                </CardTitle>
                <CardDescription>@{user.username} (User ID: {user.id})</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <section>
              <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><Info className="mr-2 h-5 w-5" />Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div className="flex items-start"><Phone className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Phone:</strong> {user.phone}</div></div>
                <div className="flex items-start"><CalendarDays className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Date of Birth:</strong> {formatDateSafe(user.dob, "dd MMMM yyyy")}</div></div>
                <div className="flex items-start col-span-1 md:col-span-2"><HomeIcon className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Address:</strong> {user.address || "N/A"}</div></div>
                <div className="flex items-start"><ClockIcon className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Due Type:</strong> {user.dueType || "N/A"}</div></div>
              </div>
            </section>
            <Separator />
             <section>
              <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><Contact className="mr-2 h-5 w-5 text-primary"/>Referral Source Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div className="flex items-start"><UserIconLucide className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Name:</strong> {user.referralSourceName || "N/A"}</div></div>
                <div className="flex items-start"><Phone className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Phone:</strong> {user.referralSourcePhone || "N/A"}</div></div>
                <div className="flex items-start col-span-1 md:col-span-2"><HomeIcon className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Address:</strong> {user.referralSourceAddress || "N/A"}</div></div>
              </div>
            </section>
            <Separator />
             <section>
              <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><DollarSign className="mr-2 h-5 w-5" />Financial Information</h3>
              <div className="space-y-3 text-sm">
                 <div className="flex items-center"><strong className="text-foreground w-28">Due Amount:</strong>{user.dueAmount !== undefined && user.dueAmount !== null ? formatCurrency(user.dueAmount) : "N/A"}</div>
              </div>
            </section>
            <Separator />
            <section>
              <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><FileText className="mr-2 h-5 w-5" />Uploaded Documents</h3>
              <div className="space-y-3 text-sm">
                {user.aadhaarCardUrl ? (<div className="flex items-center"><strong className="text-foreground w-28">Aadhaar Card:</strong><Button variant="link" asChild className="p-0 h-auto"><a href={user.aadhaarCardUrl} target="_blank" rel="noopener noreferrer">View Document</a></Button></div>) : <p className="text-muted-foreground">Aadhaar Card: Not Uploaded</p>}
                {user.panCardUrl ? (<div className="flex items-center"><strong className="text-foreground w-28">PAN Card:</strong><Button variant="link" asChild className="p-0 h-auto"><a href={user.panCardUrl} target="_blank" rel="noopener noreferrer">View Document</a></Button></div>) : <p className="text-muted-foreground">PAN Card: Not Uploaded</p>}
                {user.photoUrl ? (<div className="flex items-center"><strong className="text-foreground w-28">Recent Photograph:</strong><Button variant="link" asChild className="p-0 h-auto"><a href={user.photoUrl} target="_blank" rel="noopener noreferrer">View Photo</a></Button></div>) : <p className="text-muted-foreground">Recent Photograph: Not Uploaded</p>}
              </div>
            </section>
            <Separator />
             <section>
              <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><GroupIcon className="mr-2 h-5 w-5" />Joined Groups ({userGroups.length})</h3>
              {userGroups.length > 0 ? (
                <div className="space-y-4">
                  {userGroups.map(group => (
                    <Card key={group.id} className="bg-secondary/30 shadow-sm">
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-md font-semibold">
                          <Link href={`/admin/groups/${group.id}`} className="text-primary hover:underline">
                            {group.groupName}
                          </Link>
                        </CardTitle>
                        <CardDescription>Group ID: {group.id}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">This user has not joined any groups yet.</p>
              )}
            </section>
            <Separator />
            <section ref={dueSheetRef}>
              <Card className="shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Sheet className="mr-2 h-6 w-6 text-primary" />
                    <CardTitle className="text-xl font-bold text-foreground">Due Sheet</CardTitle>
                  </div>
                  <CardDescription>Detailed breakdown of dues for this user.</CardDescription>
                </CardHeader>
                <CardContent>
                {loadingDueSheet ? (
                     <div className="flex items-center justify-center py-4">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        <span>Loading due sheet...</span>
                    </div>
                ) : dueSheetItems.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No due items found for this user.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Due No</TableHead>
                          <TableHead>Group</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead className="text-right">Amount (₹)</TableHead>
                          <TableHead className="text-right">Penalty (₹)</TableHead>
                          <TableHead className="text-right">Paid (₹)</TableHead>
                          <TableHead className="text-right">Balance (₹)</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dueSheetItems.map((item, index) => (
                          <TableRow key={`${item.auctionId}-${item.dueNo}-${index}`}>
                            <TableCell>{item.dueNo}</TableCell>
                            <TableCell>{item.groupName}</TableCell>
                            <TableCell>{item.dueDate}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.penalty)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.paidAmount)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.balance)}</TableCell>
                            <TableCell>
                              <Badge variant={item.status === 'Paid' ? 'default' : (item.status === 'Partially Paid' ? 'secondary' : 'destructive')}
                                     className={cn(item.status === 'Paid' ? 'bg-green-600 hover:bg-green-700' : item.status === 'Partially Paid' ? 'bg-yellow-500 hover:bg-yellow-600' : '')}>
                                {item.status}
                                {item.status === 'Paid' && item.paidDateTime && (
                                  <span className="ml-1 text-xs opacity-80">({item.paidDateTime})</span>
                                )}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                </CardContent>
              </Card>
            </section>
            <Separator />
            <section>
              <Card className="shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div className="flex items-center gap-3">
                        <ReceiptText className="mr-2 h-6 w-6 text-primary" />
                        <CardTitle className="text-xl font-bold text-foreground">Payment History</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Filter className="mr-2 h-4 w-4" /> Filter by Date</Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Filter by Date</DropdownMenuLabel><DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setSelectedTransactionFilter("all")}>All Time</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setSelectedTransactionFilter("last7Days")}>Last 7 Days</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setSelectedTransactionFilter("last10Days")}>Last 10 Days</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setSelectedTransactionFilter("last30Days")}>Last 30 Days</DropdownMenuItem>
                        </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="outline" size="sm" onClick={handleDownloadPdfTransactions} disabled={filteredUserTransactions.length === 0}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loadingTransactions && (
                        <div className="flex justify-center items-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="ml-3 text-muted-foreground">Loading payment history...</p>
                        </div>
                    )}
                    {!loadingTransactions && transactionError && (
                        <div className="text-center py-10 text-destructive">
                            <AlertTriangle className="mx-auto h-10 w-10 mb-2" />
                            <p>{transactionError}</p>
                        </div>
                    )}
                    {!loadingTransactions && !transactionError && filteredUserTransactions.length === 0 && (<p className="text-muted-foreground text-center py-10">{`No payment history found for this user ${selectedTransactionFilter !== 'all' ? `in the selected period` : ''}`}.</p>)}
                    {!loadingTransactions && !transactionError && filteredUserTransactions.length > 0 && (
                    <div className="overflow-x-auto rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>S.No</TableHead>
                                    <TableHead>Date & Time</TableHead>
                                    <TableHead>From</TableHead>
                                    <TableHead>To</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="text-right">Amount (₹)</TableHead>
                                    <TableHead>Mode</TableHead>
                                    <TableHead>Remarks/Source</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                            {filteredUserTransactions.map((tx, index) => {
                                const transactionKey = tx.id + tx.originalSource;
                                const isExpanded = expandedTransactionRows[transactionKey];
                                return (
                                <React.Fragment key={transactionKey}>
                                    <TableRow>
                                    <TableCell>
                                        <div className="flex items-center">
                                        <Button variant="ghost" size="sm" onClick={() => toggleTransactionRowExpansion(transactionKey)} className="mr-1 p-1 h-auto">
                                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        </Button>
                                        {index + 1}
                                        </div>
                                        {isExpanded && (<div className="pl-7 mt-1 text-xs text-muted-foreground">Virtual ID: {tx.virtualTransactionId || "N/A"}</div>)}
                                    </TableCell>
                                    <TableCell>{formatDateTimeSafe(tx.dateTime, "dd MMM yy, hh:mm a")}</TableCell>
                                    <TableCell className="max-w-[150px]">{tx.fromParty}</TableCell>
                                    <TableCell className="max-w-[150px]">{tx.toParty}</TableCell>
                                    <TableCell>
                                        <span className={cn("font-semibold px-2 py-1 rounded-full text-xs", tx.type === "Sent by User" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300")}>
                                        {tx.type}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(tx.amount)}</TableCell>
                                    <TableCell>{tx.mode || "N/A"}</TableCell>
                                    <TableCell className="max-w-[200px]">{tx.remarksOrSource || "N/A"}</TableCell>
                                    </TableRow>
                                </React.Fragment>
                                );
                            })}
                            </TableBody>
                        </Table>
                    </div>
                    )}
                </CardContent>
              </Card>
            </section>
          </CardContent>
        </Card>
        </>
      )}
    </div>
  );
}

    