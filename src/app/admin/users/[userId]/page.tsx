
"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { User, Group } from "@/types";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, documentId, getDocs, updateDoc, runTransaction } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { 
  Loader2, 
  ArrowLeft, 
  User as UserIcon, 
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
  Image as ImageIconLucide, // Renamed to avoid conflict with next/image
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, subYears, parseISO } from "date-fns";
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
import { Alert, AlertTitle, AlertDescription as AlertDescriptionUI } from "@/components/ui/alert"; // Renamed AlertDescription to avoid conflict

// Helper function to format date safely
const formatDateSafe = (dateString: string | Date | undefined | null): string => {
  if (!dateString) return "N/A";
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    if (isNaN(date.getTime())) return "N/A";
    return format(date, "dd MMMM yyyy");
  } catch (e) {
    return "N/A";
  }
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
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal('')), // Optional, if empty, don't change
  address: z.string().min(10, "Address must be at least 10 characters"),
  referralPerson: z.string().optional(),
  aadhaarCard: optionalFileSchema,
  panCard: optionalFileSchema,
  recentPhotographFile: optionalImageFileSchema,
  recentPhotographWebcamDataUrl: z.string().optional().nullable(),
  isAdmin: z.boolean().default(false).optional(),
});

type EditUserFormValues = z.infer<typeof editUserFormSchema>;

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

  const [showCamera, setShowCamera] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);


  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: {},
  });

  const fetchUserDetails = useCallback(async () => {
    if (!userId) {
      setError("User ID is missing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        setError("User not found.");
        setLoading(false);
        return;
      }
      const userData = { id: userDocSnap.id, ...userDocSnap.data() } as User;
      setUser(userData);

      // Reset form with fetched user data
      form.reset({
        fullname: userData.fullname,
        phone: userData.phone,
        dob: userData.dob ? parseISO(userData.dob) : new Date(),
        password: '', // Password field empty by default for editing
        address: userData.address,
        referralPerson: userData.referralPerson || "",
        isAdmin: userData.isAdmin || false,
        aadhaarCard: null, // File fields reset for new uploads
        panCard: null,
        recentPhotographFile: null,
        recentPhotographWebcamDataUrl: null,
      });
      setCapturedImage(userData.photoUrl || null);


      if (userData.groups && userData.groups.length > 0) {
        const groupsRef = collection(db, "groups");
        // Firestore 'in' query supports up to 30 elements.
        const groupIds = userData.groups.slice(0, 30); 
        if (groupIds.length > 0) {
          const q = query(groupsRef, where(documentId(), "in", groupIds));
          const querySnapshot = await getDocs(q);
          const fetchedGroups = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Group));
          setUserGroups(fetchedGroups);
        } else {
          setUserGroups([]);
        }
      } else {
        setUserGroups([]);
      }
    } catch (err) {
      console.error("Error fetching user details:", err);
      setError("Failed to fetch user details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [userId, form]);

  useEffect(() => {
    fetchUserDetails();
  }, [fetchUserDetails]);

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
            videoRef.current.srcObject = null; // Explicitly nullify to release camera
            setHasCameraPermission(null); // Reset to allow re-request if needed
        }
      }
    }
  };
  
  const handleRetake = () => {
    setCapturedImage(user?.photoUrl || null); // Reset to original or null
    form.setValue("recentPhotographWebcamDataUrl", null);
    setShowCamera(true); 
    setHasCameraPermission(null); // Will trigger permission request again
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
      // Check if phone number is being changed and if the new one is already taken by another user
      if (values.phone !== user.phone) {
        const phoneQuery = query(collection(db, "users"), where("phone", "==", values.phone));
        const phoneSnapshot = await getDocs(phoneQuery);
        if (!phoneSnapshot.empty) {
          // Check if the found user is not the current user
          const existingUser = phoneSnapshot.docs[0];
          if (existingUser.id !== userId) {
            toast({ title: "Update Failed", description: "Phone number already registered by another user.", variant: "destructive" });
            setIsSubmitting(false);
            return;
          }
        }
      }

      const updatedUserData: Partial<User> = {
        fullname: values.fullname,
        phone: values.phone,
        dob: format(values.dob, "yyyy-MM-dd"),
        address: values.address,
        referralPerson: values.referralPerson || "",
        isAdmin: values.isAdmin,
      };

      // WARNING: Password update is not secure. Implement proper password hashing.
      if (values.password && values.password.length >= 6) {
        updatedUserData.password = values.password; 
      }

      if (values.aadhaarCard) {
        updatedUserData.aadhaarCardUrl = await uploadFile(values.aadhaarCard, `userFiles/${user.phone}/aadhaar/${values.aadhaarCard.name}`);
      }
      if (values.panCard) {
        updatedUserData.panCardUrl = await uploadFile(values.panCard, `userFiles/${user.phone}/pan/${values.panCard.name}`);
      }
      
      // Handle photograph update
      if (values.recentPhotographFile) {
        updatedUserData.photoUrl = await uploadFile(values.recentPhotographFile, `userFiles/${user.phone}/photo/${values.recentPhotographFile.name}`);
      } else if (values.recentPhotographWebcamDataUrl && values.recentPhotographWebcamDataUrl !== user.photoUrl) {
        const photoFile = dataURLtoFile(values.recentPhotographWebcamDataUrl, `webcam_photo_${Date.now()}.jpg`);
        updatedUserData.photoUrl = await uploadFile(photoFile, `userFiles/${user.phone}/photo/${photoFile.name}`);
      }


      const userDocRef = doc(db, "users", userId);
      await updateDoc(userDocRef, updatedUserData);

      toast({ title: "User Updated", description: `${values.fullname}'s details updated successfully.` });
      setIsEditing(false);
      fetchUserDetails(); // Re-fetch user details to show updated data
    } catch (error) {
      console.error("User update error:", error);
      toast({ title: "Error", description: "Could not update user. " + (error as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }
  
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
            <Button onClick={() => router.push("/admin/users")} className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Users</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return <div className="container mx-auto py-8 text-center text-muted-foreground">User data not available.</div>;
  }

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
        // EDIT MODE FORM
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
                          <Calendar mode="single" captionLayout="dropdown-buttons" selected={field.value} onSelect={field.onChange} fromDate={hundredYearsAgo} toDate={today} disabled={(date) => date > new Date() || date < hundredYearsAgo} initialFocus />
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
                
                <Card>
                  <CardHeader><CardTitle className="text-lg">Update Documents (Optional)</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <FormField control={form.control} name="aadhaarCard" render={({ field: { onChange, onBlur, name, ref }}) => (
                      <FormItem><FormLabel>Aadhaar Card (Upload new to replace)</FormLabel>
                        {user.aadhaarCardUrl && <p className="text-xs text-muted-foreground">Current: <a href={user.aadhaarCardUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View Aadhaar</a></p>}
                        <FormControl><Input type="file" onChange={(e) => onChange(e.target.files?.[0])} onBlur={onBlur} name={name} ref={ref} accept=".pdf,image/jpeg,image/png" /></FormControl><FormMessage />
                      </FormItem>)} />
                    <FormField control={form.control} name="panCard" render={({ field: { onChange, onBlur, name, ref }}) => (
                      <FormItem><FormLabel>PAN Card (Upload new to replace)</FormLabel>
                         {user.panCardUrl && <p className="text-xs text-muted-foreground">Current: <a href={user.panCardUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View PAN</a></p>}
                        <FormControl><Input type="file" onChange={(e) => onChange(e.target.files?.[0])} onBlur={onBlur} name={name} ref={ref} accept=".pdf,image/jpeg,image/png" /></FormControl><FormMessage />
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
                     {capturedImage && !showCamera && ( // Show retake only if an image is captured/exists and camera is now closed
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
                  <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={isSubmitting}><XCircle className="mr-2 h-4 w-4" />Cancel</Button>
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
              {(user.photoUrl) && (<Image src={user.photoUrl} alt={`${user.fullname}'s photo`} width={100} height={100} className="rounded-full border-4 border-card object-cover" data-ai-hint="user profile photo"/>)}
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
               <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><DollarSign className="mr-2 h-5 w-5" />Payment History</h3>
               <Card className="bg-secondary/30"><CardContent className="pt-6"><p className="text-sm text-muted-foreground text-center">Payment history feature is currently under development.</p></CardContent></Card>
            </section>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
