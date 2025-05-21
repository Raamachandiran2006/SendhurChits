
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, Camera, RefreshCw, Image as ImageIconLucide, UserPlus, Briefcase } from "lucide-react"; // Changed ImageIcon to ImageIconLucide
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertTitle, AlertDescription as AlertDescriptionUI } from "@/components/ui/alert"; // Renamed AlertDescription
import { cn } from "@/lib/utils";
import { format, subYears } from "date-fns";
import { db, storage } from "@/lib/firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, getDocs, doc, setDoc, updateDoc, query, where, runTransaction } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Image from "next/image";

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"];

const imageFileSchema = z.custom<File>((val) => val instanceof File, "Image file is required")
  .refine((file) => file.size <= MAX_FILE_SIZE_BYTES, `Max file size is ${MAX_FILE_SIZE_MB}MB.`)
  .refine(
    (file) => ACCEPTED_IMAGE_TYPES.includes(file.type),
    "Only .jpg, .jpeg, .png files are accepted for images."
  );

const createEmployeeFormSchema = z.object({
  fullname: z.string().min(3, "Full name must be at least 3 characters"),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
  dob: z.date({ required_error: "Date of birth is required." }),
  password: z.string().min(6, "Password must be at least 6 characters"),
  address: z.string().min(10, "Address must be at least 10 characters"),
  aadhaarNumber: z.string().regex(/^\d{12}$/, "Aadhaar number must be 12 digits").optional().or(z.literal('')),
  panCardNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN card format").optional().or(z.literal('')),
  recentPhotographFile: imageFileSchema.nullable().optional(),
  recentPhotographWebcamDataUrl: z.string().nullable().optional(),
  role: z.string().min(2, "Role must be at least 2 characters (e.g., Agent)"),
  joiningDate: z.date({ required_error: "Joining date is required." }),
}).superRefine((data, ctx) => {
  if (!data.recentPhotographFile && !data.recentPhotographWebcamDataUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please upload or capture a recent photograph.",
      path: ["recentPhotographFile"],
    });
  }
});

type CreateEmployeeFormValues = z.infer<typeof createEmployeeFormSchema>;

