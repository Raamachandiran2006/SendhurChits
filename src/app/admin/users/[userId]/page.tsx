
"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { User, Group, CollectionRecord, PaymentRecord as AdminPaymentRecordType } from "@/types"; // Added CollectionRecord, AdminPaymentRecordType
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, documentId, getDocs, updateDoc, runTransaction, orderBy, Timestamp } from "firebase/firestore"; // Added orderBy, Timestamp
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
  Home, 
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
  ReceiptText, // Added for payment history
  Filter,      // Added for filter button
  Download,    // Added for download button
  ChevronRight, // For expandable rows
  ChevronDown   // For expandable rows
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, subYears, parseISO, subDays, isAfter } from "date-fns"; // Added subDays, isAfter
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Alert, AlertTitle, AlertDescription as AlertDescriptionUI } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Added Table components
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // Added DropdownMenu
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
  referralPerson: z.string().optional(),
  aadhaarCard: optionalFileSchema,
  panCard: optionalFileSchema,
  recentPhotographFile: optionalImageFileSchema,
  recentPhotographWebcamDataUrl: z.string().optional().nullable(),
  isAdmin: z.boolean().default(false).optional(),
  dueAmount: z.coerce.number().optional().nullable(),
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
      setError("User ID is missing.");
      setLoading(false);
      setLoadingTransactions(false);
      return;
    }
    setLoading(true); setLoadingTransactions(true);
    setError(null); setTransactionError(null);
    try {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        setError("User not found.");
        setLoading(false); setLoadingTransactions(false);
        return;
      }
      const userData = { id: userDocSnap.id, ...userDocSnap.data() } as User;
      setUser(userData);
      form.reset({ /* Form reset logic from previous version */
        fullname: userData.fullname,
        phone: userData.phone,
        dob: userData.dob ? parseISO(userData.dob) : new Date(),
        password: '', 
        address: userData.address,
        referralPerson: userData.referralPerson || "",
        isAdmin: userData.isAdmin || false,
        aadhaarCard: null, 
        panCard: null,
        recentPhotographFile: null,
        recentPhotographWebcamDataUrl: null,
        dueAmount: userData.dueAmount ?? null,
      });
      setCapturedImage(userData.photoUrl || null);

      if (userData.groups && userData.groups.length > 0) {
        const groupsRef = collection(db, "groups");
        const groupIds = userData.groups.slice(0, 30); 
        if (groupIds.length > 0) {
          const q = query(groupsRef, where(documentId(), "in", groupIds));
          const querySnapshot = await getDocs(q);
          setUserGroups(querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Group)));
        } else {
          setUserGroups([]);
        }
      } else {
        setUserGroups([]);
      }

      // Fetch transactions
      let combinedTransactions: AdminUserTransaction[] = [];
      // Collections (Sent by User)
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

      // Payments (Received by User)
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

    } catch (err) {
      console.error("Error fetching user details/transactions:", err);
      setError("Failed to fetch user details. Please try again.");
      setTransactionError("Failed to fetch payment history.");
    } finally {
      setLoading(false);
      setLoadingTransactions(false);
    }
  }, [userId, form]);

  useEffect(() => {
    fetchUserDetailsAndTransactions();
  }, [fetchUserDetailsAndTransactions]);

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
      if (showCamera && videoRef.current && videoRef.current.srcObject) { // ensure camera is released
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [showCamera, requestCameraPermission, hasCameraPermission]);

  const handleCapturePhoto = () => { /* ... same as before ... */
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
  
  const handleRetake = () => { /* ... same as before ... */
    setCapturedImage(user?.photoUrl || null);
    form.setValue("recentPhotographWebcamDataUrl", null);
    setShowCamera(true); 
    setHasCameraPermission(null);
  };

  const dataURLtoFile = (dataurl: string, filename: string): File => { /* ... same as before ... */
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) throw new Error('Invalid data URL');
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]); let n = bstr.length; const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  };

  const uploadFile = async (file: File, path: string): Promise<string> => { /* ... same as before ... */
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  };

  async function onSubmit(values: EditUserFormValues) { /* ... same as before, ensure fetchUserDetailsAndTransactions is called on success ... */
    if (!user) return;
    setIsSubmitting(true);
    try {
      if (values.phone !== user.phone) {
        const phoneQuery = query(collection(db, "users"), where("phone", "==", values.phone));
        const phoneSnapshot = await getDocs(phoneQuery);
        if (!phoneSnapshot.empty) {
          const existingUser = phoneSnapshot.docs[0];
          if (existingUser.id !== userId) {
            toast({ title: "Update Failed", description: "Phone number already registered by another user.", variant: "destructive" });
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
        referralPerson: values.referralPerson || "",
        isAdmin: values.isAdmin,
        dueAmount: values.dueAmount ?? undefined,
      };
      if (values.password && values.password.length >= 6) {
        updatedUserData.password = values.password;
      }

      let oldPhotoUrl = user.photoUrl;

      if (values.recentPhotographFile) {
        if (oldPhotoUrl) { try { await deleteObject(storageRef(storage, oldPhotoUrl)); } catch (e) { console.warn("Old photo delete failed", e);}}
        updatedUserData.photoUrl = await uploadFile(values.recentPhotographFile, `userFiles/${user.phone}/photo/${values.recentPhotographFile.name}`);
      } else if (values.recentPhotographWebcamDataUrl && values.recentPhotographWebcamDataUrl !== user.photoUrl) {
        if (oldPhotoUrl) { try { await deleteObject(storageRef(storage, oldPhotoUrl)); } catch (e) { console.warn("Old photo delete failed", e);}}
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
      fetchUserDetailsAndTransactions(); // Re-fetch all data
    } catch (error) {
      console.error("User update error:", error);
      toast({ title: "Error", description: "Could not update user. " + (error as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const toggleTransactionRowExpansion = (transactionKey: string) => {
    setExpandedTransactionRows(prev => ({ ...prev, [transactionKey]: !prev[transactionKey] }));
  };

  const handleDownloadPdfTransactions = () => {
    if (!user || filteredUserTransactions.length === 0) {
      toast({ title: "No Data", description: "No transaction data to download.", variant: "default"});
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
        formatDateTimeSafe(tx.dateTime),
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
    
    const filterLabel = { all: "All Time", last7Days: "Last 7 Days", last10Days: "Last 10 Days", last30Days: "Last 30 Days" };

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

  if (loading) { /* ... */ }
  if (error) { /* ... */ }
  if (!user) { /* ... */ }

  const isAdminUser = user.isAdmin || user.username === 'admin';

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={() => isEditing ? setIsEditing(false) : router.push("/admin/users")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> {isEditing ? "Cancel Edit" : "Back to All Users"}
        </Button>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)} className="mb-6">
            <Edit3 className="mr-2 h-4 w-4" /> Edit User
          </Button>
        )}
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
                    <FormItem className="flex flex-col"><FormLabel>Date of Birth</FormLabel>
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
                <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="referralPerson" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referral Person (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
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
                
                <Card>
                  <CardHeader><CardTitle className="text-lg">Update Documents (Optional)</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <FormField control={form.control} name="aadhaarCard" render={({ field: { onChange, onBlur, name, ref }}) => (
                      <FormItem><FormLabel>Aadhaar Card (Upload new to replace)</FormLabel>
                        {user.aadhaarCardUrl && <p className="text-xs text-muted-foreground">Current: <a href={user.aadhaarCardUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View Aadhaar</a></p>}
                        <FormControl><Input type="file" onChange={(e) => onChange(e.target.files?.[0] ?? null)} onBlur={onBlur} name={name} ref={ref} accept=".pdf,image/jpeg,image/png" /></FormControl><FormMessage />
                      </FormItem>)} />
                    <FormField control={form.control} name="panCard" render={({ field: { onChange, onBlur, name, ref }}) => (
                      <FormItem><FormLabel>PAN Card (Upload new to replace)</FormLabel>
                         {user.panCardUrl && <p className="text-xs text-muted-foreground">Current: <a href={user.panCardUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View PAN</a></p>}
                        <FormControl><Input type="file" onChange={(e) => onChange(e.target.files?.[0] ?? null)} onBlur={onBlur} name={name} ref={ref} accept=".pdf,image/jpeg,image/png" /></FormControl><FormMessage />
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
                        <FormField control={form.control} name="recentPhotographFile" render={({ field: { onChange, onBlur, name, ref }}) => (
                          <FormItem><FormLabel>Upload New Photo</FormLabel>
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
                        <Button type="button" variant="outline" className="w-full" onClick={() => {setShowCamera(true); setCapturedImage(null); form.setValue("recentPhotographFile", null); requestCameraPermission(); }}>
                          <Camera className="mr-2 h-4 w-4" /> Capture with Webcam
                        </Button>
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
                  <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 flex-grow" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<Save className="mr-2 h-4 w-4" /> Save Changes
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : (
        // VIEW MODE
        <Card className="shadow-xl overflow-hidden">
          <CardHeader className="bg-secondary/50 p-6 border-b">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {(user.photoUrl) && (<Image src={user.photoUrl} alt={`${user.fullname}'s photo`} width={100} height={100} className="rounded-full border-4 border-card object-cover" data-ai-hint="user profile"/>)}
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
                <div className="flex items-start"><CalendarDays className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Date of Birth:</strong> {formatDateSafe(user.dob)}</div></div>
                <div className="flex items-start col-span-1 md:col-span-2"><Home className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Address:</strong> {user.address || "N/A"}</div></div>
                <div className="flex items-start"><Briefcase className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Referred By:</strong> {user.referralPerson || "N/A"}</div></div>
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
                {user.photoUrl ? (<div className="flex items-center"><strong className="text-foreground w-28">Photograph:</strong><Button variant="link" asChild className="p-0 h-auto"><a href={user.photoUrl} target="_blank" rel="noopener noreferrer">View Photo</a></Button></div>) : <p className="text-muted-foreground">Photograph: Not Uploaded</p>}
              </div>
            </section>
            <Separator />
            <section>
              <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><GroupIcon className="mr-2 h-5 w-5" />Joined Groups ({userGroups.length})</h3>
              {userGroups.length > 0 ? (<ul className="list-disc list-inside space-y-1 text-sm">{userGroups.map(group => (<li key={group.id}><Link href={`/admin/groups/${group.id}`} className="text-primary hover:underline">{group.groupName}</Link><span className="text-muted-foreground text-xs ml-2">(ID: {group.id})</span></li>))}</ul>) : (<p className="text-sm text-muted-foreground">This user has not joined any groups yet.</p>)}
            </section>
            <Separator />
            <section>
              <Card className="shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div className="flex items-center gap-3">
                        <ReceiptText className="h-6 w-6 text-primary" />
                        <CardTitle className="text-xl font-bold text-foreground">Payment History</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm"><Filter className="mr-2 h-4 w-4" /> Filter</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Filter by Date</DropdownMenuLabel><DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setSelectedTransactionFilter("all")}>All Time</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setSelectedTransactionFilter("last7Days")}>Last 7 Days</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setSelectedTransactionFilter("last10Days")}>Last 10 Days</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setSelectedTransactionFilter("last30Days")}>Last 30 Days</DropdownMenuItem>
                        </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="outline" size="sm" onClick={handleDownloadPdfTransactions} disabled={filteredUserTransactions.length === 0}><Download className="mr-2 h-4 w-4" /> PDF</Button>
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
                    {!loadingTransactions && !transactionError && filteredUserTransactions.length === 0 && (
                        <p className="text-muted-foreground text-center py-10">No payment history found for this user {selectedTransactionFilter !== 'all' ? `in the selected period` : ''}.</p>
                    )}
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
                                    <TableCell>{formatDateTimeSafe(tx.dateTime)}</TableCell>
                                    <TableCell>{tx.fromParty}</TableCell>
                                    <TableCell>{tx.toParty}</TableCell>
                                    <TableCell>
                                        <span className={cn("font-semibold px-2 py-1 rounded-full text-xs",
                                            tx.type === "Sent by User" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300")}>
                                        {tx.type}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(tx.amount)}</TableCell>
                                    <TableCell>{tx.mode || "N/A"}</TableCell>
                                    <TableCell className="max-w-[200px] truncate">{tx.remarksOrSource || "N/A"}</TableCell>
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
      )}
    </div>
  );
}

    