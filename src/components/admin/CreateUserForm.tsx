
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
import { CalendarIcon, Loader2, UploadCloud, Camera, RefreshCw, Image as ImageIcon, Users, PlusCircleIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { format, subYears } from "date-fns";
import { db, storage } from "@/lib/firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, getDocs, doc, setDoc, updateDoc, query, where, runTransaction } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Image from "next/image";
// Removed: import { useLanguage } from "@/contexts/LanguageContext"; 

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"];

const fileSchema = z.custom<File>((val) => val instanceof File, "File is required")
  .refine((file) => file.size <= MAX_FILE_SIZE_BYTES, `Max file size is ${MAX_FILE_SIZE_MB}MB.`)
  .refine(
    (file) => ACCEPTED_DOCUMENT_TYPES.includes(file.type),
    "Only .pdf, .jpg, .jpeg, .png files are accepted for documents."
  );

const imageFileSchema = z.custom<File>((val) => val instanceof File, "Image file is required")
  .refine((file) => file.size <= MAX_FILE_SIZE_BYTES, `Max file size is ${MAX_FILE_SIZE_MB}MB.`)
  .refine(
    (file) => ACCEPTED_IMAGE_TYPES.includes(file.type),
    "Only .jpg, .jpeg, .png files are accepted for images."
  );

const createUserFormSchema = z.object({
  fullname: z.string().min(3, "Full name must be at least 3 characters"),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
  dob: z.date({ required_error: "Date of birth is required." }),
  password: z.string().min(6, "Password must be at least 6 characters"),
  address: z.string().min(10, "Address must be at least 10 characters"),
  referralPerson: z.string().optional(),
  aadhaarCard: fileSchema,
  panCard: fileSchema,
  recentPhotographFile: imageFileSchema.nullable().optional(),
  recentPhotographWebcamDataUrl: z.string().nullable().optional(),
  isAdmin: z.boolean().default(false).optional(),
}).superRefine((data, ctx) => {
  if (!data.recentPhotographFile && !data.recentPhotographWebcamDataUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please upload or capture a recent photograph.",
      path: ["recentPhotographFile"],
    });
  }
});

type CreateUserFormValues = z.infer<typeof createUserFormSchema>;

