
"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Employee } from "@/types";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc, query, where, getDocs, collection, deleteDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Home, 
  CalendarDays,
  Briefcase,
  FileText,
  Edit3,
  Trash2,
  CreditCard,
  UserCircle2,
  DollarSign,
  Save,
  XCircle,
  Camera,
  RefreshCw,
  Image as ImageIconLucide
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, subYears } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertTitle, AlertDescription as AlertDescriptionUI } from "@/components/ui/alert";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription as AlertDialogDescriptionRoot, // Renamed to avoid conflict
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";


const formatDateSafe = (dateString: string | Date | undefined | null, outputFormat: string = "dd MMMM yyyy"): string => {
  if (!dateString) return "N/A";
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    if (isNaN(date.getTime())) return "N/A";
    return format(date, outputFormat);
  } catch (e) {
    return "N/A";
  }
};

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"];

const optionalImageFileSchema = z.custom<File>((val) => val instanceof File, "Image file is required")
  .refine((file) => file.size <= MAX_FILE_SIZE_BYTES, `Max file size is ${MAX_FILE_SIZE_MB}MB.`)
  .refine((file) => ACCEPTED_IMAGE_TYPES.includes(file.type), "Only .jpg, .jpeg, .png files.")
  .optional()
  .nullable();

const editEmployeeFormSchema = z.object({
  fullname: z.string().min(3, "Full name must be at least 3 characters"),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
  dob: z.date({ required_error: "Date of birth is required." }),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal('')),
  address: z.string().min(10, "Address must be at least 10 characters"),
  aadhaarNumber: z.string().regex(/^\d{12}$/, "Aadhaar must be 12 digits").optional().or(z.literal('')),
  panCardNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format").optional().or(z.literal('')),
  role: z.string().min(2, "Role must be at least 2 characters"),
  joiningDate: z.date({ required_error: "Joining date is required." }),
  salary: z.coerce.number().positive("Salary must be positive").optional().nullable(),
  recentPhotographFile: optionalImageFileSchema,
  recentPhotographWebcamDataUrl: z.string().optional().nullable(),
});

type EditEmployeeFormValues = z.infer<typeof editEmployeeFormSchema>;