export function CreateEmployeeForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showCamera, setShowCamera] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const form = useForm<CreateEmployeeFormValues>({
    resolver: zodResolver(createEmployeeFormSchema),
    defaultValues: {
      fullname: "",
      phone: "",
      password: "",
      address: "",
      aadhaarNumber: "",
      panCardNumber: "",
      recentPhotographFile: null,
      recentPhotographWebcamDataUrl: null,
      role: "",
      joiningDate: new Date(),
      dob: subYears(new Date(), 18), // Default to 18 years ago
    },
  });

  const { setValue, watch } = form;
  const watchPhotoFile = watch("recentPhotographFile");

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
       // Ensure camera is released if component unmounts while camera is active
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
        setValue("recentPhotographWebcamDataUrl", dataUrl, { shouldValidate: true });
        setValue("recentPhotographFile", null); 
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
    setCapturedImage(null);
    setValue("recentPhotographWebcamDataUrl", null);
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

  async function onSubmit(values: CreateEmployeeFormValues) {
    setIsSubmitting(true);
    try {
      const phoneQuery = query(collection(db, "employees"), where("phone", "==", values.phone));
      const phoneSnapshot = await getDocs(phoneQuery);
      if (!phoneSnapshot.empty) {
        toast({ title: "Employee Creation Failed", description: "Phone number already registered for an employee.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      let photoUrl = "";
      if (values.recentPhotographFile) {
        photoUrl = await uploadFile(values.recentPhotographFile, `employeeFiles/${values.phone}/photo/${values.recentPhotographFile.name}`);
      } else if (values.recentPhotographWebcamDataUrl) {
        const photoFile = dataURLtoFile(values.recentPhotographWebcamDataUrl, `webcam_photo_emp_${Date.now()}.jpg`);
        photoUrl = await uploadFile(photoFile, `employeeFiles/${values.phone}/photo/${photoFile.name}`);
      }
      
      const counterRef = doc(db, "metadata", "counters");
      let newEmployeeId = "";

      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let employeeCount = 0;
        if (!counterDoc.exists() || !counterDoc.data()?.employeeCount) {
          transaction.set(counterRef, { employeeCount: 1 }, { merge: true });
          employeeCount = 0;
        } else {
          employeeCount = counterDoc.data().employeeCount;
          transaction.update(counterRef, { employeeCount: employeeCount + 1 });
        }
        newEmployeeId = `EMP${String(employeeCount + 1).padStart(3, "0")}`;
      });
      
      const newEmployeeDocRef = doc(collection(db, "employees"));
      const newEmployeePayload = {
        employeeId: newEmployeeId,
        fullname: values.fullname,
        phone: values.phone,
        dob: format(values.dob, "yyyy-MM-dd"),
        password: values.password, // WARNING: Plain text password.
        address: values.address,
        aadhaarNumber: values.aadhaarNumber || "",
        panCardNumber: values.panCardNumber?.toUpperCase() || "",
        photoUrl,
        role: values.role,
        joiningDate: format(values.joiningDate, "yyyy-MM-dd"),
      };

      await setDoc(newEmployeeDocRef, newEmployeePayload);
      
      toast({ title: "Employee Created", description: `Employee ${values.fullname} created successfully with ID ${newEmployeeId}.` });
      router.push("/admin/employees");

    } catch (error) {
      console.error("Employee creation error:", error);
      toast({ title: "Error", description: "Could not create employee. " + (error as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const today = new Date();
  const hundredYearsAgo = subYears(today, 100);
  const eighteenYearsAgo = subYears(today, 18);
  const fiveYearsFuture = subYears(today, -5);

  return (
    <Card className="shadow-xl w-full max-w-2xl mx-auto my-8">
      <CardHeader>
        <div className="flex items-center gap-3">
            <Briefcase className="h-8 w-8 text-primary"/>
            <div>
                <CardTitle className="text-2xl font-bold text-foreground">Add New Employee</CardTitle>
                <CardDescription>Fill in the details to register a new employee.</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="fullname" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="e.g., Suresh Kumar" {...field} /></FormControl><FormMessage /></FormItem>)} />
            
            <div className="grid md:grid-cols-2 gap-6">
              <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number (for Login)</FormLabel><FormControl><Input type="tel" placeholder="9876543210" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="dob" render={({ field }) => (
                  <FormItem className="flex flex-col"><FormLabel>Date of Birth</FormLabel>
                    <Popover><PopoverTrigger asChild><FormControl>
                          <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal",!field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button></FormControl></PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" captionLayout="dropdown-buttons" selected={field.value} onSelect={field.onChange} fromDate={hundredYearsAgo} toDate={eighteenYearsAgo} defaultMonth={eighteenYearsAgo} initialFocus />
                      </PopoverContent>
                    </Popover><FormMessage />
                  </FormItem>)} />
            </div>
            
            <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Textarea placeholder="Enter employee's full address" {...field} /></FormControl><FormMessage /></FormItem>)} />

            <div className="grid md:grid-cols-2 gap-6">
              <FormField control={form.control} name="aadhaarNumber" render={({ field }) => (<FormItem><FormLabel>Aadhaar Number (Optional)</FormLabel><FormControl><Input placeholder="123456789012" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="panCardNumber" render={({ field }) => (<FormItem><FormLabel>PAN Card Number (Optional)</FormLabel><FormControl><Input placeholder="ABCDE1234F" {...field} className="uppercase" onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            
            <Card>
              <CardHeader><CardTitle className="text-lg">Photograph</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {!showCamera && !capturedImage && (
                  <>
                    <FormField control={form.control} name="recentPhotographFile" render={({ field: { onChange, value, ...rest }}) => (
                        <FormItem><FormLabel>Upload Photo</FormLabel>
                          <FormControl><Input type="file" onChange={(e) => { const file = e.target.files?.[0]; onChange(file || null); if (file) setValue("recentPhotographWebcamDataUrl", null);}} accept="image/jpeg,image/png" {...rest} /></FormControl>
                          {watchPhotoFile && <FormDescription className="text-xs">{watchPhotoFile.name}</FormDescription>}
                          <FormMessage />
                        </FormItem>)} />
                    <div className="text-center my-2 text-sm text-muted-foreground">OR</div>
                    <Button type="button" variant="outline" className="w-full" onClick={() => {setShowCamera(true); setCapturedImage(null); setValue("recentPhotographFile", null); }}>
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
                        if (videoRef.current && videoRef.current.srcObject) {
                            (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
                            videoRef.current.srcObject = null;
                            setHasCameraPermission(null);
                        }
                        }}>Cancel Webcam</Button>
                  </div>
                )}
                {capturedImage && !showCamera && (
                  <div className="space-y-2 items-center flex flex-col">
                    <FormLabel>Captured Photograph:</FormLabel>
                    <Image src={capturedImage} alt="Captured employee photo" width={200} height={150} className="rounded-md border" data-ai-hint="employee profile" />
                    <Button type="button" variant="outline" onClick={handleRetake}><RefreshCw className="mr-2 h-4 w-4" /> Retake Photo</Button>
                    <Button type="button" variant="outline" className="w-full" onClick={() => { setCapturedImage(null); setValue("recentPhotographWebcamDataUrl", null); }}>Use File Upload Instead</Button>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden"></canvas>
                {form.formState.errors.recentPhotographFile && !form.formState.errors.recentPhotographFile.message?.includes("Expected file, received null") && (<p className="text-sm font-medium text-destructive">{form.formState.errors.recentPhotographFile.message}</p>)}
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
                <FormField control={form.control} name="role" render={({ field }) => (<FormItem><FormLabel>Role</FormLabel><FormControl><Input placeholder="e.g., Collection Agent" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="joiningDate" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Joining Date</FormLabel>
                        <Popover><PopoverTrigger asChild><FormControl>
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal",!field.value && "text-muted-foreground")}>
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button></FormControl></PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" captionLayout="dropdown-buttons" selected={field.value} onSelect={field.onChange} fromDate={subYears(today, 5)} toDate={fiveYearsFuture} defaultMonth={today} initialFocus />
                        </PopoverContent>
                        </Popover><FormMessage />
                    </FormItem>)} />
            </div>

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <UserPlus className="mr-2 h-4 w-4" /> Add Employee
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