export function CreateUserForm() {
  // Removed: const { t } = useLanguage(); 
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showCamera, setShowCamera] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: {
      fullname: "",
      phone: "",
      password: "",
      address: "",
      referralPerson: "",
      aadhaarCard: undefined,
      panCard: undefined,
      recentPhotographFile: null,
      recentPhotographWebcamDataUrl: null,
      isAdmin: false,
    },
  });

  const { setValue, watch } = form;
  const watchAadhaar = watch("aadhaarCard");
  const watchPan = watch("panCard");
  const watchPhotoFile = watch("recentPhotographFile");

  const requestCameraPermission = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasCameraPermission(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      setHasCameraPermission(false);
    }
  }, []);

  useEffect(() => {
    if (showCamera && hasCameraPermission === null) {
      requestCameraPermission();
    }
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [showCamera, requestCameraPermission, hasCameraPermission]);

  const handleCapturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        setValue("recentPhotographWebcamDataUrl", dataUrl, { shouldValidate: true });
        setValue("recentPhotographFile", null); 
        setShowCamera(false);
         if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
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
    if (!mimeMatch) throw new Error('Invalid data URL: MIME type not found');
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const uploadFile = async (file: File, path: string): Promise<string> => {
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  };

  async function onSubmit(values: CreateUserFormValues) {
    setIsSubmitting(true);
    try {
      const phoneQuery = query(collection(db, "users"), where("phone", "==", values.phone));
      const phoneSnapshot = await getDocs(phoneQuery);
      if (!phoneSnapshot.empty) {
        // Reverted: toast({ title: t('common.error'), description: t('formsPhoneRegisteredError'), variant: "destructive" });
        toast({ title: "Error", description: "Phone number already registered.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      let aadhaarCardUrl = "";
      let panCardUrl = "";
      let photoUrl = "";

      if (values.aadhaarCard) {
        aadhaarCardUrl = await uploadFile(values.aadhaarCard, `userFiles/${values.phone}/aadhaar/${values.aadhaarCard.name}`);
      }
      if (values.panCard) {
        panCardUrl = await uploadFile(values.panCard, `userFiles/${values.phone}/pan/${values.panCard.name}`);
      }

      if (values.recentPhotographFile) {
        photoUrl = await uploadFile(values.recentPhotographFile, `userFiles/${values.phone}/photo/${values.recentPhotographFile.name}`);
      } else if (values.recentPhotographWebcamDataUrl) {
        const photoFile = dataURLtoFile(values.recentPhotographWebcamDataUrl, `webcam_photo_${Date.now()}.jpg`);
        photoUrl = await uploadFile(photoFile, `userFiles/${values.phone}/photo/${photoFile.name}`);
      }
      
      const counterRef = doc(db, "metadata", "counters");
      let newUsername = "";

      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let userCount = 0;
        if (!counterDoc.exists()) {
          transaction.set(counterRef, { userCount: 1 });
          userCount = 0;
        } else {
          userCount = counterDoc.data().userCount;
          transaction.update(counterRef, { userCount: userCount + 1 });
        }
        newUsername = `user${String(userCount + 1).padStart(3, "0")}`;
      });
      
      const newUserDocRef = doc(collection(db, "users"));
      const newUserPayload = {
        username: newUsername,
        fullname: values.fullname,
        phone: values.phone,
        dob: format(values.dob, "yyyy-MM-dd"),
        password: values.password,
        address: values.address,
        referralPerson: values.referralPerson || "",
        aadhaarCardUrl,
        panCardUrl,
        photoUrl,
        groups: [],
        isAdmin: values.isAdmin || false,
        dueAmount: 0,
      };

      await setDoc(newUserDocRef, newUserPayload);
      
      // Reverted: toast({ title: t('formsUserCreatedSuccess'), description: `${t('formsUserCreatedSuccessDesc', { fullname: values.fullname })} (Username: ${newUsername})` });
      toast({ title: "User Created", description: `User ${values.fullname} created successfully (Username: ${newUsername})` });
      router.push("/admin/users");

    } catch (error) {
      console.error("User creation error:", error);
      // Reverted: toast({ title: t('common.error'), description: t('formsUserCreateError', { error: (error as Error).message }), variant: "destructive" });
      toast({ title: "Error", description: `Could not create user. ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const today = new Date();
  const hundredYearsAgo = subYears(today, 100);

  return (
    <Card className="shadow-xl w-full max-w-2xl mx-auto my-8">
      <CardHeader>
        <div className="flex items-center gap-3">
            <PlusCircleIcon className="h-8 w-8 text-primary"/>
            <div>
                {/* Reverted: <CardTitle className="text-2xl font-bold text-foreground">{t('formsCreateUserPageTitle')}</CardTitle> */}
                <CardTitle className="text-2xl font-bold text-foreground">Create New User</CardTitle>
                {/* Reverted: <CardDescription>{t('formsCreateUserPageDescription')}</CardDescription> */}
                <CardDescription>Fill in the details to create a new user account.</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="fullname" render={({ field }) => (
                <FormItem>
                  {/* Reverted: <FormLabel>{t('formsFullNameLabel')}</FormLabel> */}
                  <FormLabel>Full Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Raamachandiran" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid md:grid-cols-2 gap-6">
              <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    {/* Reverted: <FormLabel>{t('formsPhoneLabel')}</FormLabel> */}
                    <FormLabel>Phone Number (for Login)</FormLabel>
                    <FormControl><Input type="tel" placeholder="9876543210" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="dob" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    {/* Reverted: <FormLabel>{t('formsDobLabel')}</FormLabel> */}
                    <FormLabel>Date of Birth</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild><FormControl>
                          <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {/* Reverted: {field.value ? format(field.value, "PPP") : <span>{t('formsPickADate')}</span>} */}
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button></FormControl></PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" captionLayout="dropdown-buttons" selected={field.value} onSelect={field.onChange} fromDate={hundredYearsAgo} toDate={today} disabled={(date) => date > new Date() || date < hundredYearsAgo} initialFocus/>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  {/* Reverted: <FormLabel>{t('formsPasswordLabel')}</FormLabel> */}
                  <FormLabel>Password</FormLabel>
                  <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                  {/* Reverted: <FormLabel>{t('formsAddressLabel')}</FormLabel> */}
                  <FormLabel>Address</FormLabel>
                  <FormControl><Textarea placeholder="Enter user's full address" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="referralPerson" render={({ field }) => (
                <FormItem>
                  {/* Reverted: <FormLabel>{t('formsReferralPersonLabel')}</FormLabel> */}
                  <FormLabel>Referral Person (Optional)</FormLabel>
                  <FormControl><Input placeholder="Name of person who referred this user" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Card>
              <CardHeader>
                {/* Reverted: <CardTitle className="text-lg">{t('formsDocumentUploadsTitle')}</CardTitle> */}
                <CardTitle className="text-lg">Document Uploads</CardTitle>
                {/* Reverted: <CardDescription>{t('formsDocumentUploadsDescription', { MAX_FILE_SIZE_MB: MAX_FILE_SIZE_MB })}</CardDescription> */}
                <CardDescription>Please upload PDF or image files (max {MAX_FILE_SIZE_MB}MB each).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="aadhaarCard" render={({ field: { onChange, value, ...rest }}) => (
                    <FormItem>
                      {/* Reverted: <FormLabel>{t('formsAadhaarCardLabel')}</FormLabel> */}
                      <FormLabel>Aadhaar Card</FormLabel>
                      <FormControl><Input type="file" onChange={(e) => onChange(e.target.files?.[0])} accept=".pdf,image/jpeg,image/png" {...rest} /></FormControl>
                      {watchAadhaar && <FormDescription className="text-xs">{watchAadhaar.name}</FormDescription>}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="panCard" render={({ field: { onChange, value, ...rest }}) => (
                    <FormItem>
                      {/* Reverted: <FormLabel>{t('formsPanCardLabel')}</FormLabel> */}
                      <FormLabel>PAN Card</FormLabel>
                      <FormControl><Input type="file" onChange={(e) => onChange(e.target.files?.[0])} accept=".pdf,image/jpeg,image/png" {...rest} /></FormControl>
                      {watchPan && <FormDescription className="text-xs">{watchPan.name}</FormDescription>}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                {/* Reverted: <CardTitle className="text-lg">{t('formsRecentPhotographLabel')}</CardTitle> */}
                <CardTitle className="text-lg">Recent Photograph</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!showCamera && !capturedImage && (
                  <>
                    <FormField control={form.control} name="recentPhotographFile" render={({ field: { onChange, value, ...rest }}) => (
                        <FormItem>
                          {/* Reverted: <FormLabel>{t('formsUploadPhotoLabel')}</FormLabel> */}
                          <FormLabel>Upload Photo</FormLabel>
                          <FormControl><Input type="file" onChange={(e) => { const file = e.target.files?.[0]; onChange(file || null); if (file) setValue("recentPhotographWebcamDataUrl", null);}} accept="image/jpeg,image/png" {...rest} /></FormControl>
                          {watchPhotoFile && <FormDescription className="text-xs">{watchPhotoFile.name}</FormDescription>}
                          <FormMessage />
                        </FormItem>)} />
                    <div className="text-center my-2 text-sm text-muted-foreground">OR</div>
                    {/* Reverted: <Button type="button" variant="outline" className="w-full" onClick={() => {setShowCamera(true); setCapturedImage(null); setValue("recentPhotographFile", null); requestCameraPermission(); }}><Camera className="mr-2 h-4 w-4" /> {t('formsCaptureWithWebcamButton')}</Button> */}
                    <Button type="button" variant="outline" className="w-full" onClick={() => {setShowCamera(true); setCapturedImage(null); setValue("recentPhotographFile", null); requestCameraPermission(); }}><Camera className="mr-2 h-4 w-4" /> Capture with Webcam</Button>
                  </>
                )}

                {/* Reverted: {showCamera && hasCameraPermission === false && (<Alert variant="destructive"><AlertTitle>{t('formsCameraAccessDenied')}</AlertTitle><AlertDescription>{t('formsCameraAccessDeniedDesc')}</AlertDescription></Alert>)} */}
                {showCamera && hasCameraPermission === false && (<Alert variant="destructive"><AlertTitle>Camera Access Denied</AlertTitle><AlertDescription>Please enable camera permissions in your browser settings.</AlertDescription></Alert>)}
                {showCamera && hasCameraPermission && (
                  <div className="space-y-2">
                    <video ref={videoRef} className="w-full aspect-video rounded-md border bg-muted" autoPlay playsInline muted />
                    {/* Reverted: <Button type="button" className="w-full" onClick={handleCapturePhoto}><ImageIcon className="mr-2 h-4 w-4" /> {t('formsCapturePhotoButton')}</Button> */}
                    <Button type="button" className="w-full" onClick={handleCapturePhoto}><ImageIcon className="mr-2 h-4 w-4" /> Capture Photo</Button>
                    {/* Reverted: <Button type="button" variant="ghost" className="w-full" onClick={() => setShowCamera(false)}>{t('formsCancelWebcamButton')}</Button> */}
                    <Button type="button" variant="ghost" className="w-full" onClick={() => setShowCamera(false)}>Cancel Webcam</Button>
                  </div>
                )}
                
                {capturedImage && !showCamera && (
                  <div className="space-y-2 items-center flex flex-col">
                    {/* Reverted: <FormLabel>{t('adminUserDetailPhotoCurrentCaptured')}</FormLabel> */}
                    <FormLabel>Captured Photograph:</FormLabel>
                    <Image src={capturedImage} alt="Captured photo" width={200} height={150} className="rounded-md border" data-ai-hint="user profile"/>
                    {/* Reverted: <Button type="button" variant="outline" onClick={handleRetake}><RefreshCw className="mr-2 h-4 w-4" /> {t('adminUserDetailPhotoRetake')}</Button> */}
                    <Button type="button" variant="outline" onClick={handleRetake}><RefreshCw className="mr-2 h-4 w-4" /> Retake Photo</Button>
                     {/* Reverted: <Button type="button" variant="outline" className="w-full" onClick={() => { setCapturedImage(null); setValue("recentPhotographWebcamDataUrl", null); }}>{t('adminUserDetailPhotoUseFileUpload')}</Button> */}
                     <Button type="button" variant="outline" className="w-full" onClick={() => { setCapturedImage(null); setValue("recentPhotographWebcamDataUrl", null); }}>Use File Upload Instead</Button>
                  </div>
                )}
                 <canvas ref={canvasRef} className="hidden"></canvas>
                 {form.formState.errors.recentPhotographFile && !form.formState.errors.recentPhotographFile.message?.includes("Expected file, received null") && (
                    <p className="text-sm font-medium text-destructive">{form.formState.errors.recentPhotographFile.message}</p>
                 )}
              </CardContent>
            </Card>

            <FormField control={form.control} name="isAdmin" render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange}/></FormControl>
                  <div className="space-y-1 leading-none">
                    {/* Reverted: <FormLabel>{t('formsIsAdminLabel')}</FormLabel> */}
                    <FormLabel>Administrator?</FormLabel>
                    {/* Reverted: <FormDescription>{t('formsIsAdminDescription')}</FormDescription> */}
                    <FormDescription>Grants full access to admin panel.</FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {/* Reverted: <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t('formsCreateUserButton')}</Button> */}
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create User</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