export default function AdminEmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const employeeDocId = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");

  const [showCamera, setShowCamera] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const form = useForm<EditEmployeeFormValues>({
    resolver: zodResolver(editEmployeeFormSchema),
    defaultValues: {},
  });

  const fetchEmployeeDetails = useCallback(async () => {
    if (!employeeDocId) {
      setError("Employee ID is missing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const employeeDocRef = doc(db, "employees", employeeDocId);
      const employeeDocSnap = await getDoc(employeeDocRef);

      if (!employeeDocSnap.exists()) {
        setError("Employee not found.");
      } else {
        const employeeData = { id: employeeDocSnap.id, ...employeeDocSnap.data() } as Employee;
        setEmployee(employeeData);
        form.reset({
          fullname: employeeData.fullname,
          phone: employeeData.phone,
          dob: employeeData.dob ? parseISO(employeeData.dob) : new Date(),
          password: '', // Keep empty, only update if filled
          address: employeeData.address,
          aadhaarNumber: employeeData.aadhaarNumber || "",
          panCardNumber: employeeData.panCardNumber || "",
          role: employeeData.role,
          joiningDate: employeeData.joiningDate ? parseISO(employeeData.joiningDate) : new Date(),
          salary: employeeData.salary ?? null,
          recentPhotographFile: null,
          recentPhotographWebcamDataUrl: null,
        });
        setCapturedImage(employeeData.photoUrl || null);
      }
    } catch (err) {
      console.error("Error fetching employee details:", err);
      setError("Failed to fetch employee details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [employeeDocId, form]);

  useEffect(() => {
    fetchEmployeeDetails();
  }, [fetchEmployeeDetails]);

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
    setCapturedImage(employee?.photoUrl || null);
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

  async function onSubmit(values: EditEmployeeFormValues) {
    if (!employee) return;
    setIsSubmitting(true);

    try {
      if (values.phone !== employee.phone) {
        const phoneQuery = query(collection(db, "employees"), where("phone", "==", values.phone));
        const phoneSnapshot = await getDocs(phoneQuery);
        if (!phoneSnapshot.empty) {
          const existingEmployee = phoneSnapshot.docs[0];
          if (existingEmployee.id !== employeeDocId) {
            toast({ title: "Update Failed", description: "Phone number already registered by another employee.", variant: "destructive" });
            setIsSubmitting(false);
            return;
          }
        }
      }

      const updatedEmployeeData: Partial<Employee> & {password?: string} = {
        fullname: values.fullname,
        phone: values.phone,
        dob: format(values.dob, "yyyy-MM-dd"),
        address: values.address,
        aadhaarNumber: values.aadhaarNumber || "",
        panCardNumber: values.panCardNumber?.toUpperCase() || "",
        role: values.role,
        joiningDate: format(values.joiningDate, "yyyy-MM-dd"),
        salary: values.salary ?? undefined,
      };

      if (values.password && values.password.length >= 6) {
        updatedEmployeeData.password = values.password;
      }

      if (values.recentPhotographFile) {
        // Delete old photo if it exists and a new one is uploaded
        if (employee.photoUrl) {
          try {
            const oldPhotoRef = storageRef(storage, employee.photoUrl);
            await deleteObject(oldPhotoRef);
          } catch (storageError) {
            console.warn("Could not delete old photo from storage:", storageError);
            // Non-critical, proceed with upload
          }
        }
        updatedEmployeeData.photoUrl = await uploadFile(values.recentPhotographFile, `employeeFiles/${employee.phone}/photo/${values.recentPhotographFile.name}`);
      } else if (values.recentPhotographWebcamDataUrl && values.recentPhotographWebcamDataUrl !== employee.photoUrl) {
         if (employee.photoUrl) {
          try {
            const oldPhotoRef = storageRef(storage, employee.photoUrl);
            await deleteObject(oldPhotoRef);
          } catch (storageError) {
             console.warn("Could not delete old photo from storage:", storageError);
          }
        }
        const photoFile = dataURLtoFile(values.recentPhotographWebcamDataUrl, `webcam_photo_emp_${Date.now()}.jpg`);
        updatedEmployeeData.photoUrl = await uploadFile(photoFile, `employeeFiles/${employee.phone}/photo/${photoFile.name}`);
      }

      const employeeDocRef = doc(db, "employees", employeeDocId);
      await updateDoc(employeeDocRef, updatedEmployeeData);

      toast({ title: "Employee Updated", description: `${values.fullname}'s details updated successfully.` });
      setIsEditing(false);
      fetchEmployeeDetails();
    } catch (error) {
      console.error("Employee update error:", error);
      toast({ title: "Error", description: "Could not update employee. " + (error as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleDeleteEmployee = async () => {
    if (!employee || deleteConfirmationText !== "delete") return;
    setIsDeleting(true);
    try {
      // Delete photo from storage if it exists
      if (employee.photoUrl) {
        try {
          const photoRef = storageRef(storage, employee.photoUrl);
          await deleteObject(photoRef);
        } catch (storageError) {
          console.warn("Could not delete employee photo from storage:", storageError);
          // Non-critical, proceed with Firestore document deletion
        }
      }
      
      const employeeDocRef = doc(db, "employees", employeeDocId);
      await deleteDoc(employeeDocRef);

      toast({
        title: "Employee Deleted",
        description: `Employee "${employee.fullname}" has been successfully deleted.`,
      });
      router.push("/admin/employees/view");
    } catch (err) {
      console.error("Error deleting employee:", err);
      toast({
        title: "Error Deleting Employee",
        description: "Failed to delete the employee. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmationText("");
    }
  };
  
  const today = new Date();
  const hundredYearsAgo = subYears(today, 100);
  const eighteenYearsAgo = subYears(today, 18);
  const fiveYearsFuture = subYears(today, -5);


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">Loading employee details...</p>
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
            <Button onClick={() => router.push("/admin/employees/view")} className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Employees</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!employee) {
    return <div className="container mx-auto py-8 text-center text-muted-foreground">Employee data not available.</div>;
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={() => isEditing ? setIsEditing(false) : router.push("/admin/employees/view")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> {isEditing ? "Cancel Edit" : "Back to All Employees"}
        </Button>
        {!isEditing && (
        <div className="flex gap-2 mb-6">
            <Button variant="outline" onClick={() => setIsEditing(true)}> 
                <Edit3 className="mr-2 h-4 w-4" /> Edit Employee
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Employee
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescriptionRoot>
                    This action cannot be undone. This will permanently delete the employee
                    <strong className="text-foreground"> {employee.fullname}</strong>. 
                    Type "delete" to confirm.
                  </AlertDialogDescriptionRoot>
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
                    onClick={handleDeleteEmployee}
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
        )}
      </div>
    
    {isEditing ? (
      <Card className="shadow-xl w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-foreground">Edit Employee: {employee.fullname}</CardTitle>
          <CardDescription>Modify the employee's details below.</CardDescription>
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
                        <Calendar mode="single" captionLayout="dropdown-buttons" selected={field.value} onSelect={field.onChange} fromDate={hundredYearsAgo} toDate={eighteenYearsAgo} defaultMonth={field.value || parseISO(employee.dob)} initialFocus />
                      </PopoverContent>
                    </Popover><FormMessage />
                  </FormItem>)} />
              </div>
              <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>New Password (optional)</FormLabel><FormControl><Input type="password" placeholder="Leave blank to keep current password" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid md:grid-cols-2 gap-6">
                <FormField control={form.control} name="aadhaarNumber" render={({ field }) => (<FormItem><FormLabel>Aadhaar Number</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="panCardNumber" render={({ field }) => (<FormItem><FormLabel>PAN Card Number</FormLabel><FormControl><Input {...field} value={field.value ?? ""} className="uppercase" onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                 <FormField control={form.control} name="role" render={({ field }) => (<FormItem><FormLabel>Role</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="joiningDate" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Joining Date</FormLabel>
                      <Popover><PopoverTrigger asChild><FormControl>
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal",!field.value && "text-muted-foreground")}>
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                            </Button></FormControl></PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" captionLayout="dropdown-buttons" selected={field.value} onSelect={field.onChange} fromDate={subYears(today, 10)} toDate={fiveYearsFuture} defaultMonth={field.value || parseISO(employee.joiningDate)} initialFocus />
                        </PopoverContent>
                      </Popover><FormMessage />
                    </FormItem>)} />
              </div>
               <FormField control={form.control} name="salary" render={({ field }) => (
                <FormItem>
                  <FormLabel>Salary (₹ Per Month - Optional)</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                      <Input 
                        type="number" 
                        placeholder="e.g., 25000" 
                        {...field} 
                        value={field.value ?? ""}
                        onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Card>
                <CardHeader><CardTitle className="text-lg">Update Photograph (Optional)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                   { (capturedImage || employee.photoUrl) && !showCamera && (
                      <div className="mb-2">
                        <FormLabel>Current/Captured Photograph:</FormLabel>
                        <Image src={capturedImage || employee.photoUrl!} alt="Employee photo" width={150} height={150} className="rounded-md border mt-1" data-ai-hint="employee profile"/>
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
                                setCapturedImage(employee.photoUrl || null);
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
                          setCapturedImage(employee.photoUrl || null);
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

              <div className="flex gap-4">
                <Button type="button" variant="outline" onClick={() => {setIsEditing(false); fetchEmployeeDetails(); /* re-fetch/reset form */}} disabled={isSubmitting}><XCircle className="mr-2 h-4 w-4" />Cancel</Button>
                <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 flex-grow" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<Save className="mr-2 h-4 w-4" /> Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    ) : (
        <Card className="shadow-xl overflow-hidden">
          <CardHeader className="bg-secondary/50 p-6 border-b">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {employee.photoUrl && (
                <Image 
                  src={employee.photoUrl} 
                  alt={`${employee.fullname}'s photo`} 
                  width={100} height={100} 
                  className="rounded-full border-4 border-card object-cover" 
                  data-ai-hint="employee profile"
                />
              )}
              <div className="flex-grow">
                <CardTitle className="text-3xl font-bold text-foreground flex items-center">
                  {employee.fullname}
                </CardTitle>
                <CardDescription>Employee ID: {employee.employeeId}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <section>
              <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><Info className="mr-2 h-5 w-5" />Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div className="flex items-start"><Phone className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Phone:</strong> {employee.phone}</div></div>
                <div className="flex items-start"><CalendarDays className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Date of Birth:</strong> {formatDateSafe(employee.dob)}</div></div>
                <div className="flex items-start col-span-1 md:col-span-2"><Home className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Address:</strong> {employee.address || "N/A"}</div></div>
              </div>
            </section>
            <Separator />
            <section>
              <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><Briefcase className="mr-2 h-5 w-5" />Employment Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div className="flex items-start"><UserCircle2 className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Role:</strong> <Badge variant="secondary">{employee.role}</Badge></div></div>
                <div className="flex items-start"><CalendarDays className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Joining Date:</strong> {formatDateSafe(employee.joiningDate)}</div></div>
                 {employee.salary !== undefined && employee.salary !== null && (
                    <div className="flex items-start"><DollarSign className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Salary:</strong> ₹{employee.salary.toLocaleString()}</div></div>
                  )}
              </div>
            </section>
             <Separator />
            <section>
              <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><FileText className="mr-2 h-5 w-5" />Identification Documents</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center"><CreditCard className="mr-2 h-4 w-4 text-muted-foreground" /> <strong className="text-foreground w-32">Aadhaar Number:</strong>{employee.aadhaarNumber || "N/A"}</div>
                <div className="flex items-center"><CreditCard className="mr-2 h-4 w-4 text-muted-foreground" /> <strong className="text-foreground w-32">PAN Card Number:</strong>{employee.panCardNumber || "N/A"}</div>
                 {employee.photoUrl ? (
                    <div className="flex items-start">
                        <UserIcon className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div>
                        <strong className="block text-foreground">Photograph:</strong>
                        <Button variant="link" asChild className="p-0 h-auto text-primary hover:underline">
                            <a href={employee.photoUrl} target="_blank" rel="noopener noreferrer">View Photograph</a>
                        </Button>
                        </div>
                    </div>
                    ) : <p className="text-muted-foreground flex items-center"><UserIcon className="mr-2 h-4 w-4 text-muted-foreground" />Photograph: Not Uploaded</p>
                }
              </div>
            </section>
          </CardContent>
        </Card>
    )}
    </div>
  );
}

    